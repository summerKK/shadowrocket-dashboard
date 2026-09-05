/* One-off dev tool: simplify public/map/countries.geojson for the 3D globe.
   Rounds coordinates to 2 decimals (~1km) and drops degenerate rings, which
   cuts triangulation cost and memory for the polygons layer. Deterministic
   rounding keeps shared borders seam-free. Run: node scripts/simplify-geojson.mjs */
import { readFile, writeFile } from 'node:fs/promises';

const file = new URL('../public/map/countries.geojson', import.meta.url);
const geo = JSON.parse(await readFile(file, 'utf8'));
const round = (n) => Math.round(n * 100) / 100;

let before = 0;
let after = 0;
const simplifyRing = (ring) => {
  before += ring.length;
  const out = [];
  let prev = null;
  for (const pt of ring) {
    const p = [round(pt[0]), round(pt[1])];
    if (prev && p[0] === prev[0] && p[1] === prev[1]) continue;
    out.push(p);
    prev = p;
  }
  after += out.length;
  return out.length >= 4 ? out : null;
};

geo.features = geo.features
  .map((f) => {
    const geom = f.geometry;
    if (geom?.type === 'Polygon') {
      const rings = geom.coordinates.map(simplifyRing).filter(Boolean);
      return rings.length ? { ...f, geometry: { type: 'Polygon', coordinates: rings } } : null;
    }
    if (geom?.type === 'MultiPolygon') {
      const polys = geom.coordinates
        .map((rings) => rings.map(simplifyRing).filter(Boolean))
        .filter((g) => g.length);
      return polys.length ? { ...f, geometry: { type: 'MultiPolygon', coordinates: polys } } : null;
    }
    return null;
  })
  .filter(Boolean);

const out = JSON.stringify(geo);
await writeFile(file, out);
console.log(`features: ${geo.features.length}, points: ${before} -> ${after} (${Math.round((1 - after / before) * 100)}% fewer), size: ${(out.length / 1024).toFixed(0)}KB`);
