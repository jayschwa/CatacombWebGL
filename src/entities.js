import { Object3D, PointLight, Raycaster, Sprite, Vector3 } from "three"
import { SpriteSheetProxy, textureCache } from "./utils"

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

function ancestorsAreEthereal(object) {
	for (let obj = object; obj; obj = obj.parent) {
		if (obj.isEthereal) {
			return obj.isEthereal
		}
	}
	return false
}

export class Portal extends Sprite {
	constructor(position) {
		super()
		this.name = "Portal"
		this.position.copy(position)
		this.fps = 8
		this.light = new PointLight(0x0042DD, 1, 1.5)
		this.add(this.light)

		textureCache.get("sprites/portal.png", texture => {
			this.spritesheet = new SpriteSheetProxy(texture)
			this.material.map = this.spritesheet
			this.material.needsUpdate = true
		})
	}

	update(time) {
		if (this.material.map && this.material.map.isSpriteSheet) {
			const n = Math.floor(time * this.fps) % this.material.map.frames
			this.material.map.setFrame(n)
		}
		this.light.intensity = 0.5 + 0.2 * Math.abs(Math.sin(0.5 * time)) + 0.02 * Math.abs(Math.sin(this.fps * time))
	}
}
