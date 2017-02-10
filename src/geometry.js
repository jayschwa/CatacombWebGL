import { PlaneGeometry } from "three"

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
		directions = ["south", "east", "north", "west"]
		this.rotateZ(directions.indexOf(direction) * Math.PI / 2)
		if (position) {
			this.translate(position.x, position.y, 0)
		}
	}
}
