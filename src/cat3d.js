import * as THREE from "three"
import { CustomMaterial } from "./material.js"
import { Entity, SpriteSheetProxy, textureCache } from "./primitives.js"
import { Bat, Demon, Mage, Orc, Troll } from "./enemies.js"

THREE.Vector3.prototype.copy = function(v) {
	this.x = v.x
	this.y = v.y
	if (v.isVector3) {
		this.z = v.z
	}
	return this
}

const wallTypeMap = {
	1: "stone",
	2: "slime",
	3: "white",
	4: "blood",
	5: "tar",
	6: "gold",
	7: "hell"
}

function getWallName(type, direction) {
	const suffix = ["north", "south"].includes(direction) ? "dark" : "light"
	return wallTypeMap[type] + "_" + suffix
}

const fireballTexture = textureCache.get("sprites/fireball.png")

class Fireball extends Entity {
	constructor(origin, direction, isBig) {
		super(0, 30)
		this.isBig = isBig
		this.name = isBig? "Big Fireball" : "Fireball"
		this.scale.divideScalar(3)
		this.position.copy(origin)
		this.lookAt(origin.clone().add(direction))
		this.position.addScaledVector(direction, 2/3)
		this.updateMatrixWorld()
		this.moveDirection.z = 1
		this.updateVelocity()

		this.light = new THREE.PointLight(0xFF6600, 0.5, 0.5)
		if (isBig) { this.light.distance *= 2 }
		if (isBig) { this.add(this.light) }

		this.spriteSheet = SpriteSheetProxy(fireballTexture)
		this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: this.spriteSheet}))
		if (!isBig) {
			this.sprite.material.rotation = Math.floor(Math.random() * 4) * Math.PI / 2
		}
		this.add(this.sprite)
	}

	onCollision(collision, time) {
		if (!this.removeAtTime) {
			for (let obj = collision.object; obj; obj = obj.parent) {
				if (obj.onDamage) {
					obj.onDamage(time)
					break
				}
			}
		}
		if (!this.isBig) {
			this.add(this.light)
		}
		this.removeAtTime = time + 0.075
		this.isBig = false
		this.removeAtTime += 0.075
		this.moveDirection.z = 0
		this.updateVelocity()
		this.translateZ(-0.1)
		return true
	}

	update(time, maze) {
		super.update(time, maze)
		let frame = Math.floor(time * 10) % 2
		if (this.isBig) { frame += 2 }
		this.spriteSheet.setFrame(frame)
		if (time >= this.removeAtTime) {
			this.shouldRemove = true
		}
	}
}

class Player extends Entity {
	constructor() {
		super(2/3, 5)
		this.camera = new THREE.PerspectiveCamera(45, 0, 0.01, 256)
		this.name = "Player"
		this.camera.rotation.set(0, Math.PI, 0)
		this.add(this.camera)

		this.light = new THREE.PointLight(0xE55B00, 0, 0)
		this.add(this.light)

		textureCache.get("sprites/hand.png", texture => {
			const spritesheet = SpriteSheetProxy(texture, 88, 2)
			spritesheet.repeat.y = 88/72
			this.hand = new THREE.Sprite(new THREE.SpriteMaterial({map: spritesheet}))
			this.hand.setFrame = (frame) => {
				spritesheet.setFrame(frame)
				this.light.intensity = frame
			}
			this.hand.scale.divideScalar(20)
			this.hand.outPosition = new THREE.Vector3(-0.0032, -0.0165, 0.1)
			this.hand.inPosition = new THREE.Vector3(-0.0032, -0.033, 0.05)
			this.hand.position.copy(this.hand.inPosition)
			this.add(this.hand)
		})
	}

	update(time, maze) {
		super.update(time, maze)
		if (this.hand) {
			this.updateHand(time)
		}
	}

	updateHand(time) {
		const handProgress = (this.hand.position.clone().sub(this.hand.inPosition).length() /
			this.hand.outPosition.clone().sub(this.hand.inPosition).length())
		if (this.chargeStarted) {
			const chargeTime = time - this.chargeStarted
			this.hand.position.lerpVectors(
				this.hand.inPosition,
				this.hand.outPosition,
				Math.min(1, Math.max(handProgress, chargeTime * 2))
			)
			const frame = Math.ceil(chargeTime * 8) % 2
			this.hand.setFrame(frame)
			this.light.distance = Math.min(1, chargeTime) * 2.5
		} else if (this.lastFire) {
			const timeDelta = time - this.lastFire
			this.hand.position.lerpVectors(
				this.hand.outPosition,
				this.hand.inPosition,
				Math.min(1, Math.max(1 - handProgress, timeDelta - 1))
			)
		}
	}

	moveForward(value) { this.moveDirection.z += value; this.updateVelocity() }
	moveBackward(value) { this.moveDirection.z -= value; this.updateVelocity() }
	moveLeft(value) { this.moveDirection.x += value; this.updateVelocity() }
	moveRight(value) { this.moveDirection.x -= value; this.updateVelocity() }
	sprint(value) { this.speed *= (value > 0) ? 2 : 0.5; this.updateVelocity() }
	turnLeft(value) { this.turnDirection += value }
	turnRight(value) { this.turnDirection -= value }
	shoot(value) {
		if (value > 0) {
			this.chargeStarted = this.lastTime
			this.hand.setFrame(1)
			this.light.distance = 0
		} else {
			const chargeTime = this.lastTime - this.chargeStarted
			const fireball = new Fireball(this.position, this.getWorldDirection(), chargeTime > 1)
			this.parent.add(fireball)
			this.chargeStarted = 0
			this.lastFire = this.lastTime
			this.hand.setFrame(0)

			const handProgress = (this.hand.position.clone().sub(this.hand.inPosition).length() /
				this.hand.outPosition.clone().sub(this.hand.inPosition).length())
			this.hand.position.lerpVectors(
				this.hand.inPosition,
				this.hand.outPosition,
				Math.min(1, handProgress + 0.25)
			)
		}
	}
}

function bindsFor(player) {
	return {
		ArrowUp: player.moveForward.bind(player),
		ArrowLeft: player.turnLeft.bind(player),
		ArrowDown: player.moveBackward.bind(player),
		ArrowRight: player.turnRight.bind(player),

		KeyW: player.moveForward.bind(player),
		KeyA: player.moveLeft.bind(player),
		KeyS: player.moveBackward.bind(player),
		KeyD: player.moveRight.bind(player),

		ShiftLeft: player.sprint.bind(player)
	}
}


const PLAYER_START_NORTH = 0x01
const PLAYER_START_EAST = 0x02
const PLAYER_START_SOUTH = 0x03
const PLAYER_START_WEST = 0x04
const PLAYER_START_SET = new Set([PLAYER_START_NORTH, PLAYER_START_EAST, PLAYER_START_SOUTH, PLAYER_START_WEST])

const TELEPORTER_A = 0x1F
const TELEPORTER_B = 0x20
const TELEPORTER_C = 0x21
const TELEPORTER_SET = new Set([TELEPORTER_A, TELEPORTER_B, TELEPORTER_C])

class ExplodingWall extends THREE.Object3D {
	constructor(tileIndex) {
		super()
		const geometry = new THREE.BoxBufferGeometry(1, 1, 1)
		geometry.rotateX(Math.PI / 2)
		const texture = textureCache.get("walls/exploding.png", texture => {
			this.box.material.map = new SpriteSheetProxy(texture, 64, 3)
			this.box.material.needsUpdate = true
		})
		const material = new THREE.MeshBasicMaterial({map: texture, transparent: true})
		this.box = new THREE.Mesh(geometry, material)
		this.duration = 1/3
		this.adjacentIndices = []
		this.tileIndex = tileIndex
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
		// FIXME: determine adjacents at initialization
		const adjacent = this.parent.children.filter(e => this.adjacentIndices.includes(e.tileIndex))
		adjacent.forEach(wall => wall.ignite(time))
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

class Tile {
	constructor(map, index, position, layout, entity) {
		this.map = map
		this.index = index
		this.position = position
		this.layout = layout
		this.entity = entity
	}

	adjacentTiles() {
		// TODO: Tile should not be aware of how data is laid out in Map
		return [
			this.index - 1,
			this.index + 1,
			this.index - this.map.width,
			this.index + this.map.width
		]
		.filter(idx => 0 <= idx && idx < this.map.size())
		.map(idx => this.map.tileAt(idx))
	}

	directionTo(other) {
		const tx = this.position.x
		const ty = this.position.y
		const ox = other.position.x
		const oy = other.position.y
		if (tx < ox && ty == oy) {
			return "east"
		} else if (tx > ox && ty == oy) {
			return "west"
		} else if (ty < oy && tx == ox) {
			return "north"
		} else if (ty > oy && tx == ox) {
			return "south"
		}
		return null
	}

	isFloor() {
		return !(this.isWall() || this.isExplodable())
	}

	isWall() {
		return wallTypeMap[this.layout] !== undefined
	}

	isExplodable() {
		return wallTypeMap[this.layout-7] !== undefined
	}
}

function isStartOrTeleport(tile) {
	return PLAYER_START_SET.has(tile.entity) || TELEPORTER_SET.has(tile.entity)
}

class TileMap {
	constructor(bytes) {
		this.width = bytes[0]
		this.height = bytes[1]
		this.layout = bytes.slice(2, this.size() + 2)
		this.entities = bytes.slice(this.size() + 2)
	}

	positionAt(index) {
		let x = index % this.width
		let y = this.height - Math.floor(index / this.width)
		return new THREE.Vector2(x, y)
	}

	size() {
		return this.width * this.height
	}

	tileAt(index) {
		return new Tile(this, index, this.positionAt(index), this.layout[index], this.entities[index])
	}

	tiles() {
		const tiles = []
		for (let i = 0; i < this.size(); i++) {
			tiles.push(this.tileAt(i))
		}
		return tiles
	}
}

class FloorGeometry extends THREE.PlaneGeometry {
	constructor(position) {
		super(1, 1)
		this.translate(position.x, position.y, -0.5)
	}
}

class WallGeometry extends THREE.PlaneGeometry {
	constructor(position, direction) {
		super(1, 1)
		this.rotateX(Math.PI / 2)
		this.translate(0, -0.5, 0)
		const coeffs = {
			west: -1,
			south: 0,
			east: 1,
			north: 2
		}
		this.rotateZ(coeffs[direction] * Math.PI / 2)
		this.translate(position.x, position.y, 0)
	}
}

function setupMaze(map, scene) {
	const immutable = new THREE.Group()
	const explodable = new THREE.Group()

	const floorGeometry = new THREE.Geometry()
	const wallGeometry = new Map()

	const visited = Array(map.size()).fill(false)
	const queue = map.tiles().filter(isStartOrTeleport)
	queue.forEach(tile => visited[tile.index] = true)

	while (queue.length) {
		const tile = queue.shift()
		const adjacent = tile.adjacentTiles()
		const walls = adjacent.filter(t => t.isWall())

		floorGeometry.merge(new FloorGeometry(tile.position))

		// add static wall geometry
		walls.forEach(wall => {
			const dir = wall.directionTo(tile)
			const name = getWallName(wall.layout, dir)
			if (!wallGeometry.has(name)) {
				wallGeometry.set(name, new THREE.Geometry())
			}
			wallGeometry.get(name).merge(new WallGeometry(wall.position, dir))
		})

		// add explodeable wall geometry
		if (tile.isExplodable()) {
			const explodingWall = new ExplodingWall(tile.index)
			explodingWall.position.copy(tile.position)
			adjacent.filter(a => a.isFloor()).forEach(floor => {
				const dir = tile.directionTo(floor)
				const name = getWallName(tile.layout-7, dir)
				const geometry = new WallGeometry(new THREE.Vector2(), dir)
				const bufferGeometry = new THREE.BufferGeometry().fromGeometry(geometry)
				const texture = textureCache.get("walls/" + name + ".png")
				texture.anisotropy = 8
				const material = new CustomMaterial({map: texture})
				const mesh = new THREE.Mesh(bufferGeometry, material)
				explodingWall.add(mesh)
			})
			explodingWall.adjacentIndices = adjacent.filter(e => e.isExplodable()).map(e => e.index)
			explodable.add(explodingWall)
		}

		// enqueue adjacent floor tiles that haven't been visited yet
		const unvisited_floors = adjacent.filter(t => !t.isWall()).filter(t => !visited[t.index])
		unvisited_floors.forEach(tile => {
			queue.push(tile)
			visited[tile.index] = true
		})
	}

	// add floor geometry to scene
	const material = new CustomMaterial({color: 0x555555, clampColor: false, pixelate: 0})
	immutable.add(new THREE.Mesh(new THREE.BufferGeometry().fromGeometry(floorGeometry), material))

	// add aggregate wall geometries to scene
	wallGeometry.forEach((geometry, name) => {
		const bufferGeometry = new THREE.BufferGeometry().fromGeometry(geometry)
		const texture = textureCache.get("walls/" + name + ".png")
		texture.anisotropy = 8
		const material = new CustomMaterial({map: texture})
		const mesh = new THREE.Mesh(bufferGeometry, material)
		mesh.name = name
		immutable.add(mesh)
	})
	scene.add(immutable, explodable)
}

function setupPlayerSpawn(map, player) {
	const spawn = map.tiles().filter(t => PLAYER_START_SET.has(t.entity))[0]
	player.position.copy(spawn.position)
	const target = player.position.clone()
	switch (spawn.entity) {
		case PLAYER_START_NORTH: target.y += 1; break
		case PLAYER_START_EAST: target.x += 1; break
		case PLAYER_START_SOUTH: target.y -= 1; break
		case PLAYER_START_WEST: target.x -= 1; break
	}
	player.lookAt(target)
}

class Portal extends THREE.Sprite {

	constructor(position) {
		super()
		this.name = "Portal"
		this.position.copy(position)
		this.fps = 8
		this.light = new THREE.PointLight(0x0042DD, 1, 1.5)
		this.add(this.light)

		textureCache.get("sprites/portal.png", texture => {
			this.spritesheet = new SpriteSheetProxy(texture)
			this.material.map = this.spritesheet
			this.material.needsUpdate = true
		})
	}

	update(time) {
		if (this.material.map && this.material.map.isSpriteSheet) {
			const n = Math.floor(time * this.fps) % this.material.map.frames
			this.material.map.setFrame(n)
		}
		this.light.intensity = 0.5 + 0.2 * Math.abs(Math.sin(0.5 * time)) + 0.02 * Math.abs(Math.sin(this.fps * time))
	}
}

function addPortals(map, scene) {
	const portalTiles = map.tiles().filter(t => [0x18, 0x1F, 0x20, 0x21].includes(t.entity))
	for (let tile of portalTiles) {
		const portal = new Portal(tile.position)
		scene.add(portal)
	}
}

function addEnemies(map, scene) {
	const enemies = [Orc, Troll, Bat, Mage, Demon]
	const mapTiles = map.tiles()
	enemies.forEach(enemy => {
		const spawnPoints = mapTiles.filter(t => enemy.entityIds().includes(t.entity))
		spawnPoints.forEach(spawn => scene.add(new enemy(spawn.position)))
	})
}

export class Game {
	constructor(container, mapName, player) {
		this.container = container
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
	}

	onKey(value) {
		const binds = bindsFor(this.player)
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
		this.renderer.render(this.scene, this.player.camera)
		if (this.isActive) {
			requestAnimationFrame(this.render.bind(this))
		}
	}

	resizeView(width, height) {
		this.renderer.setSize(width, height)
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
			} else {
				eventHandlers.forEach(([e, f]) => document.removeEventListener(e, f))
			}
		})

		const that = this
		fetch("maps/" + this.mapName + ".c3dmap")
		.then(function(response) {
			return response.arrayBuffer()
		})
		.then(function(buffer) {
			// TODO: Game should not be aware of map format
			const map = new TileMap(new Uint8Array(buffer))
			console.log("map dimensions: " + map.width + "x" + map.height)
			const hellish = map.layout.includes(7)
			const fogColor = hellish ? 0x330000 : 0x000000  // hell gets red tint
			that.scene.fog = new THREE.Fog(fogColor, 1, Math.max(40, 1.25 * Math.max(map.width, map.height)))
			setupMaze(map, that.maze)
			setupPlayerSpawn(map, that.player)
			addPortals(map, that.maze)
			addEnemies(map, that.maze)
			that.scene.add(that.maze)
			that.play()
		})
	}
}
