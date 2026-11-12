import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Pause, Play } from "lucide-react";
import { restState } from "./rest-timer.js";

// Rest between sets. When it runs out, the ring closes, a check draws itself
// and one clear button takes you on to the next set.
export function RestTimer({ draft, onAction, onNext, nextLabel, nextAction = "Next set" }) {
  const [, setNow] = useState(Date.now);
  const previous = useRef(null);
  const { remaining, progress, phase } = restState(draft, Date.now());
  const [announcement, announce] = useState("");
  const [justDone, setJustDone] = useState(false);
  useEffect(() => {
    if (phase !== "running") return;
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [phase, draft.restUntil]);
  useEffect(() => {
    if (previous.current === "running" && phase === "complete") {
      announce(`Rest complete. ${nextLabel || "Ready for your next set."}`);
      navigator.vibrate?.([40, 70, 40]);
      setJustDone(true);
    }
    previous.current = phase;
  }, [phase, nextLabel]);
  const seconds = Math.ceil(remaining / 1000);
  const done = phase === "complete";
  return (
    <section className={`logger-rest rest-${phase} ${justDone ? "rest-just-done" : ""}`} aria-label="Rest timer">
      <div className="rest-orbit" aria-hidden="true">
        <svg viewBox="0 0 64 64">
          <circle className="rest-track" cx="32" cy="32" r="28" />
          <circle
            className="rest-progress"
            cx="32"
            cy="32"
            r="28"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={done ? 0 : 1 - progress}
            transform="rotate(-90 32 32)"
          />
          {done && <path className="rest-check" pathLength="1" d="M21 33.5l7.5 7.5L44 25" />}
        </svg>
        {!done && <span>{phase === "paused" ? <Pause size={16} /> : <i />}</span>}
      </div>
      <div className="rest-copy">
        <b role="timer" aria-label="Rest remaining">
          {done ? "Rest done" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
        </b>
        <span>
          {phase === "paused" ? "Paused · take your time" : done ? nextLabel || "Ready for your next set" : `Rest · ${nextLabel || "log when ready"}`}
        </span>
      </div>
      <div className="rest-controls">
        {done ? (
          <button type="button" className="rest-next" onClick={onNext}>
            {nextAction}
            <ArrowRight size={18} />
          </button>
        ) : (
          <>
            <button type="button" aria-label={phase === "paused" ? "Resume rest" : "Pause rest"} onClick={() => onAction(phase === "paused" ? "resume" : "pause")}>
              {phase === "paused" ? <Play size={17} /> : <Pause size={17} />}
            </button>
            <button type="button" onClick={() => onAction("extend")}>+30s</button>
            <button type="button" onClick={() => onAction("skip")}>Skip rest</button>
          </>
        )}
      </div>
      {justDone && <span className="rest-ripple" aria-hidden="true" />}
      <span className="sr-only" role="status">{announcement}</span>
    </section>
  );
}
