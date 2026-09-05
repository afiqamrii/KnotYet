// Web Audio API Synthesizer for instant, zero-dependency sound effects

class SoundEffects {
  private ctx: AudioContext | null = null;
  private bgm: HTMLAudioElement | null = null;
  public isMuted: boolean = false;
  public currentTrackIndex: number = 0;
  public tracks = [
    { name: 'Chill Lo-Fi', url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3' },
    { name: 'Upbeat Arcade', url: 'https://raw.githubusercontent.com/photonstorm/phaser3-examples/master/public/assets/audio/oedipus_wizball_highscore.mp3' }
  ];

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Card whoosh/pop sound when swiping
  playSwipe() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      // Super cute 'bloop' pop sound
      osc.frequency.setValueAtTime(400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.4, this.ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch {
      // Audio not supported or blocked
    }
  }

  // Card flip sound (Cute 'boop')
  playFlip() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      // Higher pitched quick cute 'boop'
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {
      // ignore
    }
  }

  // Wheel click tick
  playTick() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.03);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.03);
    } catch {
      // ignore
    }
  }

  // Match / Win chime
  playSuccess() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Extended arpeggio for a longer celebration! (C5, E5, G5, C6, E6, G6, C7)
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00]; 

      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        // Use square wave for a more retro/festive celebration sound
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0.1, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.3);
      });
    } catch {
      // ignore
    }
  }

  // Mismatch / Wrong guess sound
  playMismatch() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [440, 370];

      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0.15, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.12 + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.18);
      });
    } catch {
      // ignore
    }
  }

  // Background Music
  playBGM() {
    if (typeof window === 'undefined' || this.isMuted) return;
    
    if (!this.bgm) {
      this.bgm = new Audio(this.tracks[this.currentTrackIndex].url);
      this.bgm.loop = true;
      this.bgm.volume = 0.25;
    }
    
    // Ensure the src is correct
    if (this.bgm.src !== this.tracks[this.currentTrackIndex].url) {
      this.bgm.src = this.tracks[this.currentTrackIndex].url;
      this.bgm.load();
    }
    
    this.bgm.play().catch(() => console.log('BGM autoplay blocked'));
  }

  stopBGM() {
    if (this.bgm) {
      this.bgm.pause();
    }
  }
  
  setTrack(index: number) {
    if (index >= 0 && index < this.tracks.length) {
      this.currentTrackIndex = index;
      if (this.bgm) {
        const wasPlaying = !this.bgm.paused;
        this.bgm.src = this.tracks[this.currentTrackIndex].url;
        this.bgm.load();
        if (wasPlaying && !this.isMuted) {
          this.bgm.play().catch(() => console.log('BGM autoplay blocked'));
        }
      }
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopBGM();
    } else {
      this.playBGM();
    }
    return this.isMuted;
  }
}

export const sounds = new SoundEffects();
