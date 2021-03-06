import { AmbientLight, BufferGeometry, Fog, Geometry, Mesh, Scene, Vector2, Vector3 } from "three"
import * as enemies from "./enemies"
import * as misc from "./entities"
import { Door, ExplodingWall } from "./environment"
import { FloorGeometry, WallGeometry, createWallMeshes, mergeWallGeometry } from "./geometry"
import * as items from "./items"
import { CustomMaterial } from "./material"
import { textureCache } from "./utils"

function connectAdjacent(objects, obj, x, y, filterFunc) {
	[
		objects[[x-1, y]],
		objects[[x+1, y]],
		objects[[x, y-1]],
		objects[[x, y+1]]
	]
	.filter(e => e !== undefined)
	.filter(filterFunc || (e => true))
	.forEach(neighbor => {
		obj.adjacent.push(neighbor)
		neighbor.adjacent.push(obj)
	})
	objects[[x, y]] = obj
}

export class Map {
	constructor(props) {
		Object.assign(this, props)
		if (typeof this.layout[0] === "string") {
			this.layout = this.layout.map(line => line.split(""))
		}
	}

	getTile(position) {
		const row = this.height-1-Math.round(position.y)
		const col = Math.round(position.x)
		if (row < 0 || row >= this.height || col < 0 || col >= this.width) {
			return null
		}
		const symbol = this.layout[row][col]
		if (symbol == " ") {
			return {type: "floor"}
		} else {
			return this.legend[symbol]
		}
	}

	adjacentTiles(position) {
		const x = position.x
		const y = position.y
		return {
			east: this.getTile(new Vector2(x+1, y)),
			west: this.getTile(new Vector2(x-1, y)),
			north: this.getTile(new Vector2(x, y+1)),
			south: this.getTile(new Vector2(x, y-1))
		}
	}

	/** List of cardinal directions from position that contain a different type of tile. **/
	adjacentBorders(position) {
		const tile = this.getTile(position)
		const adjacentTiles = this.adjacentTiles(position)
		return Object.keys(adjacentTiles).filter(d => {
			const adj = adjacentTiles[d]
			return adj && adj.type != tile.type
		})
	}

	getPlayerStart() {
		const isPlayer = entity => entity.type == "Player"
		return this.entities.filter(isPlayer).shift() || this.playerStart
	}

	toScene() {
		const scene = new Scene()
		scene.add(new AmbientLight())
		if (this.fog) {
			scene.fog = new Fog(this.fog.color, this.fog.near, this.fog.far)
		}
		constructLayout(this, scene)
		spawnEntities(this.entities, scene)
		return scene
	}
}

function constructLayout(map, parent) {
	const doors = {}
	const explodingWalls = {}
	const floor = new Geometry()
	const walls = {}

	for (let x = 0; x < map.width; x++) {
		for (let y = 0; y < map.height; y++) {
			const position = new Vector2(x, y)
			const tile = map.getTile(position)
			const borders = map.adjacentBorders(position)
			const removeFunc = () => map.layout[map.height-1-y][x] = " "

			if (tile.type == "wall") {
				mergeWallGeometry(tile.value, borders, walls, position)
			} else if (tile.type == "exploding_wall") {
				const wall = new ExplodingWall({position: position, wall: tile.value, faces: borders}, removeFunc)
				connectAdjacent(explodingWalls, wall, x, y)
				parent.add(wall)
			} else if (tile.type == "door") {
				const door = new Door({color: tile.value, position: position}, removeFunc)
				connectAdjacent(doors, door, x, y, d => d.color == door.color)
				parent.add(door)
			}
			if (tile.type != "wall") {
				floor.merge(new FloorGeometry(position))
			}
		}
	}

	// add floor geometry to scene
	const material = new CustomMaterial({color: 0x555555, clampColor: false, pixelate: 0})
	parent.add(new Mesh(new BufferGeometry().fromGeometry(floor), material))

	// add aggregate wall geometries to scene
	parent.add(...createWallMeshes(walls))
}

function spawnEntities(entities, parent) {
	const entityClasses = Object.assign({}, enemies, items, misc, {ExplodingWall: ExplodingWall})
	entities.forEach(entity => {
		const position = new Vector3(entity.position[0], entity.position[1], 0)
		const entityClass = entityClasses[entity.type]
		if (entityClass) {
			parent.add(new entityClass(entity))
		} else {
			console.warn("class not found for", entity.type, "at", position)
		}
	})
}
