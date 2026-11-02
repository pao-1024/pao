#!/bin/sh
set -eu

cd "$(dirname "$0")"
cache=../tmp/presentation-assets
mkdir -p "$cache" public/diagrams public/reference public/videos

for source in diagrams/*.mmd; do
  svg=public/diagrams/$(basename "$source" .mmd).svg
  [ "$svg" -nt "$source" ] && [ "$svg" -nt diagrams/mermaid-config.json ] && continue
  pnpm exec mmdc -q -i "$source" -o "$svg" -c diagrams/mermaid-config.json -b transparent
done

cp ../hardware/schematic.svg public/reference/pao-schematic.svg
cp ../simulator/images/simulator-overview.png public/reference/
cp ../mechanical/cadquery-launcher/images/launcher_preview.png public/reference/
for image in agent-hardware agent-pcb manufacturing; do
  cp "../experimental/platform/$image-preview.jpg" public/reference/
done

for id in 01 02 03 04 05; do
  name=video-$id
  video=public/videos/$name.mp4
  [ -s "$video" ] && [ -s "public/videos/$name.png" ] && continue

  source=$cache/$name.mp4
  if [ ! -s "$source" ]; then
    url=$(sed -n "s/^\[$name\]: //p" ../docs/making-of.md)
    gh auth token | sed 's/^/Authorization: Bearer /' | curl -fsSL -H @- -o "$source.part" "$url"
    mv "$source.part" "$source"
  fi

  # 浏览器不一定能播放 HEVC，转成 H.264；其余视频原样使用。
  codec=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$source")
  if [ "$codec" = h264 ]; then
    cp "$source" "$video.part.mp4"
  else
    ffmpeg -hide_banner -nostdin -loglevel error -y -i "$source" -map 0:v:0 -map '0:a?' \
      -c:v libx264 -preset fast -crf 20 -threads 2 -pix_fmt yuv420p -fps_mode passthrough \
      -c:a copy -movflags +faststart "$video.part.mp4"
  fi
  mv "$video.part.mp4" "$video"
  ffmpeg -hide_banner -nostdin -loglevel error -y -ss 1 -i "$video" -frames:v 1 -an -update 1 "public/videos/$name.png"
done

# 机械动画来自同一份模型与动力学轨迹；源码变更后重新生成。
mechanical_motion=../tmp/cadquery-launcher/launcher_motion.mp4
regenerate=false
[ -s "$mechanical_motion" ] || regenerate=true
for source in ../mechanical/cadquery-launcher/*.py ../mechanical/cadquery-launcher/Taskfile.yaml ../pyproject.toml ../uv.lock; do
  if [ "$source" -nt "$mechanical_motion" ]; then
    regenerate=true
  fi
done
if [ "$regenerate" = true ]; then
  (cd .. && task mechanical:animate)
fi
video=public/videos/mechanical-launcher.mp4
if [ ! -s "$video" ] || [ "$mechanical_motion" -nt "$video" ] || [ ! -s public/videos/mechanical-launcher.png ]; then
  cp "$mechanical_motion" "$video"
  ffmpeg -hide_banner -nostdin -loglevel error -y -ss 0.4 -i "$video" -frames:v 1 -an -update 1 public/videos/mechanical-launcher.png
fi
