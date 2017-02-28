import { BoxBufferGeometry, Mesh, MeshBasicMaterial, Object3D, PositionalAudio } from "three"
import { audioListener, audioLoader } from "./audio"
import { Entity } from "./entities"
import { CustomMaterial } from "./material"
import { SpriteSheetProxy, textureCache } from "./utils"

export class Door extends Entity {
	constructor(props) {
		super(props)
		this.type = "Door"
		this.persistedProps.push("color")
		this.color = props.color

		const geometry = new BoxBufferGeometry(1, 1, 1)
		geometry.rotateX(Math.PI / 2)
		const material = new CustomMaterial()
		textureCache.get("walls/" + this.color + "_door.png", texture => {
			texture.anisotropy = 8
			const spritesheet = new SpriteSheetProxy(texture)
			material.map = spritesheet
			material.needsUpdate = true
		})
		this.mesh = new Mesh(geometry, material)
		this.add(this.mesh)

		this.frequency = 9 + 0.5 * Math.random()
		this.adjacent = []

		audioLoader.load("sounds/adlib/use_key.wav", buffer => {
			this.unlockSound = new PositionalAudio(audioListener)
			this.unlockSound.setBuffer(buffer)
			this.add(this.unlockSound)
		})
	}

	update(time) {
		if (this.mesh.material.map) {
			const frame = Math.floor(this.frequency * time) % 2
			this.mesh.material.map.setFrame(frame)
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

export class ExplodingWall extends Entity {
	constructor(props) {
		super(props)
		this.type = "ExplodingWall"
		this.persistedProps.push("ignition", "wall")
		this.ignition = props.ignition
		this.wall = props.wall

		const geometry = new BoxBufferGeometry(1, 1, 1)
		geometry.rotateX(Math.PI / 2)
		const texture = textureCache.get("walls/exploding.png", texture => {
			this.box.material.map = new SpriteSheetProxy(texture, 64, 3)
			this.box.material.needsUpdate = true
		})
		const material = new MeshBasicMaterial({map: texture, transparent: true})
		this.box = new Mesh(geometry, material)

		this.adjacent = []
		this.burnDuration = 0.25
		this.spreadDuration = this.burnDuration / 2
	}

	ignite(time) {
		if (time >= this.ignition) {
			return
		}
		this.ignition = time
		this.adjacent.forEach(e => e.ignite(time + this.spreadDuration))
	}

	onDamage(time) {
		this.ignite(time)
	}

	update(time) {
		const timeDelta = time - this.ignition
		if (timeDelta > this.burnDuration) {
			this.shouldRemove = true
		} else if (timeDelta > 0) {
			if (!this.exploding) {
				this.exploding = true
				this.children.forEach(mesh => mesh.shouldRemove = true) // remove wall segments
				this.add(this.box)
			}
			const texture = this.box.material.map
			const frame = Math.floor(timeDelta * texture.frames / this.burnDuration)
			texture.setFrame(frame)
		}
	}
}
