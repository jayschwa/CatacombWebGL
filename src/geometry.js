import { BufferGeometry, Geometry, Mesh, PlaneGeometry } from "three"
import { CustomMaterial } from "./material"
import { textureCache } from "./utils"

export class FloorGeometry extends PlaneGeometry {
	constructor(position) {
		super(1, 1)
		this.translate(position.x, position.y, -0.5)
	}
}

export class WallGeometry extends PlaneGeometry {
	constructor(direction, position) {
		super(1, 1)
		this.rotateX(Math.PI / 2)
		this.translate(0, -0.5, 0)
		const directions = ["south", "east", "north", "west"]
		this.rotateZ(directions.indexOf(direction) * Math.PI / 2)
		if (position) {
			this.translate(position.x, position.y, 0)
		}
	}
}

export function createWallMeshes(geometryDict) {
	return Object.keys(geometryDict).map(name => {
		const geometry = new BufferGeometry().fromGeometry(geometryDict[name])
		const texture = textureCache.get("walls/" + name + ".png")
		texture.anisotropy = 8
		const material = new CustomMaterial({map: texture})
		const mesh = new Mesh(geometry, material)
		mesh.dispose = function() {
			geometry.dispose()
			material.dispose()
			texture.dispose()
		}
		return mesh
	})
}

export function mergeWallGeometry(name, faces, geometryDict, position) {
	geometryDict = geometryDict || {}
	const suffix = {
		east: "light",
		west: "light",
		north: "dark",
		south: "dark"
	}
	faces.forEach(face => {
		const faceName = name + "_" + suffix[face]
		if (!(faceName in geometryDict)) {
			geometryDict[faceName] = new Geometry()
		}
		geometryDict[faceName].merge(new WallGeometry(face, position))
	})
	return geometryDict
}
