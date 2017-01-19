import { NearestFilter, Object3D, Raycaster, TextureLoader, Vector3 } from "three"

export class Entity extends Object3D {
	constructor(size, speed) {
		super()
		this.name = "Entity"
		this.up.set(0, 0, 1)

		this.size = size
		this.speed = speed || 0

		this.moveDirection = new Vector3()
		this.velocity = new Vector3()
		this.turnDirection = 0

		this.raycaster = new Raycaster()
	}

	update(time, maze) {
		const timeDelta = time - this.lastTime
		this.lastTime = time
		if (!timeDelta) { return }

		if (this.turnDirection) {
			this.rotateY(this.turnDirection * timeDelta)
			this.updateVelocity()
		}

		if (this.velocity.lengthSq()) {
			let collided = false
			const positionDelta = this.velocity.clone().multiplyScalar(timeDelta)
			do {
				collided = false
				const magnitude = positionDelta.length()
				const direction = positionDelta.clone().normalize()
				const far = this.size + magnitude
				this.raycaster.set(this.position, direction)
				this.raycaster.far = far

				let collisions = this.raycaster.intersectObject(maze, true)

				// FIXME: Three seems to have a terrible bug with sprite raytracing
				collisions = collisions.filter(c => c.face || c.object.getWorldPosition().distanceTo(this.raycaster.ray.origin) <= far)

				for (let collision of collisions) {
					if (ancestorsAreEthereal(collision.object)) {
						continue
					}
					let pushBack = true
					if (this.onCollision) {
						pushBack = this.onCollision(collision, time)
					}
					if (pushBack) {
						const normal = collision.face ? collision.face.normal : direction.clone().negate()
						const overlap = far - collision.distance
						positionDelta.addScaledVector(normal, Math.min(overlap, magnitude))
						collided = true
					}
				}
			} while(collided)

			this.position.add(positionDelta)
		}
	}

	updateVelocity() {
		this.velocity.copy(this.moveDirection).normalize().multiplyScalar(this.speed)  // velocity in object space
		this.localToWorld(this.velocity).sub(this.position)                            // velocity in world space
		return this.velocity.multiplyScalar(100).roundToZero().divideScalar(100)       // round tiny values to zero
	}
}

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
					cachedTextures.set(path, queued)
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

function ancestorsAreEthereal(object) {
	for (let obj = object; obj; obj = obj.parent) {
		if (obj.isEthereal) {
			return obj.isEthereal
		}
	}
	return false
}