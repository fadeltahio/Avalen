import React, { useLayoutEffect, useRef, useState, useEffect, useId } from 'react';

export function GlassTabSelector({ index, reducedMotion }) {
  const lens = useRef(null), trail = useRef(null), fill = useRef(null), rim = useRef(null);
  const previous = useRef(index), frame = useRef(0), measuredWidth = useRef(0);
  const motion = useRef({ head: 0, tail: 0, speed: 0, tailSpeed: 0 });
  const gradient = `liquid-${useId().replaceAll(':', '')}`;
  const [systemReduced, setSystemReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setSystemReduced(preference.matches);
    preference.addEventListener('change', changed);
    return () => preference.removeEventListener('change', changed);
  }, []);

  function settle(width) {
    cancelAnimationFrame(frame.current);
    const target = previous.current * width;
    motion.current = { head: target, tail: target, speed: 0, tailSpeed: 0 };
    lens.current.style.transform = `translateX(${target}px)`;
    lens.current.dataset.moving = 'false';
    trail.current.style.opacity = '0';
  }

  useLayoutEffect(() => {
    const glass = lens.current;
    const oldIndex = previous.current;
    previous.current = index;
    cancelAnimationFrame(frame.current);
    const width = parseFloat(getComputedStyle(glass).width);
    if (!glass.getClientRects().length || !width) return;
    const firstMeasurement = !measuredWidth.current;
    measuredWidth.current = width;
    glass.parentElement.style.setProperty('--tab-step', `${width}px`);
    if (reducedMotion || systemReduced || firstMeasurement || oldIndex === index) {
      settle(width);
      return;
    }

    const target = index * width, height = glass.offsetHeight;
    const state = motion.current;
    glass.dataset.moving = 'true';
    let last = performance.now();
    const started = last;
    // Two damped springs: the lens leads, while the liquid's rear catches up.
    // Drawing stays in this leaf; no React updates occur during movement.
    function draw(now) {
      const dt = Math.min((now - last) / 1000, .025);
      last = now;
      state.speed += ((target - state.head) * 410 - state.speed * 33) * dt;
      state.head += state.speed * dt;
      state.tailSpeed += ((state.head - state.tail) * 145 - state.tailSpeed * 22) * dt;
      state.tail += state.tailSpeed * dt;
      const lag = Math.max(-width * 1.15, Math.min(width * 1.15, state.head - state.tail));
      const amount = Math.min(1, Math.abs(lag) / (width * .62));
      glass.style.transform = `translateX(${state.head}px) scale(${1 + amount * .2},${1 - amount * .1})`;

      // One tapered surface joins the rear drop to the lens. Its bright rim
      // gives the trail a readable outline against the translucent dock.
      const direction = Math.sign(lag) || 1;
      const head = state.head + width / 2, tail = head - lag;
      const y = height / 2, rearRadius = height * .34 * amount;
      const frontRadius = height * .46;
      const shoulder = head - lag * .48;
      const back = tail - direction * rearRadius * 1.1;
      const path = `M ${head} ${y - frontRadius}
        C ${shoulder} ${y - frontRadius}, ${tail + direction * rearRadius} ${y - rearRadius}, ${tail} ${y - rearRadius}
        C ${back} ${y - rearRadius}, ${back} ${y + rearRadius}, ${tail} ${y + rearRadius}
        C ${tail + direction * rearRadius} ${y + rearRadius}, ${shoulder} ${y + frontRadius}, ${head} ${y + frontRadius}`;
      fill.current.setAttribute('d', `${path} Z`);
      rim.current.setAttribute('d', path);
      trail.current.style.opacity = String(Math.min(1, Math.abs(lag) / 8));

      if ((Math.abs(target - state.head) < .08 && Math.abs(target - state.tail) < .12 && Math.abs(state.speed) < .3 && Math.abs(state.tailSpeed) < .4) || now - started > 1600) {
        settle(width);
      } else {
        frame.current = requestAnimationFrame(draw);
      }
    }
    frame.current = requestAnimationFrame(draw);
  }, [index, reducedMotion, systemReduced]);

  useLayoutEffect(() => {
    const glass = lens.current;
    const observer = new ResizeObserver(() => {
      const width = parseFloat(getComputedStyle(glass).width);
      if (!width || Math.abs(width - measuredWidth.current) < .01) return;
      measuredWidth.current = width;
      glass.parentElement.style.setProperty('--tab-step', `${width}px`);
      settle(width);
    });
    observer.observe(glass);
    return () => { observer.disconnect(); cancelAnimationFrame(frame.current); };
  }, []);

  return <>
    <svg ref={trail} className="nav-glass-trail" aria-hidden="true" focusable="false">
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="var(--liquid-tail-top)"/>
        <stop offset=".48" stopColor="var(--liquid-tail-mid)"/>
        <stop offset="1" stopColor="var(--liquid-tail-bottom)"/>
      </linearGradient></defs>
      <path ref={fill} fill={`url(#${gradient})`}/>
      <path ref={rim} fill="none" className="nav-liquid-rim"/>
    </svg>
    <span ref={lens} className="nav-glass-selection" aria-hidden="true" data-moving="false"/>
  </>;
}
