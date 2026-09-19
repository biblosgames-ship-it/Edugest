/**
 * Utilidad de Audio con Web Audio API para el Timbre Escolar y Silbato de Rotación.
 * No depende de archivos mp3 externos, funciona 100% offline y sin latencia.
 */

let audioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

export type SoundStyle = 'traditional' | 'buzzer' | 'bell' | 'chime' | 'whistle';

/**
 * 1. Timbre Tradicional Duro (Campana Industrial de Alto Impacto para Sistemas de Audio Escolar / PA)
 * Simula el repique electro-mecánico de martillo continuo sobre campana de acero o bronce.
 * Muy potente y penetrante, diseñado para amplificadores, bocinas y patios escolares.
 */
const playTraditionalIndustrialBell = (ctx: AudioContext, masterVolume: number) => {
  const now = ctx.currentTime;
  const duration = 3.6; // 3.6 segundos de timbrado fuerte y continuo

  // Modulador de martilleo electromecánico rápido (27 golpes por segundo)
  const strikerLFO = ctx.createOscillator();
  strikerLFO.type = 'sawtooth';
  strikerLFO.frequency.setValueAtTime(27, now);

  const strikerLFOgain = ctx.createGain();
  strikerLFOgain.gain.setValueAtTime(0.6, now);
  strikerLFO.connect(strikerLFOgain);

  // Nodo VCA para el golpeo del martillo
  const strikerVCA = ctx.createGain();
  strikerVCA.gain.setValueAtTime(0.4, now);
  strikerLFOgain.connect(strikerVCA.gain);

  // Salida maestra con rampa de volumen contundente y decaimiento metálico al apagar
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.001, now);
  masterGain.gain.linearRampToValueAtTime(0.95 * masterVolume, now + 0.03);
  masterGain.gain.setValueAtTime(0.95 * masterVolume, now + duration);
  // Resonancia metálica residual cuando cesa el martilleo (fadeout natural de la campana)
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 1.2);

  // Frecuencias modales inarmónicas de una campana de acero/bronce pesada
  const metalModes = [
    { freq: 760, type: 'sawtooth' as OscillatorType, gain: 0.35, q: 8 },
    { freq: 950, type: 'triangle' as OscillatorType, gain: 0.45, q: 10 },
    { freq: 1220, type: 'sawtooth' as OscillatorType, gain: 0.35, q: 12 },
    { freq: 1680, type: 'square' as OscillatorType, gain: 0.28, q: 10 },
    { freq: 2350, type: 'sawtooth' as OscillatorType, gain: 0.22, q: 7 },
    { freq: 3180, type: 'triangle' as OscillatorType, gain: 0.15, q: 5 }
  ];

  metalModes.forEach(({ freq, type, gain, q }) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    // Filtro pasa banda resonante para conferir el timbre metálico característico
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, now);
    filter.Q.setValueAtTime(q, now);

    const toneGain = ctx.createGain();
    toneGain.gain.setValueAtTime(gain, now);

    osc.connect(filter);
    filter.connect(toneGain);
    toneGain.connect(strikerVCA);

    osc.start(now);
    osc.stop(now + duration + 1.3);
  });

  // Golpe grave de caja de resonancia metálica (cuerpo de campana industrial)
  const gongBody = ctx.createOscillator();
  gongBody.type = 'sine';
  gongBody.frequency.setValueAtTime(410, now);
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0.35, now);
  gongBody.connect(bodyGain);
  bodyGain.connect(strikerVCA);
  gongBody.start(now);
  gongBody.stop(now + duration + 0.8);

  strikerVCA.connect(masterGain);
  masterGain.connect(ctx.destination);

  strikerLFO.start(now);
  strikerLFO.stop(now + duration + 0.05);
};

/**
 * 2. Chicharra Escolar Clásica (Buzzer industrial vibrante de cambio de hora)
 * Zumbido potente tipo relay electromagnético de alta presencia acústica.
 */
const playIndustrialBuzzer = (ctx: AudioContext, masterVolume: number) => {
  const now = ctx.currentTime;
  const duration = 3.0;

  const osc1 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(120, now);

  const osc2 = ctx.createOscillator();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(240, now);

  const osc3 = ctx.createOscillator();
  osc3.type = 'sawtooth';
  osc3.frequency.setValueAtTime(360, now);

  // Filtro de presencia agresivo para cortar el ruido ambiental
  const filter = ctx.createBiquadFilter();
  filter.type = 'peaking';
  filter.frequency.setValueAtTime(950, now);
  filter.Q.setValueAtTime(3.5, now);
  filter.gain.setValueAtTime(14, now);

  const buzzerGain = ctx.createGain();
  buzzerGain.gain.setValueAtTime(0.001, now);
  buzzerGain.gain.linearRampToValueAtTime(0.9 * masterVolume, now + 0.02);
  buzzerGain.gain.setValueAtTime(0.9 * masterVolume, now + duration);
  buzzerGain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.08);

  osc1.connect(filter);
  osc2.connect(filter);
  osc3.connect(filter);
  filter.connect(buzzerGain);
  buzzerGain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc3.start(now);

  osc1.stop(now + duration + 0.1);
  osc2.stop(now + duration + 0.1);
  osc3.stop(now + duration + 0.1);
};

/**
 * 3. Campanada Escolar Armónica (Chime Westminster / Bim-Bam)
 */
const playChimeSound = (ctx: AudioContext, masterVolume: number) => {
  const notes = [
    { freq: 659.25, time: 0.0, duration: 0.6 }, // E5
    { freq: 523.25, time: 0.5, duration: 0.6 }, // C5
    { freq: 587.33, time: 1.0, duration: 0.6 }, // D5
    { freq: 392.0, time: 1.5, duration: 1.2 }   // G4
  ];

  notes.forEach(({ freq, time, duration }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + time);

    // Armónico suave para riqueza acústica
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, ctx.currentTime + time);
    const gain2 = ctx.createGain();

    const startTime = ctx.currentTime + time;
    const endTime = startTime + duration;

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.4 * masterVolume, startTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    gain2.gain.setValueAtTime(0, startTime);
    gain2.gain.linearRampToValueAtTime(0.15 * masterVolume, startTime + 0.03);
    gain2.gain.exponentialRampToValueAtTime(0.0001, endTime);

    osc.connect(gain);
    osc2.connect(gain2);
    gain.connect(ctx.destination);
    gain2.connect(ctx.destination);

    osc.start(startTime);
    osc2.start(startTime);
    osc.stop(endTime + 0.1);
    osc2.stop(endTime + 0.1);
  });
};

/**
 * 4. Timbre Escolar Eléctrico Resonante (Ring-Ring de escuela)
 */
const playElectricBell = (ctx: AudioContext, masterVolume: number) => {
  const baseFreqs = [850, 920, 1150, 1400];
  const now = ctx.currentTime;
  const totalDuration = 2.2;

  baseFreqs.forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator(); // Modulador de trémolo rápido (timbre)
    const lfoGain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    lfo.type = 'square';
    lfo.frequency.setValueAtTime(22, now); // 22 repiques por segundo
    lfoGain.gain.setValueAtTime(0.5, now);

    lfo.connect(lfoGain);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25 * masterVolume, now + 0.05);
    gain.gain.setValueAtTime(0.25 * masterVolume, now + 1.8);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + totalDuration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + totalDuration + 0.1);
    lfo.stop(now + totalDuration + 0.1);
  });
};

/**
 * 5. Silbato / Pito de Rotación (Triple pitido deportivo de cambio de turno)
 */
const playWhistleSound = (ctx: AudioContext, masterVolume: number) => {
  const beeps = [
    { start: 0.0, duration: 0.25, freq: 2400 },
    { start: 0.35, duration: 0.25, freq: 2400 },
    { start: 0.7, duration: 0.65, freq: 2600 }
  ];

  beeps.forEach(({ start, duration, freq }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const noise = ctx.createOscillator(); // Trémolo de silbato
    const noiseGain = ctx.createGain();

    const t = ctx.currentTime + start;
    const endT = t + duration;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.linearRampToValueAtTime(freq + 100, endT);

    noise.type = 'sine';
    noise.frequency.setValueAtTime(45, t);
    noiseGain.gain.setValueAtTime(15, t);
    noise.connect(osc.frequency);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.5 * masterVolume, t + 0.03);
    gain.gain.setValueAtTime(0.5 * masterVolume, endT - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, endT);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    noise.start(t);
    osc.stop(endT + 0.05);
    noise.stop(endT + 0.05);
  });
};

/**
 * Reproducir sonido del timbre escolar
 */
export const playSchoolBellSound = async (style: SoundStyle = 'traditional', volume: number = 0.9) => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const safeVol = Math.max(0.1, Math.min(1.0, volume));

    switch (style) {
      case 'traditional':
        playTraditionalIndustrialBell(ctx, safeVol);
        break;
      case 'buzzer':
        playIndustrialBuzzer(ctx, safeVol);
        break;
      case 'bell':
        playElectricBell(ctx, safeVol);
        break;
      case 'whistle':
        playWhistleSound(ctx, safeVol);
        break;
      case 'chime':
      default:
        playChimeSound(ctx, safeVol);
        break;
    }
    return true;
  } catch (err) {
    console.warn('Error al reproducir timbre escolar:', err);
    return false;
  }
};
