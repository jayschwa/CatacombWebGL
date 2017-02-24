export class Clock {
	constructor(startTime) {
		this.elapsedTime = startTime || 0
		this.running = false
	}

	getElapsedTime() {
		if (this.running) {
			const currentTime = performance.now() / 1000
			this.elapsedTime += currentTime - this.oldTime
			this.oldTime = currentTime
		}
		return this.elapsedTime
	}

	start() {
		this.oldTime = performance.now() / 1000
		this.running = true
	}

	pause() {
		this.running = false
	}
}