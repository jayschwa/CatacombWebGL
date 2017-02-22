import { Audio, AudioLoader, PositionalAudio, Sprite } from "three"
import { audioListener, audioLoader } from "./audio"
import { SpriteSheetProxy, textureCache } from "./utils"

export class Item extends Sprite {
	constructor(props, ...itemFrames) {
		super()
		this.type = props.type
		this.name = props.type.toLowerCase()
		if ("value" in props) {
			this.value = props.value
		}
		this.soundName = props.soundName
		this.position.copy(props.position)
		const scale = 0.6
		this.scale.multiplyScalar(scale)
		this.translateZ(-(1-scale)/2)
		this.itemFrames = itemFrames
		this.material.fog = true
		audioLoader.load("sounds/adlib/pickup_" + (this.soundName || this.name) + ".wav", buffer => {
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

	getState() {
		const state = {
			type: this.type,
			position: this.position
		}
		if ("value" in this) {
			state.value = this.value
		}
		return state
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
