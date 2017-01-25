import * as THREE from "three"
import { Entity, Fireball, Portal, Teleporter } from "./entities"
import { Bat, Demon, Mage, Orc, Troll } from "./enemies"
import { Door } from "./environment"
import { FloorGeometry, WallGeometry } from "./geometry"
import { Bolt, Nuke, Potion, RedKey, YellowKey, GreenKey, BlueKey, Scroll, Treasure } from "./items"
import { CustomMaterial } from "./material"
import { Player } from "./player"
import { SpriteSheetProxy, textureCache } from "./utils"

THREE.Vector3.prototype.copy = function(v) {
	this.x = v.x
	this.y = v.y
	if (v.isVector3) {
		this.z = v.z
	}
	return this
}

const doorTypeMap = {
	0x14: "red",
	0x18: "yellow",
	0x1C: "green",
	0x20: "blue"
}

const wallTypeMap = {
	0x01: "stone",
	0x02: "slime",
	0x03: "white",
	0x04: "blood",
	0x05: "tar",
	0x06: "gold",
	0x07: "hell"
}

function getWallName(type, direction) {
	const suffix = ["north", "south"].includes(direction) ? "dark" : "light"
	return wallTypeMap[type] + "_" + suffix
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
	constructor(position) {
		super()
		const geometry = new THREE.BoxBufferGeometry(1, 1, 1)
		geometry.rotateX(Math.PI / 2)
		const texture = textureCache.get("walls/exploding.png", texture => {
			this.box.material.map = new SpriteSheetProxy(texture, 64, 3)
			this.box.material.needsUpdate = true
		})
		const material = new THREE.MeshBasicMaterial({map: texture, transparent: true})
		this.position.copy(position)
		this.box = new THREE.Mesh(geometry, material)
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

	isDoor() {
		return doorTypeMap[this.layout] !== undefined
	}

	isFloor() {
		return !(this.isDoor() || this.isWall() || this.isExplodable())
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

function setupMaze(map, scene) {
	const mapTiles = map.tiles()

	const immutable = new THREE.Group()
	const explodable = new THREE.Group()

	const doors = Array(map.size())
	const explodingWalls = Array(map.size())

	const floorGeometry = new THREE.Geometry()
	const wallGeometry = new Map()

	const visited = Array(map.size()).fill(false)
	const queue = mapTiles.filter(isStartOrTeleport)
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

		// doors
		if (tile.isDoor()) {
			const color = doorTypeMap[tile.layout]
			const door = new Door(color, tile.position)
			doors[tile.index] = door
			scene.add(door)
		}

		// add explodeable wall geometry
		if (tile.isExplodable()) {
			const explodingWall = new ExplodingWall(tile.position)
			adjacent.filter(a => a.isDoor() || a.isFloor()).forEach(floor => {
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
			explodingWalls[tile.index] = explodingWall
			explodable.add(explodingWall)
		}

		// enqueue adjacent floor tiles that haven't been visited yet
		const unvisited_floors = adjacent.filter(t => !t.isWall()).filter(t => !visited[t.index])
		unvisited_floors.forEach(tile => {
			queue.push(tile)
			visited[tile.index] = true
		})
	}

	for (let i = 0; i < doors.length; i++) {
		const door = doors[i]
		if (door) {
			const tile = mapTiles[i]
			for (let k of tile.adjacentTiles().map(t => t.index)) {
				if (doors[k] && doors[k].color == door.color) {
					door.adjacent.push(doors[k])
				}
			}
		}
	}

	for (let i = 0; i < explodingWalls.length; i++) {
		const expWall = explodingWalls[i]
		if (expWall) {
			const tile = mapTiles[i]
			for (let k of tile.adjacentTiles().map(t => t.index)) {
				if (explodingWalls[k]) {
					expWall.adjacent.push(explodingWalls[k])
				}
			}
		}
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

function addPortals(map, scene) {
	const portalTiles = map.tiles().filter(t => [0x18, 0x1F, 0x20, 0x21].includes(t.entity))
	const teleporters = {}
	for (let tile of portalTiles) {
		if (tile.entity == 0x18) {
			scene.add(new Portal(tile.position))
		} else {
			const sibling = teleporters[tile.entity]
			if (sibling) {
				scene.add(new Teleporter(tile.position, sibling))
			} else {
				const teleporter = new Teleporter(tile.position)
				scene.add(teleporter)
				teleporters[tile.entity] = teleporter
			}
		}
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

function addItems(map, scene) {
	const items = {
		0x05: Bolt,
		0x06: Nuke,
		0x07: Potion,
		0x08: RedKey,
		0x09: YellowKey,
		0x0A: GreenKey,
		0x0B: BlueKey,
		0x0C: Scroll,
		0x0D: Scroll,
		0x0E: Scroll,
		0x0F: Scroll,
		0x10: Scroll,
		0x11: Scroll,
		0x12: Scroll,
		0x13: Scroll,
		0x15: Treasure
	}
	map.tiles().forEach(tile => {
		const item = items[tile.entity]
		if (item) {
			scene.add(new item(tile.position))
		}
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
				this.player.moveDirection.set(0, 0, 0)
				this.player.updateVelocity()
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
			const fogColor = hellish ? 0x3300 : 0x0000 // hell gets red tint
			that.scene.fog = new THREE.Fog(fogColor, 1, Math.max(40, 1.25 * Math.max(map.width, map.height)))
			setupMaze(map, that.maze)
			setupPlayerSpawn(map, that.player)
			addPortals(map, that.maze)
			addEnemies(map, that.maze)
			addItems(map, that.maze)
			that.scene.add(that.maze)
			that.play()
		})
	}
}
