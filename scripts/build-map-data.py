"""Convert DB-IP Lite CSV and Natural Earth GeoJSON into offline map assets.

Usage: python3 scripts/build-map-data.py country.csv.gz world.geojson
See data/NOTICE.md for sources and licenses.
"""
import csv
import gzip
import ipaddress
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parent.parent
blocks = {4: bytearray(), 6: bytearray()}
with gzip.open(sys.argv[1], 'rt') as source:
    for start, end, country in csv.reader(source):
        first, last = ipaddress.ip_address(start), ipaddress.ip_address(end)
        blocks[first.version].extend(first.packed + last.packed + country.encode('ascii'))
for family, data in blocks.items():
    (root / f'data/country-v{family}.bin.gz').write_bytes(gzip.compress(data, mtime=0))

world = json.loads(Path(sys.argv[2]).read_text())
paths, countries = [], {}
for feature in world['features']:
    props, geometry = feature['properties'], feature['geometry']
    code = props.get('ISO_A2_EH') or props.get('ISO_A2') or ''
    if len(code) == 2 and code != '-99':
        countries[code] = {'name': props.get('NAME_ZH') or props.get('NAME'), 'lon': props['LABEL_X'], 'lat': props['LABEL_Y']}
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    for polygon in polygons:
        d = ' '.join('M' + ' L'.join(f'{(lon + 180) * 3:.1f},{(90 - lat) * 3:.1f}' for lon, lat in ring) + ' Z' for ring in polygon)
        paths.append({'code': code if len(code) == 2 and code != '-99' else '', 'd': d})
# Small regions omitted from Natural Earth's 110m polygons still need country anchors.
countries.update({'HK': {'name': '香港', 'lon': 114.17, 'lat': 22.32}, 'MO': {'name': '澳门', 'lon': 113.54, 'lat': 22.20}, 'SG': {'name': '新加坡', 'lon': 103.82, 'lat': 1.35}})
(root / 'public/map/world.json').write_text(json.dumps({'paths': paths, 'countries': countries}, ensure_ascii=False, separators=(',', ':')))
