// A client's More: their profile, coaching updates, connected devices, privacy,
// data export, settings, and (in the local preview) switching who you're viewing as.
import React, { useState } from 'react';
import { ArrowRight, ChevronRight, Download, MessageCircle, Settings, Shield } from 'lucide-react';
import { AppContext } from '../context.js';
import { useWorkspaceSave } from '../workspace-save.js';
import { connection, request } from '../ecosystem/connection.js';
import { download } from '../store.js';
import { MotionDetails } from '../motion.jsx';
import { Avatar, Button, Field, Heading, Modal } from '../ui.jsx';
import { t } from '../i18n.js';
import { ClientPayments } from '../payments.jsx';
import { CoachingMemory } from '../ecosystem/memory.jsx';
import { AISharingPreference } from '../ecosystem/updates.jsx';
import { Appearance, ConnectedDevices } from '../preferences.jsx';
import { openDevicesOnReturn } from '../wearables.jsx';
import { wearableSync } from '../features.js';
import { LeaveCoachSection, SignOutSection } from '../ecosystem/accounts.jsx';

export function You() {
  const { data, client, update, navigate } = React.useContext(AppContext);
  const {save, saving, error:saveError} = useWorkspaceSave();
  const [edit, setEdit] = useState(false),
    [reset, setReset] = useState(false),
    [privacy, setPrivacy] = useState(false),
    [exportError, setExportError] = useState(''),
    [form, setForm] = useState({
      name: client.name,
      email: client.email,
      goal: client.goal,
    });
  return (
    <>
      <Heading title={t('You')} />
      <section className="card you-profile">
        <Avatar name={client.name} size="large" />
        <h2>{t(client.name)}</h2>
        <p>{client.goal}</p>
        <Button secondary small onClick={() => setEdit(true)}>
          {t('Edit profile')}
        </Button>
      </section>
      <ClientPayments />
      <button className="more-coach-shortcut" onClick={() => navigate("coach", "Overview")}><MessageCircle size={20}/><span>{t('Your coach')}<small>{t('Messages, check-ins and membership')}</small></span><ChevronRight size={18}/></button>

      <MotionDetails className="settings-disclosure"><summary>{t('Coaching updates')}<ChevronRight size={18}/></summary><CoachingMemory clientId={client.id} compact/></MotionDetails>
      {connection() && <AISharingPreference/>}
      <Appearance />
      {!connection() && <MotionDetails className="settings-disclosure"><summary>{t('Account & connection')}<ChevronRight size={18}/></summary><a className="simple-row" href="/?connected=1">{t('Connect a private coaching workspace')} <ArrowRight size={18}/></a></MotionDetails>}
      <MotionDetails className="settings-disclosure" open={openDevicesOnReturn() || undefined}><summary>{wearableSync() ? t('Connected devices') : t('Sleep & recovery')}<small>{wearableSync() ? t('Sleep, recovery and activity from your wearable') : t('Readings you enter for your coach')}</small><ChevronRight size={18}/></summary><ConnectedDevices /></MotionDetails>
      <div className="card list">
        <button className="simple-row" onClick={() => setPrivacy(true)}>
          <Shield size={19} />
          <span>
            <b>{connection()?t('Privacy & your recordings'):t('Privacy & this preview')}</b>
            <small>{t('Understand how your data is stored')}</small>
          </span>
          <ChevronRight size={16} />
        </button>
        <button
          className="simple-row"
          onClick={async () => {
            // With an account, the server holds the full history across every coach.
            if (connection()) {
              try {
                const history = await request("/account/export");
                download(new Blob([JSON.stringify(history, null, 2)], { type: "application/json" }), "avalen-my-history.json");
              } catch (cause) {
                setExportError(cause.message);
              }
              return;
            }
            const mine = {
              profile: client,
              exportedAt: new Date().toISOString(),
            };
            for (const k of [
              "sessions",
              "foodLogs",
              "measurements",
              "habitLogs",
              "checkins",
              "messages",
              "photos",
              "documents",
              "inbodies",
              "timeline",
              "activityLogs",
              "nutritionDays",
              "formSubmissions","scheduleProposals","notifications",
            ])
              mine[k] = (data[k] || []).filter((x) => x.clientId === client.id);
            download(
              new Blob([JSON.stringify(mine, null, 2)], {
                type: "application/json",
              }),
              "avalen-my-data.json",
            );
          }}
        >
          <Download size={19} />
          <span>
            <b>{t('Export my data')}</b>
            <small>{t('JSON records · media files are downloaded separately')}</small>
          </span>
          <ChevronRight size={16} />
        </button>
        {exportError && <p className="error" role="alert">{exportError}</p>}
        <label className="simple-row">
          <Settings size={19} />
          <span>
            <b>{t('Reduce motion')}</b>
            <small>{t('Keep transitions minimal')}</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={data.settings.reducedMotion}
            onChange={(e) =>
              update((d) => (d.settings.reducedMotion = e.target.checked))
            }
          />
        </label>
      </div>
      {!connection() && <section className="card">
        <h3>{t('Test another perspective')}</h3>
        <p className="muted">
          {t('Preview a client, or use the role selector at the top to explore the coach workspace. This switch is for testing only.')}
        </p>
        <Field label={t('Client preview')}>
          <select
            value={client.id}
            onChange={(e) => update((d) => (d.activeClientId = e.target.value))}
          >
            {data.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {t(c.name)}
              </option>
            ))}
          </select>
        </Field>
        <Button secondary onClick={() => setReset(true)}>
          {t('Start a fresh test profile')}
        </Button>
      </section>}
      {connection() && <LeaveCoachSection />}
      <SignOutSection />
      {edit && (
        <Modal title={t('Your profile')} onClose={() => setEdit(false)} canClose={!saving}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await save((d) =>
                Object.assign(
                  d.clients.find((c) => c.id === client.id),
                  Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])),
                ),
              )) setEdit(false);
            }}
          >
            <fieldset className="save-fields" disabled={saving}>
            {[
              ["name", "Full name"],
              ["email", "Email"],
              ["goal", "Your goal"],
            ].map(([k, label]) => (
              <Field
                key={k}
                label={label}
                required
                type={k === "email" ? "email" : "text"}
                value={form[k]}
                maxLength={k === "goal" ? 200 : 80}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            ))}
            {saveError && <p className="error" role="alert">{saveError}</p>}
            <Button type="submit">{saving ? t('Saving profile…') : t('Save profile')}</Button>
            </fieldset>
          </form>
        </Modal>
      )}
      {reset && (
        <Modal title={t('A clean start')} onClose={() => setReset(false)}>
          <p>
            {t('Create a new profile with no workout, food or progress history. Existing profiles and their records will be kept.')}
          </p>
          <Button
            onClick={() => {
              update((d) => (d.onboarded = false));
              setReset(false);
            }}
          >
            {t('Return to Get Started')}
          </Button>
        </Modal>
      )}
      {privacy && (
        <Modal
          title={connection() ? t('Your private coaching data') : t('Your data in this preview')}
          onClose={() => setPrivacy(false)}
        >
          <p className="account-legal-links"><a href="/privacy.html" target="_blank" rel="noreferrer">{t('Privacy policy')}</a> · <a href="/support.html" target="_blank" rel="noreferrer">{t('Help & support')}</a></p>
          {connection()?<><h3>{t('Your private coaching workspace')}</h3><p>{t('Your records are stored by this Avalen service. Your account and assigned coach can access your coaching records; private coach notes stay with the coach. Recordings are retained until their displayed expiry date and can be deleted from FormLab. Unpublished editor drafts can remain on this device.')}</p><p>{t('AI and transcription receive evidence or recordings only when configured and you explicitly allow the request. In-app reminders are active; external notifications and wearables need configured services.')}</p></>:<><h3>{t('Local, not cloud-connected')}</h3>
          <p>
            {t('Your records are saved in this browser. Uploaded photos, videos and PDFs are stored on this device. Anyone with access to this browser profile can access them.')}
          </p>
          <h3>{t('Use test data only')}</h3>
          <p>
            {t('The coach/client switch and code 00000 are demo tools, not authentication. Don’t use this version for real private health records.')}
          </p>
          <h3>{t('What isn’t connected yet')}</h3>
          <p>
            {t('Secure sign-in, cloud sync, real payments, push notifications, wearable imports and AI food/report recognition require production services. App-store submission also requires a native build and a full security and privacy review.')}
          </p></>}
        </Modal>
      )}
    </>
  );
}

