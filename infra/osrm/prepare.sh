#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
command -v osmium >/dev/null || { echo "Instale osmium-tool antes de preparar os dados." >&2; exit 1; }
mkdir -p data
candidate=$(mktemp -d "$PWD/data/candidate.XXXXXXXX")
curl --fail --location --retry 3 https://download.geofabrik.de/south-america/brazil/nordeste-latest.osm.pbf -o "$candidate/nordeste.osm.pbf"
# Sergipe com margem nas fronteiras; sem limitar artificialmente nas divisas estaduais.
osmium extract -b -38.30,-11.60,-36.20,-9.40 "$candidate/nordeste.osm.pbf" -o "$candidate/sergipe.osm.pbf"
image=ghcr.io/project-osrm/osrm-backend:v6.0.0
for operation in extract partition customize; do
  if [ "$operation" = extract ]; then
    docker run --rm -v "$candidate:/data" "$image" osrm-extract -p /opt/car.lua /data/sergipe.osm.pbf
  else
    docker run --rm -v "$candidate:/data" "$image" "osrm-$operation" /data/sergipe.osrm
  fi
done
# Candidate remains isolated; promotion is explicit after a routing smoke test.
printf 'Dados preparados em %s. Valide e promova conforme docs/MOTORISTA_PWA.md.\n' "$candidate"
