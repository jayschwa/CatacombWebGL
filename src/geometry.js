import { PlaneGeometry } from "three"

export class FloorGeometry extends PlaneGeometry {
	constructor(position) {
		super(1, 1)
		this.translate(position.x, position.y, -0.5)
	}
}

export class WallGeometry extends PlaneGeometry {
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
