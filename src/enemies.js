import { Sprite, SpriteMaterial } from "three"
import { Actor } from "./entities"
import { SpriteSheetProxy, textureCache } from "./utils"

export class Enemy extends Actor {
	constructor(sprite, props, size, speed, spriteInfo) {
		super(props, size, speed)
		this.persistedProps.push("anim", "animStartTime", "health", "isEthereal")

		this.anim = this.anim || "move"
		this.health = this.health || 5

		this.sprite = new Sprite(new SpriteMaterial({fog: true}))
		this.spriteInfo = spriteInfo

		const w = spriteInfo.walkFrames
		const a = spriteInfo.attackFrames
		const d = spriteInfo.deathFrames
		this.frames = {
			move: [0, w],
			attack: [w, a],
			pain: [w+a, 1],
			death: [w+a, d]
		}

		textureCache.get(sprite, texture => {
			const totalFrames = spriteInfo.walkFrames + spriteInfo.attackFrames + spriteInfo.deathFrames
			this.texture = new SpriteSheetProxy(texture, spriteInfo.frameWidth, totalFrames)
			this.sprite.material.map = this.texture
			this.sprite.material.needsUpdate = true
			this.add(this.sprite)
		})
	}

	onDamage(time) {
		if (this.anim != "death") {
			this.health -= 1
			if (this.health) {
				this.startAnimation("pain", time)
			} else {
				this.isEthereal = true
				this.startAnimation("death", time)
			}
		}
	}

	startAnimation(anim, time) {
		if (anim in this.frames) {
			this.anim = anim
			this.animStartTime = time
		}
	}

	update(time) {
		if (this.texture) {
			if (!this.animStartTime) {
				this.startAnimation(this.anim, time)
			}

			const delta = time - this.animStartTime
			const animFrameInfo = this.frames[this.anim]
			let frameNum = Math.floor(delta * this.speed)

			if (frameNum >= animFrameInfo[1]) {
				if (this.anim == "death") {
					if (this.removeDead) {
						this.shouldRemove = true
					}
					frameNum = animFrameInfo[1]-1
				} else if (this.anim == "move") {
					if (Math.random() < 1/3) {
						this.startAnimation("attack", time)
						return this.update(time)
					} else {
						this.animStartTime = time
						frameNum = frameNum % animFrameInfo[1]
					}
				} else {
					this.startAnimation("move", time)
					return this.update(time)
				}
			}

			this.texture.setFrame(animFrameInfo[0] + frameNum)
		}
	}
}

export class Orc extends Enemy {
	constructor(props) {
		super("sprites/orc.png", props, 0.5, 5, {
			frameWidth: 51,
			walkFrames: 4,
			attackFrames: 2,
			deathFrames: 4
		})
	}
}

export class Troll extends Enemy {
	constructor(props) {
		super("sprites/troll.png", props, 0.75, 5, {
			frameWidth: 64,
			walkFrames: 4,
			attackFrames: 3,
			deathFrames: 4
		})
	}
}

export class Bat extends Enemy {
	constructor(props) {
		super("sprites/bat.png", props, 0.5, 10, {
			frameWidth: 40,
			walkFrames: 4,
			attackFrames: 0,
			deathFrames: 2
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
		super("sprites/mage.png", props, 0.5, 5, {
			frameWidth: 56,
			walkFrames: 2,
			attackFrames: 1,
			deathFrames: 3
		})
		this.sprite.scale.x = 56/64
	}
}

export class Demon extends Enemy {
	constructor(props) {
		super("sprites/demon.png", props, 0.75, 5, {
			frameWidth: 64,
			walkFrames: 4,
			attackFrames: 3,
			deathFrames: 4
		})
	}
}
