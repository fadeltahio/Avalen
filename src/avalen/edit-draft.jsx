import React, { useEffect, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { Button, Modal } from './ui.jsx';

import { t } from './i18n.js';
export function useEditDraft(key, initial) {
  const storageKey = `avalen.edit.${key}`;
  const initialJSON = JSON.stringify(initial);
  const [loaded] = useState(() => {
    try { const value = JSON.parse(localStorage.getItem(storageKey)); return value?.version === 1 && value.value && Object.keys(initial).every(k => Object.hasOwn(value.value,k)) ? value : null; } catch { return null; }
  });
  const [value, setValue] = useState(() => loaded?.value || structuredClone(initial));
  const [error, setError] = useState('');
  const [base,setBase] = useState(loaded?.base || initialJSON);
  const dirty = JSON.stringify(value) !== initialJSON;
  const conflict = dirty && base !== initialJSON;
  useEffect(() => { if (!dirty) setBase(initialJSON); }, [dirty,initialJSON]);
  useEffect(() => {
    try {
      if (dirty) localStorage.setItem(storageKey, JSON.stringify({ version: 1, value, base }));
      else localStorage.removeItem(storageKey);
      setError('');
    } catch { setError(t('This draft could not be saved on this device. Keep this screen open until you save your changes.')); }
  }, [value, dirty, storageKey, initialJSON, base]);
  useEffect(() => {
    if (!dirty || !error) return;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, error]);
  function clear(next = initial) { try { localStorage.removeItem(storageKey); } catch {} setValue(structuredClone(next)); }
  return { value, setValue, dirty, error, conflict, clear };
}

export function EditSaveBar({ draft, label, onSave, disabled = false, saved = false }) {
  const [discard, setDiscard] = useState(false);
  return <>
    {draft.error && <p role="alert" className="error">{draft.error}</p>}
    {draft.conflict && <p role="alert" className="error">{t('The assigned plan changed since this draft was started. Review the changes before saving.')}</p>}
    <div className="edit-save-bar"><div role="status"><b>{draft.dirty ? t('Unpublished changes') : saved ? t('Plan updated') : t('Current plan')}</b><small>{draft.dirty ? draft.error ? t('Draft not saved') : t('Draft saved on this device') : t('Changes are up to date')}</small></div><div className="edit-save-actions">{draft.dirty && <button type="button" className="icon-btn" aria-label={t('Discard draft')} onClick={() => setDiscard(true)}><RotateCcw size={18}/></button>}<Button aria-label={label} type={onSave ? 'button' : 'submit'} disabled={disabled} onClick={onSave}>{label === 'Save nutrition plan' ? t('Save plan') : label}<Check size={17}/></Button></div></div>
    {discard && <Modal title={t('Discard this draft?')} onClose={() => setDiscard(false)}><p>{t('Your assigned plan will stay as it is. Only unpublished changes will be removed.')}</p><div className="button-row"><Button onClick={() => { draft.clear(); setDiscard(false); }}>{t('Discard draft')}</Button><Button secondary onClick={() => setDiscard(false)}>{t('Keep editing')}</Button></div></Modal>}
  </>;
}
