import { BoxBufferGeometry, Mesh, MeshBasicMaterial } from "three"
import { SpriteSheetProxy, textureCache } from "./utils"

// TODO: Move exploding wall here

export class Door extends Mesh {
	constructor(color, position) {
		const geometry = new BoxBufferGeometry(1, 1, 1)
		geometry.rotateX(Math.PI / 2)
		const material = new MeshBasicMaterial()
		textureCache.get("walls/" + color + "_door.png", texture => {
			texture.anisotropy = 8
			const spritesheet = new SpriteSheetProxy(texture)
			material.map = spritesheet
			material.needsUpdate = true
		})
		super(geometry, material)
		this.color = color
		this.frequency = 9 + 0.5 * Math.random()
		this.position.copy(position)
		this.adjacent = []
	}

	update(time) {
		if (this.material.map) {
			const frame = Math.floor(this.frequency * time) % 2
			this.material.map.setFrame(frame)
		}
	}
}
