import { ChiptuneSynth } from './ChiptuneSynth';
import { settings } from '@store/settings';

/** Named SFX presets shared by all games (drawn with the ChiptuneSynth). */
export type Sfx =
  | 'blip'
  | 'select'
  | 'coin'
  | 'eat'
  | 'jump'
  | 'shoot'
  | 'explosion'
  | 'hit'
  | 'powerup'
  | 'clear'
  | 'levelup'
  | 'gameover';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private synth: ChiptuneSynth | null = null;

  // Menu music: its own quiet bus + a looping arpeggio scheduled with the Web Audio clock.
  private musicBus: GainNode | null = null;
  private musicSynth: ChiptuneSynth | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;

  /** Lazily create the AudioContext (browsers require a user gesture first). */
  private ensure(): boolean {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return true;
    }
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.synth = new ChiptuneSynth(this.ctx, this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.18;
    this.musicBus.connect(this.ctx.destination);
    this.musicSynth = new ChiptuneSynth(this.ctx, this.musicBus);
    this.applyVolume();
    return true;
  }

  private blurred = false;

  /** Call from a user-gesture handler to unlock audio on mobile. */
  unlock(): void {
    this.ensure();
  }

  /** Mute/unmute when the tab loses/regains focus (respects the muteOnBlur setting). */
  setMutedByBlur(blurred: boolean): void {
    this.blurred = blurred;
    this.applyVolume();
  }

  private applyVolume(): void {
    const s = settings();
    const blurMuted = this.blurred && s.audio.muteOnBlur;
    if (this.master) this.master.gain.value = !s.audio.sfx || blurMuted ? 0 : s.audio.master;
    if (this.musicBus) this.musicBus.gain.value = !s.audio.music || blurMuted ? 0 : 0.18 * s.audio.master;
  }

  // ── menu music: a gentle looping pentatonic arpeggio ──
  private static readonly MUSIC: number[] = [261.6, 329.6, 392.0, 523.3, 392.0, 329.6, 440.0, 392.0];

  startMusic(): void {
    if (!settings().audio.music) return;
    if (!this.ensure() || !this.musicSynth || this.musicTimer !== null) return;
    this.applyVolume();
    this.musicStep = 0;
    this.musicTimer = window.setInterval(() => {
      if (!this.musicSynth) return;
      const note = AudioManager.MUSIC[this.musicStep % AudioManager.MUSIC.length]!;
      this.musicSynth.tone({ freq: note, duration: 0.22, type: 'triangle', volume: 0.5 });
      if (this.musicStep % 4 === 0) this.musicSynth.tone({ freq: note / 2, duration: 0.4, type: 'square', volume: 0.25 });
      this.musicStep++;
    }, 260);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  /** Re-evaluate music against the current setting (call after a settings change). */
  syncMusic(): void {
    if (settings().audio.music) this.startMusic();
    else this.stopMusic();
    this.applyVolume();
  }

  sfx(name: Sfx): void {
    if (!settings().audio.sfx) return;
    if (!this.ensure() || !this.synth) return;
    this.applyVolume();
    const s = this.synth;
    switch (name) {
      case 'blip':
        return s.tone({ freq: 660, duration: 0.05, type: 'square', volume: 0.4 });
      case 'select':
        return s.tone({ freq: 880, duration: 0.07, type: 'square', slideTo: 1200, volume: 0.4 });
      case 'coin':
        s.tone({ freq: 988, duration: 0.07 });
        return s.sequence([{ freq: 1319, dur: 0.12 }]);
      case 'eat':
        return s.tone({ freq: 440, duration: 0.06, slideTo: 720, volume: 0.45 });
      case 'jump':
        return s.tone({ freq: 380, duration: 0.14, type: 'square', slideTo: 760, volume: 0.4 });
      case 'shoot':
        return s.tone({ freq: 720, duration: 0.09, type: 'square', slideTo: 180, volume: 0.35 });
      case 'hit':
        return s.tone({ freq: 200, duration: 0.1, type: 'sawtooth', slideTo: 80, volume: 0.5 });
      case 'powerup':
        return s.sequence([
          { freq: 523, dur: 0.08 },
          { freq: 659, dur: 0.08 },
          { freq: 784, dur: 0.08 },
          { freq: 1047, dur: 0.12 },
        ]);
      case 'clear':
        return s.sequence([
          { freq: 784, dur: 0.07 },
          { freq: 988, dur: 0.07 },
          { freq: 1319, dur: 0.12 },
        ]);
      case 'explosion':
        return s.noise(0.35, 0.5);
      case 'levelup':
        return s.sequence([
          { freq: 523, dur: 0.1 },
          { freq: 659, dur: 0.1 },
          { freq: 784, dur: 0.1 },
          { freq: 1047, dur: 0.18 },
        ]);
      case 'gameover':
        return s.sequence([
          { freq: 523, dur: 0.16 },
          { freq: 392, dur: 0.16 },
          { freq: 330, dur: 0.16 },
          { freq: 262, dur: 0.32 },
        ]);
    }
  }
}

export const audio = new AudioManager();
