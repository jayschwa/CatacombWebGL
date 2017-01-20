import { Sprite } from "three"
import { SpriteSheetProxy, textureCache } from "./utils"

class Item extends Sprite {
	constructor(position, ...itemFrames) {
		super()
		const scale = 0.6
		this.scale.multiplyScalar(scale)
		this.position.copy(position)
		this.translateZ(-(1-scale)/2)
		this.itemFrames = itemFrames
		this.material.fog = true
		textureCache.get("sprites/items.png", texture => {
			this.material.map = new SpriteSheetProxy(texture, 40, 11)
			this.material.map.setFrame(this.itemFrames[0])
			this.material.needsUpdate = true
		})
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
		super(position, 0, 1)
	}
}

export class Nuke extends Item {
	constructor(position) {
		super(position, 2, 3)
	}
}

export class Potion extends Item {
	constructor(position) {
		super(position, 4)
	}
}

export class RedKey extends Item {
	constructor(position) {
		super(position, 5)
	}
}

export class YellowKey extends Item {
	constructor(position) {
		super(position, 6)
	}
}

export class GreenKey extends Item {
	constructor(position) {
		super(position, 7)
	}
}

export class BlueKey extends Item {
	constructor(position) {
		super(position, 8)
	}
}

export class Scroll extends Item {
	constructor(position) {
		super(position, 9)
	}
}

export class Treasure extends Item {
	constructor(position) {
		super(position, 10)
	}
}
