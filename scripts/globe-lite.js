// Builds vendor/globe-lite.json: simplified state outlines and world land for drawing the
// zoomed-out globe quickly. Run after updating the us-atlas or world-atlas files:
//   node scripts/globe-lite.js path/to/us-atlas/states-10m.json path/to/world-atlas/land-110m.json
const fs = require("fs");
const { presimplify, simplify, sphericalTriangleArea } = require("topojson-simplify");
const { feature } = require("topojson-client");

const [statesFile, landFile] = process.argv.slice(2);
const lite = (file, minWeight) => {
  const topo = JSON.parse(fs.readFileSync(file, "utf8"));
  return simplify(presimplify(topo, sphericalTriangleArea), minWeight);
};
// Two decimals is about 1 km, well under a pixel at the zoom levels these are drawn at.
const round = c => typeof c[0] === "number" ? [Math.round(c[0] * 100) / 100, Math.round(c[1] * 100) / 100] : c.map(round);
const geom = g => ({ type: g.type, coordinates: round(g.coordinates) });

const st = lite(statesFile, 3e-6);
const states = feature(st, st.objects.states).features
  .filter(f => f.id < "60")
  .map(f => ({ type: "Feature", id: f.id, properties: f.properties, geometry: geom(f.geometry) }));
const ld = lite(landFile, 4e-6);
// Land as separate polygons, so the ones on the far side of the globe can be skipped.
const land = feature(ld, ld.objects.land).features
  .flatMap(f => f.geometry.type === "MultiPolygon" ? f.geometry.coordinates.map(c => ({ type: "Polygon", coordinates: c })) : [f.geometry])
  .map(geom);
fs.writeFileSync(__dirname + "/../vendor/globe-lite.json", JSON.stringify({ states, land }));
console.log("wrote vendor/globe-lite.json:", states.length, "states,", land.length, "land polygons");
