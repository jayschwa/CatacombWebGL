import { Sprite, SpriteMaterial } from "three"
import { Entity } from "./entities"
import { SpriteSheetProxy, textureCache } from "./utils"

export class Enemy extends Entity {
	constructor(sprite, props, size, speed, spriteInfo) {
		super(size, speed)
		const pos = props.position
		this.position.set(pos[0], pos[1], pos[2] || 0)
		this.spriteInfo = spriteInfo
		textureCache.get(sprite, texture => {
			const totalFrames = spriteInfo.walkFrames + spriteInfo.attackFrames + spriteInfo.deathFrames
			this.texture = new SpriteSheetProxy(texture, spriteInfo.frameWidth, totalFrames)
			this.sprite = new Sprite(new SpriteMaterial({fog: true, map: this.texture}))
			this.add(this.sprite)
		})
	}

	onDamage(time) {
		if (!this.timeOfDeath) {
			this.isEthereal = true
			this.timeOfDeath = time
		}
	}

	update(time) {
		if (this.texture) {
			if (this.timeOfDeath) {
				const timeAfterDeath = time - this.timeOfDeath
				const deathStartFrame = this.texture.frames - this.spriteInfo.deathFrames
				const frame = deathStartFrame + Math.floor(8 * timeAfterDeath)
				if (frame >= this.texture.frames && this.removeDead) {
					this.shouldRemove = true
				} else if (frame < this.texture.frames) {
					this.texture.setFrame(frame)
				}
			} else {
				const frame = Math.floor(this.speed * time) % this.spriteInfo.walkFrames
				this.texture.setFrame(frame)
			}
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

	static entityIds() {
		return [0x17, 0x25, 0x2A]
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

	static entityIds() {
		return [0x16, 0x24, 0x29]
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
		this.scale.x = 40/64
		const scale = 0.8
		this.scale.multiplyScalar(scale)
		this.translateZ(-0.1)
		this.removeDead = true
	}

	static entityIds() {
		return [0x19, 0x26, 0x2B]
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
		this.scale.x = 56/64
	}

	static entityIds() {
		return [0x1B, 0x28, 0x2D]
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

	static entityIds() {
		return [0x1A, 0x27, 0x2C]
	}
}
