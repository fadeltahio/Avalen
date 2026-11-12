import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MovingIndicator, useAnimatedNumber, useMotionReduced, animate, timing, ease, TrendLine } from "./motion.jsx";
import { chartRecords, fieldMessage } from "./validation.js";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { dayKey, offsetDay, dateOf, initials, useFile, scheduleDay } from "./store.js";
import rack from "../assets/share-strength-rack-v2.jpg";
import weights from "../assets/share-dumbbells-studio-v2.jpg";
import track from "../assets/share-track-dawn-v2.jpg";
import recovery from "../assets/share-recovery-v2.jpg";
import night from "../assets/share-night-gym-v2.jpg";
import mountain from "../assets/avalen-mountains.jpg";
export const IMAGES = [rack, weights, track, recovery, night];
export { mountain };
export const BACKGROUNDS = [
  "Strength",
  "Dumbbells",
  "Track",
  "Recovery",
  "Night gym",
];
// Clients inherit the coach's workspace branding; no per-client copies to drift.
export function BrandLogo({ brand, large = false, className = "" }) {
  const url = useFile(brand?.logo?.id);
  return url ? (
    <img
      className={`brand-logo ${large ? "large" : ""} ${className}`}
      src={url}
      alt={`${brand.brand} logo`}
    />
  ) : (
    <Mark large={large} />
  );
}
export function Mark({ large = false }) {
  return (
    <svg
      className={large ? "a-mark large" : "a-mark"}
      viewBox="0 0 36 34"
      aria-label="Avalen"
    >
      <path d="M3 31 18 3 33 31h-5L18 12 8 31Z" fill="currentColor" />
    </svg>
  );
}
export function Avatar({ name, size = "normal" }) {
  return (
    <span className={`avatar ${size}`} aria-label={name}>
      {initials(name)}
    </span>
  );
}
export function Button({
  children,
  secondary = false,
  small = false,
  className = "",
  ...props
}) {
  return (
    <button
      type="button"
      className={`${secondary ? "secondary" : "primary"} ${small ? "small" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function IconButton({ label, children, ...props }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}
export function Tabs({ items, value, onChange, label = "Sections" }) {
  const container = useRef(null);
  const reduced = useMotionReduced();
  useLayoutEffect(() => {
    const host = container.current, active = host?.querySelector('[aria-selected="true"]');
    if (!active || host.scrollWidth <= host.clientWidth) return;
    const left = active.offsetLeft, right = left + active.offsetWidth;
    if (left < host.scrollLeft || right > host.scrollLeft + host.clientWidth)
      host.scrollTo({left: Math.max(0, left < host.scrollLeft ? left - 8 : right - host.clientWidth + 8), behavior: reduced ? 'instant' : 'smooth'});
  }, [value, reduced]);
  return (
    <div ref={container} className="tabs" role="tablist" aria-label={label}>
      <MovingIndicator container={container} value={value}/>
      {items.map((item, index) => {
        const [id, text] = Array.isArray(item) ? item : [item, item];
        return (
          <button
            key={id}
            type="button"
            role="tab"
            tabIndex={value === id || (index === 0 && !items.some(item => (Array.isArray(item) ? item[0] : item) === value)) ? 0 : -1}
            aria-selected={value === id}
            className={value === id ? "active" : ""}
            onClick={() => onChange(id)}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? items.length - 1
                    : (index +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        items.length) %
                      items.length;
              onChange(
                Array.isArray(items[next]) ? items[next][0] : items[next],
              );
              event.currentTarget.parentElement
                .querySelectorAll('[role="tab"]')
                [next].focus();
            }}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}
export function Heading({ title, subtitle, action, eyebrow }) {
  return (
    <div className="page-heading">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <div>
        <h1>{title}</h1>
        {action}
      </div>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
export function SectionHead({ title, action }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {action}
    </div>
  );
}
export function Empty({ icon: Icon = ImageIcon, title, detail, action }) {
  return (
    <div className="empty">
      <Icon size={26} />
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
export function Quote() {
  return (
    <aside
      className="quote"
      style={{
        backgroundImage: `linear-gradient(90deg, #171d1dec, #11181844),url(${mountain})`,
      }}
    >
      <span>“</span>
      <p>
        Discipline today
        <br />
        builds the freedom you want tomorrow.
      </p>
    </aside>
  );
}
export function Stat({ label, value, note, tone, children }) {
  return (
    <div className="card stat">
      <span>{label}</span>
      <strong className="metric-value">{value}</strong>
      {children}
      {note && <small className={tone || ""}>{note}</small>}
    </div>
  );
}
export function Ring({ value, target, label, unit = "", tone = "green", motionKey = "" }) {
  const shown = useAnimatedNumber(value, `${motionKey}:macro:${label}`, 0);
  return (
    <div className={`ring-item ${tone}`} aria-label={`${label}: ${value}${unit} of ${target}${unit}`}>
      <div className="ring" aria-hidden="true">
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="40" r="35" className="ring-track" />
          <circle
            cx="40"
            cy="40"
            r="35"
            strokeDasharray={`${(target > 0 ? Math.max(0, Math.min(100, shown / target * 100)) : 0) * 2.199} 220`}
            transform="rotate(-90 40 40)"
          />
        </svg>
        <span>
          <b>
            {shown.toLocaleString(undefined, { maximumFractionDigits: Number.isInteger(value) ? 0 : Math.min(3, String(value).split('.')[1]?.length || 3) })}
            {unit}
          </b>
          <small>
            {target.toLocaleString()}
            {unit}
          </small>
        </span>
      </div>
      <span>{label}</span>
    </div>
  );
}
export function Bars({ values = [4, 6, 5, 7, 8, 6, 9], tone = "green" }) {
  return (
    <div className={`mini-bars ${tone}`} aria-hidden="true">
      {values.map((n, i) => (
        <i
          key={i}
          style={{
            height: `${n ? Math.max(8, (n / (Math.max(...values) || 1)) * 100) : 3}%`,
            opacity: 0.35 + (i / values.length) * 0.65,
          }}
        />
      ))}
    </div>
  );
}
export function Meter({ value, target, tone = "green", label = 'Progress toward target' }) {
  return (
    <div
      className={`meter ${tone}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.max(1, target)}
      aria-valuenow={Math.max(0, Math.min(value, Math.max(1, target)))}
      aria-valuetext={`${value} of ${target}`}
    >
      <i style={{ transform: `scaleX(${target > 0 ? Math.max(0, Math.min(1, value / target)) : 0})` }} />
    </div>
  );
}
export function Calendar({ selected, onChange, client, sessions = [] }) {
  const ref = useRef(null),
    drag = useRef(null),
    centered = useRef(false);
  const reduced = useMotionReduced();
  const today = dayKey();
  const days = Array.from({ length: 35 }, (_, i) => offsetDay(i - 21));
  useEffect(() => {
    const calendar = ref.current;
    const centerSelectedDay = (behavior = 'instant') => {
      const el = calendar?.querySelector('[aria-pressed="true"]');
      if (el) calendar.scrollTo({ left: el.offsetLeft - calendar.offsetLeft - calendar.clientWidth / 2 + el.clientWidth / 2, behavior });
    };
    // Only a day the person chose glides; first paint and resizes land directly.
    centerSelectedDay(centered.current && !reduced ? 'smooth' : 'instant');
    centered.current = true;
    let width = calendar.clientWidth;
    const observer = new ResizeObserver(() => {
      if (calendar.clientWidth === width) return;
      width = calendar.clientWidth;
      centerSelectedDay();
    });
    observer.observe(calendar);
    return () => observer.disconnect();
  }, [selected, reduced]);
  return (
    <>
    <p className="calendar-month" aria-live="polite">{dateOf(selected).toLocaleDateString("en", { month: "long", year: "numeric" })}</p>
    <div
      className="calendar"
      ref={ref}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse")
          drag.current = {
            x: e.clientX,
            left: ref.current.scrollLeft,
            moved: false,
          };
      }}
      onPointerMove={(e) => {
        if (drag.current) {
          const dx = e.clientX - drag.current.x;
          if (Math.abs(dx) > 5) drag.current.moved = true;
          ref.current.scrollLeft = drag.current.left - dx;
        }
      }}
      onPointerUp={() => {
        setTimeout(() => {
          drag.current = null;
        }, 0);
      }}
      onPointerLeave={() => {
        drag.current = null;
      }}
    >
      {days.map((d) => {
        const complete = sessions.some(
          (s) => s.clientId === client.id && s.date === d,
        );
        const scheduled = Boolean(scheduleDay(client, d));
        return (
          <button
            key={d}
            aria-label={dateOf(d).toLocaleDateString("en", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            aria-pressed={d === selected}
            aria-description={complete ? 'Workout completed' : scheduled ? 'Workout scheduled' : 'Rest day'}
            className={`${d === selected ? "active" : ""} ${d === today ? "today" : ""}`}
            onClick={() => {
              if (!drag.current?.moved) onChange(d);
            }}
          >
            <small>
              {dateOf(d).toLocaleDateString("en", { weekday: "short" })}
            </small>
            <b>{dateOf(d).getDate()}</b>
            {(complete || scheduled) && <i className={complete ? 'calendar-complete' : 'calendar-scheduled'} aria-hidden="true"/>}
          </button>
        );
      })}
    </div>
    </>
  );
}
export function Modal({ title, onClose, children, wide = false, className = "", canClose = true }) {
  const ref = useRef(null), closing = useRef(false), closeAnimation = useRef(null), latestClose = useRef(onClose), gesture = useRef(null);
  latestClose.current = onClose;
  const closeAllowed = useRef(canClose); closeAllowed.current = canClose;
  const reduced = useMotionReduced();
  useEffect(() => { if (reduced) closeAnimation.current?.finish(); }, [reduced]);
  async function requestClose() {
    if (closing.current || !closeAllowed.current) return;
    closing.current = true;
    const el = ref.current;
    const currentTransform = getComputedStyle(el).transform;
    const from = currentTransform === 'none' ? 'translateY(0)' : currentTransform;
    el.dataset.closing = "true";
    // Phone sheets leave the way they arrived; desktop dialogs fade.
    closeAnimation.current = matchMedia("(max-width: 760px)").matches
      ? animate(el, [{ transform: from }, { transform: `${from} translateY(100%)` }], { duration: timing.panel, easing: ease.sheetOut })
      : animate(el, [{ opacity: 1, transform: from }, { opacity: 0, transform: `${from} translateY(14px)` }], { duration: timing.state });
    try { await closeAnimation.current?.finished; } catch {}
    if (!ref.current) return;
    delete el.dataset.closing;
    try { await latestClose.current(); } finally { closing.current = false; }
  }
  function beginDrag(event) {
    if (closing.current || !closeAllowed.current || event.pointerType !== 'touch' || event.target.closest('button')) return;
    closeAnimation.current?.cancel();
    gesture.current = { y: event.clientY, dy: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event) {
    if (!gesture.current) return;
    gesture.current.dy = Math.max(0, Math.min(100, event.clientY - gesture.current.y));
    if (!reduced) ref.current.style.transform = `translateY(${gesture.current.dy * .55}px)`;
  }
  function endDrag(cancelled = false) {
    if (!gesture.current || !ref.current) return;
    const dismiss = !cancelled && gesture.current.dy > 65;
    gesture.current = null;
    const el = ref.current, from = el.style.transform || 'translateY(0)';
    if (dismiss) requestClose();
    el.style.transform = '';
    if (!dismiss) closeAnimation.current = animate(el, [{ transform: from }, { transform: 'translateY(0)' }], { duration: timing.state, easing: ease.spring });
  }
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    const prior = document.activeElement;
    el.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
      closeAnimation.current?.cancel();
      if (el.open) el.close();
      if (prior?.isConnected) prior.focus?.({preventScroll:true});
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`modal ${wide ? "wide" : ""} ${className}`}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const bounds = ref.current.getBoundingClientRect();
          if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) requestClose();
        }
      }}
    >
      <header className="modal-drag-handle" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={() => endDrag()} onPointerCancel={() => endDrag(true)}>
        <h2 id={titleId}>{title}</h2>
        <IconButton label="Close dialog" disabled={!canClose} onClick={requestClose}>
          <X size={20} />
        </IconButton>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function Field({ label, children, ...props }) {
  const [error, setError] = useState('');
  const errorId = useId();
  const labelId = useId();
  function validate(input) {
    input.setCustomValidity('');
    const message = fieldMessage(input, label);
    input.setCustomValidity(message);
    setError(message);
  }
  return (
    <label className="field">
      <span id={labelId}>{label}</span>
      {children ? (React.isValidElement(children) && ['input', 'select', 'textarea'].includes(children.type) ? React.cloneElement(children, { 'aria-labelledby': children.props['aria-labelledby'] || labelId }) : children) : <input {...props}
        aria-labelledby={props['aria-labelledby'] || labelId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : props['aria-describedby']}
        onInvalid={(event) => { validate(event.currentTarget); props.onInvalid?.(event); }}
        onBlur={(event) => { validate(event.currentTarget); props.onBlur?.(event); }}
        onChange={(event) => {
          const input = event.currentTarget;
          input.setCustomValidity(input.required && input.value && !input.value.trim() ? `Please enter ${label.toLowerCase()}.` : '');
          setError('');
          props.onChange?.(event);
        }}
      />}
      {error && <small id={errorId} className="error" role="alert">{error}</small>}
    </label>
  );
}
export function Media({ fileId, alt = "", className = "", type }) {
  const url = useFile(fileId);
  const [failed, setFailed] = useState(null);
  if (url === null || (url && failed === url))
    return (
      <div className={`media-placeholder ${className}`} role="status">
        This file is unavailable in this browser.
      </div>
    );
  if (!url)
    return (
      <div className={`media-placeholder skeleton ${className}`} role="status" aria-busy="true">
        <ImageIcon size={18} />
        <span>Loading file…</span>
      </div>
    );
  return type?.startsWith("video/") ? (
    <video className={className} src={url} controls preload="metadata" aria-label={alt || 'Attached video'} onError={() => setFailed(url)} />
  ) : type?.startsWith("audio/") ? (
    <audio src={url} controls preload="metadata" aria-label={alt || 'Attached audio'} onError={() => setFailed(url)} />
  ) : (
    <img className={className} src={url} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(url)} />
  );
}
export function LineChart({
  records,
  field = "weight",
  unit = "kg",
  color = "green",
  label = field,
  timeScale = false,
  domain,
}) {
  const [active, setActive] = useState(null);
  const data = useMemo(() => chartRecords(records, field), [records, field]);
  const datasetKey = data.map(point => `${point.date}:${point[field]}`).join('|');
  useEffect(() => setActive(null), [datasetKey, field]);
  if (!data.length)
    return (
      <Empty
        title="Your trend starts here"
        detail="Log a measurement to see your progress."
      />
    );
  const vals = data.map((x) => Number(x[field]));
  const smallest = Math.min(...vals);
  const low = domain?.[0] ?? (smallest >= 0 ? Math.max(0, Math.floor(smallest - 1)) : Math.floor(smallest - 1)),
    high = domain?.[1] ?? Math.ceil(Math.max(...vals) + 1),
    range = high - low || 1;
  const firstDate = dateOf(data[0].date).getTime(), lastDate = dateOf(data.at(-1).date).getTime();
  const pts = data.map((x, i) => [
    data.length === 1 ? 180 : 35 + (timeScale ? (dateOf(x.date).getTime() - firstDate) / (lastDate - firstDate || 1) : i / (data.length - 1)) * 290,
    145 - ((x[field] - low) / range) * 120,
  ]);
  const i =
    active === null ? data.length - 1 : Math.min(active, data.length - 1);
  const path = pts.map((p) => p.join(",")).join(" ");
  function scrub(e) {
    const box = e.currentTarget.getBoundingClientRect();
    const pointer = (e.clientX - box.left) / box.width * 350;
    const next = pts.reduce((best,point,index) => Math.abs(point[0] - pointer) < Math.abs(pts[best][0] - pointer) ? index : best,0);
    if (next !== active) {
      setActive(next);
      navigator.vibrate?.(5);
    }
  }
  return (
    <div className={`chart ${color}`}>
      <div className="chart-readout">
        <span>
          {new Date(data[i].date + "T12:00:00").toLocaleDateString("en", {
            month: "short",
            day: "numeric",
          })}
        </span>
        <b className="metric-value">
          {Number(data[i][field]).toFixed(1)} <small>{unit}</small>
        </b>
      </div>
      <svg
        viewBox="0 0 350 180"
        role="slider"
        tabIndex={0}
        aria-label={`${label} history, use arrow keys to explore`}
        aria-valuemin={0}
        aria-valuemax={data.length - 1}
        aria-valuenow={i}
        aria-valuetext={`${data[i].date}: ${data[i][field]} ${unit}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          scrub(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons || e.pointerType === "mouse") scrub(e);
        }}
        onKeyDown={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            setActive(
              Math.max(
                0,
                Math.min(
                  data.length - 1,
                  e.key === "Home" ? 0 : e.key === "End" ? data.length - 1 : i + (e.key === "ArrowRight" ? 1 : -1),
                ),
              ),
            );
          }
        }}
      >
        {[0, 1, 2, 3].map((n) => (
          <g key={n}>
            <line
              x1="35"
              x2="325"
              y1={25 + n * 40}
              y2={25 + n * 40}
              className="gridline"
            />
            <text x="0" y={29 + n * 40}>
              {(high - (n * range) / 3).toFixed(0)}
            </text>
          </g>
        ))}
        {data.length > 1 && <polygon points={`35,145 ${path} 325,145`} className="chart-area" />}
        <TrendLine points={path} identity={`${label}:${field}`} />
        {timeScale && pts.map((point,index)=><circle key={`${data[index].date}-${index}`} className="chart-point" cx={point[0]} cy={point[1]} r="2.5"/>)}
        <line
          x1={pts[i][0]}
          x2={pts[i][0]}
          y1="20"
          y2="150"
          className="chart-cursor"
        />
        <circle cx={pts[i][0]} cy={pts[i][1]} r="4.5" />
        <text x="35" y="174">
          {dateOf(data[0].date).toLocaleDateString("en", {
            month: "short",
            day: "numeric",
          })}
        </text>
        <text x="325" y="174" textAnchor="end">
          {dateOf(data.at(-1).date).toLocaleDateString("en", {
            month: "short",
            day: "numeric",
          })}
        </text>
      </svg>
    </div>
  );
}
export function Notice({ children }) {
  return <div className="notice" role="status">{children}</div>;
}
