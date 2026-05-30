/** A tiny 8-bit synth: oscillators + envelopes + noise, no audio assets. See docs/06 §8. */

export interface ToneSpec {
  freq: number;
  type?: OscillatorType;
  duration?: number; // seconds
  attack?: number;
  release?: number;
  volume?: number; // 0..1
  slideTo?: number; // glide target freq
}

export interface Note {
  freq: number;
  dur: number; // seconds
  type?: OscillatorType;
}

export class ChiptuneSynth {
  constructor(
    private ctx: AudioContext,
    private out: GainNode,
  ) {}

  tone(spec: ToneSpec): void {
    const {
      freq,
      type = 'square',
      duration = 0.12,
      attack = 0.005,
      release = 0.05,
      volume = 0.5,
      slideTo,
    } = spec;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration + release);

    osc.connect(gain).connect(this.out);
    osc.start(t0);
    osc.stop(t0 + duration + release + 0.02);
  }

  noise(duration = 0.2, volume = 0.4): void {
    const t0 = this.ctx.currentTime;
    const frames = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(gain).connect(this.out);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  /** Play a melodic sequence (jingles like level-up / game-over). */
  sequence(notes: Note[], gap = 0): void {
    let when = 0;
    for (const n of notes) {
      window.setTimeout(() => this.tone({ freq: n.freq, duration: n.dur, type: n.type ?? 'square' }), when * 1000);
      when += n.dur + gap;
    }
  }
}
