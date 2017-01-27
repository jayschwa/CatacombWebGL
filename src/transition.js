import { BoxBufferGeometry, Mesh, OrthographicCamera, PlaneBufferGeometry, Scene, ShaderMaterial, UniformsLib, UniformsUtils } from "three"

const vertexShader = `
#define USE_MAP = 1;
#include <uv_pars_vertex>

void main() {
	#include <begin_vertex>
	#include <project_vertex>
	#include <uv_vertex>
}`

const fragmentShader = `
uniform sampler2D tex1;
uniform sampler2D tex2;
uniform float weight;

#define USE_MAP = 1;
#include <uv_pars_fragment>

void main() {
	vec4 color1 = texture2D(tex1, vUv);
	vec4 color2 = texture2D(tex2, vUv);
	gl_FragColor = mix(color1, color2, weight);
}`

class TransitionMaterial extends ShaderMaterial {
	constructor(tex1, tex2) {
		const uniforms = UniformsUtils.merge([
			UniformsLib.common,
			{
				tex1: {value: tex1},
				tex2: {value: tex2},
				weight: {value: 0.0}
			}
		])
		super({
			vertexShader: vertexShader,
			fragmentShader: fragmentShader,
			uniforms: uniforms,
		})
	}
}

export class Transition {
	constructor(width, height, fbo1, fbo2) {
		this.fbo1 = fbo1
		this.fbo2 = fbo2
		this.camera = new OrthographicCamera(-width/2, width/2, height/2, -height/2, -10, 10)
		this.material = new TransitionMaterial(fbo1.texture, fbo2.texture)
		this.plane = new Mesh(new PlaneBufferGeometry(width, height), this.material)
		this.scene = new Scene()
		this.scene.add(this.camera, this.plane)
	}

	setMix(mix) {
		this.material.uniforms.weight.value = mix
	}

	setSize(width, height) {
		this.camera.left = -width/2
		this.camera.right = width/2
		this.camera.top = height/2
		this.camera.bottom = -height/2
		this.camera.updateProjectionMatrix()
		// TODO: update plane size
	}
}
