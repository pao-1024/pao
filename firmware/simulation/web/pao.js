const $ = selector => document.querySelector(selector);
let socket, microphone, speaker, playHead = 0;
const canvas = $('#oled'), pixels = canvas.getContext('2d');
function send(value) {
  if (socket.readyState !== WebSocket.OPEN) throw Error('模拟器未连接');
  socket.send(value instanceof ArrayBuffer ? value : JSON.stringify(value));
}
async function stopMicrophone() {
  const current = microphone; microphone = null;
  if (current) {
    current.stream.getTracks().forEach(track => track.stop());
    current.source.disconnect(); current.node.disconnect(); await current.context.close();
  }
  $('#mic').textContent = '启用麦克风和扬声器';
}
function binary(buffer) {
  const data = new DataView(buffer);
  if (data.getUint8(0) === 1) {
    const width = data.getUint16(1, true), height = data.getUint16(3, true);
    canvas.width = width; canvas.height = height;
    const frame = pixels.createImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      const color = data.getUint16(5 + i * 2, true), at = i * 4;
      frame.data[at] = (color >> 11) * 255 / 31;
      frame.data[at + 1] = ((color >> 5) & 63) * 255 / 63;
      frame.data[at + 2] = (color & 31) * 255 / 31; frame.data[at + 3] = 255;
    }
    pixels.putImageData(frame, 0, 0);
  } else if (data.getUint8(0) === 2 && speaker) {
    const rate = data.getUint32(1, true), count = (buffer.byteLength - 5) / 2;
    const audio = speaker.createBuffer(1, count, rate), channel = audio.getChannelData(0);
    for (let i = 0; i < count; i++) channel[i] = data.getInt16(5 + i * 2, true) / 32768;
    const source = speaker.createBufferSource(); source.buffer = audio; source.connect(speaker.destination);
    playHead = Math.max(playHead, speaker.currentTime + 0.06);
    source.start(playHead); playHead += audio.duration;
  }
}
function connect() {
  socket = new WebSocket(`ws://${location.host}/ws`); socket.binaryType = 'arraybuffer';
  socket.onopen = () => { $('#status').textContent = '模拟器已连接'; $('#mic').disabled = $('#boot').disabled = false; };
  socket.onmessage = event => {
    if (event.data instanceof ArrayBuffer) { binary(event.data); return; }
    const message = JSON.parse(event.data);
    if (message.t === 'serial' && message.src === 'uart0') {
      const output = $('#console'); output.textContent = (output.textContent + message.data).slice(-60000); output.scrollTop = output.scrollHeight;
    } else if (message.t === 'ring') $('#led').style.background = `rgb(${message.leds[0].join(',')})`;
    else if (message.t === 'stat') $('#status').textContent = `模拟器已连接 · ${message.time.toFixed(2)} 秒`;
    else if (message.t === 'microphone-error') { stopMicrophone(); $('#hint').textContent = message.message; }
  };
  socket.onclose = () => {
    stopMicrophone(); $('#mic').disabled = $('#boot').disabled = true;
    $('#status').textContent = '模拟器连接已断开'; setTimeout(connect, 1000);
  };
}
$('#mic').onclick = async () => {
  if (microphone) { await stopMicrophone(); $('#hint').textContent = '麦克风已关闭'; return; }
  $('#mic').disabled = true;
  let stream, context;
  try {
    if (!speaker) speaker = new AudioContext();
    await speaker.resume();
    stream = await navigator.mediaDevices.getUserMedia({audio: {channelCount: 1, echoCancellation: true}});
    context = new AudioContext({sampleRate: 16000});
    if (context.sampleRate !== 16000) throw Error('浏览器未提供 16 kHz 采样率');
    await context.audioWorklet.addModule('pao-microphone.js');
    const source = context.createMediaStreamSource(stream), node = new AudioWorkletNode(context, 'pao-microphone');
    node.port.onmessage = event => { if (socket.readyState === WebSocket.OPEN) send(event.data); };
    source.connect(node); node.connect(context.destination); await context.resume();
    if (socket.readyState !== WebSocket.OPEN) throw Error('模拟器连接已断开');
    microphone = {stream, context, source, node};
    $('#mic').textContent = '关闭麦克风'; $('#hint').textContent = '正在收音，说“你好小智”';
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop()); if (context) await context.close();
    $('#hint').textContent = error.message;
  } finally { $('#mic').disabled = socket.readyState !== WebSocket.OPEN; }
};
$('#boot').onclick = () => { send({t: 'btn', pin: 0, v: 1}); setTimeout(() => { if (socket.readyState === WebSocket.OPEN) send({t: 'btn', pin: 0, v: 0}); }, 100); };
window.addEventListener('pagehide', stopMicrophone);
connect();
