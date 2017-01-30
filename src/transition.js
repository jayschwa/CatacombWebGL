import { BoxBufferGeometry, Mesh, OrthographicCamera, PlaneBufferGeometry, Scene, ShaderMaterial, UniformsLib, UniformsUtils } from "three"

// TODO: Sort out copyright of https://github.com/stegu/webgl-noise

const vertexShader = `
#define USE_MAP = 1;
#include <uv_pars_vertex>

void main() {
	#include <begin_vertex>
	#include <project_vertex>
	#include <uv_vertex>
}`

const fragmentShader = `
uniform float aspectRatio;
uniform float pixelate;
uniform sampler2D tex1;
uniform sampler2D tex2;
uniform float weight;

#define USE_MAP = 1;
#include <uv_pars_fragment>

vec4 mod289(vec4 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x)
{
  return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

vec2 fade(vec2 t) {
  return t*t*t*(t*(t*6.0-15.0)+10.0);
}

// Classic Perlin noise
float cnoise(vec2 P)
{
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod289(Pi); // To avoid truncation effects in permutation
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;

  vec4 i = permute(permute(ix) + iy);

  vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0 ;
  vec4 gy = abs(gx) - 0.5 ;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;

  vec2 g00 = vec2(gx.x,gy.x);
  vec2 g10 = vec2(gx.y,gy.y);
  vec2 g01 = vec2(gx.z,gy.z);
  vec2 g11 = vec2(gx.w,gy.w);

  vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));
  g00 *= norm.x;  
  g01 *= norm.y;  
  g10 *= norm.z;  
  g11 *= norm.w;  

  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));

  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
  return 2.3 * n_xy;
}

// Classic Perlin noise, periodic variant
float pnoise(vec2 P, vec2 rep)
{
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod(Pi, rep.xyxy); // To create noise with explicit period
  Pi = mod289(Pi);        // To avoid truncation effects in permutation
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;

  vec4 i = permute(permute(ix) + iy);

  vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0 ;
  vec4 gy = abs(gx) - 0.5 ;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;

  vec2 g00 = vec2(gx.x,gy.x);
  vec2 g10 = vec2(gx.y,gy.y);
  vec2 g01 = vec2(gx.z,gy.z);
  vec2 g11 = vec2(gx.w,gy.w);

  vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));
  g00 *= norm.x;  
  g01 *= norm.y;  
  g10 *= norm.z;  
  g11 *= norm.w;  

  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));

  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
  return 2.3 * n_xy;
}

void main() {
	vec4 color1 = texture2D(tex1, vUv);
	vec4 color2 = texture2D(tex2, vUv);
	vec2 pixel = vUv * vec2(pixelate * aspectRatio, pixelate);
	pixel = floor(pixel) + vec2(0.5);
	float noise = cnoise(pixel);
	noise = step(1.0-2.0*weight, noise);
	gl_FragColor = mix(color1, color2, noise);
}`

class TransitionMaterial extends ShaderMaterial {
	constructor(tex1, tex2) {
		const uniforms = UniformsUtils.merge([
			UniformsLib.common,
			{
				aspectRatio: {value: 1.0},
				pixelate: {value: 128.0},
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
		this.plane = new Mesh(new PlaneBufferGeometry(1, 1), this.material)
		this.scene = new Scene()
		this.scene.add(this.camera, this.plane)
	}

	setMix(mix) {
		this.material.uniforms.weight.value = mix
	}

	setSize(width, height) {
		this.material.uniforms.aspectRatio.value = width/height
		this.camera.left = -width/2
		this.camera.right = width/2
		this.camera.top = height/2
		this.camera.bottom = -height/2
		this.camera.updateProjectionMatrix()
		this.plane.scale.set(width, height, 1)
	}
}
