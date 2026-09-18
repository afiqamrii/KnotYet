// Cheerful, short major-key plucks and pops, synthesized locally for instant feedback.
const SOUND_PREFERENCE = 'knotyet_sound_preferences';

class SoundEffects {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bgm: HTMLAudioElement | null = null;
  private lastTap = -Infinity;
  private lastTick = -Infinity;
  public isMuted = false;
  public effectVolume = .5;
  public currentTrackIndex = 0;
  public tracks = [
    { name: 'Chill Lo-Fi', url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3' },
    { name: 'Upbeat Arcade', url: 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/audio/oedipus_wizball_highscore.mp3' },
  ];

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(SOUND_PREFERENCE) || '{}');
      this.isMuted = saved.muted === true;
      if (typeof saved.volume === 'number' && Number.isFinite(saved.volume)) this.effectVolume = Math.max(0, Math.min(1, saved.volume));
    } catch { /* Storage is optional. */ }
  }

  private save() {
    try { localStorage.setItem(SOUND_PREFERENCE, JSON.stringify({ muted: this.isMuted, volume: this.effectVolume })); } catch { /* Storage is optional. */ }
  }

  private init() {
    if (this.isMuted || this.effectVolume === 0 || typeof window === 'undefined') return false;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.effectVolume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    return true;
  }

  private tone(frequency: number, duration: number, volume: number, delay = 0, endFrequency = frequency) {
    if (!this.ctx || !this.master) return;
    const time = this.ctx.currentTime + delay;
    const oscillator = this.ctx.createOscillator();
    const envelope = this.ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(volume, time + .004);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(time);
    oscillator.stop(time + duration + .01);
  }

  private brush(duration: number, volume: number, cutoff: number) {
    if (!this.ctx || !this.master) return;
    const buffer = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * duration), this.ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const envelope = this.ctx.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass'; filter.frequency.value = cutoff; filter.Q.value = .6;
    const time = this.ctx.currentTime;
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(volume, time + .003);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    source.connect(filter); filter.connect(envelope); envelope.connect(this.master);
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
    source.start(time); source.stop(time + duration);
  }

  private pluck(frequency: number, duration: number, volume: number, delay = 0) {
    // A soft fundamental plus a quiet octave gives a toy-piano tone, without
    // harsh square waves or the old high-pitched frequency sweeps.
    this.tone(frequency, duration, volume, delay);
    this.tone(frequency * 2, duration * .55, volume * .13, delay);
  }

  playFlip() {
    try {
      if (!this.init() || !this.ctx || this.ctx.currentTime - this.lastTap < .055) return;
      this.lastTap = this.ctx.currentTime;
      this.pluck(523.25, .13, .2);
      this.tone(783.99, .09, .06, .025);
    } catch { /* Audio may be unavailable. */ }
  }
  playSwipe() {
    try { if (this.init()) { this.brush(.085, .09, 1900); this.pluck(523.25, .11, .12); this.pluck(659.25, .16, .12, .055); } } catch { /* optional */ }
  }
  playTick() {
    try {
      if (!this.init() || !this.ctx || this.ctx.currentTime - this.lastTick < .045) return;
      this.lastTick = this.ctx.currentTime;
      this.pluck(783.99, .06, .085);
    } catch { /* optional */ }
  }
  playSuccess() {
    try {
      if (!this.init()) return;
      // A rising C-major fanfare, with a warm chord under the final note.
      [523.25, 659.25, 783.99, 1046.5].forEach((note, index) => this.pluck(note, index === 3 ? .38 : .19, .16, index * .09));
      [261.63, 329.63, 392].forEach(note => this.tone(note, .4, .055, .27));
    } catch { /* optional */ }
  }
  playMismatch() {
    try { if (this.init()) { this.pluck(392, .16, .14); this.pluck(329.63, .16, .12, .085); this.pluck(523.25, .25, .12, .17); } } catch { /* optional */ }
  }
  playChatPop() {
    try { if (this.init()) { this.pluck(659.25, .12, .12); this.pluck(783.99, .16, .12, .06); } } catch { /* optional */ }
  }
  playChatSent() {
    try { if (this.init()) { this.pluck(523.25, .1, .09); this.pluck(659.25, .12, .09, .04); } } catch { /* optional */ }
  }

  setEffectVolume(volume: number) {
    if (!Number.isFinite(volume)) return;
    this.effectVolume = Math.max(0, Math.min(1, volume));
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.isMuted ? 0 : this.effectVolume, this.ctx.currentTime, .015);
    this.save();
  }

  playBGM() {
    if (typeof window === 'undefined' || this.isMuted) return;
    if (!this.bgm) { this.bgm = new Audio(this.tracks[this.currentTrackIndex].url); this.bgm.loop = true; this.bgm.volume = .12; }
    if (this.bgm.src !== this.tracks[this.currentTrackIndex].url) { this.bgm.src = this.tracks[this.currentTrackIndex].url; this.bgm.load(); }
    void this.bgm.play().catch(() => undefined);
  }
  stopBGM() { this.bgm?.pause(); }
  setTrack(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= this.tracks.length) return;
    this.currentTrackIndex = index;
    if (this.bgm) {
      const wasPlaying = !this.bgm.paused;
      this.bgm.src = this.tracks[index].url; this.bgm.load();
      if (wasPlaying && !this.isMuted) void this.bgm.play().catch(() => undefined);
    }
  }
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.isMuted ? 0 : this.effectVolume, this.ctx.currentTime, .01);
    if (this.isMuted) this.stopBGM(); else this.playBGM();
    this.save();
    return this.isMuted;
  }
}

export const sounds = new SoundEffects();
