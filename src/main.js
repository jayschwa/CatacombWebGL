import * as THREE from "three"
import { constructLayout, spawnEntities } from "./map"
import { Player } from "./player"
import { Transition } from "./transition"
import { SpriteSheetProxy, textureCache } from "./utils"

THREE.Vector3.prototype.copy = function(v) {
	this.x = v.x
	this.y = v.y
	if (v.isVector3) {
		this.z = v.z
	}
	return this
}

function setupPlayerSpawn(map, player) {
	const pos = map.playerStart.position
	const dir = map.playerStart.direction
	player.position.set(pos[0], pos[1], 0)
	const target = player.position.clone()
	target.x += dir[0]
	target.y += dir[1]
	player.lookAt(target)
}

export class Game {
	constructor(container, location, mapName, player) {
		this.container = container
		this.location = location

		this.mapName = mapName
		this.player = player || new Player()

		this.clock = new THREE.Clock()

		this.renderer = new THREE.WebGLRenderer({antialias: true})
		this.renderer.physicallyCorrectLights = true
		container.appendChild(this.renderer.domElement)

		this.scene = new THREE.Scene()
		this.ambientLight = new THREE.AmbientLight()
		this.scene.add(this.ambientLight)
		this.scene.add(this.player)

		this.maze = new THREE.Group()
		this.maze.name = "Maze"

		// transition stuff
		this.fbo1 = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat, stencilBuffer: false})
		this.fbo2 = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat, stencilBuffer: false})
		this.transition = new Transition(window.innerWidth, window.innerHeight, this.fbo1, this.fbo2)
	}

	onKey(value) {
		const binds = this.player.binds()
		return (event) => {
			const command = binds[event.code]
			if (command && !event.repeat) {
				command(value)
			}
		}
	}

	onMouseButton(value) {
		return (event) => {
			this.player.shoot(value)
		}
	}

	onMouseMove(event) {
		this.player.rotateY(-event.movementX / 2000)
		this.player.updateVelocity()
	}

	play() {
		this.isActive = true
		this.render()
	}

	pause() {
		this.isActive = false
	}

	render() {
		const time = this.clock.getElapsedTime()
		const objectsToRemove = []
		this.scene.traverse(obj => {
			obj.update && obj.update(time, this.maze)
			if (obj.shouldRemove) {
				objectsToRemove.push(obj)
			}
		})
		objectsToRemove.forEach(obj => obj.parent.remove(obj))

		if (this.player.warpToPosition) {
			this.transitionStart = time

			// render to first FBO
			this.renderer.render(this.scene, this.player.camera, this.fbo1, true)

			this.player.position.copy(this.player.warpToPosition)
			this.player.warpToPosition = null
		}

		const transitionDelta = time - this.transitionStart
		const transitionDuration = 2/3
		if (transitionDelta < transitionDuration) {
			// render to second FBO
			this.renderer.render(this.scene, this.player.camera, this.fbo2, true)

			this.player.frozen = true
			this.transition.setMix(transitionDelta / transitionDuration)
			this.transition.material.uniforms.tex1.value = this.fbo1.texture
			this.transition.material.uniforms.tex2.value = this.fbo2.texture
			this.renderer.render(this.transition.scene, this.transition.camera)
		} else {
			this.player.frozen = false
			this.renderer.render(this.scene, this.player.camera)
		}

		const pos = this.player.position
		const tile = this.map.getTile(Math.round(pos.x), Math.round(pos.y))
		if (tile && tile.type == "floor") {
			this.location.innerText = tile.value || ""
		} else {
			this.location.innerText = ""
		}

		if (this.isActive) {
			requestAnimationFrame(this.render.bind(this))
		}
	}

	resizeView(width, height) {
		[this.renderer, this.fbo1, this.fbo2, this.transition].forEach(e => e.setSize(width, height))
		const cameras = [this.player.camera]
		cameras.forEach(camera => {
			camera.aspect = width / height
			camera.updateProjectionMatrix()
		})
	}

	setup() {
		const eventHandlers = [
			["keydown", this.onKey(1)],
			["keyup", this.onKey(-1)],
			["mousedown", this.onMouseButton(1)],
			["mouseup", this.onMouseButton(-1)],
			["mousemove", this.onMouseMove.bind(this)]
		]

		document.addEventListener("pointerlockchange", event => {
			if (document.pointerLockElement === this.renderer.domElement) {
				eventHandlers.forEach(([e, f]) => document.addEventListener(e, f))
				this.container.classList.add("playing")
			} else {
				eventHandlers.forEach(([e, f]) => document.removeEventListener(e, f))
				this.container.classList.remove("playing")
				this.player.moveDirection.set(0, 0, 0)
				this.player.updateVelocity()
			}
		})

		const that = this
		fetch("maps/" + this.mapName + ".map.json")
		.then(function(response) {
			return response.json()
		})
		.then(function(map) {
			that.map = map
			if (map.fog) {
				that.scene.fog = new THREE.Fog(map.fog.color, map.fog.near, map.fog.far)
			}
			constructLayout(map, that.maze)
			spawnEntities(map, that.maze)
			setupPlayerSpawn(map, that.player)
			that.scene.add(that.maze)
			that.play()
		})
	}
}
