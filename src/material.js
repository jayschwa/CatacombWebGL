import { Color, ShaderMaterial, UniformsLib, UniformsUtils } from "three"

const vertexShader = `
varying vec3 vNormal;
varying vec3 vModelPosition;

#include <common>
#include <fog_pars_vertex>
#include <uv_pars_vertex>

void main() {
	#include <begin_vertex>
	#include <project_vertex>

	#include <beginnormal_vertex>
	#include <defaultnormal_vertex>

	vNormal = normalize(transformedNormal);
	vModelPosition = transformed;

	#include <fog_vertex>
	#include <uv_vertex>
}`

const fragmentShader = `
uniform bool clampColor;
uniform vec3 diffuse;
uniform float interweaveMin;
uniform float interweaveSteps;
uniform float opacity;
uniform int pixelate;

uniform mat4 modelViewMatrix;

varying vec3 vNormal;
varying vec3 vModelPosition;

vec3 colorPalette[16];

void initColorPalette() {
	colorPalette[0] = vec3(0, 0, 0);
	colorPalette[1] = vec3(0, 0, 2.0/3.0);
	colorPalette[2] = vec3(0, 2.0/3.0, 0);
	colorPalette[3] = vec3(0, 2.0/3.0, 2.0/3.0);
	colorPalette[4] = vec3(2.0/3.0, 0, 0);
	colorPalette[5] = vec3(2.0/3.0, 0, 2.0/3.0);
	colorPalette[6] = vec3(2.0/3.0, 1.0/3.0, 0);
	colorPalette[7] = vec3(2.0/3.0, 2.0/3.0, 2.0/3.0);
	colorPalette[8] = vec3(1.0/3.0, 1.0/3.0, 1.0/3.0);
	colorPalette[9] = vec3(1.0/3.0, 1.0/3.0, 1);
	colorPalette[10] = vec3(1.0/3.0, 1, 1.0/3.0);
	colorPalette[11] = vec3(1.0/3.0, 1, 1);
	colorPalette[12] = vec3(1, 1.0/3.0, 1.0/3.0);
	colorPalette[13] = vec3(1, 1.0/3.0, 1);
	colorPalette[14] = vec3(1, 1, 1.0/3.0);
	colorPalette[15] = vec3(1, 1, 1);
}

vec3 clampToPalette(const in vec3 color) {
	float smallestDistance = 100000.0;
	vec3 closestColor = color;
	for (int i = 0; i < 16; i++) {
		float distance = distance(color, colorPalette[i]);
		if (distance < smallestDistance) {
			smallestDistance = distance;
			closestColor = colorPalette[i];
		}
	}
	return closestColor;
}

#include <common>
#include <bsdfs>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <lights_pars_maps>
#include <map_pars_fragment>
#include <uv_pars_fragment>

void RE_Direct_Pixelated(const in IncidentLight directLight, const in GeometricContext geometry, const in vec3 material, inout ReflectedLight reflectedLight) {

	float dotNL = saturate(dot(geometry.normal, directLight.direction));
	vec3 irradiance = dotNL * directLight.color;

	#ifndef PHYSICALLY_CORRECT_LIGHTS
		irradiance *= PI; // punctual light
	#endif

	reflectedLight.directDiffuse += mix(irradiance * material, irradiance, 0.5);
}

void RE_IndirectDiffuse_Pixelated(const in vec3 irradiance, const in GeometricContext geometry, const in vec3 material, inout ReflectedLight reflectedLight) {
	reflectedLight.indirectDiffuse += irradiance * material;  // FIXME: this is a color right now
}

#define RE_Direct          RE_Direct_Pixelated
#define RE_IndirectDiffuse RE_IndirectDiffuse_Pixelated

void main() {
	initColorPalette();

	vec4 diffuseColor = vec4(diffuse, opacity);

	#include <map_fragment>

	#include <normal_fragment_begin>
	#include <normal_fragment_maps>

	ReflectedLight reflectedLight = ReflectedLight(vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0));

	vec3 material = diffuseColor.rgb;

	vec3 modelPosition = vModelPosition;
	float interweave = 1.0;
	if (pixelate > 0) {
		modelPosition = floor(modelPosition * float(pixelate));
		float interweaveStep = (1.0 - interweaveMin) / interweaveSteps;
		interweave = interweaveMin + interweaveStep * mod(dot(modelPosition, vec3(1)), interweaveSteps);
		modelPosition /= float(pixelate);
	}
	vec3 vViewPosition = -(modelViewMatrix * vec4(modelPosition, 1.0)).xyz;

	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>

	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	outgoingLight += reflectedLight.directDiffuse * interweave;
	gl_FragColor = vec4(outgoingLight, diffuseColor.a);

	if (clampColor) {
		gl_FragColor.rgb = clampToPalette(gl_FragColor.rgb);
	}

	#include <fog_fragment>
}`

export class CustomMaterial extends ShaderMaterial {
	constructor(params) {
		const uniforms = UniformsUtils.merge([
			UniformsLib.common,
			UniformsLib.fog,
			UniformsLib.lights,
			{
				clampColor: {value: true},
				interweaveMin: {value: 2/3},
				interweaveSteps: {value: 3},
				pixelate: {value: 64}
			}
		])
		super({
			vertexShader: vertexShader,
			fragmentShader: fragmentShader,
			uniforms: uniforms,
			fog: true,
			lights: true
		})
		this.setValues(params)
	}

	get clampColor() { return this.uniforms.clampColor.value }
	set clampColor(bool) { this.uniforms.clampColor.value = bool }

	get color() { return this.uniforms.diffuse.value }
	set color(value) {
		if (value.isColor) {
			this.uniforms.diffuse.value = value
		} else {
			this.uniforms.diffuse.value = new Color(value)
		}
	}

	get interweaveMin() { return this.uniforms.interweaveMin.value }
	set interweaveMin(value) { this.uniforms.interweaveMin.value = value }

	get interweaveSteps() { return this.uniforms.interweaveSteps.value }
	set interweaveSteps(value) { this.uniforms.interweaveSteps.value = value }

	get map() { return this.uniforms.map.value }
	set map(value) {
		this.uniforms.map.value = value
	}

	get pixelate() { return this.uniforms.pixelate.value }
	set pixelate(value) { this.uniforms.pixelate.value = value }
}
