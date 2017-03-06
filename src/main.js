import * as THREE from "three"
import { Clock } from "./clock"
import { Map, constructLayout, spawnEntities } from "./map"
import { Player } from "./player"
import { Transition } from "./transition"
import { SpriteSheetProxy, textureCache } from "./utils"

THREE.Vector3.prototype.copy = function(v) {
	if ("x" in v) this.x = v.x
	if ("y" in v) this.y = v.y
	if ("z" in v) this.z = v.z
	return this
}

function setupPlayerSpawn(player, start) {
	player.position.copy(start.position)
	const dir = start.direction
	const target = player.position.clone()
	target.x += dir.x
	target.y += dir.y
	player.lookAt(target)
}

export class Game {
	constructor(container, location, mapName, player) {
		this.container = container
		this.location = location

		this.mapName = mapName
		this.player = player || new Player()

		this.renderer = new THREE.WebGLRenderer({antialias: true})
		this.renderer.physicallyCorrectLights = true
		container.appendChild(this.renderer.domElement)

		// transition stuff
		this.fbo1 = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat, stencilBuffer: false})
		this.fbo2 = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat, stencilBuffer: false})
		this.transition = new Transition(window.innerWidth, window.innerHeight, this.fbo1, this.fbo2)
	}

	onKey(value) {
		const binds = this.player.binds()
		binds.Enter = this.save.bind(this)
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
		this.clock.start()
		this.isActive = true
		this.render()
	}

	pause() {
		this.clock.pause()
		this.isActive = false
	}

	render() {
		const time = this.clock.getElapsedTime()
		const objectsToRemove = []
		this.scene.traverse(obj => {
			obj.update && obj.update(time, this.scene)
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

	loadMap(name) {
		const savedState = localStorage.getItem(name)
		if (savedState) {
			const map = new Map(JSON.parse(savedState))
			return Promise.resolve(map)
		} else {
			const path = "maps/" + name + ".map.json"
			return fetch(path).then(r => r.json()).then(o => new Map(o))
		}
	}

	getMapState() {
		const entities = []
		this.scene.traverse(obj => {
			const objState = obj.getState && obj.getState()
			if (objState) {
				entities.push(objState)
			}
		})
		const map = Object.assign({}, this.map)
		map.layout = map.layout.map(line => line.join(""))
		map.entities = entities
		map.time = this.clock.getElapsedTime()
		return map
	}

	save() {
		localStorage.setItem(this.mapName, JSON.stringify(this.getMapState()))
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
		this.loadMap(this.mapName).then(map => {
			that.map = map
			that.scene = map.toScene()
			that.scene.add(that.player)
			const start = map.entities.filter(e => e.type == "Player").shift() || map.playerStart
			setupPlayerSpawn(that.player, start)
			that.clock = new Clock(map.time)
			that.play()
		})
	}
}
