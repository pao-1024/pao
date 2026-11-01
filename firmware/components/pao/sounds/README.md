# 内置音效

`pao_launch.ogg` 是项目自行合成的约 280ms 降调电子音，不使用外部录音。
`pao_alarm.ogg` 是约 750ms 的三次短促高频提示音，用于前方障碍物过近报警。
`pao_explore.ogg` 是约 240ms 的双音提示，用于自动探索开始和转向；语音聆听或播放期间跳过提示音。
三者都通过固件现有的 Ogg/Opus 播放链路输出，跟随设备音量。

重新生成需要 FFmpeg（含 libopus）：

```sh
ffmpeg -f lavfi -i 'aevalsrc=0.65*(1-exp(-180*t))*exp(-12*t)*sin(2*PI*(160*t+80*(1-exp(-20*t)))):s=16000:d=0.28' -ac 1 -c:a libopus -application audio -frame_duration 60 -b:a 16000 -map_metadata -1 -y firmware/components/pao/sounds/pao_launch.ogg

ffmpeg -f lavfi -i 'aevalsrc=0.32*exp(-18*mod(t\,0.25))*sin(2*PI*1200*t):s=16000:d=0.75' -ac 1 -c:a libopus -application audio -frame_duration 60 -b:a 16000 -map_metadata -1 -y firmware/components/pao/sounds/pao_alarm.ogg

ffmpeg -f lavfi -i 'aevalsrc=0.20*exp(-18*mod(t\,0.12))*sin(2*PI*(700+400*floor(t/0.12))*t):s=16000:d=0.24' -ac 1 -c:a libopus -application audio -frame_duration 60 -b:a 16000 -map_metadata -1 -y firmware/components/pao/sounds/pao_explore.ogg
```
