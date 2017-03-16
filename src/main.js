import * as THREE from "three"
import { Clock } from "./clock"
import { Enemy } from "./enemies"
import { Map } from "./map"
import { Player } from "./player"
import { Transition } from "./transition"
import { SpriteSheetProxy, textureCache } from "./utils"

THREE.Vector3.prototype.copy = function(v) {
	if ("x" in v) this.x = v.x
	if ("y" in v) this.y = v.y
	if ("z" in v) this.z = v.z
	return this
}

class TouchControls {
	constructor(actor) {
		this.actor = actor
		this.touches = {}
		this.touchOrigins = {}

		document.addEventListener("touchstart", this.onTouchStart.bind(this))
		document.addEventListener("touchmove", this.onTouchMove.bind(this))
		document.addEventListener("touchend", this.onTouchEnd.bind(this))
	}

	partition(touches) {
		const left = []
		const right = []
		for (let touch of touches) {
			if (touch.screenX < window.screen.width / 2) {
				left.push(touch)
			} else {
				right.push(touch)
			}
		}
		return {left: left, right: right}
	}

	moveForward() {
		this.movingForward = true
		this.actor.moveForward(0.5)
	}

	onTouchStart(event) {
		this.touches = this.partition(event.touches)
		this.actor.shoot && this.actor.shoot(this.touches.right.length)
		if (this.touches.left.length && !this.movingForward) {
			this.timeoutId = window.setTimeout(this.moveForward.bind(this), 500)
		}
		for (let touch of event.changedTouches) {
			this.touchOrigins[touch.identifier] = {
				x: touch.screenX,
				y: touch.screenY
			}
		}
	}

	onTouchMove(event) {
		this.touches = this.partition(event.touches)
		if (this.touches.left.length < 1) {
			return
		}
		let delta = 0
		for (let touch of this.touches.left) {
			const origin = this.touchOrigins[touch.identifier]
			const xDelta = origin.x - touch.screenX
			if (Math.abs(xDelta) > Math.abs(delta)) {
				delta = xDelta
			}
		}
		let fraction = delta / 25.0
		fraction = Math.min(fraction, 1.5)
		if (Math.abs(fraction) < 0.5) {
			fraction = 0
		} else if (!this.movingForward) {
			window.clearTimeout(this.timeoutId)
			this.timeoutId = window.setTimeout(this.moveForward.bind(this), 500)
		}
		this.actor.turnDirection = fraction
	}

	onTouchEnd(event) {
		this.touches = this.partition(event.touches)
		this.actor.shoot && this.actor.shoot(this.touches.right.length)
		if (this.touches.left.length < 1) {
			window.clearTimeout(this.timeoutId)
			this.timeoutId = undefined
			if (this.movingForward) {
				this.actor.moveForward(-0.5)
				this.movingForward = false
			}
			this.actor.turnDirection = 0
		}
		for (let touch of event.changedTouches) {
			delete this.touchOrigins[touch.identifier]
		}
	}
}

export class Game {
	constructor(name, container, location, mapOverride) {
		this.name = name
		this.container = container
		this.location = location

		const globalState = JSON.parse(localStorage.getItem(this.name) || "{}")
		this.fromSave = "mapName" in globalState && globalState.mapName == mapOverride

		this.clock = new Clock(globalState.gameTime)
		this.mapName = mapOverride || globalState.mapName
		this.player = new Player(globalState.player || {type: "Player"}, this)

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

		const tile = this.map.getTile(this.player.position)
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

	changeMap(name) {
		if (this.loading) {
			return
		}

		// render to first FBO
		this.renderer.render(this.scene, this.player.camera, this.fbo1, true)
		this.player.frozen = true
		this.loading = true

		const that = this
		this.loadMap(name).then(map => {
			that.save()

			that.scene.traverse(obj => obj.dispose && obj.dispose())

			that.transitionStart = that.clock.getElapsedTime()
			that.mapName = name
			that.map = map
			that.scene = map.toScene()
			that.scene.add(that.player)
			that.player.position.copy(map.playerStart.position)
			that.player.direction = map.playerStart.direction
			that.huntPlayer()
			that.loading = false
		})
	}

	huntPlayer() {
		this.scene.traverse(obj => {
			if ("hunt" in obj) {
				obj.hunt(this.player, this.scene)
			}
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

	getGlobalState() {
		return {
			date: new Date(),
			gameTime: this.clock.getElapsedTime(),
			mapName: this.mapName,
			player: this.player.getState()
		}
	}

	getMapState() {
		const entities = []
		this.scene.traverse(obj => {
			if (obj instanceof Player) {
				return
			}
			const objState = obj.getState && obj.getState()
			if (objState) {
				entities.push(objState)
			}
		})
		const map = Object.assign({}, this.map)
		map.layout = map.layout.map(line => line.join(""))
		map.entities = entities
		return map
	}

	save() {
		localStorage.setItem(this.name, JSON.stringify(this.getGlobalState()))
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

		this.touchControls = new TouchControls(this.player)

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
			if (!that.fromSave) {
				that.player.position.copy(map.playerStart.position)
				that.player.direction = map.playerStart.direction
			}
			that.huntPlayer()
			that.play()
		})
	}
}
