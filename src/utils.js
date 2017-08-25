import hqx from "js-hqx"
import { CanvasTexture, NearestFilter, TextureLoader } from "three"
import { HQXFactor } from "./config"

export function SpriteSheetProxy(texture, frameWidth, frames) {
	const p = {
		offset: texture.offset.clone(),
		repeat: texture.repeat.clone()
	}
	if (frameWidth && HQXFactor > 1) {
		frameWidth *= HQXFactor
	}
	p.frameWidth = frameWidth || texture.image.height
	p.frames = frames || Math.floor(texture.image.width / p.frameWidth)
	p.repeat.y = Math.max(1, p.frameWidth / texture.image.height)
	p.frameUvWidth = p.frameWidth / texture.image.width
	p.isSpriteSheet = true
	p.offsetRepeatUniform = null
	p.setFrame = function(n) {
		if (n < 0 || n >= this.frames) {
			console.log(texture.image.width)
			console.log(p.frameWidth)
			throw new RangeError(`Invalid frame number ${n} of ${this.frames}`)
		}
		this.offset.x = n * this.frameUvWidth
		this.repeat.x = this.frameUvWidth

		// Custom materials can set this property so the corresponding uniform stays synced
		if (this.offsetRepeatUniform) {
			this.offsetRepeatUniform.set(this.offset.x, this.offset.y, this.repeat.x, this.repeat.y)
		}
	}
	const proxy = new Proxy(texture, {
		get: function(obj, prop) {
			if (p.hasOwnProperty(prop)) {
				return p[prop]
			} else {
				return obj[prop]
			}
		},
		set: function(obj, prop, value) {
			if (p.hasOwnProperty(prop)) {
				p[prop] = value
			} else {
				obj[prop] = value
			}
			return true
		}
	})
	proxy.setFrame(0)
	return proxy
}

class TextureCache extends TextureLoader {
	constructor() {
		super(...arguments)
		this.cache = new Map()
		this.queued = new Map()
		this.stats = new Map()
	}

	load(path, onLoad, ...args) {
		if (!this.stats.has(path)) {
			this.stats.set(path, {hits: 0, loaded: 0})
		}
		this.stats.get(path).loaded++
		function wrappedOnLoad(texture) {
			if (HQXFactor > 1) {
				const hqxImage = hqx(texture.image, HQXFactor)
				texture.image = hqxImage
				texture.needsUpdate = true
			}
			onLoad && onLoad(texture)
		}
		return super.load(path, wrappedOnLoad, ...args)
	}

	get(path, onLoad, onProgress, onError) {
		if (this.cache.has(path)) {
			this.stats.get(path).hits++
			const texture = this.cache.get(path)
			onLoad && onLoad(texture)
			return texture
		} else if (this.queued.has(path)) {
			this.stats.get(path).hits++
			const queued = this.queued.get(path)
			queued.onLoad.push(onLoad)
			queued.onProgress.push(onProgress)
			queued.onError.push(onError)
			return queued.texture
		} else {
			const cachedTextures = this.cache
			const queuedTextures = this.queued
			const queued = {
				onLoad: [onLoad],
				onProgress: [onProgress],
				onError: [onError]
			}
			const texture = this.load(path,
				(...args) => {
					const texture = args[0]
					cachedTextures.set(path, texture)
					queuedTextures.delete(path)
					queued.onLoad.forEach(f => f && f(...args))
				},
				(...args) => {
					queued.onProgress.forEach(f => f && f(...args))
				},
				(...args) => {
					queuedTextures.delete(path)
					queued.onError.forEach(f => f && f(...args))
				})
			queued.texture = texture
			queuedTextures.set(path, queued)
			texture.magFilter = NearestFilter
			return texture
		}
	}
}

export const textureCache = new TextureCache()
