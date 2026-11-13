// The coach's code: clients type it in the app to join this coach. Shown only for a
// signed-in coach account; the device demo explains it instead of inventing one.
import React, { useEffect, useRef, useState } from 'react';
import { Copy, RefreshCw, Share2 } from 'lucide-react';
import { Button, Modal, SectionHead } from './ui.jsx';
import { connection, request } from './ecosystem/connection.js';
import { t } from './i18n.js';

export function CoachCodeCard() {
  const signedIn = connection()?.user?.role === 'coach';
  const [code, setCode] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    request('/coach-code').then((r) => live && setCode(r.code)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [signedIn]);

  if (!signedIn) return <section className="card coach-code-card">
    <SectionHead title={t('Your coach code')} />
    <p className="muted">{t('Clients join you by entering your coach code in the app. Your code appears here once you sign in to your coach account.')}</p>
  </section>;

  const message = code ? t('Join me on Avalen. My coach code is {code}.', { code }) : '';
  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError(t('Copying is not available here. Select the code and copy it.')); }
  }
  async function share() {
    try { await navigator.share({ text: message }); } catch (e) { if (e?.name !== 'AbortError') copy(); }
  }
  async function replace() {
    if (lock.current) return;
    lock.current = true; setReplacing(true); setError('');
    try { const r = await request('/coach-code/replace', { method: 'POST' }); setCode(r.code); setConfirming(false); }
    catch (e) { setError(e.message); }
    finally { lock.current = false; setReplacing(false); }
  }
  return <section className="card coach-code-card">
    <SectionHead title={t('Your coach code')} />
    <p className="muted">{t('Share this code with new clients. They enter it when they create their account and appear in your client list.')}</p>
    <output className="coach-code" dir="ltr" aria-live="polite" aria-label={code ? t('Coach code {code}', { code: code.split('').join(' ') }) : t('Loading your coach code')}>{code || '— — —'}</output>
    <div className="coach-code-actions">
      <Button secondary small disabled={!code} onClick={copy}><Copy size={15}/>{copied ? t('Copied') : t('Copy')}</Button>
      {typeof navigator !== 'undefined' && navigator.share && <Button secondary small disabled={!code} onClick={share}><Share2 size={15}/>{t('Share')}</Button>}
      <Button secondary small disabled={!code} onClick={() => setConfirming(true)}><RefreshCw size={15}/>{t('Get a new code')}</Button>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {confirming && <Modal title={t('Get a new code?')} onClose={() => setConfirming(false)} canClose={!replacing}>
      <p>{t('Your current code stops working for new clients. Clients who already joined stay connected.')}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <Button disabled={replacing} onClick={replace}>{replacing ? t('Creating a new code…') : t('Get a new code')}</Button>
      <Button secondary disabled={replacing} onClick={() => setConfirming(false)}>{t('Keep the current code')}</Button>
    </Modal>}
  </section>;
}
