import { Audio, NearestFilter, PerspectiveCamera, PointLight, PositionalAudio, Sprite, SpriteMaterial, Vector3 } from "three"
import { audioListener, audioLoader } from "./audio"
import { Actor, Fireball, JumpGate, WarpGate } from "./entities"
import { Door } from "./environment"
import { Item, Treasure } from "./items"
import { SpriteSheetProxy, textureCache } from "./utils"

export class Player extends Actor {
	constructor(props, game) {
		super(props, 2/3, 5)
		this.persistedProps.push("direction", "inventory")
		if (props.direction) {
			this.direction = props.direction
		}
		if (!this.inventory) {
			this.inventory = {}
		}

		this.game = game

		this.audioListener = audioListener
		this.add(this.audioListener)

		this.camera = new PerspectiveCamera(45, 0, 0.01, 256)
		this.camera.rotation.set(0, Math.PI, 0)
		this.add(this.camera)

		this.light = new PointLight(0xE55B00, 0, 0)
		this.add(this.light)

		this.score = 0

		this.footstepIdx = 0
		this.footsteps = []
		for (let i = 0; i < 2; i++) {
			audioLoader.load("sounds/adlib/footstep" + i + ".wav", buffer => {
				const footstep = new Audio(audioListener)
				footstep.setBuffer(buffer)
				footstep.setVolume(1/3)
				this.footsteps.push(footstep)
			})
		}

		textureCache.get("sprites/hand.png", texture => {
			texture.magFilter = NearestFilter
			const spritesheet = SpriteSheetProxy(texture, 88, 2)
			spritesheet.repeat.y = 88/72
			this.hand = new Sprite(new SpriteMaterial({map: spritesheet}))
			this.hand.setFrame = frame => {
				spritesheet.setFrame(frame)
				this.light.intensity = frame
			}
			this.hand.scale.divideScalar(20)
			this.hand.outPosition = new Vector3(-0.0032, -0.0165, 0.1)
			this.hand.inPosition = new Vector3(-0.0032, -0.033, 0.05)
			this.hand.position.copy(this.hand.inPosition)
			this.add(this.hand)

			const sounds = ["shoot", "big_shoot"]
			sounds.forEach(name => {
				const file = "sounds/adlib/" + name + ".wav"
				audioLoader.load(file, buffer => {
					const audio = new PositionalAudio(audioListener).setBuffer(buffer)
					const prop = name.replace("_", "") + "Sound"
					this[prop] = audio
					this.hand.add(audio)
				})
			})
		})
	}

	get direction() {
		return this.getWorldDirection(new Vector3())
	}

	set direction(vector) {
		const direction = new Vector3().copy(vector)
		const target = this.position.clone().add(direction)
		this.lookAt(target)
	}

	onCollision(collision, time) {
		for (let obj = collision.object; obj; obj = obj.parent) {
			if (obj.pickup) {
				this.pickupItem(obj)
				return false
			} else if (obj instanceof Door) {
				return !this.unlockDoor(obj)
			} else if (obj instanceof JumpGate) {
				const forward = this.velocity.clone().normalize().multiplyScalar(2/3)
				this.warpToPosition = obj.destination.clone().add(forward)
				return false
			} else if (obj instanceof WarpGate) {
				this.game.changeMap(obj.value)
			}
		}
		return true
	}

	/** Mark item for removal from scene and add to player's inventory. **/
	pickupItem(item) {
		if (item instanceof Treasure) {
			this.score += item.value
		} else {
			const name = item.type.toLowerCase()
			if (this.inventory[name] === undefined) {
				this.inventory[name] = 0
			}
			this.inventory[name] += 1
		}
		item.pickup()
	}

	/**
	 * Unlock door if player has matching key in inventory.
	 * @return {boolean} true if successful, false if player does not have matching key
	 */
	unlockDoor(door) {
		const keyName = door.color + "key"
		if (this.inventory[keyName]) {
			if (door.unlock()) {
				this.inventory[keyName] -= 1
			}
			return true
		} else {
			return false
		}
	}

	update(time, maze) {
		super.update(time, maze)
		if (this.hand) {
			this.updateHand(time)
		}
		if (this.velocity.lengthSq() && !this.frozen) {
			const delta = time - this.lastStep
			if (delta > (7 / 3) / this.speed) {
				this.footsteps[this.footstepIdx].play()
				this.footstepIdx = (this.footstepIdx + 1) % this.footsteps.length
				this.lastStep = time
			}
		} else {
			this.lastStep = time
		}
	}

	updateHand(time) {
		const handProgress = (this.hand.position.clone().sub(this.hand.inPosition).length() /
			this.hand.outPosition.clone().sub(this.hand.inPosition).length())
		if (this.chargeStarted) {
			const chargeTime = time - this.chargeStarted
			this.hand.position.lerpVectors(
				this.hand.inPosition,
				this.hand.outPosition,
				Math.min(1, Math.max(handProgress, chargeTime * 2))
			)
			const frame = Math.ceil(chargeTime * 8) % 2
			this.hand.setFrame(frame)
			this.light.distance = Math.min(1, chargeTime) * 2.5
		} else if (this.lastFire) {
			const timeDelta = time - this.lastFire
			this.hand.position.lerpVectors(
				this.hand.outPosition,
				this.hand.inPosition,
				Math.min(1, Math.max(1 - handProgress, timeDelta - 1))
			)
		}
	}

	binds() {
		return {
			ArrowUp: this.moveForward.bind(this),
			ArrowLeft: this.turnLeft.bind(this),
			ArrowDown: this.moveBackward.bind(this),
			ArrowRight: this.turnRight.bind(this),

			KeyW: this.moveForward.bind(this),
			KeyA: this.moveLeft.bind(this),
			KeyS: this.moveBackward.bind(this),
			KeyD: this.moveRight.bind(this),

			ShiftLeft: this.sprint.bind(this),

			Space: this.shoot.bind(this)
		}
	}

	updateMovement() {
		let forward = 0
		let strafe = 0
		let turn = 0
		if (this.movingForward) {
			forward += 1
		}
		if (this.movingBackward) {
			forward -= 1
		}
		if (this.movingLeft) {
			strafe += 1
		}
		if (this.movingRight) {
			strafe -= 1
		}
		if (this.turningLeft) {
			turn += 1
		}
		if (this.turningRight) {
			turn -= 1
		}
		this.moveDirection.z = forward
		this.moveDirection.x = strafe
		this.turnDirection = turn
		this.updateVelocity()
	}

	stopMovement() {
		this.movingForward = false
		this.movingBackward = false
		this.movingLeft = false
		this.movingRight = false
		this.turningLeft = false
		this.turningRight = false
		this.updateMovement()
	}

	moveForward(value) { this.movingForward = value; this.updateMovement() }
	moveBackward(value) { this.movingBackward = value; this.updateMovement() }
	moveLeft(value) { this.movingLeft = value; this.updateMovement() }
	moveRight(value) { this.movingRight = value; this.updateMovement() }
	sprint(value) { this.speed *= (value > 0) ? 2 : 0.5; this.updateVelocity() }
	turnLeft(value) { this.turningLeft = value; this.updateMovement() }
	turnRight(value) { this.turningRight = value; this.updateMovement() }
	shoot(value) {
		if (value && !this.chargeStarted) {
			this.chargeStarted = this.lastTime
			this.hand.setFrame(1)
			this.light.distance = 0
		} else if (this.chargeStarted) {
			const chargeTime = this.lastTime - this.chargeStarted
			const direction = this.getWorldDirection(new Vector3())
			const fireball = new Fireball({
				type: "Fireball",
				position: this.position.clone().addScaledVector(direction, 2/3),
				direction: direction,
				isBig: chargeTime > 1
			})
			this.parent.add(fireball)

			const sound = fireball.isBig ? this.bigshootSound : this.shootSound
			if (sound.isPlaying) {
				sound.stop()
			}
			sound.play()

			this.chargeStarted = 0
			this.lastFire = this.lastTime
			this.hand.setFrame(0)

			const handProgress = (this.hand.position.clone().sub(this.hand.inPosition).length() /
				this.hand.outPosition.clone().sub(this.hand.inPosition).length())
			this.hand.position.lerpVectors(
				this.hand.inPosition,
				this.hand.outPosition,
				Math.min(1, handProgress + 0.25)
			)
		}
	}
}
