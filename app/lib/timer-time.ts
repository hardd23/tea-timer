export const getBrewingRemainingSeconds = (remainingMs: number) =>
  Math.ceil(Math.max(0, remainingMs) / 1000);

export const getCoolingElapsedSeconds = (elapsedMs: number) =>
  Math.floor(Math.max(0, elapsedMs) / 1000);

export const getBrewingProgress = (remainingMs: number, durationMs: number) =>
  Math.max(0, Math.min(1, Math.max(0, remainingMs) / durationMs));

export const getCoolingProgress = (elapsedMs: number, durationMs: number) =>
  Math.min(1, Math.max(0, elapsedMs) / durationMs);
