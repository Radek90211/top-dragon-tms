// Synchronous compatibility boundary for the legacy iframe. No DOM or mutable state.
(() => {
  function findAvailableStart({ intervals, requestedStart, duration, maxHour, epsilon = 1 / 120 }) {
    const length = Math.max(0.25, Number(duration) || 0.25);
    const ceil = value => Math.ceil((value - 1e-9) * 4) / 4;
    let candidate = ceil(Math.max(0, Number(requestedStart) || 0));
    for (const interval of [...intervals].sort((a, b) => a.start - b.start)) {
      if (interval.end <= candidate + epsilon) continue;
      if (interval.start >= candidate + length - epsilon) break;
      candidate = ceil(Math.max(candidate, interval.end));
    }
    return candidate + length <= maxHour + 1e-9 ? candidate : null;
  }
  globalThis.TopDragonPlanning = Object.freeze({ findAvailableStart });
})();
