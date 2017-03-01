import { BufferGeometry, Geometry, Mesh, Scene, Vector2, Vector3 } from "three"
import * as enemies from "./enemies"
import * as misc from "./entities"
import { Door, ExplodingWall } from "./environment"
import { FloorGeometry, WallGeometry } from "./geometry"
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

function createWallMeshes(geometryDict) {
	return Object.keys(geometryDict).map(name => {
		const geometry = new BufferGeometry().fromGeometry(geometryDict[name])
		const texture = textureCache.get("walls/" + name + ".png")
		texture.anisotropy = 8
		const material = new CustomMaterial({map: texture})
		return new Mesh(geometry, material)
	})
}

function mergeWallGeometry(tile, adjacentTiles, geometryDict, position) {
	geometryDict = geometryDict || {}
	const variants = {
		light: ["east", "west"],
		dark: ["north", "south"]
	}
	Object.keys(variants).forEach(v => {
		const name = tile.value + "_" + v
		variants[v].forEach(face => {
			if (adjacentTiles[face] && adjacentTiles[face].type != tile.type) {
				geometryDict[name] = geometryDict[name] || new Geometry()
				geometryDict[name].merge(new WallGeometry(face, position))
			}
		})
	})
	return geometryDict
}

export function constructLayout(map, parent) {
	const doors = {}
	const explodingWalls = {}
	const floor = new Geometry()
	const walls = {}

	// TODO: attach these methods somewhere else
	map.getTile = function(x, y) {
		try {
			const symbol = this.layout[this.height-1-y][x]
			if (symbol == " ") {
				return {type: "floor"}
			} else {
				return this.legend[symbol]
			}
		} catch (ex) {
			return null
		}
	}

	map.adjacentTiles = function(x, y) {
		return {
			east: this.getTile(x+1, y),
			west: this.getTile(x-1, y),
			north: this.getTile(x, y+1),
			south: this.getTile(x, y-1)
		}
	}

	for (let x = 0; x < map.width; x++) {
		for (let y = 0; y < map.height; y++) {
			const position = new Vector2(x, y)
			const tile = map.getTile(x, y)
			const removeFunc = () => map.layout[map.height-1-y][x] = " "

			if (tile.type == "wall") {
				mergeWallGeometry(tile, map.adjacentTiles(x, y), walls, position)
			} else if (tile.type == "exploding_wall") {
				const wall = new ExplodingWall({position: position, wall: tile.value}, removeFunc)
				wall.add(...createWallMeshes(mergeWallGeometry(tile, map.adjacentTiles(x, y))))
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

export function spawnEntities(entities, parent) {
	const entityClasses = Object.assign({}, enemies, items, misc)
	entities.forEach(entity => {
		if (entity.type == "Player") {
			return
		}
		const position = new Vector3(entity.position[0], entity.position[1], 0)
		const entityClass = entityClasses[entity.type]
		if (entityClass) {
			parent.add(new entityClass(entity))
		} else {
			console.warn("class not found for", entity.type, "at", position)
		}
	})
}
