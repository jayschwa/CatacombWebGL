import { Audio, AudioLoader, PositionalAudio, Sprite, SpriteMaterial } from "three"
import { audioListener, audioLoader } from "./audio"
import { Entity } from "./entities"
import { SpriteSheetProxy, textureCache } from "./utils"

const ITEM_SCALE = 0.6

export class Item extends Entity {
	constructor(props, ...itemFrames) {
		super(props)
		this.itemFrames = itemFrames
		const soundName = this.soundName || this.type.toLowerCase()
		audioLoader.load("sounds/adlib/pickup_" + soundName + ".wav", buffer => {
			this.pickupSound = new PositionalAudio(audioListener)
			this.pickupSound.setBuffer(buffer)
			this.add(this.pickupSound)
		})
		textureCache.get("sprites/items.png", texture => {
			this.spritesheet = new SpriteSheetProxy(texture, 40, 11)
			this.spritesheet.setFrame(this.itemFrames[0])
			this.sprite = new Sprite(new SpriteMaterial({fog: true, map: this.spritesheet}))
			this.sprite.scale.multiplyScalar(ITEM_SCALE)
			this.sprite.translateZ(-(1-ITEM_SCALE)/2)
			this.add(this.sprite)
		})
	}

	pickup() {
		if (this.pickupSound) {
			this.pickupSound.play()
		}
		this.shouldRemove = true
		return this
	}

	update(time) {
		if (this.itemFrames.length > 1 && this.spritesheet) {
			const idx = Math.floor(8 * time) % this.itemFrames.length
			const frame = this.itemFrames[idx]
			this.spritesheet.setFrame(frame)
		}
	}
}

function simpleItem(itemFrames, addlProps) {
	return class extends Item {
		constructor(props) {
			super(Object.assign(props, addlProps), ...itemFrames)
		}
	}
}

export const Bolt = simpleItem([0, 1])
export const Nuke = simpleItem([2, 3])
export const Potion = simpleItem([4])
export const RedKey = simpleItem([5], {soundName: "key"})
export const YellowKey = simpleItem([6], {soundName: "key"})
export const GreenKey = simpleItem([7], {soundName: "key"})
export const BlueKey = simpleItem([8], {soundName: "key"})
export const Scroll = simpleItem([9])
export const Treasure = simpleItem([10])
