// The first screen before onboarding: the pitch, "Explore demo", and joining a
// coach with the local preview's fixed demo code.
import React, { useState } from 'react';
import { ArrowRight, Clock3 } from 'lucide-react';
import { AppContext } from '../context.js';
import { useWorkspaceSave } from '../workspace-save.js';
import { newClient } from '../seed.js';
import { dayKey } from '../store.js';
import { Button, Field, Modal } from '../ui.jsx';
import { t, lines } from '../i18n.js';
const welcomePortrait = '/design/campaign-welcome-v2.webp';

export function Welcome({ onDismiss, onJoined }) {
  const { data, update } = React.useContext(AppContext);
  const {save, saving, error:saveError} = useWorkspaceSave();
  const [join, setJoin] = useState(false), [error, setError] = useState(''), [privacy, setPrivacy] = useState(false);
  async function explore() { if (await save(d => d.onboarded = true)) onDismiss(); }
  return <div className="editorial-welcome">
    <img className="editorial-welcome-photo" src={welcomePortrait} alt={t('Athlete preparing for training')}/>
    <div className="editorial-welcome-shade"/>
    <div className="editorial-welcome-wordmark">AVALEN</div>
    <div className="editorial-welcome-content motion-stage"><p className="welcome-greeting">{data.onboarded ? t('Welcome {name}!', {name: data.clients.find(c => c.id === data.activeClientId)?.name.split(' ')[0]}) : t('A little about you. A lot of possibility.')}</p><h1>{lines(t('Realize your\npotential.'))}</h1><p className="welcome-description">{lines(t('Your training. Your goals. Your coach.\nA more personal way to move forward.'))}</p><div className="welcome-time"><Clock3 size={19}/><span>{t('Make it yours in less than 1 minute')}</span></div><p className="welcome-privacy">{t('Your information stays on this device.')} <button onClick={() => setPrivacy(true)}>{t('Your privacy')}</button></p><Button aria-label={t('Get Started')} disabled={saving} onClick={() => data.onboarded ? onDismiss() : setJoin(true)}>{t('Let’s go')}</Button><button className="welcome-skip" aria-label={t('Explore demo')} disabled={saving} onClick={explore}>{t('Skip for now')}</button>{saveError && <p className="error" role="alert">{saveError}</p>}</div>
    {join && <Modal title={t('Make it personal.')} onClose={() => setJoin(false)} canClose={!saving}><p className="muted">{t('Join your coach’s preview with code')} <b>00000</b>.</p><form onSubmit={async e => {
      e.preventDefault(); const fields = new FormData(e.currentTarget);
      if (fields.get('code') !== '00000') { setError(t('Use 00000 for this preview.')); return; }
      if (!String(fields.get('name')).trim()) { setError(t('Please enter your name.')); return; }
      const c = newClient(fields.get('name').trim(), fields.get('email').trim());
      c.created = dayKey(); c.schedule = c.schedule.filter(s => s.date >= dayKey()); c.goal = fields.get('goal'); c.needsIntake = true;
      if (await save(d => { d.clients.push(c); d.activeClientId = c.id; d.onboarded = true; d.demo = false; })) { onDismiss(); onJoined(); }
    }}><fieldset className="save-fields" disabled={saving}><Field label={t('Your name')} name="name" autoComplete="name" required maxLength={70}/><Field label={t('Email')} name="email" type="email" autoComplete="email" required/><Field label={t('Your focus')}><select name="goal" defaultValue="Build strength"><option value="Build strength">{t('Build strength')}</option><option value="Improve fitness">{t('Improve fitness')}</option><option value="Build a consistent routine">{t('Build a consistent routine')}</option><option value="Improve body composition">{t('Improve body composition')}</option></select></Field><Field label={t('Coach code')} name="code" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} required placeholder="00000"/>{error && <p className="error" role="alert">{error}</p>}{saveError && <p className="error" role="alert">{saveError}</p>}<Button type="submit">{saving ? t('Saving profile…') : t('Join my coach')} <ArrowRight size={18}/></Button><p className="fine-print muted">{t('Local preview. Your entries are saved on this device.')}</p></fieldset></form></Modal>}
    {privacy && <Modal title={t('Your privacy')} onClose={() => setPrivacy(false)}><p className="account-legal-links"><a href="/privacy.html" target="_blank" rel="noreferrer">{t('Privacy policy')}</a> · <a href="/support.html" target="_blank" rel="noreferrer">{t('Help & support')}</a></p><p>{t('This preview saves your profile and training records in this browser on this device. It does not send your information to a coach or connect to a health account.')}</p><p>{t('You can export your records from More. Starting a fresh test profile keeps existing profiles and their records.')}</p><Button onClick={() => setPrivacy(false)}>{t('Got it')}</Button></Modal>}
  </div>;
}

