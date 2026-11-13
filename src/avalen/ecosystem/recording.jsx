import React, { useEffect, useRef, useState } from "react";
import { useMotionReduced } from "../motion.jsx";
import { Mic, Square, Trash2, Pause, Play } from "lucide-react";
import { Button, Field } from "../ui.jsx";
import { saveFile, useFile } from "../store.js";
import { connection, request } from "./connection.js";
import { t } from '../i18n.js';
export function VoiceRecording({
  value,
  onChange,
  clientId,
  label = "Voice update",
  maxSeconds = 60,
  onBusyChange,
}) {
  const [recording, setRecording] = useState(false),
    [paused, setPaused] = useState(false),
    [starting, setStarting] = useState(false),
    [seconds, setSeconds] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false),
    [available, setAvailable] = useState(false),
    [transcribing, setTranscribing] = useState(false);
  useEffect(() => {
    onBusyChange?.(starting || recording || busy || transcribing);
  }, [starting, recording, busy, transcribing]);
  const recorder = useRef(null),
    stream = useRef(null),
    meterContext = useRef(null),
    timer = useRef(null),
    alive = useRef(true),
    chunks = useRef([]),
    elapsed = useRef(0),
    activeSince = useRef(0),
    url = useFile(value?.id);
  useEffect(() => {
    alive.current = true;
    if (connection())
      request("/status")
        .then((s) => setAvailable(s.transcription))
        .catch(() => {});
    return () => {
      alive.current = false;
      clearInterval(timer.current);
      if (recorder.current && recorder.current.state !== "inactive")
        recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      meterContext.current?.close().catch(() => {});
    };
  }, []);
  async function store(file) {
    setBusy(true);
    setError("");
    try {
      let duration = null;
      if (!connection()) {
        const objectURL = URL.createObjectURL(file);
        try {
          duration = await new Promise((resolve, reject) => {
            const audio = document.createElement("audio");
            const timer = setTimeout(
              () =>
                reject(new Error(t('Choose a playable recording or use text.'))),
              10000,
            );
            audio.onloadedmetadata = () => {
              clearTimeout(timer);
              resolve(audio.duration);
            };
            audio.onerror = () => {
              clearTimeout(timer);
              reject(new Error(t('Choose a playable voice recording.')));
            };
            audio.src = objectURL;
          });
        } finally {
          URL.revokeObjectURL(objectURL);
        }
        if (Number.isFinite(duration) && duration > maxSeconds + 1)
          throw new Error(t('Choose a recording up to {maxSeconds} seconds.', { maxSeconds }));
      }
      const saved = await saveFile(file, {
        types: ["audio/"],
        maxMB: 12,
        clientId,
        purpose: "voice",
      });
      if (alive.current)
        onChange({ ...saved, ...(duration ? { duration } : {}) });
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function start() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(
        t('Recording is unavailable in this browser. Upload a voice recording or use text.'),
      );
      return;
    }
    setStarting(true);
    // Safari requires Web Audio to be unlocked in the originating user gesture,
    // before microphone permission and React effects cross an async boundary.
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      meterContext.current = new Audio();
      meterContext.current.resume().catch(() => {});
    } catch { meterContext.current = null; }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!alive.current) {
        stream.current.getTracks().forEach((t) => t.stop());
        return;
      }
      const type = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(
        stream.current,
        type ? { mimeType: type } : {},
      );
      recorder.current = r;
      chunks.current = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      r.onstop = () => {
        clearInterval(timer.current);
        stream.current?.getTracks().forEach((t) => t.stop());
        meterContext.current?.close().catch(() => {});
        if (alive.current) {
          setRecording(false);
          setPaused(false);
          const blob = new Blob(chunks.current, { type: r.mimeType });
          store(
            new File(
              [blob],
              `voice-${Date.now()}.${r.mimeType.includes("mp4") ? "m4a" : "webm"}`,
              { type: r.mimeType.split(";")[0] },
            ),
          );
        }
      };
      r.start(1000);
      setRecording(true);
      setSeconds(0);
      elapsed.current = 0;
      activeSince.current = Date.now();
      timer.current = setInterval(() => {
        const n = Math.floor(
          (elapsed.current +
            (r.state === "recording" ? Date.now() - activeSince.current : 0)) /
            1000,
        );
        if (alive.current) setSeconds(Math.min(n, maxSeconds));
        if (n >= maxSeconds && r.state === "recording") r.stop();
      }, 250);
    } catch {
      stream.current?.getTracks().forEach((t) => t.stop());
      meterContext.current?.close().catch(() => {});
      setError(
        t('Microphone access was unavailable. You can upload a recording or write your update.'),
      );
    } finally {
      if (alive.current) setStarting(false);
    }
  }
  function togglePause() {
    const r = recorder.current;
    if (r?.state === "recording") {
      elapsed.current += Date.now() - activeSince.current;
      r.pause();
      setPaused(true);
    } else if (r?.state === "paused") {
      activeSince.current = Date.now();
      meterContext.current?.resume().catch(() => {});
      r.resume();
      setPaused(false);
    }
  }
  async function transcribe() {
    setTranscribing(true);
    setError("");
    try {
      const job = await request("/transcriptions", {
        method: "POST",
        body: { clientId, mediaId: value.id, consent: true },
      });
      for (let i = 0; i < 60; i++) {
        const result = await request(`/jobs/${job.id}`);
        if (result.state === "done") {
          onChange({
            ...value,
            transcript: result.result.text,
            transcriptSource: "configured-provider",
          });
          return;
        }
        if (result.state === "failed")
          throw new Error(
            result.error ||
              t('Transcription failed. Your recording is still available.'),
          );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setError(
        t('Transcription is still processing. You can submit the original audio and your coach can listen.'),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      if (alive.current) setTranscribing(false);
    }
  }
  return (
    <section
      className="record-control"
      data-recording={
        recording
          ? paused
            ? "paused"
            : "recording"
          : busy
            ? "processing"
            : transcribing
              ? "transcribing"
              : value
                ? "complete"
                : "idle"
      }
      aria-label={label}
    >
      <div className="ecosystem-card-header">
        <b>{label}</b>
        <span className="fine-print muted">{t('Up to {maxSeconds} seconds', { maxSeconds })}</span>
      </div>
      <p className="record-status" role="status">
        {starting
          ? t('Waiting for microphone permission…')
          : recording
            ? paused
              ? t('Recording paused')
              : t('Recording · microphone connected')
            : busy
              ? t('Saving your recording…')
              : transcribing
                ? t('Preparing your transcript…')
                : value
                  ? t('Recording ready · listen before sending')
                  : t('Voice or text. Your choice.')}
      </p>
      {recording ? (
        <>
          <MicrophoneMeter stream={stream.current} context={meterContext.current} paused={paused} />
          <div className="ecosystem-toolbar">
            <span role="timer" className="record-time">{t('{seconds}s / {maxSeconds}s', { seconds, maxSeconds })}</span>
            <Button secondary small onClick={togglePause}>
              {paused ? <Play size={15} /> : <Pause size={15} />}{" "}
              {paused ? t('Resume recording') : t('Pause recording')}
            </Button>
            <Button small onClick={() => recorder.current?.stop()}>
              <Square size={15} />
              {t('Stop recording')}
            </Button>
          </div>
        </>
      ) : value ? (
        <>
          <audio src={url || undefined} controls preload="metadata" />
          <div className="ecosystem-toolbar">
            <Button
              secondary
              small
              disabled={busy || transcribing}
              onClick={() => onChange(null)}
            >
              <Trash2 size={14} />
              {t('Remove recording')}
            </Button>
            {available && (
              <Button
                secondary
                small
                disabled={!consent || transcribing}
                onClick={transcribe}
              >
                {transcribing ? t('Transcribing…') : t('Prepare transcript')}
              </Button>
            )}
          </div>
          {available ? (
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              {t('Allow this recording to be sent to the configured transcription provider.')}
            </label>
          ) : (
            <small className="muted">
              {t('No transcription provider is connected. Your coach can listen to the original recording.')}
            </small>
          )}
          {value.transcript !== undefined && (
            <Field label={t('Transcript · review and correct before sending')}>
              <textarea
                maxLength={6000}
                value={value.transcript}
                onChange={(e) =>
                  onChange({ ...value, transcript: e.target.value })
                }
              />
            </Field>
          )}
        </>
      ) : (
        <div className="ecosystem-toolbar">
          <Button secondary small disabled={busy || starting} onClick={start}>
            <Mic size={16} />
            {starting
              ? t('Connecting microphone…')
              : busy
                ? t('Saving recording…')
                : t('Record voice')}
          </Button>
          <label className="text-link">
            {t('Upload audio')}
            <input
              className="sr-only"
              type="file"
              accept="audio/*"
              aria-label={t('Upload {value}', { value: t(label) })}
              disabled={busy || starting}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) store(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
export function AudioPlayer({ file }) {
  const url = useFile(file?.id);
  return file ? (
    <audio
      src={url || undefined}
      controls
      preload="metadata"
      style={{ width: "100%" }}
    />
  ) : null;
}

function MicrophoneMeter({ stream, context, paused }) {
  const ref = useRef(null),
    output = useRef(null);
  const reduced = useMotionReduced();
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (paused || !stream) return;
    let source,
      frame,
      stopped = false,
      last = 0;
    const bars = [...ref.current.children];
    try {
      if (!context || context.state === 'closed') throw new Error(t('No audio analyser'));
      source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      const bins = new Uint8Array(analyser.frequencyBinCount);
      const waveform = new Uint8Array(analyser.fftSize);
      context.resume().catch(() => {
        if (!stopped) setUnavailable(true);
      });
      const paint = (now) => {
        if (stopped) return;
        if (!document.hidden && now - last >= (reduced ? 250 : 33)) {
          if (context.state !== 'running') {
            output.current.textContent = 'Microphone level unavailable while audio is suspended.';
            last = now;
            frame = requestAnimationFrame(paint);
            return;
          }
          analyser.getByteFrequencyData(bins);
          analyser.getByteTimeDomainData(waveform);
          if (!reduced)
            bars.forEach((bar, i) => {
              bar.style.transform = `scaleY(${Math.max(0.03, bins[Math.floor((i / bars.length) * bins.length)] / 255)})`;
            });
          const rms = Math.sqrt(
            waveform.reduce((sum, n) => sum + ((n - 128) / 128) ** 2, 0) /
              waveform.length,
          );
          output.current.textContent = `${Math.round(Math.min(1, rms) * 100)}% microphone level`;
          last = now;
        }
        frame = requestAnimationFrame(paint);
      };
      frame = requestAnimationFrame(paint);
    } catch {
      setUnavailable(true);
    }
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      source?.disconnect();
      bars.forEach((bar) => {
        bar.style.transform = "scaleY(.03)";
      });
    };
  }, [stream, context, paused, reduced]);
  return (
    <div>
      <div ref={ref} className="voice-meter" aria-hidden="true">
        {Array.from({ length: 32 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      <small ref={output} className="fine-print muted">
        {paused
          ? t('Microphone visualization paused')
          : unavailable
            ? t('Level visualization unavailable. You can still record.')
            : t('Listening for microphone input…')}
      </small>
    </div>
  );
}
