import { MotionNumber } from "./motion.jsx";
import React, { useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { useApp } from "./context.js";
import {
  dayKey,
  uid,
  sum,
  round,
  download,
  metrics,
  useFile,
  saveFile,
} from "./store.js";
import {
  Button,
  BrandLogo,
  IMAGES,
  BACKGROUNDS,
  Modal,
  Notice,
  Tabs,
} from "./ui.jsx";

import { t } from './i18n.js';
export function makeDraft(data, client, day, date) {
  return {
    id: uid(),
    clientId: client.id,
    date,
    dayId: day.id,
    title: day.name,
    cover: day.cover,
    coverFile: day.coverFile || null,
    startedAt: Date.now(),
    index: 0,
    sets: [],
    exercises: structuredClone(day.exercises),
    note: "",
  };
}
export { Workout } from "./WorkoutLogger.jsx";

export function ShareWorkout({ session, onClose, celebrate = false }) {
  const { data } = useApp();
  const [weeks, setWeeks] = useState(4);
  const [background, setBackground] = useState(session.cover ?? 0),
    [custom, setCustom] = useState(session.coverFile || null),
    [uploading, setUploading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const operationLock = useRef(false);
  const customUrl = useFile(custom?.id);
  const logoUrl = useFile(data.coach.logo?.id);
  const story = session.story,
    m = story ? metrics(data, session.clientId, dayKey(), weeks * 7) : null,
    sets = story ? m.sessions.flatMap((s) => s.sets) : session.sets;
  const title = story ? "Small steps.\nReal progress." : session.title;
  const stats = story
    ? [
        [m.sessions.length, "WORKOUTS"],
        [`${m.training ?? 0}%`, "CONSISTENCY"],
        [m.change === null ? "—" : `${m.change} ${t('kg')}`, t('WEIGHT CHANGE')],
      ]
    : [
        [Math.round(session.duration / 60) || 1, "MINUTES"],
        [sets.filter((s) => !s.skipped).length, "SETS"],
        [
          Math.round(sum(sets, (s) =>
            s.skipped || s.kind === "Duration" ? 0 : s.weight * s.reps,
          )),
          "KG VOLUME",
        ],
      ];
  const bg = custom ? customUrl : IMAGES[background],
    caption = `${title.replace("\n", " ")}. ${stats.map(([v, l]) => `${v} ${l.toLowerCase()}`).join(" · ")}. ${data.coach.brand}`;
  async function render() {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.src = bg;
    await img.decode();
    const ratio = Math.max(1080 / img.width, 1920 / img.height);
    ctx.drawImage(
      img,
      (1080 - img.width * ratio) / 2,
      (1920 - img.height * ratio) / 2,
      img.width * ratio,
      img.height * ratio,
    );
    const grad = ctx.createLinearGradient(0, 0, 0, 1920);
    grad.addColorStop(0, "#07110c33");
    grad.addColorStop(0.4, "#08100d66");
    grad.addColorStop(1, "#07100dfa");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#fff";
    ctx.font = "500 40px Arial";
    if (logoUrl) {
      const logo = new Image();
      logo.src = logoUrl;
      await logo.decode();
      const fit = Math.min(80 / logo.width, 80 / logo.height);
      ctx.drawImage(
        logo,
        80 + (80 - logo.width * fit) / 2,
        74 + (80 - logo.height * fit) / 2,
        logo.width * fit,
        logo.height * fit,
      );
    }
    ctx.fillText(
      data.coach.brand.toUpperCase(),
      logoUrl ? 185 : 80,
      130,
      logoUrl ? 810 : 920,
    );
    ctx.font = "24px Arial";
    ctx.fillText(
      story ? `YOUR LAST ${weeks} WEEKS` : "WORKOUT COMPLETE",
      80,
      1040,
    );
    ctx.font = "600 94px Arial";
    let y = 1160;
    const words = title.replace("\n", " ").split(" ");
    let line = "";
    const lines = [];
    for (const word of words) {
      if (ctx.measureText(line + word).width > 900) {
        if (line.trim()) lines.push(line.trim());
        line = "";
      }
      line += word + " ";
    }
    if (line.trim()) lines.push(line.trim());
    lines.slice(0, 3).forEach((text, index) => {
      const fitted = index === 2 && lines.length > 3 ? `${text.slice(0, 24)}…` : text;
      ctx.fillText(fitted, 80, 1160 + index * 108, 900);
    });
    y += (Math.min(lines.length, 3) - 1) * 108;
    ctx.fillStyle = "#83d8b0";
    ctx.fillRect(80, y + 60, 72, 5);
    stats.forEach(([v, label], i) => {
      ctx.fillStyle = "#fff";
      ctx.font = "500 54px Arial";
      ctx.fillText(typeof v === 'number' ? v.toLocaleString() : String(v), 80 + i * 320, 1570);
      ctx.fillStyle = "#b6c2bd";
      ctx.font = "21px Arial";
      ctx.fillText(label, 80 + i * 320, 1620);
    });
    ctx.fillStyle = "#b8c5be";
    ctx.font = "28px Arial";
    ctx.fillText("The work speaks for itself.", 80, 1805);
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error(t('Could not create image.')))),
        "image/png",
      ),
    );
  }
  async function exportImage(share) {
    if (operationLock.current || !bg || (data.coach.logo && logoUrl === '')) return;
    operationLock.current = true;
    setBusy(true);
    setError("");
    try {
      const blob = await render(),
        file = new File([blob], "avalen-progress.png", { type: "image/png" });
      if (share && navigator.canShare?.({ files: [file] }))
        await navigator.share({
          files: [file],
          title: story ? "My progress" : title,
        });
      else {
        download(blob, "avalen-progress.png");
        setMessage(t('Image download started. Add it to your Instagram story or post.'));
      }
    } catch (e) {
      if (e.name !== "AbortError")
        setError(t('Could not export your image. Please try again.'));
    } finally {
      operationLock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title={story ? t('Your progress story') : t('You showed up.')}
      className="share-modal"
      onClose={onClose}
    >
      {!celebrate && <p className="muted">{t('A little proof of the work. Made to share.')}</p>}
      {story && (
        <Tabs
          items={[
            [4, "4 weeks"],
            [8, "8 weeks"],
            [12, "12 weeks"],
          ]}
          value={weeks}
          onChange={setWeeks}
        />
      )}
      {celebrate && !story && <div className="workout-earned" role="status"><span className="earned-mark"><Check size={26}/></span><div><span className="eyebrow">{t('SESSION SAVED')}</span><h2>{t('You put in the work.')}</h2><p>{session.prs?.length ? t('{count} personal records · {list}', { count: session.prs.length, list: session.prs.map((name) => t(name)).join(t(', ')) }) : t('{length} working sets. One step forward.', { length: sets.filter(s => !s.skipped).length })}</p></div></div>}
      <div
        className={`share-poster ${celebrate ? 'earned-poster' : ''}`}
        style={{
          backgroundImage: bg ? `linear-gradient(180deg,#07110c22 15%,#07100d55 45%,#07100df5),url(${bg})` : 'linear-gradient(180deg,#15241b,#07100d)',
        }}
      >
        <div className="share-brand">
          <BrandLogo brand={data.coach} />
          {data.coach.brand}
        </div>
        <div className="share-result">
          <span className="eyebrow">
            {story ? t('YOUR LAST {weeks} WEEKS', { weeks }) : t('WORKOUT COMPLETE')}
          </span>
          <h2>{title}</h2>
          <i />
          <div>
            {stats.map(([value, label]) => (
              <span key={label}>
                <b>{typeof value === 'number' ? <MotionNumber value={value} from={celebrate ? 0 : undefined} identity={`result:${session.id}:${label}`}/> : value}</b>
                <small>{label}</small>
              </span>
            ))}
          </div>
          <p>{t('The work speaks for itself.')}</p>
        </div>
      </div>
      <SectionLabel>{t('Make it yours')}</SectionLabel>
      <div className="background-picker">
        {IMAGES.map((url, i) => (
          <button
            key={url}
            aria-label={t('{value} background', { value: BACKGROUNDS[i] })}
            aria-pressed={!custom && background === i}
            disabled={busy || uploading}
            style={{ backgroundImage: `url(${url})` }}
            onClick={() => {
              setBackground(i);
              setCustom(null);
              setError('');
              setMessage('');
            }}
          >
            {background === i && !custom && <Check size={18} />}
          </button>
        ))}
      </div>
      <label className="upload-inline">
        {t('Use your own photo')}
        <input
          type="file"
          accept="image/*"
          disabled={busy || uploading}
          onChange={async (e) => {
            const input = e.currentTarget;
            const file = input.files?.[0];
            if (file && !operationLock.current) {
              operationLock.current = true;
              setUploading(true);
              setError('');
              setMessage('');
              try {
                setCustom(await saveFile(file));
              } catch (e) {
                setError(e.message);
              } finally {
                operationLock.current = false;
                setUploading(false);
                input.value = '';
              }
            }
          }}
        />
      </label>
      {(uploading || (custom && customUrl === '')) && <Notice>{t('Preparing your photo…')}</Notice>}
      {custom && customUrl === null && <p className="error" role="alert">{t('This photo is unavailable. Choose a background or upload it again.')}</p>}
      <div className="button-row share-actions">
        <Button
          disabled={busy || uploading || !bg || (data.coach.logo && logoUrl === "")}
          onClick={() => exportImage(true)}
        >
          {busy ? t('Preparing image…') : t('Share result')}
          <Share2 size={16} />
        </Button>
        <Button
          secondary
          disabled={busy || uploading || !bg || (data.coach.logo && logoUrl === "")}
          onClick={() => exportImage(false)}
        >
          {t('Save image')}
        </Button>
      </div>
      <button
        className="text-link"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(caption);
            setMessage(t('Caption copied.'));
          } catch {
            setMessage(caption);
          }
        }}
      >
        {t('Copy caption')}
      </button>
      {message && <Notice>{message}</Notice>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
function SectionLabel({ children }) {
  return <h3 className="section-label">{children}</h3>;
}
