import nodeResolve from "rollup-plugin-node-resolve";

export default {
  entry: "src/cat3d.js",
  dest: "build/cat3d.js",
  format: "iife",
  moduleName: "Catacomb3D",
  sourceMap: "inline",
  plugins: [nodeResolve()]
};
