import nodeResolve from "rollup-plugin-node-resolve";
import uglify from "rollup-plugin-uglify";
import { minify } from "uglify-js";

export default {
  entry: "src/cat3d.js",
  dest: "build/cat3d.js",
  format: "iife",
  moduleName: "Catacomb3D",
  sourceMap: true,
  plugins: [
  	nodeResolve(),
  	uglify({}, minify)
  ]
};
