import { afterEach, expect, it, vi } from 'vitest';
import { playTimerSound, prepareTimerSounds, stopTimerAudio, unlockTimerAudio } from './timer-sounds';

afterEach(() => {
  stopTimerAudio();
  vi.unstubAllGlobals();
});

it('decodes selected sounds before the deadline, then starts them without another fetch or player load', async () => {
  const buffer = new ArrayBuffer(8);
  const fetchFile = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => buffer });
  const decode = vi.fn().mockResolvedValue({ duration: 2 });
  const actions: string[] = [];
  const slowPlayer = vi.fn();
  vi.stubGlobal('fetch', fetchFile);
  vi.stubGlobal('Audio', slowPlayer);
  vi.stubGlobal('AudioContext', class {
    state = 'suspended';
    decodeAudioData = decode;
    async resume() { this.state = 'running'; }
    createBufferSource() {
      return { connect() {}, disconnect() {}, start() { actions.push('start'); }, stop() { actions.push('stop'); } };
    }
  });

  prepareTimerSounds('silent', 'default', 'gong_clear');
  unlockTimerAudio();
  await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(2));

  const finishPreview = vi.fn();
  playTimerSound('default', false, finishPreview);
  playTimerSound('gong_clear', true);
  expect(actions).toEqual(['start', 'stop', 'start']);
  expect(finishPreview).toHaveBeenCalledOnce();
  expect(fetchFile).toHaveBeenCalledTimes(2);
  expect(slowPlayer).not.toHaveBeenCalled();

  playTimerSound('silent', true);
  expect(actions).toEqual(['start', 'stop', 'start', 'stop']);
  expect(slowPlayer).not.toHaveBeenCalled();
});
