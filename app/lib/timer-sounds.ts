const defaultSound = { id: 'default', label: 'soundDefault', url: '/notification.mp3' } as const;

export const TIMER_SOUNDS = [
  { id: 'silent', label: 'soundSilent', url: null },
  defaultSound,
  { id: 'singing_bowl', label: 'soundSingingBowl', url: '/sounds/raw/singing_bowl.mp3' },
  { id: 'gong_clear', label: 'soundGongClear', url: '/sounds/raw/gong_clear.mp3' },
  { id: 'gong_soft', label: 'soundGongSoft', url: '/sounds/raw/gong_soft.mp3' },
] as const;

export type TimerSoundId = (typeof TIMER_SOUNDS)[number]['id'];
export type TimerSounds = Record<'brewing' | 'cooling', TimerSoundId>;

type AudibleSound = Exclude<(typeof TIMER_SOUNDS)[number], { url: null }>;
const decoded = new Map<TimerSoundId, AudioBuffer | null>();
let audioContext: AudioContext | undefined;
let active: { alert: boolean; stop: () => void } | undefined;

export const getTimerSound = (id: unknown) => TIMER_SOUNDS.find((sound) => sound.id === id) ?? defaultSound;

function getAudioContext() {
  if (typeof AudioContext === 'undefined') return undefined;
  try { return audioContext ??= new AudioContext(); }
  catch { return undefined; }
}

export function prepareTimerSounds(...ids: TimerSoundId[]) {
  const context = getAudioContext();
  if (!context) return;
  for (const id of ids) {
    const { url } = getTimerSound(id);
    if (!url || decoded.has(id)) continue;
    decoded.set(id, null);
    void fetch(url).then((response) => {
      if (!response.ok) throw new Error('Sound unavailable');
      return response.arrayBuffer();
    }).then((bytes) => context.decodeAudioData(bytes))
      .then((buffer) => decoded.set(id, buffer))
      .catch(() => decoded.delete(id));
  }
}

export function unlockTimerAudio() {
  const context = getAudioContext();
  if (context?.state === 'suspended') void context.resume().catch(() => {});
}

export const stopTimerAudio = () => { active?.stop(); };

export function playTimerSound(id: TimerSoundId, alert: boolean, onFinished?: () => void) {
  const sound = getTimerSound(id);
  if (!sound.url || (!alert && active?.alert)) {
    if (!sound.url && alert) stopTimerAudio();
    onFinished?.();
    return () => {};
  }
  active?.stop();
  let release: (() => void) | undefined;
  let currentAttempt: object | undefined;
  const playback = { alert, stop: () => {
    if (active !== playback) return;
    active = undefined;
    release?.();
    onFinished?.();
  } };
  active = playback;

  const start = (sound: AudibleSound) => {
    const context = audioContext;
    const buffer = decoded.get(sound.id);
    if (context?.state === 'running' && buffer) {
      let source: AudioBufferSourceNode | undefined;
      try {
        const node = context.createBufferSource();
        source = node;
        node.buffer = buffer;
        node.connect(context.destination);
        node.onended = playback.stop;
        node.start();
        release = () => {
          node.onended = null;
          node.stop();
          node.disconnect();
        };
        return;
      } catch {
        if (source) {
          source.onended = null;
          source.disconnect();
        }
      }
    }

    const attempt = {};
    currentAttempt = attempt;
    const failed = () => {
      if (active !== playback || currentAttempt !== attempt) return;
      release?.();
      release = undefined;
      if (sound === defaultSound) playback.stop();
      else {
        start(defaultSound);
      }
    };

    try {
      const audio = new Audio(sound.url);
      release = () => {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
      };
      audio.onended = playback.stop;
      audio.onerror = failed;
      void audio.play().catch(failed);
    } catch {
      failed();
    }
  };

  start(sound);
  return playback.stop;
}
