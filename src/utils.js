import { NearestFilter, TextureLoader } from "three"

export function SpriteSheetProxy(texture, frameWidth, frames) {
	const offset = texture.offset.clone()
	const repeat = texture.repeat.clone()
	const proxy = new Proxy(texture, {
		get: function(obj, prop) {
			switch (prop) {
				case "offset": return offset
				case "repeat": return repeat
				default: return obj[prop]
			}
		}
	})
	proxy.frameWidth = frameWidth || texture.image.height
	proxy.frames = frames || Math.floor(texture.image.width / proxy.frameWidth)
	proxy.repeat.y = Math.max(1, proxy.frameWidth / texture.image.height)
	proxy.frameUvWidth = proxy.frameWidth / texture.image.width
	proxy.isSpriteSheet = true
	proxy.setFrame = function(n) {
		if (n < 0 || n >= this.frames) {
			throw new RangeError("Invalid frame number")
		}
		this.offset.x = n * this.frameUvWidth
		this.repeat.x = this.frameUvWidth
	}
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

	load(path, ...args) {
		if (!this.stats.has(path)) {
			this.stats.set(path, {hits: 0, loaded: 0})
		}
		this.stats.get(path).loaded++
		return super.load(path, ...args)
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
