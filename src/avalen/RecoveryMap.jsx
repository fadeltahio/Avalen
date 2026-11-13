import React, { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useApp } from "./context.js";
import { byUrgency, planPressure, recoveryMap, statusLine } from "./recovery.js";
import "./recovery.css";

import { t } from './i18n.js';
// Each muscle is its own shape so it can carry its own recovery state. Paths describe
// the left half of the figure and are mirrored at render.
const MIRROR = "matrix(-1 0 0 1 200 0)";
const SILHOUETTE = "M100 54 L93 54 C93 60 91 65 85 68 C75 72 63 72 55 77 C46 82 42 92 41 104 C39 122 33 142 31 160 C29 178 24 200 21 224 C20 232 15 240 14 250 C13 258 18 265 22 262 C27 260 30 250 32 238 C35 224 41 198 46 176 C49 162 53 146 57 132 C58 146 66 168 70 186 C70 198 64 206 63 222 C60 252 62 282 68 308 C69 320 65 342 68 362 C70 376 73 388 73 396 C72 404 64 410 69 414 L92 414 C94 406 90 398 90 390 C92 370 97 340 92 310 C96 282 98 252 99 232 L100 228 Z";
const FOREARM = "M35 167 C29 182 25 204 23 222 C27 225 31 225 33 222 C40 204 46 184 47 168 C43 171 39 171 35 167 Z";
const FRONT = [
  ["shoulders", "M67 78 C56 77 47 85 44 98 C43 108 45 116 49 121 C55 116 63 102 68 88 Z"],
  ["chest", "M98 84 C90 79 77 80 70 88 C63 99 62 110 67 117 C76 125 92 123 98 115 Z"],
  ["biceps", "M47 125 C41 134 37 148 36 159 C40 164 47 162 50 156 C54 144 55 132 53 122 Z"],
  ["forearms", FOREARM],
  ["core", "M98 127 L85 129 C83 135 83 141 85 145 L98 145 Z"],
  ["core", "M98 148 L85 148 C84 154 84 160 85 164 L98 164 Z"],
  ["core", "M98 167 L86 167 C85 174 86 180 87 185 L98 185 Z"],
  ["core", "M98 188 L88 188 C89 201 93 214 98 224 Z"],
  ["core", "M81 129 C74 138 71 158 74 184 C77 188 80 186 82 182 C80 164 80 146 82 130 Z"],
  ["quads", "M66 224 C62 250 63 282 70 304 C73 302 75 292 75 276 C75 256 73 238 71 222 Z"],
  ["quads", "M76 220 C82 240 86 264 85 290 C84 298 81 303 79 304 C79 278 78 246 76 220 Z"],
  ["quads", "M88 252 C91 266 92 286 89 304 C86 306 83 306 82 304 C86 296 88 272 88 252 Z"],
  ["calves", "M71 320 C67 336 68 362 74 384 C77 378 79 356 79 338 C79 330 77 322 75 316 Z"],
  ["calves", "M85 318 C83 332 84 358 86 378 C90 366 93 340 89 314 Z"],
];
const BACK = [
  ["traps", "M98 58 C92 66 80 72 68 77 C76 84 88 104 98 136 Z"],
  ["shoulders", "M66 78 C56 77 47 85 44 98 C43 108 45 116 49 121 C56 112 64 100 68 90 Z"],
  ["triceps", "M48 125 C41 134 36 150 35 164 C40 166 46 164 49 158 C53 146 55 134 54 124 Z"],
  ["forearms", FOREARM],
  ["back", "M70 94 C62 106 62 130 72 174 C80 166 92 152 98 138 C90 120 80 104 70 94 Z"],
  ["lowerBack", "M98 148 C90 158 80 170 75 186 C82 196 90 200 98 200 Z"],
  ["glutes", "M98 204 C84 200 68 206 64 224 C63 240 76 250 90 248 C96 246 98 238 98 228 Z"],
  ["hamstrings", "M66 252 C63 272 66 296 73 308 C76 300 78 280 78 256 C74 254 70 254 66 252 Z"],
  ["hamstrings", "M81 256 C82 276 84 296 87 308 C92 292 95 272 94 252 C90 256 86 256 81 256 Z"],
  ["calves", "M70 318 C64 334 66 356 74 368 C78 358 80 342 80 324 C77 320 73 318 70 318 Z"],
  ["calves", "M84 322 C84 342 86 356 88 366 C94 352 96 336 90 318 C88 320 86 322 84 322 Z"],
];
const AHEAD = [[0, "Now"], [24, "Tomorrow"], [48, "In 2 days"]];

function Body({ side, states, selected, onSelect }) {
  const shapes = side === "front" ? FRONT : BACK;
  return (
    <svg className="body-svg" viewBox="0 0 200 424" aria-hidden="true">
      <g className="body-base">
        <ellipse cx="100" cy="30" rx="16" ry="21" />
        <path d={SILHOUETTE} />
        <path d={SILHOUETTE} transform={MIRROR} />
      </g>
      {shapes.map(([id, d], index) => (
        <g
          key={index}
          className={`body-muscle is-${states[id]} ${selected === id ? "is-selected" : ""} ${selected && selected !== id ? "is-dimmed" : ""}`}
          style={{ "--i": index }}
          onClick={onSelect ? () => onSelect(id) : undefined}
        >
          <path d={d} />
          <path d={d} transform={MIRROR} />
        </g>
      ))}
    </svg>
  );
}

function Segments({ label, items, value, onChange }) {
  const active = Math.max(0, items.findIndex(([id]) => id === value));
  return (
    <div className="recovery-segments" role="group" aria-label={label} style={{ "--count": items.length, "--active": active }}>
      <i aria-hidden="true" />
      {items.map(([id, text]) => (
        <button key={id} type="button" aria-pressed={id === value} onClick={() => onChange(id)}>{text}</button>
      ))}
    </div>
  );
}

const Row = ({ muscle, selected, onClick, index }) => (
  <button type="button" className={`recovery-row is-${muscle.state} ${selected ? "is-selected" : ""}`} style={{ "--i": index }} aria-pressed={selected} onClick={onClick}>
    <i aria-hidden="true" />
    <span><b>{t(muscle.label)}</b><small>{statusLine(muscle)}</small></span>
  </button>
);

const Legend = () => (
  <div className="recovery-legend" aria-hidden="true">
    <span className="is-hot"><i />{t('Hot')}</span><span className="is-recovering"><i />{t('Recovering')}</span><span className="is-ready"><i />{t('Ready')}</span><span className="is-idle"><i />{t('Not lately')}</span>
  </div>
);

const Pressure = ({ day, muscles }) => muscles.length > 0 && (
  <p className="recovery-pressure">{t('Today’s')} {t(day.name)} {t('hits')} <b>{muscles.slice(0, 2).map((muscle) => muscle.label).join(" and ")}</b>{t(', still recovering.')}</p>
);

export function RecoveryMap({ clientId, compact = false, coach = false, day = null, onOpen }) {
  const { data } = useApp();
  const [side, setSide] = useState("front"), [ahead, setAhead] = useState(0), [selected, setSelected] = useState(null);
  const map = useMemo(() => recoveryMap(data, clientId, Date.now() + ahead * 3600000), [data.sessions, data.library, clientId, ahead]);
  const states = Object.fromEntries(map.muscles.map((muscle) => [muscle.id, muscle.state]));
  const pressure = planPressure(map, day);
  const focus = map.muscles.find((muscle) => muscle.id === selected);
  const chooseSide = (next) => { setSide(next); setSelected(null); };
  const heading = <div className="recovery-heading"><span>{t('LIVE RECOVERY')}</span>{compact && <ChevronRight size={18} />}</div>;

  if (compact) return (
    <button type="button" className="recovery-card is-compact" aria-label={t('Open live recovery')} onClick={onOpen}>
      {heading}
      <div className="recovery-compact">
        <div className="recovery-bodies"><Body side="front" states={states} /><Body side="back" states={states} /></div>
        <div className="recovery-list">
          {map.logged ? byUrgency(map.muscles).slice(0, 3).map((muscle, index) => <span key={muscle.id} className={`recovery-row is-${muscle.state}`} style={{ "--i": index }}><i aria-hidden="true" /><span><b>{t(muscle.label)}</b><small>{statusLine(muscle)}</small></span></span>) : <p className="recovery-empty">{coach ? t('Muscles light up as this client logs workouts.') : t('Log a workout and your muscles light up here.')}</p>}
        </div>
      </div>
      <Pressure day={day} muscles={pressure} />
    </button>
  );

  return (
    <section className="recovery-card" aria-label={t('Live recovery')}>
      {heading}
      <Pressure day={day} muscles={ahead ? [] : pressure} />
      <div className="recovery-main">
        <div className="recovery-stage" data-side={side}>
          <div className="body-flip">
            <div className="body-face"><Body side="front" states={states} selected={selected} onSelect={setSelected} /></div>
            <div className="body-face is-back"><Body side="back" states={states} selected={selected} onSelect={setSelected} /></div>
          </div>
          <Segments label={t('Body side')} items={[["front", "Front"], ["back", "Back"]]} value={side} onChange={chooseSide} />
        </div>
        <div className="recovery-list" key={side}>
          {byUrgency(map.muscles.filter((muscle) => muscle.side === side)).map((muscle, index) => <Row key={muscle.id} muscle={muscle} index={index} selected={selected === muscle.id} onClick={() => setSelected(selected === muscle.id ? null : muscle.id)} />)}
        </div>
      </div>
      {focus && <div className="recovery-detail" key={focus.id}>
        <b>{t(focus.label)}</b>
        {focus.lastAt ? <p>{focus.sets} {focus.sets === 1 ? "set" : "sets"} {t('in')} {focus.session}. {focus.exercises.join(", ")}.</p> : <p>{coach ? t('No logged sets in the last two weeks.') : t('No logged sets in the last two weeks. A good one to bring up with your coach.')}</p>}
      </div>}
      <Segments label={t('Preview recovery')} items={AHEAD} value={ahead} onChange={setAhead} />
      <Legend />
      {!map.logged && <p className="recovery-empty">{coach ? t('Muscles light up as this client logs workouts.') : t('Log a workout and your muscles light up here.')}</p>}
      <p className="recovery-note">{t('Estimated from logged sets, not measured. How you feel comes first.')}</p>
    </section>
  );
}
