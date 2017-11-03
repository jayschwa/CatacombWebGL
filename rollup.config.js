import nodeResolve from "rollup-plugin-node-resolve";
import uglify from "rollup-plugin-uglify";
import { minify } from "uglify-es";

export default {
	input: "src/main.js",
	output: {
		file: "build/cat3d.js",
		format: "iife",
		name: "Catacomb3D",
		sourcemap: true
	},
	plugins: [
		nodeResolve()
		//uglify({}, minify)
	]
};
