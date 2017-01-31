import { BoxBufferGeometry, Mesh, MeshBasicMaterial, PositionalAudio } from "three"
import { audioListener, audioLoader } from "./audio"
import { CustomMaterial } from "./material"
import { SpriteSheetProxy, textureCache } from "./utils"

// TODO: Move exploding wall here

export class Door extends Mesh {
	constructor(color, position) {
		const geometry = new BoxBufferGeometry(1, 1, 1)
		geometry.rotateX(Math.PI / 2)
		const material = new CustomMaterial()
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

		audioLoader.load("sounds/adlib/use_key.wav", buffer => {
			this.unlockSound = new PositionalAudio(audioListener)
			this.unlockSound.setBuffer(buffer)
			this.add(this.unlockSound)
		})
	}

	update(time) {
		if (this.material.map) {
			const frame = Math.floor(this.frequency * time) % 2
			this.material.map.setFrame(frame)
		}
	}

	/**
	 * Mark this and connected door tiles for removal.
	 * @return {boolean} true if successful, false if this door is already marked
	 */
	unlock(silent) {
		if (this.shouldRemove) {
			return false
		} else {
			if (!silent) {
				this.unlockSound.play()
			}
			this.shouldRemove = true
			this.adjacent.forEach(door => door.unlock(true))
			return true
		}
	}
}
