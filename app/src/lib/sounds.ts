let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function playTone(
  frequency: number,
  duration: number,
  startTime: number,
  ctx: AudioContext,
  destination: AudioNode,
  type: OscillatorType = "sine",
  volume = 0.15,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

/** Ascending two-tone chime — a peer joined the room */
export function playJoinSound(): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  playTone(523.25, 0.15, now, ctx, ctx.destination, "sine", 0.12);        // C5
  playTone(659.25, 0.2, now + 0.12, ctx, ctx.destination, "sine", 0.12);  // E5
}

/** Descending single tone — a peer left the room */
export function playLeaveSound(): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(440, now);         // A4
  osc.frequency.exponentialRampToValueAtTime(330, now + 0.2); // E4

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.25);
}

/** Quick double-beep — someone started a crosstalk with you */
export function playCrosstalkSound(): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  playTone(880, 0.08, now, ctx, ctx.destination, "sine", 0.15);         // A5
  playTone(880, 0.08, now + 0.12, ctx, ctx.destination, "sine", 0.15);  // A5
}
