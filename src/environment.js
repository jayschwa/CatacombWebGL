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

		this.duration = 1/3
		this.adjacent = []
	}

	ignite(time) {
		if (this.isExploding()) {
			return
		}
		this.ignition = time
		this.children.forEach(mesh => mesh.shouldRemove = true)
		this.add(this.box)
	}

	igniteAdjacent(time) {
		this.adjacent.forEach(e => e.ignite(time))
		this.adjacentsIgnited = true
	}

	isExploding() {
		return !!this.ignition
	}

	onDamage(time) {
		this.ignite(time)
	}

	update(time) {
		if (this.isExploding()) {
			const timeDelta = time - this.ignition
			if (timeDelta > this.duration) {
				this.shouldRemove = true
			} else {
				const texture = this.box.material.map
				const frame = Math.floor(timeDelta * texture.frames / this.duration)
				this.box.material.map.setFrame(frame)
				if (!this.adjacentsIgnited && timeDelta > this.duration / texture.frames) {
					this.igniteAdjacent(time)
				}
			}
		}
	}
}