import { PerspectiveCamera, PointLight, Sprite, SpriteMaterial, Vector3 } from "three"
import { Entity, Fireball } from "./entities"
import { SpriteSheetProxy, textureCache } from "./utils"

export class Player extends Entity {
	constructor() {
		super(2/3, 5)
		this.camera = new PerspectiveCamera(45, 0, 0.01, 256)
		this.name = "Player"
		this.camera.rotation.set(0, Math.PI, 0)
		this.add(this.camera)

		this.light = new PointLight(0xE55B00, 0, 0)
		this.add(this.light)

		textureCache.get("sprites/hand.png", texture => {
			const spritesheet = SpriteSheetProxy(texture, 88, 2)
			spritesheet.repeat.y = 88/72
			this.hand = new Sprite(new SpriteMaterial({map: spritesheet}))
			this.hand.setFrame = (frame) => {
				spritesheet.setFrame(frame)
				this.light.intensity = frame
			}
			this.hand.scale.divideScalar(20)
			this.hand.outPosition = new Vector3(-0.0032, -0.0165, 0.1)
			this.hand.inPosition = new Vector3(-0.0032, -0.033, 0.05)
			this.hand.position.copy(this.hand.inPosition)
			this.add(this.hand)
		})
	}

	update(time, maze) {
		super.update(time, maze)
		if (this.hand) {
			this.updateHand(time)
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

			ShiftLeft: this.sprint.bind(this)
		}
	}

	moveForward(value) { this.moveDirection.z += value; this.updateVelocity() }
	moveBackward(value) { this.moveDirection.z -= value; this.updateVelocity() }
	moveLeft(value) { this.moveDirection.x += value; this.updateVelocity() }
	moveRight(value) { this.moveDirection.x -= value; this.updateVelocity() }
	sprint(value) { this.speed *= (value > 0) ? 2 : 0.5; this.updateVelocity() }
	turnLeft(value) { this.turnDirection += value }
	turnRight(value) { this.turnDirection -= value }
	shoot(value) {
		if (value > 0) {
			if (!this.chargeStarted) {
				this.chargeStarted = this.lastTime
				this.hand.setFrame(1)
				this.light.distance = 0
			}
		} else {
			const chargeTime = this.lastTime - this.chargeStarted
			const fireball = new Fireball(this.position, this.getWorldDirection(), chargeTime > 1)
			this.parent.add(fireball)
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
