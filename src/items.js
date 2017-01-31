import { Audio, AudioLoader, PositionalAudio, Sprite } from "three"
import { audioListener, audioLoader } from "./audio"
import { SpriteSheetProxy, textureCache } from "./utils"

export class Item extends Sprite {
	constructor(name, position, ...itemFrames) {
		super()
		const scale = 0.6
		this.name = name
		this.scale.multiplyScalar(scale)
		this.position.copy(position)
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

export class Bolt extends Item {
	constructor(position) {
		super("bolt", position, 0, 1)
	}
}

export class Nuke extends Item {
	constructor(position) {
		super("nuke", position, 2, 3)
	}
}

export class Potion extends Item {
	constructor(position) {
		super("potion", position, 4)
	}
}

export class RedKey extends Item {
	constructor(position) {
		super("redKey", position, 5)
	}
}

export class YellowKey extends Item {
	constructor(position) {
		super("yellowKey", position, 6)
	}
}

export class GreenKey extends Item {
	constructor(position) {
		super("greenKey", position, 7)
	}
}

export class BlueKey extends Item {
	constructor(position) {
		super("blueKey", position, 8)
	}
}

export class Scroll extends Item {
	constructor(position) {
		super("scroll", position, 9)
	}
}

export class Treasure extends Item {
	constructor(position) {
		super("treasure", position, 10)
	}
}
