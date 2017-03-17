import { Raycaster, Sprite, SpriteMaterial } from "three"
import { Actor } from "./entities"
import { SpriteSheetProxy, textureCache } from "./utils"

export class Enemy extends Actor {
	constructor(sprite, props, health, size, speed, spriteInfo) {
		super(props, size, speed)
		this.persistedProps.push("anim", "animStartTime", "health")

		if (this.anim === undefined) {
			this.anim = "move"
			this.animStartTime = -Math.random() // Prevent enemies from appearing in lockstep
		}
		if (this.health === undefined) {
			this.health = health
		}
		this.isEthereal = this.health <= 0
		this.sprite = new Sprite(new SpriteMaterial({fog: true}))

		this.animations = spriteInfo.animations
		const totalFrames = Object.values(this.animations).map(a => a.start + a.length).reduce(Math.max, 0)

		textureCache.get(sprite, texture => {
			this.texture = new SpriteSheetProxy(texture, spriteInfo.frameWidth, totalFrames)
			this.sprite.material.map = this.texture
			this.sprite.material.needsUpdate = true
			this.add(this.sprite)
		})
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
				if (this.thinkInterval) {
					this.thinkInterval = clearInterval(this.thinkInterval)
				}
			}
		}
	}

	dispose() {
		this.sprite.material.dispose()
		this.texture.dispose()
		if (this.thinkInterval) {
			this.thinkInterval = clearInterval(this.thinkInterval)
		}
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
		this.raycaster = new Raycaster()
		this.sightTarget()
		this.thinkInterval = window.setInterval(this.sightTarget.bind(this), 250)
	}

	sightTarget() {
		const path = this.target.position.clone().sub(this.position)
		const distance = path.length()
		this.raycaster.set(this.position, path.normalize())
		this.raycaster.far = distance
		let collisions = this.raycaster.intersectObject(this.maze, true)
		collisions = collisions.filter(c => !(c.object instanceof Sprite))
		if (collisions.length) {
			// sight to target is obstructed
			if (this.moveDestination) {
				this.moveDestination = this.moveDestination.clone()
			}
		} else {
			this.moveDestination = this.target.position
		}
	}

	update(time, maze) {
		if (this.moveDestination && this.anim == "move") {
			this.velocity.copy(this.moveDestination).sub(this.position).clampLength(0, this.speed)
			let arrivedDistance = this.size
			if (this.target) {
				arrivedDistance += this.target.size
			}
			if (this.velocity.length() < arrivedDistance) {
				this.moveDestination = null
				this.velocity.set(0, 0, 0)
				this.startAnimation("attack", time)
			}
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

export class Orc extends Enemy {
	constructor(props) {
		super("sprites/orc.png", props, 3, 0.5, 2, {
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

export class Troll extends Enemy {
	constructor(props) {
		super("sprites/troll.png", props, 10, 0.75, 5, {
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

export class Bat extends Enemy {
	constructor(props) {
		super("sprites/bat.png", props, 1, 0.5, 5, {
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

export class Mage extends Enemy {
	constructor(props) {
		super("sprites/mage.png", props, 5, 0.5, 1.5, {
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

export class Demon extends Enemy {
	constructor(props) {
		super("sprites/demon.png", props, 50, 0.75, 1.5, {
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

export class Nemesis extends Enemy {
	constructor(props) {
		super("sprites/nemesis.png", props, 100, 0.5, 5, {
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
