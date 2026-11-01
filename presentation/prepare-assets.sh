#!/bin/sh
set -eu

presentation_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
release_dir="$presentation_dir/public/release"
reference_dir="$presentation_dir/public/reference"
mkdir -p "$release_dir"
mkdir -p "$reference_dir"

for photo in \
  photo-03-motion-check.jpg \
  photo-12-first-rollout.jpg \
  photo-18-display-installed.jpg
do
  if [ ! -s "$release_dir/$photo" ]; then
    gh release download assets --repo pao-1024/pao --pattern "$photo" --dir "$release_dir"
  fi
done

cp "$presentation_dir/../simulator/images/simulator-overview.png" "$reference_dir/simulator-overview.png"
cp "$presentation_dir/../experimental/platform/agent-hardware-preview.jpg" "$reference_dir/agent-hardware-preview.jpg"
cp "$presentation_dir/../experimental/platform/agent-pcb-preview.jpg" "$reference_dir/agent-pcb-preview.jpg"
cp "$presentation_dir/../experimental/platform/manufacturing-preview.jpg" "$reference_dir/manufacturing-preview.jpg"
