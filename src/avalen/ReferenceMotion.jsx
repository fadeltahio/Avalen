import React, { useEffect, useRef, useState } from 'react';
import { Check, Droplets, Minus, Plus } from 'lucide-react';
import { useApp } from './context.js';
import { dayKey, uid } from './store.js';
import { Button, Field, Modal } from './ui.jsx';
import { createWaterRenderer, createWaterFallback } from './water-renderer.js';

import { t } from './i18n.js';
export { useMotionReduced as useReducedMotion } from './motion.jsx';
import { useMotionReduced as useReducedMotion } from './motion.jsx';

export function SavedMotion({ label = 'Set saved', values = ['✓', '✓', '✓', '✓'] }) {
  return <div className="saved-motion" role="status"><span>{label}</span><div className="saved-morph" aria-hidden="true">{values.slice(0, 4).map((v, i) => <i key={i} style={{ '--cell': i }}>{v}</i>)}<svg viewBox="0 0 48 48"><path d="m14 24 7 7 14-15" /></svg></div></div>;
}

function Liquid({ percent, impulse, liters, hasTarget }) {
  const canvas = useRef(null), engine = useRef(null);
  const latest = useRef({ percent, liters, hasTarget });
  const [fallback, setFallback] = useState(false);
  const reduced = useReducedMotion();
  latest.current = { percent, liters, hasTarget };
  useEffect(() => {
    if (!engine.current) return;
    engine.current.setValue(hasTarget ? percent : liters, hasTarget ? '%' : 'L');
    if (impulse && !reduced) engine.current.splash(.6, .68, 1);
    if (reduced) engine.current.render(performance.now() / 1000);
  }, [percent, impulse, liters, hasTarget]);
  useEffect(() => {
    const el = canvas.current, scene = el.parentElement;
    let renderer;
    try { renderer = (fallback ? createWaterFallback : createWaterRenderer)(el, { reduced }); }
    catch { setFallback(true); return; }
    engine.current = renderer;
    renderer.setValue(latest.current.hasTarget ? latest.current.percent : latest.current.liters, latest.current.hasTarget ? '%' : 'L');
    el.dataset.renderer = fallback ? 'canvas' : 'webgl';
    scene.dataset.interactive = reduced ? 'false' : 'true';
    let frame, visible = true, last = 0;
    const resizeAndPaint = () => {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) return;
      renderer.resize(box.width, box.height);
      const result = renderer.render(performance.now() / 1000);
      if (result) { el.dataset.interactions = String(result.interactions); el.dataset.level = String(Math.round(result.level)); }
    };
    const resize = new ResizeObserver(resizeAndPaint);
    resize.observe(el);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }); observer.observe(el);
    const interact = event => {
      if (event.target.closest('button, input, a')) return;
      const rect = el.getBoundingClientRect();
      if (event.type === 'pointerdown' && event.pointerType === 'touch') scene.setPointerCapture(event.pointerId);
      renderer.point(Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height)),event.type==='pointerdown',performance.now()/1000);
    };
    const release = () => renderer.release();
    const lost = event => { event.preventDefault(); setFallback(true); };
    scene.addEventListener('pointerdown', interact); scene.addEventListener('pointermove', interact);
    scene.addEventListener('pointerup', release); scene.addEventListener('pointerleave', release); scene.addEventListener('pointercancel', release);
    el.addEventListener('webglcontextlost', lost);
    function draw(now) {
      if (visible && !document.hidden && now-last>=28) {
        const result = renderer.render(now/1000);
        if (result) { el.dataset.interactions=String(result.interactions); el.dataset.level=String(Math.round(result.level)); }
        last=now;
      }
      frame=requestAnimationFrame(draw);
    }
    if (!reduced) frame=requestAnimationFrame(draw);
    document.fonts.ready.then(() => { if (engine.current === renderer) resizeAndPaint(); });
    return () => { cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();renderer.destroy();engine.current=null;scene.removeEventListener('pointerdown',interact);scene.removeEventListener('pointermove',interact);scene.removeEventListener('pointerup',release);scene.removeEventListener('pointerleave',release);scene.removeEventListener('pointercancel',release);el.removeEventListener('webglcontextlost',lost); };
  }, [reduced, fallback]);
  return <canvas key={fallback ? 'fallback' : 'webgl'} ref={canvas} className="liquid-canvas" aria-hidden="true" />;
}

export function Hydration({ date = dayKey(), compact = false }) {
  const { data, client, update } = useApp();
  const [custom, setCustom] = useState(false), [amount, setAmount] = useState('250'), [impulse, setImpulse] = useState(0);
  const row = data.habitLogs.find(h => h.clientId === client.id && h.date === date);
  const value = row?.values.water || 0;
  const target = client.habits.find(h => h.id === 'water')?.target;
  const percent = target > 0 ? Math.round(value / target * 100) : 0;
  const editable = date === dayKey();
  const valid = amount !== '' && Number.isFinite(Number(amount)) && Number(amount) >= 10 && Number(amount) <= 2000;
  function add(ml) {
    update(d => { let h = d.habitLogs.find(h => h.clientId === client.id && h.date === date); if (!h) { h = {clientId: client.id, date, values: {}}; d.habitLogs.push(h); } h.values.water = Number(((h.values.water || 0) + ml / 1000).toFixed(3)); h.waterEntries ??= []; h.waterEntries.push({id: uid(), ml, at: new Date().toISOString()}); });
    setImpulse(i => i + 1);
  }
  return <section className={`hydration ${compact ? 'compact' : ''}`} aria-label={t('Water tracker')}>
    <div className="water-scene"><Liquid percent={percent} impulse={impulse} liters={value} hasTarget={target > 0}/><div className="water-heading"><Droplets size={22}/><h2>{t('Water')}</h2><p>{date === dayKey() ? t('Today') : date} <b>{Math.round(value * 1000).toLocaleString()}</b>{target ? t(' of {value} ml', { value: (target * 1000).toLocaleString() }) : t(' ml · no coach target')}</p></div><strong className="water-percent sr-only" aria-live="polite">{target ? `${percent}%` : t('{value} L', { value })}</strong><div className="water-actions"><button disabled={!editable} aria-label={t('Add 100 ml water')} onClick={() => add(100)}><Plus size={15}/>{t('100 ml')}</button><button disabled={!editable} aria-label={t('Add 250 ml water')} onClick={() => add(250)}><Plus size={15}/>{t('250 ml')}</button><button disabled={!editable} onClick={() => setCustom(true)}>{t('Custom')}</button></div></div>
    <div className="water-history"><h3>{date === dayKey() ? t('Today') : t('Water log')}{row?.waterEntries?.length > 0 && <span>{row.waterEntries.length} {row.waterEntries.length === 1 ? 'drink' : 'drinks'}</span>}</h3>{row?.waterEntries?.length ? row.waterEntries.slice(compact ? -1 : -4).reverse().map(e => <div className="water-entry" key={e.id}><span><Droplets size={14}/>{t('Water (+')}{e.ml} {t('ml)')}</span><time>{new Date(e.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</time>{editable && <button aria-label={t('Remove {ml} ml drink at {at}', { ml: e.ml, at: e.at })} onClick={() => update(d => { const h = d.habitLogs.find(h => h.clientId === client.id && h.date === date); if (!h?.waterEntries.some(x => x.id === e.id)) return; h.waterEntries = h.waterEntries.filter(x => x.id !== e.id); h.values.water = Number(Math.max(0, h.values.water - e.ml / 1000).toFixed(3)); })}><Minus size={14}/></button>}</div>) : <p className="muted">{value ? t('{value} L already logged in your habits.', { value }) : t('A little water goes a long way.')}</p>}</div>
    {custom && <Modal title={t('Add water')} onClose={() => setCustom(false)}><form onSubmit={e => { e.preventDefault(); if (valid) { add(Number(amount)); setCustom(false); } }}><Field label={t('Water amount (ml)')} type="number" inputMode="decimal" min="10" max="2000" step="any" value={amount} onChange={e => setAmount(e.target.value)}/><Button type="submit" disabled={!valid}>{t('Log water')} <Check size={17}/></Button></form></Modal>}
  </section>;
}
