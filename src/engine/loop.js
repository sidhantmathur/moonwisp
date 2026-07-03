// Fixed-timestep game loop: physics at 120 Hz, rendering every rAF with an
// interpolation alpha so movement stays silky on any refresh rate.

export const DT = 1 / 120;
const MAX_FRAME = 0.25; // clamp huge pauses (tab switches) so we don't spiral

export function createLoop({ update, render }) {
  let running = false;
  let last = 0;
  let acc = 0;
  let rafId = 0;

  function frame(now) {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    const t = now / 1000;
    let elapsed = t - last;
    last = t;
    if (elapsed > MAX_FRAME) elapsed = MAX_FRAME;
    acc += elapsed;
    while (acc >= DT) {
      update(DT);
      acc -= DT;
    }
    render(acc / DT, t);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now() / 1000;
      acc = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
    get running() { return running; },
  };
}
