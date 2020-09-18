import nodeResolve from "@rollup/plugin-node-resolve";
import { terser } from "rollup-plugin-terser";

export default {
	input: "src/main.js",
	output: {
		file: "build/cat3d.js",
		format: "iife",
		name: "Catacomb3D",
		sourcemap: true,
	},
	plugins: [
		nodeResolve(),
		terser()
	]
};
