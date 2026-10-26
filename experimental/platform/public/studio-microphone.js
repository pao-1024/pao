// Linear streaming resampling keeps the source at 48kHz even when the browser uses 44.1kHz.
class StudioMicrophone extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.channel = options.processorOptions.channel;
    this.samples = new Int16Array(1024); this.used = 0;
    this.position = 0; this.previous = null;
  }
  process(inputs) {
    const mono = inputs[0]?.[0];
    if (!mono) return true;
    for (let i = 0; i < mono.length; i++) {
      const previous = this.previous ?? mono[i];
      while (this.position <= i) {
        const value = previous + (mono[i] - previous) * (this.position - i + 1);
        this.samples[this.used++] = Math.round(Math.max(-1, Math.min(1, value)) * 32767);
        this.position += sampleRate / 48000;
        if (this.used === this.samples.length) {
          const packet = new ArrayBuffer(4 + this.samples.length * 2);
          const bytes = new DataView(packet);
          bytes.setUint8(0, 6); bytes.setUint8(1, 0); bytes.setUint8(2, this.channel); bytes.setUint8(3, 0);
          for (let j = 0; j < this.samples.length; j++) bytes.setInt16(4 + j * 2, this.samples[j], true);
          this.port.postMessage(packet, [packet]); this.used = 0;
        }
      }
      this.previous = mono[i];
    }
    this.position -= mono.length;
    return true;
  }
}
registerProcessor('studio-microphone', StudioMicrophone);
