import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ScanBarcode } from 'lucide-react';
import { Button } from './ui.jsx';
import { lookupBarcode, validBarcode } from './food-library.js';

import { t } from './i18n.js';
const canScan = () => typeof window !== 'undefined' && 'BarcodeDetector' in window && Boolean(navigator.mediaDevices?.getUserMedia);

// Scan a packaged food's barcode, or type its number, then review the label values.
export function BarcodeScan({ onFound, onManual, onCancel }) {
  const video = useRef(null), stream = useRef(null), request = useRef(null), loop = useRef(null), live = useRef(true);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState(canScan() ? 'starting' : 'typing');
  const [message, setMessage] = useState('');

  function stopCamera() {
    clearTimeout(loop.current);
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  }
  useEffect(() => {
    live.current = true;
    if (status === 'starting') startCamera();
    return () => { live.current = false; stopCamera(); request.current?.abort(); };
  }, []);

  async function startCamera() {
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (!live.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      video.current.srcObject = media;
      await video.current.play();
      setStatus('camera');
      const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      const scan = async () => {
        if (!live.current || !stream.current) return;
        try {
          const [found] = await detector.detect(video.current);
          if (found?.rawValue && validBarcode(found.rawValue)) { navigator.vibrate?.(20); stopCamera(); setCode(found.rawValue); find(found.rawValue); return; }
        } catch { /* keep scanning */ }
        loop.current = setTimeout(scan, 280);
      };
      scan();
    } catch {
      stopCamera();
      if (live.current) { setStatus('typing'); setMessage(t('The camera isn’t available. Type the number under the barcode instead.')); }
    }
  }

  async function find(value = code) {
    const clean = String(value).trim();
    if (!validBarcode(clean) || status === 'looking') return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    setStatus('looking'); setMessage('');
    try {
      const food = await lookupBarcode(clean, { signal: controller.signal });
      if (!live.current) return;
      if (food) onFound(food);
      else { setStatus('missing'); setMessage(t('This product isn’t in the food database yet. Add it from the label. It takes a minute.')); }
    } catch (error) {
      if (!live.current) return;
      setStatus('typing');
      setMessage(error.name === 'AbortError' ? t('The lookup took too long. Check your connection and try again.') : error.message || t('The lookup failed. Try again.'));
    } finally { clearTimeout(timeout); }
  }

  return <div className="barcode-scan">
    {(status === 'starting' || status === 'camera') && <div className="barcode-viewfinder">
      <video ref={video} muted playsInline aria-label={t('Camera view for barcode scanning')}/>
      <i className="barcode-frame" aria-hidden="true"/><i className="barcode-laser" aria-hidden="true"/>
      <p>{status === 'starting' ? t('Starting camera…') : t('Point at the barcode')}</p>
    </div>}
    <form className="barcode-entry" onSubmit={event => { event.preventDefault(); stopCamera(); find(); }}>
      <label><span>{t('Barcode number')}</span><input value={code} inputMode="numeric" autoComplete="off" maxLength={14} placeholder={t('e.g. 6221007012345')} aria-label={t('Barcode number')} onChange={event => setCode(event.target.value.replace(/\D/g, ''))}/></label>
      <Button type="submit" disabled={!validBarcode(code) || status === 'looking'}><ScanBarcode size={17}/>{status === 'looking' ? t('Looking up…') : t('Look up')}</Button>
    </form>
    {status === 'looking' && <p className="barcode-status" role="status"><i/>{t('Finding')} {code} {t('in the food database…')}</p>}
    {message && <p className={status === 'missing' ? 'barcode-status' : 'error'} role="alert">{message}</p>}
    {status === 'missing' && <Button secondary onClick={() => onManual(code)}>{t('Add it manually')}</Button>}
    <p className="muted barcode-note">{t('Packaged foods come from Open Food Facts, a free public database. Always check the values against the label.')}</p>
    <button type="button" className="text-link barcode-back" onClick={onCancel}><ArrowLeft size={15}/>{t('Back to search')}</button>
  </div>;
}
