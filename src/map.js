import { BufferGeometry, Geometry, Mesh, Scene, Vector2 } from "three"
import { Door, ExplodingWall } from "./environment"
import { FloorGeometry, WallGeometry } from "./geometry"
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
	.filter(filterFunc || e => true)
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

export function addStaticMeshes(map, parent) {
	const doors = {}
	const explodingWalls = {}
	const floor = new Geometry()
	const walls = {}

	// TODO: attach these methods somewhere else
	map.getTile = function(x, y) {
		try {
			const symbol = this.layout[this.height-1-y][x]
			return this.legend[symbol]
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

			if (tile.type.includes("wall")) {
				const adjacent = map.adjacentTiles(x, y)
				const variants = {
					light: ["east", "west"],
					dark: ["north", "south"]
				}
				const exploding = tile.type == "exploding_wall"
				const geometry = exploding ? {} : walls
				const translate = exploding ? new Vector2(0, 0) : position // FIXME
				Object.keys(variants).forEach(v => {
					const name = tile.value + "_" + v
					const faces = variants[v]
					faces.forEach(face => {
						if (adjacent[face] && adjacent[face].type != tile.type) {
							geometry[name] = geometry[name] || new Geometry()
							geometry[name].merge(new WallGeometry(translate, face))
						}
					})
				})
				if (exploding) {
					const wall = new ExplodingWall(position)
					wall.add(...createWallMeshes(geometry))
					connectAdjacent(explodingWalls, wall, x, y)
					parent.add(wall)
				}
			} else if (tile.type == "door") {
				const door = new Door(tile.value, position)
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