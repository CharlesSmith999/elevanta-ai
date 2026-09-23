// A disposed list view must never replace a research record being edited.
export function researchRefresh<T>(options: {
  load: () => Promise<T>; apply: (value: T) => void;
  fail: (error: unknown) => void; settled: () => void;
  schedule: (tick: () => void, milliseconds: number) => () => void;
}) {
  let active = true;
  let pending = false;
  async function tick() {
    if (!active || pending) return;
    pending = true;
    try { const value = await options.load(); if (active) options.apply(value); }
    catch (error) { if (active) options.fail(error); }
    finally { pending = false; if (active) options.settled(); }
  }
  const cancel = options.schedule(() => { void tick(); }, 60_000);
  void tick();
  return () => { active = false; cancel(); };
}
