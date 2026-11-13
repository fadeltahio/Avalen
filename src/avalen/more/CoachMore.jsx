// The coach's More: the same settings a client finds under More.
import React from 'react';
import { ChevronRight, FileText, MessageCircle, Settings, Shield } from 'lucide-react';
import { AppContext } from '../context.js';
import { connection } from '../ecosystem/connection.js';
import { Avatar, Button, Heading } from '../ui.jsx';
import { t } from '../i18n.js';
import { CoachCodeCard } from '../CoachCode.jsx';
import { Appearance } from '../preferences.jsx';
import { SignOutSection } from '../ecosystem/accounts.jsx';

// The coach's More: the same settings a client finds under More, for the coach.
export function CoachMore({ onAccount }) {
  const { data, update, navigate } = React.useContext(AppContext);
  return (
    <>
      <Heading title={t('You')} />
      <section className="card you-profile">
        <Avatar name={data.coach.name} size="large" />
        <h2>{t(data.coach.name)}</h2>
        <p>{data.coach.brand}</p>
        <Button secondary small onClick={() => navigate("business", "Brand")}>{t('Brand & business')}</Button>
      </section>
      <CoachCodeCard />
      <Appearance />
      <div className="card list">
        <label className="simple-row">
          <Settings size={19} />
          <span>
            <b>{t('Reduce motion')}</b>
            <small>{t('Keep transitions minimal')}</small>
          </span>
          <input type="checkbox" role="switch" checked={data.settings.reducedMotion} onChange={(e) => update((d) => (d.settings.reducedMotion = e.target.checked))} />
        </label>
        {connection() ? <button className="simple-row" onClick={onAccount}><Shield size={19} /><span><b>{t('Account')}</b><small>{t('Sign in details, privacy and sign out')}</small></span><ChevronRight size={16} /></button>
          : <a className="simple-row" href="/?connected=1"><Shield size={19} /><span><b>{t('Account & connection')}</b><small>{t('Connect a private coaching workspace')}</small></span><ChevronRight size={16} /></a>}
        <a className="simple-row" href="/privacy.html" target="_blank" rel="noreferrer"><FileText size={19} /><span><b>{t('Privacy policy')}</b><small>{t('Understand how your data is stored')}</small></span><ChevronRight size={16} /></a>
        <a className="simple-row" href="/support.html" target="_blank" rel="noreferrer"><MessageCircle size={19} /><span><b>{t('Help & support')}</b><small>{t('Questions, problems and feedback')}</small></span><ChevronRight size={16} /></a>
      </div>
      <SignOutSection />
    </>
  );
}

