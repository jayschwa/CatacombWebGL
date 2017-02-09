import { BufferGeometry, Geometry, Mesh, Scene, Vector2 } from "three"
import { FloorGeometry, WallGeometry } from "./geometry"
import { CustomMaterial } from "./material"
import { textureCache } from "./utils"

export function addStaticMeshes(map, parent) {
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
			if (tile.type == "wall") {
				const adjacent = map.adjacentTiles(x, y)
				const variants = {
					light: ["east", "west"],
					dark: ["north", "south"]
				}
				Object.keys(variants).forEach(v => {
					const name = tile.value + "_" + v
					const faces = variants[v]
					faces.forEach(face => {
						if (adjacent[face] && adjacent[face].type != "wall") {
							walls[name] = walls[name] || new Geometry()
							walls[name].merge(new WallGeometry(position, face))
						}
					})
				})
			} else {
				floor.merge(new FloorGeometry(position))
			}
		}
	}

	// add floor geometry to scene
	const material = new CustomMaterial({color: 0x555555, clampColor: false, pixelate: 0})
	parent.add(new Mesh(new BufferGeometry().fromGeometry(floor), material))

	// add aggregate wall geometries to scene
	Object.keys(walls).forEach(name => {
		const geometry = new BufferGeometry().fromGeometry(walls[name])
		const texture = textureCache.get("walls/" + name + ".png")
		texture.anisotropy = 8
		const material = new CustomMaterial({map: texture})
		parent.add(new Mesh(geometry, material))
	})
}