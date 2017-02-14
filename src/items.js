import { Audio, AudioLoader, PositionalAudio, Sprite } from "three"
import { audioListener, audioLoader } from "./audio"
import { SpriteSheetProxy, textureCache } from "./utils"

export class Item extends Sprite {
	constructor(props, ...itemFrames) {
		super()
		this.name = props.type
		const pos = props.position
		this.position.set(pos[0], pos[1], pos[2] || 0)
		const scale = 0.6
		this.scale.multiplyScalar(scale)
		this.translateZ(-(1-scale)/2)
		this.itemFrames = itemFrames
		this.material.fog = true
		audioLoader.load("sounds/adlib/pickup_" + this.name + ".wav", buffer => {
			this.pickupSound = new PositionalAudio(audioListener)
			this.pickupSound.setBuffer(buffer)
			this.add(this.pickupSound)
		})
		textureCache.get("sprites/items.png", texture => {
			this.material.map = new SpriteSheetProxy(texture, 40, 11)
			this.material.map.setFrame(this.itemFrames[0])
			this.material.needsUpdate = true
		})
	}

	pickup() {
		if (this.pickupSound) {
			this.pickupSound.play()
		}
		this.shouldRemove = true
	}

	update(time) {
		if (this.itemFrames.length > 1 && this.material.map) {
			const idx = Math.floor(8 * time) % this.itemFrames.length
			const frame = this.itemFrames[idx]
			this.material.map.setFrame(frame)
		}
	}
}

function simpleItem(...itemFrames) {
	return class extends Item {
		constructor(props) {
			super(props, ...itemFrames)
		}
	}
}

export const Bolt = simpleItem(0, 1)
export const Nuke = simpleItem(2, 3)
export const Potion = simpleItem(4)
export const RedKey = simpleItem(5)
export const YellowKey = simpleItem(6)
export const GreenKey = simpleItem(7)
export const BlueKey = simpleItem(8)
export const Scroll = simpleItem(9)
export const Treasure = simpleItem(10)
