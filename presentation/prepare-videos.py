#!/usr/bin/env python3
"""Prepare browser-compatible, complete videos referenced by docs/making-of.md."""

import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from fractions import Fraction
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "tmp/presentation-assets"
PREPARED = CACHE / "prepared-videos-v1"
OUTPUT = ROOT / "presentation/public/videos"


class PrepareError(Exception):
    pass


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urllib.parse.urlsplit(newurl).scheme != "https":
            raise PrepareError("视频下载拒绝非 HTTPS 重定向")
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected and urllib.parse.urlsplit(newurl).netloc != urllib.parse.urlsplit(req.full_url).netloc:
            redirected.remove_header("Authorization")
        return redirected


def probe(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries",
         "stream=codec_type,codec_name,width,height,pix_fmt,nb_frames,avg_frame_rate:format=duration",
         "-of", "json", str(path)],
        capture_output=True, text=True,
    )
    try:
        data = json.loads(result.stdout)
        videos = [s for s in data["streams"] if s["codec_type"] == "video"]
        audio = [s for s in data["streams"] if s["codec_type"] == "audio"]
        duration = float(data["format"]["duration"])
        valid = (result.returncode == 0 and len(videos) == 1
                 and videos[0]["width"] > 0 and videos[0]["height"] > 0
                 and math.isfinite(duration) and duration > 0
                 and Fraction(videos[0]["avg_frame_rate"]) > 0)
        if valid:
            return {"video": videos[0], "audio": audio, "duration": duration}
    except (KeyError, ValueError, TypeError, ZeroDivisionError):
        pass
    raise PrepareError(f"{path.name} 不是有效的完整视频，请检查素材缓存")


def download(name, url, target):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or parsed.netloc != "github.com" or not parsed.path.startswith("/user-attachments/assets/"):
        raise PrepareError(f"{name} 的文档链接不是 GitHub HTTPS 附件")
    if not shutil.which("gh"):
        raise PrepareError(f"缺少 {name} 原始素材；请安装 gh 并登录 GitHub 后重试")
    auth = subprocess.run(
        ["gh", "auth", "token", "--hostname", "github.com"],
        capture_output=True, text=True,
    )
    if auth.returncode or not auth.stdout.strip():
        raise PrepareError(f"缺少 {name} 原始素材；请先执行 gh auth login")
    request = urllib.request.Request(
        url, headers={"Authorization": "Bearer " + auth.stdout.strip(),
                      "User-Agent": "pao-presentation"},
    )
    partial = CACHE / f"{name}.download.mp4"
    try:
        with urllib.request.build_opener(SafeRedirect).open(request, timeout=60) as response:
            content_type = response.headers.get_content_type()
            if not (content_type.startswith("video/") or content_type == "application/octet-stream"):
                raise PrepareError(f"{name} 下载响应不是视频")
            with partial.open("wb") as destination:
                shutil.copyfileobj(response, destination, length=1024 * 1024)
            length = response.headers.get("Content-Length")
            if length is not None and partial.stat().st_size != int(length):
                raise PrepareError(f"{name} 下载不完整，请重试")
    except urllib.error.HTTPError as error:
        raise PrepareError(f"{name} 下载失败（HTTP {error.code}），请检查 GitHub 访问权限") from None
    except PrepareError:
        raise
    except Exception:
        # Network exceptions can contain signed redirect URLs; never print them.
        raise PrepareError(f"{name} 下载失败，请检查网络后重试") from None
    probe(partial)
    partial.replace(target)


def digest(path):
    checksum = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            checksum.update(chunk)
    return checksum.hexdigest()


def run_ffmpeg(arguments, log):
    with log.open("w") as output:
        result = subprocess.run(
            ["ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error", "-y", *arguments],
            stdout=output, stderr=subprocess.STDOUT,
        )
    if result.returncode:
        raise PrepareError(f"视频处理失败，详情见 {log.relative_to(ROOT)}")


def validate_output(original, converted, name):
    before, after = original["video"], converted["video"]
    valid = (after["codec_name"] == "h264"
             and after["pix_fmt"] in {"yuv420p", "yuvj420p"}
             and (before["codec_name"] == "h264" or after["pix_fmt"] == "yuv420p")
             and (before["width"], before["height"]) == (after["width"], after["height"])
             and Fraction(before["avg_frame_rate"]) == Fraction(after["avg_frame_rate"])
             and abs(original["duration"] - converted["duration"]) <= 0.1
             and [s["codec_name"] for s in original["audio"]]
             == [s["codec_name"] for s in converted["audio"]])
    if before.get("nb_frames", "N/A") != "N/A":
        valid = valid and before["nb_frames"] == after.get("nb_frames")
    if not valid:
        raise PrepareError(f"{name} 转换校验失败：编码、尺寸、帧数、帧率、音轨或时长不符")


def publish(source, target):
    if target.is_file() and digest(source) == digest(target):
        return
    partial = PREPARED / f"publish-{target.name}"
    shutil.copy2(source, partial)
    partial.replace(target)


def prepare(name, url):
    original = CACHE / f"{name}.mp4"
    if not original.is_file():
        print(f"{name}：下载文档引用的原始视频", flush=True)
        download(name, url, original)
    source = probe(original)
    if source["video"]["codec_name"] not in {"hevc", "h264"} or any(s["codec_name"] != "aac" for s in source["audio"]):
        raise PrepareError(f"{name} 原始编码发生变化，预期 H.264/HEVC 视频与 AAC 音轨")
    key = f"{name}-{digest(original)}"
    prepared = PREPARED / f"{key}.mp4"
    if not prepared.is_file():
        print(f"{name}：准备完整视频", flush=True)
        partial = PREPARED / f"{key}.part.mp4"
        if source["video"]["codec_name"] == "h264":
            shutil.copy2(original, partial)
        else:
            run_ffmpeg(
                ["-i", str(original), "-map", "0:v:0", "-map", "0:a?",
                 "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-threads", "2",
                 "-pix_fmt", "yuv420p", "-fps_mode", "passthrough", "-c:a", "copy",
                 "-movflags", "+faststart", str(partial)],
                PREPARED / f"{name}-encode.log",
            )
        validate_output(source, probe(partial), name)
        partial.replace(prepared)
    validate_output(source, probe(prepared), name)
    poster = PREPARED / f"{key}.png"
    if not poster.is_file():
        partial = PREPARED / f"{key}.part.png"
        run_ffmpeg(
            ["-ss", str(min(1.0, source["duration"] / 2)), "-i", str(prepared),
             "-frames:v", "1", "-an", "-update", "1", str(partial)],
            PREPARED / f"{name}-poster.log",
        )
        partial.replace(poster)
    with poster.open("rb") as image:
        if image.read(8) != b"\x89PNG\r\n\x1a\n":
            raise PrepareError(f"{name} 封面不是有效 PNG，请检查素材缓存")
    publish(prepared, OUTPUT / f"{name}.mp4")
    publish(poster, OUTPUT / f"{name}.png")
    print(f"{name}：视频与真实帧封面已就绪", flush=True)


def main():
    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            raise PrepareError(f"缺少 {tool}，请先安装 FFmpeg")
    links = dict(re.findall(
        r"^\[(video-\d+)\]:\s+(https://\S+)\s*$",
        (ROOT / "docs/making-of.md").read_text(), re.MULTILINE,
    ))
    names = [f"video-{number:02}" for number in range(1, 6)]
    for name in names:
        if name not in links:
            raise PrepareError(f"docs/making-of.md 缺少 [{name}] 链接")
    PREPARED.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name in names:
        prepare(name, links[name])


if __name__ == "__main__":
    try:
        main()
    except (PrepareError, OSError) as error:
        print(f"准备演示视频失败：{error}", file=sys.stderr)
        sys.exit(1)
