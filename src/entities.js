import { Object3D, PointLight, PositionalAudio, Raycaster, Sprite, SpriteMaterial, Vector3 } from "three"
import { audioListener, audioLoader } from "./audio"
import { SpriteSheetProxy, textureCache } from "./utils"

export class Entity extends Object3D {
	constructor(props) {
		super()
		Object.keys(props).forEach(prop => {
			if (this[prop] instanceof Object && this[prop].copy) {
				this[prop].copy(props[prop])
			} else {
				this[prop] = props[prop]
			}
		})
		this.persistedProps = ["type", "position"]
		this.up.set(0, 0, 1)
	}

	/** True if the given object is identical to, or a descendant of, this entity. **/
	includes(object) {
		for (let obj = object; obj; obj = obj.parent) {
			if (obj === this) {
				return true
			}
		}
		return false
	}

	getState() {
		const state = {}
		this.persistedProps.forEach(prop => {
			if (prop in this) {
				state[prop] = this[prop]
			} else {
				console.log(this)
				throw new Error("entity does not have a `" + prop + "` property")
			}
		})
		return state
	}
}

export class Actor extends Entity {
	constructor(props, size, speed) {
		super(props)

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

		if (this.velocity.lengthSq() && !this.frozen) {
			let loops = 0
			let collided = false
			const positionDelta = this.velocity.clone().multiplyScalar(timeDelta)
			do {
				loops++
				collided = false
				const magnitude = positionDelta.length()
				const direction = positionDelta.clone().normalize()
				const far = this.size + magnitude
				this.raycaster.set(this.position, direction)
				this.raycaster.far = far

				let collisions = this.raycaster.intersectObject(maze, true)

				for (let collision of collisions) {
					if (this.includes(collision.object) || ancestorsAreEthereal(collision.object)) {
						continue
					}
					let pushBack = true
					if (this.onCollision) {
						pushBack = this.onCollision(collision, time)
					}
					if (pushBack) {
						const normal = new Vector3()
						if (collision.face) {
							normal.copy(collision.face.normal)
						} else {
							// calculate normal vector of sprite
							const objDir = collision.object.getWorldPosition().sub(collision.point)
							normal.crossVectors(direction, objDir).cross(objDir).normalize()
						}
						const pushBackDistance = Math.min(magnitude, far - collision.distance)
						if (pushBackDistance) {
							positionDelta.addScaledVector(normal, pushBackDistance)
							collided = true
						}
					}
				}
			} while(collided && loops < 4)

			if (loops >= 4) {
				console.warn("aborted collision loop after", loops, "loops")  // FIXME
			}

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
		if (obj.isEthereal || obj.shouldRemove) {
			return true
		}
	}
	return false
}

let wallHitSound = null
audioLoader.load("sounds/adlib/wall_hit.wav", buffer => wallHitSound = buffer)

export class Fireball extends Actor {
	constructor(props) {
		super(props, 0, 30)
		this.persistedProps.push("direction", "isBig")

		if (this.isBig === undefined) {
			this.isBig = true
		}

		this.scale.divideScalar(3)
		this.lookAt(this.position.clone().add(this.direction))
		this.updateMatrixWorld()
		this.moveDirection.z = 1
		this.updateVelocity()
		this.isEthereal = true

		if (wallHitSound) {
			this.hitSound = new PositionalAudio(audioListener)
			this.hitSound.setBuffer(wallHitSound)
			this.add(this.hitSound)
		}

		this.light = new PointLight(0xFF6600, 0.5, 0.5)
		if (this.isBig) { this.light.distance *= 2 }
		if (this.isBig) { this.add(this.light) }

		textureCache.get("sprites/fireball.png", texture => {
			this.spriteSheet = SpriteSheetProxy(texture)
			this.sprite = new Sprite(new SpriteMaterial({map: this.spriteSheet}))
			if (!this.isBig) {
				this.sprite.material.rotation = Math.floor(Math.random() * 4) * Math.PI / 2
			}
			this.add(this.sprite)
		})
	}

	dispose() {
		this.sprite.material.dispose()
		this.spriteSheet.dispose()
	}

	onCollision(collision, time) {
		if (!this.removeAtTime) {
			let damagedSomething = false
			for (let obj = collision.object; obj; obj = obj.parent) {
				if (obj.onDamage) {
					const damage = this.isBig ? 3 : 1
					obj.onDamage(time, damage)
					damagedSomething = true
					break
				}
			}
			if (!damagedSomething && this.hitSound) {
				this.hitSound.play()
			}
		}
		if (!this.isBig) {
			this.add(this.light)
		}
		this.removeAtTime = time + 0.075
		this.isBig = false
		this.removeAtTime += 0.075
		this.moveDirection.z = 0
		this.updateVelocity()
		this.translateZ(-0.1)
		return true
	}

	update(time, maze) {
		super.update(time, maze)
		let frame = Math.floor(time * 10) % 2
		if (this.isBig) { frame += 2 }
		if (this.spriteSheet) {
			this.spriteSheet.setFrame(frame)
		}
		if (time >= this.removeAtTime) {
			this.shouldRemove = true
		}
	}
}

export class Portal extends Entity {
	constructor(props) {
		super(props)
		this.persistedProps.push("value")
		this.fps = 8

		this.light = new PointLight(0x0042DD, 1, 1.5)
		this.add(this.light)

		textureCache.get("sprites/portal.png", texture => {
			this.spritesheet = new SpriteSheetProxy(texture)
			this.sprite = new Sprite(new SpriteMaterial({fog: true, map: this.spritesheet}))
			this.add(this.sprite)
		})
	}

	dispose() {
		this.sprite.material.dispose()
		this.spritesheet.dispose()
	}

	update(time) {
		if (this.spritesheet) {
			const n = Math.floor(time * this.fps) % this.spritesheet.frames
			this.spritesheet.setFrame(n)
		}
		this.light.intensity = 0.5 + 0.2 * Math.abs(Math.sin(0.5 * time)) + 0.02 * Math.abs(Math.sin(this.fps * time))
	}
}

export class JumpGate extends Portal {
	constructor(props) {
		super(props)
		this.destination = new Vector3().copy(props.value)
	}
}

export class WarpGate extends Portal {}
