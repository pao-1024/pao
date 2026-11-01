#!/bin/sh
set -eu

presentation_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cache_dir="$presentation_dir/../tmp/presentation-assets"
release_dir="$presentation_dir/public/release"
reference_dir="$presentation_dir/public/reference"
mkdir -p "$cache_dir" "$release_dir" "$reference_dir"

photo=photo-12-first-rollout.jpg
if [ ! -s "$cache_dir/$photo" ]; then
  gh release download assets --repo pao-1024/pao --pattern "$photo" --dir "$cache_dir"
fi
cp "$cache_dir/$photo" "$release_dir/$photo"
cp "$presentation_dir/../hardware/schematic.svg" "$reference_dir/pao-schematic.svg"
cp "$presentation_dir/../simulator/images/simulator-overview.png" "$reference_dir/simulator-overview.png"
cp "$presentation_dir/../experimental/platform/agent-hardware-preview.jpg" "$reference_dir/agent-hardware-preview.jpg"
cp "$presentation_dir/../experimental/platform/agent-pcb-preview.jpg" "$reference_dir/agent-pcb-preview.jpg"
cp "$presentation_dir/../experimental/platform/manufacturing-preview.jpg" "$reference_dir/manufacturing-preview.jpg"
