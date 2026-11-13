import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Check, LayoutGrid, Minus, Plus, RotateCcw } from 'lucide-react';
import { useWorkspaceSave } from './workspace-save.js';
import { Button, Modal } from './ui.jsx';
import { layoutFrom, resolveLayout } from './home-layout.js';
import { t } from './i18n.js';

export function EditHomeButton({ onClick }) {
  return <button className="home-edit-button" onClick={onClick}><LayoutGrid size={16}/>{t('Customise home')}</button>;
}

// Shows widgets in their current order. The change is kept open until the save
// is confirmed; on failure the arrangement and an error stay on screen.
export function CustomiseHome({ widgets, saved, role, onClose, write }) {
  const { save, saving, error } = useWorkspaceSave();
  const [rows, setRows] = useState(() => resolveLayout(saved, widgets, role));
  const move = (index, step) => setRows((list) => {
    const next = [...list], target = index + step;
    if (target < 0 || target >= next.length) return list;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const toggle = (id) => setRows((list) => list.map((r) => (r.id === id ? { ...r, visible: !r.visible } : r)));
  const shown = rows.filter((r) => r.visible), hidden = rows.filter((r) => !r.visible);
  async function done(layout) {
    if (await save((d) => write(d, layout))) onClose();
  }
  return <Modal title={t('Customise home')} onClose={onClose} canClose={!saving} className="home-editor">
    <p className="muted">{t('Choose what you see on your home screen and in what order.')}</p>
    <ol className="home-editor-list" aria-label={t('On your home screen')}>
      {shown.map((row) => { const index = rows.indexOf(row); const first = index === rows.findIndex((r) => r.visible), last = index === rows.findLastIndex((r) => r.visible);
        return <li key={row.id}>
          <span><b>{t(row.label)}</b><small>{t(row.detail)}</small></span>
          <button className="icon-btn" aria-label={t('Move {label} up', { label: row.label })} disabled={saving || first} onClick={() => { let t = index - 1; while (t >= 0 && !rows[t].visible) t--; move(index, t - index); }}><ArrowUp size={16}/></button>
          <button className="icon-btn" aria-label={t('Move {label} down', { label: row.label })} disabled={saving || last} onClick={() => { let t = index + 1; while (t < rows.length && !rows[t].visible) t++; move(index, t - index); }}><ArrowDown size={16}/></button>
          <button className="icon-btn" aria-label={t('Remove {label}', { label: row.label })} disabled={saving || shown.length === 1} onClick={() => toggle(row.id)}><Minus size={16}/></button>
        </li>; })}
    </ol>
    {hidden.length > 0 && <>
      <h3 className="home-editor-heading">{t('Add to home')}</h3>
      <ul className="home-editor-list is-hidden" aria-label={t('Not on your home screen')}>
        {hidden.map((row) => <li key={row.id}><span><b>{t(row.label)}</b><small>{t(row.detail)}</small></span><button className="icon-btn" aria-label={t('Add {label}', { label: row.label })} disabled={saving} onClick={() => toggle(row.id)}><Plus size={16}/></button></li>)}
      </ul>
    </>}
    {error && <p className="error" role="alert">{error}</p>}
    <Button disabled={saving} onClick={() => done(layoutFrom(rows))}>{saving ? t('Saving…') : <><Check size={16}/>{t('Save home')}</>}</Button>
    <button className="text-link home-editor-reset" disabled={saving} onClick={() => done(null)}><RotateCcw size={14}/>{t('Reset to default')}</button>
  </Modal>;
}
