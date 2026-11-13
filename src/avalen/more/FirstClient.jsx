// A new coach before their first client joins: their code, a way to check for a
// new client or add one directly, and the settings they need.
import React, { useState } from 'react';
import { ChevronRight, MessageCircle, Shield } from 'lucide-react';
import { AppContext } from '../context.js';
import { useWorkspaceSave } from '../workspace-save.js';
import { connection, refreshConnection } from '../ecosystem/connection.js';
import { newClient } from '../seed.js';
import { dayKey } from '../store.js';
import { Button, Field, Heading, Modal, SectionHead } from '../ui.jsx';
import { t } from '../i18n.js';
import { CoachCodeCard } from '../CoachCode.jsx';
import { Appearance } from '../preferences.jsx';
import { SignOutSection } from '../ecosystem/accounts.jsx';

// A new coach before their first client: their code, a way to check for new clients
// or add one directly, and the settings they need.
export function FirstClient({ onAccount }) {
  const { data } = React.useContext(AppContext);
  const { save, saving, error: saveError } = useWorkspaceSave();
  const [adding, setAdding] = useState(false), [checking, setChecking] = useState(false), [note, setNote] = useState('');
  async function check() {
    setChecking(true); setNote('');
    try { const fresh = await refreshConnection(); if (!fresh?.data?.clients?.length) setNote(t('No one has joined yet. New clients also appear here automatically.')); }
    catch (e) { setNote(e.message); }
    finally { setChecking(false); }
  }
  return (
    <>
      <Heading title={t('Welcome, {name}.', { name: (data.coach.name || '').split(' ')[0] })} subtitle={t('Your first client is one code away.')} />
      <CoachCodeCard />
      <section className="card first-client">
        <SectionHead title={t('Waiting for your first client')} />
        <p className="muted">{t('When a client joins with your code, they appear here and your full coaching workspace opens.')}</p>
        <Button secondary disabled={checking || !connection()} onClick={check}>{checking ? t('Checking…') : t('Check for new clients')}</Button>
        {note && <p className="muted" role="status">{note}</p>}
        <button type="button" className="text-link" onClick={() => setAdding(true)}>{t('Or add a client yourself')}</button>
      </section>
      <Appearance />
      <div className="card list">
        {connection() && <button className="simple-row" onClick={onAccount}><Shield size={19} /><span><b>{t('Account')}</b><small>{t('Sign in details, privacy and sign out')}</small></span><ChevronRight size={16} /></button>}
        <a className="simple-row" href="/support.html" target="_blank" rel="noreferrer"><MessageCircle size={19} /><span><b>{t('Help & support')}</b><small>{t('Questions, problems and feedback')}</small></span><ChevronRight size={16} /></a>
      </div>
      <SignOutSection />
      {adding && (
        <Modal title={t('Add a client')} onClose={() => setAdding(false)} canClose={!saving}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const fields = new FormData(e.currentTarget), c = newClient(String(fields.get('name')).trim(), String(fields.get('email')).trim());
            c.created = dayKey();
            c.schedule = c.schedule.filter((s) => s.date >= dayKey());
            if (await save((d) => { d.clients.push(c); d.activeClientId = c.id; })) setAdding(false);
          }}>
            <fieldset className="save-fields" disabled={saving}>
              <Field label={t('Full name')} name="name" required maxLength={80} />
              <Field label={t('Email')} name="email" type="email" required />
              {saveError && <p className="error" role="alert">{saveError}</p>}
              <Button type="submit">{saving ? t('Creating client…') : t('Create client')}</Button>
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  );
}

