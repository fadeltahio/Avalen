import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { transitionRoute } from "./motion.jsx";
import { readRoute, routeHash, routeMotion } from "./route-model.js";
export { readRoute, routeHash, routeMotion };
const positions = new Map();
export function useAppRoute(fallbackRole) {
  const [route, setRoute] = useState(() =>
    readRoute(location.hash, fallbackRole),
  );
  const latest = useRef(route);
  latest.current = route;
  const scrolling = useRef(false),
    sequence = useRef(0),
    frames = useRef(new Set());
  function frame(callback) {
    const id = requestAnimationFrame(() => {
      frames.current.delete(id);
      callback();
    });
    frames.current.add(id);
  }
  function settleScroll(top, ticket, attempt = 0) {
    if (ticket !== sequence.current) return;
    window.scrollTo({ top, behavior: "instant" });
    frame(() => {
      if (ticket !== sequence.current) return;
      if (Math.abs(scrollY - top) > 2 && attempt < 12)
        settleScroll(top, ticket, attempt + 1);
      else
        frame(() => {
          if (ticket === sequence.current) scrolling.current = false;
        });
    });
  }
  useEffect(() => {
    const oldRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    history.replaceState(
      {
        ...history.state,
        avalen: true,
        avalenIndex: history.state?.avalenIndex ?? 0,
      },
      "",
      location.hash || routeHash(route),
    );
    let currentHash = location.hash,
      currentEntry = history.state.avalenIndex;
    const remember = () => {
      if (!scrolling.current) positions.set(currentEntry, scrollY);
    };
    const restore = () => {
      if (currentHash === location.hash) return;
      const nextEntry = history.state?.avalenIndex ?? 0;
      // Capture the destination before queued scroll events can fire. Suppress
      // recording until restoration settles; a later route cancels this ticket.
      const top = positions.get(nextEntry) || 0,
        next = readRoute(location.hash, fallbackRole);
      scrolling.current = true;
      const ticket = ++sequence.current;
      currentHash = location.hash;
      currentEntry = nextEntry;
      transitionRoute(() => {
        flushSync(() => setRoute(next));
        settleScroll(top, ticket);
      }, routeMotion(latest.current, next));
    };
    const visited = () => {
      currentHash = location.hash;
      currentEntry = history.state?.avalenIndex ?? 0;
    };
    window.addEventListener("scroll", remember, { passive: true });
    window.addEventListener("avalen:visit", visited);
    window.addEventListener("popstate", restore);
    window.addEventListener("hashchange", restore);
    return () => {
      history.scrollRestoration = oldRestoration;
      frames.current.forEach(cancelAnimationFrame);
      frames.current.clear();
      window.removeEventListener("scroll", remember);
      window.removeEventListener("avalen:visit", visited);
      window.removeEventListener("popstate", restore);
      window.removeEventListener("hashchange", restore);
    };
  }, []);
  function visit(next, replace = false) {
    const hash = routeHash(next);
    if (hash === location.hash) return;
    positions.set(history.state?.avalenIndex ?? 0, scrollY);
    scrolling.current = true;
    const ticket = ++sequence.current;
    const index = (history.state?.avalenIndex || 0) + (replace ? 0 : 1);
    history[replace ? "replaceState" : "pushState"](
      {
        avalen: true,
        avalenParent: Boolean(history.state?.avalen),
        avalenIndex: index,
      },
      "",
      hash,
    );
    window.dispatchEvent(new Event("avalen:visit"));
    transitionRoute(() => {
      flushSync(() => setRoute(next));
      settleScroll(0, ticket);
    }, routeMotion(latest.current, next));
  }
  return [route, visit];
}
