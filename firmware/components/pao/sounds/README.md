# 发射音效

`pao_launch.ogg` 是项目自行合成的约 280ms 降调电子音，不使用外部录音。
通过固件现有的 Ogg/Opus 播放链路输出，跟随设备音量。

重新生成需要 FFmpeg（含 libopus）：

```sh
ffmpeg -f lavfi -i 'aevalsrc=0.65*(1-exp(-180*t))*exp(-12*t)*sin(2*PI*(160*t+80*(1-exp(-20*t)))):s=16000:d=0.28' -ac 1 -c:a libopus -application audio -frame_duration 60 -b:a 16000 -map_metadata -1 -y firmware/components/pao/sounds/pao_launch.ogg
```
