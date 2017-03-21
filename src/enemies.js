import { PositionalAudio, Raycaster, Sprite, SpriteMaterial } from "three"
import { audioListener, audioLoader } from "./audio"
import { Actor, Fireball } from "./entities"
import { SpriteSheetProxy, textureCache } from "./utils"

export class Enemy extends Actor {
	constructor(sprite, props, health, size, speed, attackInterval, spriteInfo) {
		super(props, size, speed)
		this.persistedProps.push("anim", "animStartTime", "health", "lastAttackTime")

		if (this.anim === undefined) {
			this.anim = "move"
			this.animStartTime = -Math.random() // Prevent enemies from appearing in lockstep
		}
		if (this.health === undefined) {
			this.health = health
		}
		if (this.lastAttackTime === undefined) {
			this.lastAttackTime = 0
		}
		this.lastThinkTime = Math.random()
		this.isEthereal = this.health <= 0
		this.sprite = new Sprite(new SpriteMaterial({fog: true}))
		this.attackInterval = attackInterval

		this.animations = spriteInfo.animations
		const totalFrames = Object.values(this.animations).map(a => a.start + a.length).reduce(Math.max, 0)

		textureCache.get(sprite, texture => {
			this.texture = new SpriteSheetProxy(texture, spriteInfo.frameWidth, totalFrames)
			this.sprite.material.map = this.texture
			this.sprite.material.needsUpdate = true
			this.add(this.sprite)
		})

		this.raycaster = new Raycaster()
	}

	attack(position, time) {
		this.startAnimation("attack", time)
		this.lastAttackTime = time
	}

	onDamage(time, damage) {
		if (this.anim != "death") {
			this.health -= damage
			this.velocity.set(0, 0, 0)
			if (this.health > 0) {
				this.startAnimation("pain", time)
			} else {
				this.isEthereal = true
				this.startAnimation("death", time)
				this.moveDestination = null
			}
		}
	}

	dispose() {
		this.sprite.material.dispose
		this.texture.dispose()
	}

	startAnimation(anim, time) {
		if (anim in this.animations) {
			this.anim = anim
			this.animStartTime = time
		}
	}

	hunt(target, maze) {
		if (this.anim == "death") {
			return
		}
		this.target = target
		this.maze = maze
	}

	sightTarget() {
		const path = this.target.position.clone().sub(this.position)
		const distance = path.length()
		this.raycaster.set(this.position, path.normalize())
		this.raycaster.far = distance
		let collisions = this.raycaster.intersectObject(this.maze, true)
		collisions = collisions.filter(c => !(c.object instanceof Sprite))
		if (collisions.length && this.targetLocked) {
			// sight to target is obstructed
			this.targetPosition = this.targetPosition.clone()
			this.targetLocked = false
		} else if (!collisions.length && !this.targetLocked) {
			this.targetPosition = this.target.position
			this.targetLocked = true
		}
		return this.targetLocked
	}

	onCollision(collision, time) {
		const obj = collision.object
		if (obj instanceof Sprite) {
			const obstructionNormal = this.worldToLocal(obj.position.clone()).cross(this.up)
			const localTarget = this.worldToLocal(this.target.position.clone())
			this.sidestep = Math.sign(localTarget.dot(obstructionNormal))
		}
		return true
	}

	update(time, maze) {
		if (this.animStartTime === undefined) {
			this.startAnimation(this.anim, time)
		}

		if (this.target && time > this.lastThinkTime + 0.25) {
			this.think(time)
			this.lastThinkTime = time
		}

		if (this.moveDestination && this.anim == "move") {
			this.velocity.copy(this.moveDestination).sub(this.position)
			if (this.sidestep) {
				this.velocity.cross(this.up.clone().multiplyScalar(this.sidestep))
			}
			this.velocity.clampLength(0, this.speed)
			let arrivedDistance = this.size
			if (this.target) {
				arrivedDistance += this.target.size
			}
			if (this.velocity.length() < arrivedDistance) {
				this.moveDestination = null
				this.velocity.set(0, 0, 0)
			}
		} else {
			this.velocity.set(0, 0, 0)
		}

		super.update(time, maze)
		
		if (this.texture) {
			const delta = time - this.animStartTime
			const animFrameInfo = this.animations[this.anim]
			let frameNum = Math.floor(delta * animFrameInfo.speed)

			if (frameNum >= animFrameInfo.length) {
				if (this.anim == "death") {
					if (this.removeDead) {
						this.shouldRemove = true
					}
					frameNum = animFrameInfo.length-1
				} else if (this.anim == "move") {
					this.animStartTime = time
					frameNum = frameNum % animFrameInfo.length
				} else {
					this.startAnimation("move", time)
					return this.update(time)
				}
			}

			this.texture.setFrame(animFrameInfo.start + frameNum)
		}
	}
}

export class MeleeEnemy extends Enemy {
	think(time) {
		if (this.sightTarget()) {
			const delta = time - this.lastAttackTime
			const reach = this.size + this.target.size
			if (this.position.distanceTo(this.targetPosition) < reach && this.anim == "move" && delta >= this.attackInterval) {
				this.attack(this.targetPosition, time)
			} else {
				this.moveDestination = this.targetPosition
			}
			this.sidestep = 0
		} else {
			this.moveDestination = this.targetPosition
		}
	}
}

export class RangedEnemy extends Enemy {
	constructor(...args) {
		super(...args)
		audioLoader.load("sounds/adlib/shoot.wav", buffer => {
			this.shootSound = new PositionalAudio(audioListener).setBuffer(buffer)
			this.add(this.shootSound)
		})
	}

	attack(position, time) {
		super.attack(position, time)
		const direction = position.clone().sub(this.position).normalize()
		const fireball = new Fireball({
			type: "Fireball",
			position: this.position.clone().addScaledVector(direction, 2/3),
			direction: direction,
			isBig: false
		})
		this.parent.add(fireball)
		if (this.shootSound) {
			this.shootSound.play()
		}
	}

	think(time) {
		if (this.sightTarget()) {
			const delta = time - this.lastAttackTime
			if (this.anim == "move" && delta >= this.attackInterval) {
				this.attack(this.targetPosition, time)
			}
			this.sidestep = 0
		} else {
			this.moveDestination = this.targetPosition
		}
	}
}

export class Orc extends MeleeEnemy {
	constructor(props) {
		super("sprites/orc.png", props, 3, 0.5, 2, 1, {
			frameWidth: 51,
			animations: {
				move:   {start: 0, length: 4, speed: 4},
				attack: {start: 4, length: 2, speed: 2},
				pain:   {start: 6, length: 1, speed: 4},
				death:  {start: 6, length: 4, speed: 6}
			}
		})
	}
}

export class Troll extends MeleeEnemy {
	constructor(props) {
		super("sprites/troll.png", props, 10, 0.75, 5, 1, {
			frameWidth: 64,
			animations: {
				move:   {start: 0, length: 4, speed: 6},
				attack: {start: 4, length: 3, speed: 5},
				pain:   {start: 7, length: 1, speed: 4},
				death:  {start: 7, length: 4, speed: 6}
			}
		})
	}
}

export class Bat extends MeleeEnemy {
	constructor(props) {
		super("sprites/bat.png", props, 1, 0.5, 5, 0, {
			frameWidth: 40,
			animations: {
				move:   {start: 0, length: 4, speed: 16},
				death:  {start: 4, length: 2, speed: 8}
			}
		})
		this.sprite.scale.x = 40/64
		const scale = 0.8
		this.sprite.scale.multiplyScalar(scale)
		this.sprite.translateZ(-0.1)
		this.removeDead = true
	}
}

export class Mage extends RangedEnemy {
	constructor(props) {
		super("sprites/mage.png", props, 5, 0.5, 1.5, 2, {
			frameWidth: 56,
			animations: {
				move:   {start: 0, length: 2, speed: 3},
				attack: {start: 2, length: 1, speed: 3},
				pain:   {start: 3, length: 1, speed: 2},
				death:  {start: 3, length: 3, speed: 7}
			}
		})
		this.sprite.scale.x = 56/64
	}
}

export class Demon extends MeleeEnemy {
	constructor(props) {
		super("sprites/demon.png", props, 50, 0.75, 1.5, 1, {
			frameWidth: 64,
			animations: {
				move:   {start: 0, length: 4, speed: 3.5},
				attack: {start: 4, length: 3, speed: 4},
				pain:   {start: 7, length: 1, speed: 4},
				death:  {start: 7, length: 4, speed: 6}
			}
		})
	}
}

export class Nemesis extends RangedEnemy {
	constructor(props) {
		super("sprites/nemesis.png", props, 100, 0.5, 5, 2, {
			frameWidth: 64,
			animations: {
				move:   {start: 0, length: 2, speed: 10},
				attack: {start: 2, length: 1, speed: 2},
				pain:   {start: 3, length: 1, speed: 4},
				death:  {start: 3, length: 7, speed: 8}
			}
		})
	}
}
