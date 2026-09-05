# Offline map data

IP geolocation: DB-IP IP to Country Lite, September 2026.
Source: https://download.db-ip.com/free/dbip-country-lite-2026-09.csv.gz
License: Creative Commons Attribution 4.0 International
https://creativecommons.org/licenses/by/4.0/
Attribution: https://db-ip.com/

Modified into sorted fixed-width binary range tables (start address, end address,
two ASCII country-code bytes), gzip compressed. IPv4 rows are 10 bytes; IPv6 rows
are 34 bytes. Addresses are in network byte order. Accuracy is country-level,
not an actual machine location. No IP queries leave the local dashboard.

World outlines and country label anchors: Natural Earth, public domain.
Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson
https://www.naturalearthdata.com/about/terms-of-use/
Modified to equirectangular SVG paths; HK, MO and SG anchors added manually.

Rebuild with `python3 scripts/build-map-data.py country.csv.gz world.geojson`.
Downloads and updates are manual, not performed at app runtime.
