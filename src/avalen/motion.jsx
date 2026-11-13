import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { t } from './i18n.js';
// One policy for CSS, Web Animations and visual-only number interpolation.
const MotionScope = createContext("workspace");
export const MotionProvider = MotionScope.Provider;
export const timing = {
  press: 110,
  state: 180,
  panel: 280,
  screen: 240,
  reveal: 460,
  sheet: 420,
  achievement: 640,
};
export const ease = {
  out: "cubic-bezier(.2,.8,.2,1)",
  spring: "cubic-bezier(.16,1.08,.32,1)",
  sheetOut: "cubic-bezier(.4,0,1,1)",
};
export function motionReduced() {
  return (
    typeof document === "undefined" ||
    document.documentElement.dataset.motion === "reduced" ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
const listeners = new Set();
let disconnect;
function subscribe(listener) {
  listeners.add(listener);
  if (!disconnect) {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => {
      if (motionReduced()) {
        transition?.skipTransition();
        document.getAnimations().forEach((a) => {
          try {
            if (a.effect?.getComputedTiming().iterations !== Infinity)
              a.finish();
            else a.cancel();
          } catch {
            a.cancel();
          }
        });
      }
      listeners.forEach((fn) => fn());
    };
    const observer = new MutationObserver(changed);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-motion"],
    });
    query.addEventListener("change", changed);
    disconnect = () => {
      observer.disconnect();
      query.removeEventListener("change", changed);
      disconnect = null;
    };
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) disconnect?.();
  };
}
export const useMotionReduced = () =>
  useSyncExternalStore(subscribe, motionReduced, () => true);
export function animate(element, frames, options = {}) {
  if (!element?.animate || motionReduced()) return null;
  return element.animate(frames, {
    duration: timing.panel,
    easing: ease.out,
    ...options,
  });
}

// Each screen settles in once per session: what is on screen arrives together, the
// rest as it scrolls into view. Resting state stays visible, so nothing depends on it.
const revealedScreens = new Set();
export function useSectionReveal(scope, enabled = true) {
  useLayoutEffect(() => {
    const main = document.getElementById("main-content");
    if (!enabled || !main || motionReduced() || revealedScreens.has(scope)) return;
    if (main.querySelector(".route-skeleton")) return;
    revealedScreens.add(scope);
    main.dataset.firstVisit = "";
    const sections = [...main.querySelectorAll(":scope > *, :scope > .editorial-home > *")]
      .filter((node) => !node.matches(".editorial-home, .page-footer, .tabs"));
    const settle = (node, order) => animate(
      node,
      [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }],
      { duration: timing.reveal, delay: order * 55, fill: "backwards" },
    );
    let onScreen = 0;
    const later = sections.filter((node) => {
      if (node.getBoundingClientRect().top >= innerHeight) return true;
      settle(node, onScreen++);
      return false;
    });
    if (!later.length || !window.IntersectionObserver) return;
    const observer = new IntersectionObserver((entries) => {
      entries.filter((entry) => entry.isIntersecting).forEach((entry, order) => {
        observer.unobserve(entry.target);
        settle(entry.target, order);
      });
    }, { rootMargin: "0px 0px -4% 0px" });
    later.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [scope, enabled]);
}

// Remember actual targets, scoped by person/day/metric. Re-entering a screen never
// counts up from zero. Frames are presentation only; accessible values stay exact.
const values = new Map();
export function useAnimatedNumber(value, identity, from) {
  const scope = useContext(MotionScope),
    reduced = useMotionReduced();
  const key = identity ? `${scope}:${identity}` : null;
  const [display, setDisplay] = useState(() =>
    key && values.has(key) && !motionReduced()
      ? values.get(key)
      : !motionReduced() && Number.isFinite(from)
        ? from
        : value,
  );
  const latest = useRef(display),
    previousKey = useRef(key);
  useEffect(() => {
    let frame;
    const startValue = previousKey.current === key ? latest.current : value;
    previousKey.current = key;
    if (key) {
      values.delete(key);
      values.set(key, value);
      if (values.size > 300) values.delete(values.keys().next().value);
    }
    const started = performance.now();
    const paint = (n) => {
      latest.current = n;
      setDisplay(n);
    };
    if (reduced || !Number.isFinite(startValue) || startValue === value)
      paint(value);
    else {
      const tick = (now) => {
        const p = Math.min(
          1,
          (now - started) /
            (Number.isFinite(from) ? timing.achievement : timing.screen),
        );
        paint(startValue + (value - startValue) * (1 - (1 - p) ** 3));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(frame);
  }, [value, key, reduced]);
  return previousKey.current !== key || reduced ? value : display;
}
export function MotionNumber({ value, identity, decimals, from }) {
  decimals ??= Number.isInteger(Number(value)) ? 0 : Math.min(3, String(value).split(".")[1]?.length || 3);
  const shown = useAnimatedNumber(Number(value), identity, from);
  const format = (n) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  return (
    <>
      <span aria-hidden="true" className="motion-number">
        {format(shown)}
      </span>
      <span className="sr-only">{format(Number(value))}</span>
    </>
  );
}

// Measure only when selection/layout changes; animate a single indicator.
export function MovingIndicator({
  container,
  value,
  selector = '[aria-selected="true"]',
  className = "motion-tab-indicator",
}) {
  const ref = useRef(null),
    last = useRef(null),
    reduced = useMotionReduced();
  useLayoutEffect(() => {
    const host = container.current || ref.current?.parentElement,
      indicator = ref.current;
    if (!host || !indicator) return;
    const measure = () => {
      const active = host.querySelector(selector);
      if (!active || !active.offsetWidth || !host.offsetWidth) {
        indicator.hidden = true;
        last.current = null;
        return;
      }
      indicator.hidden = false;
      const left = active.offsetLeft,
        width = active.offsetWidth;
      const old = last.current;
      indicator.style.width = `${width}px`;
      indicator.style.transform = `translateX(${left}px)`;
      indicator.getAnimations().forEach((a) => a.cancel());
      if (old && !reduced && (old.left !== left || old.width !== width))
        animate(
          indicator,
          [
            {
              transform: `translateX(${old.left}px) scaleX(${old.width / width})`,
            },
            { transform: `translateX(${left}px) scaleX(1)` },
          ],
          { duration: timing.screen, easing: ease.spring },
        );
      last.current = { left, width };
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => {
      observer.disconnect();
      indicator.getAnimations().forEach((a) => a.cancel());
    };
  }, [value, reduced, selector, container]);
  return <span ref={ref} className={className} aria-hidden="true" />;
}

// Keyed list continuity: surviving items move, inserted items settle, detached
// inert copies exit. Animation never delays or triggers a data mutation.
export function MotionList({
  children,
  className = "",
  as: Tag = "div",
  ...props
}) {
  const ref = useRef(null),
    before = useRef(new Map()),
    running = useRef([]);
  const reduced = useMotionReduced();
  const items = React.Children.toArray(children);
  const signature = items.map((c) => c.key).join("|");
  useLayoutEffect(() => {
    const host = ref.current;
    running.current.forEach((a) => a.cancel());
    running.current = [];
    host
      .querySelectorAll(":scope > [data-motion-ghost]")
      .forEach((n) => n.remove());
    const children = [...host.children];
    const next = new Map();
    children.forEach((node) => {
      const id = node.dataset.motionId;
      if (!id) return;
      const rect = {
        left: node.offsetLeft,
        top: node.offsetTop,
        width: node.offsetWidth,
        height: node.offsetHeight,
      };
      next.set(id, { ...rect, node });
      if (reduced || !before.current.size) return;
      const old = before.current.get(id);
      const animation = old
        ? animate(node, [
            {
              transform: `translate(${old.left - rect.left}px, ${old.top - rect.top}px)`,
            },
            { transform: "translate(0, 0)" },
          ])
        : animate(node, [
            { opacity: 0, transform: "translateY(6px)" },
            { opacity: 1, transform: "translateY(0)" },
          ]);
      if (animation) running.current.push(animation);
    });
    if (!reduced)
      before.current.forEach((old, id) => {
        if (next.has(id)) return;
        const ghost = old.node.cloneNode(true);
        ghost.dataset.motionGhost = "";
        ghost.removeAttribute("data-motion-id");
        ghost.setAttribute("aria-hidden", "true");
        ghost.inert = true;
        ghost.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
        ghost.removeAttribute("id");
        Object.assign(ghost.style, {
          position: "absolute",
          left: `${old.left}px`,
          top: `${old.top}px`,
          width: `${old.width}px`,
          height: `${old.height}px`,
          margin: "0",
          pointerEvents: "none",
          zIndex: "1",
        });
        host.append(ghost);
        const animation = animate(
          ghost,
          [{ opacity: 1 }, { opacity: 0, transform: "translateX(-8px)" }],
          { duration: timing.state },
        );
        animation?.finished.catch(() => {}).finally(() => ghost.remove());
        if (animation) running.current.push(animation);
        else ghost.remove();
      });
    before.current = next;
  }, [signature, reduced]);
  useEffect(() => () => running.current.forEach((a) => a.cancel()), []);
  return (
    <Tag ref={ref} className={`motion-list ${className}`} {...props}>
      {items.map((child) =>
        React.isValidElement(child)
          ? React.cloneElement(child, { "data-motion-id": child.key })
          : child,
      )}
    </Tag>
  );
}

export function MotionDetails({ children, ...props }) {
  const ref = useRef(null),
    animation = useRef(null),
    target = useRef(null);
  const reduced = useMotionReduced();
  useEffect(() => {
    if (reduced) animation.current?.finish();
  }, [reduced]);
  useEffect(() => () => animation.current?.cancel(), []);
  function toggle(event) {
    if (
      event.target.closest("summary") !==
        ref.current.querySelector(":scope > summary") ||
      event.target.closest("button, a, input")
    )
      return;
    event.preventDefault();
    const el = ref.current;
    const opening = !(target.current ?? el.open);
    target.current = opening;
    const start = el.getBoundingClientRect().height;
    animation.current?.cancel();
    if (reduced) {
      el.open = opening;
      target.current = null;
      return;
    }
    el.open = true;
    const summary = el.querySelector("summary");
    const end = opening
      ? el.getBoundingClientRect().height
      : summary.getBoundingClientRect().height +
        parseFloat(getComputedStyle(el).paddingTop || 0) +
        parseFloat(getComputedStyle(el).paddingBottom || 0);
    el.style.overflow = "hidden";
    const a = animate(el, [{ height: `${start}px` }, { height: `${end}px` }], {
      duration: timing.panel,
    });
    animation.current = a;
    if (!a) {
      el.open = opening;
      el.style.overflow = "";
      target.current = null;
      return;
    }
    a.finished
      .then(() => {
        el.open = opening;
        el.style.overflow = "";
        target.current = null;
        animation.current = null;
      })
      .catch(() => {});
  }
  return (
    <details
      {...props}
      ref={ref}
      className={`motion-details ${props.className || ""}`}
      onClick={toggle}
    >
      {children}
    </details>
  );
}

let transition,
  generation = 0;
// A change within one screen (sub-tab, day, client section): the heading, tab row
// and calendar stay exactly where they are and only the content beneath settles in.
function settleInPlace(anchor) {
  const main = document.getElementById("main-content");
  if (!main) return;
  const fixed = (anchor === "day" && main.querySelector(".calendar, .date-nav")) || main.querySelector(".tabs");
  const changed = [];
  for (let node = fixed?.nextElementSibling; node; node = node.nextElementSibling) changed.push(node);
  (fixed ? changed : [...main.children].filter((node) => !node.matches(".page-heading")))
    .filter((node) => !node.matches(".page-footer") && !node.getAnimations().length)
    .forEach((node) =>
      animate(node, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 220 }),
    );
}
export function transitionRoute(commit, motion = {}) {
  const ticket = ++generation;
  transition?.skipTransition();
  const inPlace = motion.kind === "swap";
  if (inPlace || !document.startViewTransition || motionReduced()) {
    queueMicrotask(() => {
      if (ticket !== generation) return;
      commit();
      if (inPlace) settleInPlace(motion.anchor);
    });
    return;
  }
  document.documentElement.dataset.routeDirection = motion.direction || "forward";
  document.documentElement.dataset.routeKind = motion.kind || "swap";
  transition = document.startViewTransition(() => {
    if (ticket === generation) commit();
  });
  transition.ready.catch(() => {});
  transition.updateCallbackDone.catch((error) => console.error(error));
  transition.finished.catch(() => {});
}

const revealedTrends = new Set();
export function TrendLine({ points, identity }) {
  const ref = useRef(null),
    previous = useRef(null);
  const scope = useContext(MotionScope),
    reduced = useMotionReduced();
  useEffect(() => {
    const key = `${scope}:${identity}`;
    const first = !revealedTrends.has(key);
    let animation;
    if (first) {
      revealedTrends.add(key);
      if (revealedTrends.size > 200)
        revealedTrends.delete(revealedTrends.values().next().value);
      animation = animate(
        ref.current,
        [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
        { duration: 420 },
      );
    } else if (previous.current && previous.current !== points) {
      animation = animate(ref.current, [{ opacity: 0.25 }, { opacity: 1 }], {
        duration: timing.panel,
      });
    }
    previous.current = points;
    return () => animation?.cancel();
  }, [points, identity, scope, reduced]);
  return <polyline ref={ref} points={points} className="chart-line" />;
}

export function WeeklyProgress({ value, target, identity }) {
  const shown = useAnimatedNumber(value, identity);
  const previous = useRef(value),
    [earned, setEarned] = useState(false);
  useEffect(() => {
    if (target > 0 && previous.current < target && value >= target)
      setEarned(true);
    previous.current = value;
    const timer = setTimeout(() => setEarned(false), timing.achievement);
    return () => clearTimeout(timer);
  }, [value, target]);
  if (!target) return null;
  const complete = value >= target;
  return (
    <div className={`home-week-goal ${earned ? "goal-earned" : ""}`}>
      <div
        className="weekly-track"
        role="meter"
        aria-label={t('Weekly training goal')}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(value, target)}
        aria-valuetext={`${value} of ${target} sessions`}
      >
        <i
          style={{
            transform: `scaleX(${Math.max(0, Math.min(1, shown / target))})`,
          }}
        />
      </div>
      {complete && (
        <small className="weekly-complete" role="status">
          {t('Weekly training goal reached')}
        </small>
      )}
    </div>
  );
}
