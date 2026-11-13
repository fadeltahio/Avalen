// The coach's client list: search, filter, add a client, and open one client's
// full record (ClientDetail).
import { useState } from 'react';
import { ChevronRight, Plus, Search } from 'lucide-react';
import { MotionList } from '../motion.jsx';
import { reviewQueue } from '../coach-review.js';
import { useApp } from '../context.js';
import { useWorkspaceSave } from '../workspace-save.js';
import { connection } from '../ecosystem/connection.js';
import { attentionFor, dayKey, metrics, offsetDay } from '../store.js';
import { newClient } from '../seed.js';
import { useWearableSummary, WearableLine } from '../wearables.jsx';
import { Avatar, Button, Empty, Field, Heading, IconButton, Modal, Notice, Tabs } from '../ui.jsx';
import { t } from '../i18n.js';
import { ClientDetail } from './ClientDetail.jsx';

export function Clients() {
  const {save, saving, error:saveError} = useWorkspaceSave();
  const {
    data,
    update,
    selectedClientId,
    selectClient,
    clientTab,
    setClientTab,
  } = useApp();
  const wearables = useWearableSummary();
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All"),
    [adding, setAdding] = useState(false);
  const selected = data.clients.find((c) => c.id === selectedClientId);
  if (selected)
    return (
      <ClientDetail
        key={selected.id}
        client={selected}
        tab={clientTab}
        setTab={setClientTab}
      />
    );
  const queue = reviewQueue(data, wearables);
  const clientFlags = client => queue.find(row => row.client.id === client.id)?.flags || [];
  const rows = data.clients.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "All" ||
        (filter === "Needs attention" && clientFlags(c).length) ||
        (filter === "Paused" && c.paused) ||
        (filter === "On track" && !c.paused && !clientFlags(c).length) ||
        (filter === "Check-in due" &&
          attentionFor(data, c).some((f) => f.key === "checkin")) ||
        (filter === "Ending soon" && c.programEnd <= offsetDay(7))),
  );
  return (
    <>
      <Heading
        title={t('Clients')}
        action={
          <IconButton label={t('Add client')} onClick={() => setAdding(true)}>
            <Plus size={20} />
          </IconButton>
        }
      />
      <label className="search">
        <Search size={17} />
        <input
          aria-label={t('Search clients')}
          placeholder={t('Find a client…')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <Tabs
        items={[
          "All",
          "Needs attention",
          "On track",
          "Check-in due",
          "Ending soon",
          "Paused",
        ]}
        value={filter}
        onChange={setFilter}
      />
      <MotionList className="client-grid">
        {rows.map((c) => {
          const m = metrics(data, c.id),
            flags = clientFlags(c);
          return (
            <button
              className="card client-card"
              key={c.id}
              onClick={() => selectClient(c.id, "Overview")}
            >
              <div>
                <Avatar name={c.name} />
                <span>
                  <h3>{t(c.name)}</h3>
                  <small>{t(c.program.name)}</small>
                </span>
                <ChevronRight size={18} />
              </div>
              <div className="client-mini">
                <span>
                  <b>{m.training ?? "—"}%</b>{t('Training')}
                </span>
                <span>
                  <b>{m.nutrition ?? "—"}%</b>{t('Nutrition')}
                </span>
                <span>
                  <b>{m.lastWeight ?? "—"}</b>{t('Weight · kg')}
                </span>
              </div>
              <WearableLine entry={wearables[c.id]} />
              <p
                className={
                  c.paused ? "muted" : flags.length ? flags[0].tone : "green"
                }
              >
                {c.paused ? t('Coaching paused') : flags[0]?.title || t('On track')}
              </p>
            </button>
          );
        })}
      </MotionList>
      {!rows.length && (
        <Empty title={t('No clients found')} detail={t('Try another name or filter.')} />
      )}
      {adding && (
        <Modal title={t('Add a client')} onClose={() => setAdding(false)} canClose={!saving}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fields = new FormData(e.currentTarget),
                c = newClient(fields.get("name"), fields.get("email"));
              c.created = dayKey();
              c.schedule = c.schedule.filter((s) => s.date >= dayKey());
              if (!await save((d) => d.clients.push(c))) return;
              setAdding(false);
              selectClient(c.id, "Plan");
            }}
          >
            <fieldset className="save-fields" disabled={saving}>
            <Field label={t('Full name')} name="name" required maxLength={80} />
            <Field label={t('Email')} name="email" type="email" required />
            <Notice>
              {connection() ? t('This creates a client in your private workspace. Then use Account → Invite a client to create their sign-in invitation.') : t('This creates a client in this device’s workspace. Connect a private workspace to invite clients securely.')}
            </Notice>
            {saveError && <p className="error" role="alert">{saveError}</p>}
            <Button type="submit">{saving ? t('Creating client…') : t('Create client')}</Button>
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  );
}

