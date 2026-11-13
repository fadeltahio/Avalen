// The coach's reusable programme templates: create, edit, duplicate and assign.
import { useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { useApp } from '../context.js';
import { useWorkspaceSave } from '../workspace-save.js';
import { defaultProgram } from '../seed.js';
import { dayKey, decision, offsetDay, uid } from '../store.js';
import { libraryWithCatalogue } from '../exercise-catalogue.js';
import { Button, Empty, Field, Heading, IconButton, Modal, Notice, SectionHead } from '../ui.jsx';
import { t } from '../i18n.js';
import { ProgramEditor } from './ProgramEditor.jsx';

export function Programs() {
  const { data, update } = useApp();
  const {save, saving, error:saveError} = useWorkspaceSave();
  const [editing, setEditing] = useState(null),
    [assign, setAssign] = useState(null),
    [clientId, setClientId] = useState(data.clients[0].id);
  const programs = data.templates;
  return (
    <>
      <Heading
        title={t('Programs')}
        action={
          <IconButton
            label={t('Create programme')}
            onClick={() => setEditing(defaultProgram())}
          >
            <Plus size={21} />
          </IconButton>
        }
      />
      <div className="client-grid">
        {programs.map((p) => (
          <section className="card" key={p.id}>
            <span className="eyebrow">{t('{weeks} WEEKS · {length} DAYS', { weeks: p.weeks, length: p.days.length })}</span>
            <h2>{t(p.name)}</h2>
            <p>{p.phase}</p>
            <div className="button-row">
              <Button
                small
                secondary
                onClick={() => setEditing(structuredClone(p))}
              >
                {t('Edit')}
              </Button>
              <Button small onClick={() => setAssign(p)}>
                {t('Assign')}
              </Button>
              <button
                className="text-link"
                onClick={() =>
                  setEditing({
                    ...structuredClone(p),
                    id: uid(),
                    name: p.name + " · copy",
                  })
                }
              >
                {t('Duplicate')}
              </button>
            </div>
          </section>
        ))}
      </div>
      {!programs.length && (
        <Empty
          icon={FileText}
          title={t('Your coaching method, repeatable.')}
          detail={t('Create a reusable template, then assign it to a client. Their copy can be adjusted independently.')}
          action={
            <Button onClick={() => setEditing(defaultProgram())}>
              {t('Create your first programme')} <Plus size={16} />
            </Button>
          }
        />
      )}
      <section className="card">
        <SectionHead
          title={t('Exercise library')}
          action={<span className="pill">{t('{length} movements', { length: libraryWithCatalogue(data.library).length })}</span>}
        />
        <p className="muted">
          {t('The programme builder includes sets, reps, load, rest, tempo, RPE, RIR and coaching notes for every movement.')}
        </p>
      </section>
      {editing && (
        <ProgramEditor
          program={editing}
          onClose={() => setEditing(null)}
          onSave={async(p) => {
            const result=await update((d) => {
              d.templates = d.templates.filter((t) => t.id !== p.id);
              d.templates.push(p);
            });
            if(result?.error)throw new Error(result.error);
            setEditing(null);
          }}
        />
      )}
      {assign && (
        <Modal title={t('Assign programme')} onClose={() => setAssign(null)} canClose={!saving}>
          <fieldset className="save-fields" disabled={saving}>
          <Field label={t('Client')}>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              {data.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {t(c.name)}
                </option>
              ))}
            </select>
          </Field>
          <Notice>{t('This replaces the client’s current plan and schedules four sessions per week for the full {weeks}-week programme. Completed workout history is kept.', { weeks: assign.weeks })}</Notice>
          <Button
            onClick={async () => {
              if (!await save((d) => {
                const c = d.clients.find((c) => c.id === clientId);
                c.program = structuredClone(assign);
                c.schedule = c.schedule.filter((s) => s.date < dayKey() || d.sessions.some(x=>x.clientId===c.id && x.date===s.date));
                let n = 0;
                for (let i = 0; i < Number(assign.weeks) * 7; i++) {
                  const date = offsetDay(i);
                  if (
                    !d.sessions.some(x=>x.clientId===c.id && x.date===date) && [1, 2, 4, 6].includes(
                      new Date(date + "T12:00:00").getDay(),
                    )
                  )
                    c.schedule.push({
                      date,
                      dayId: c.program.days[n++ % c.program.days.length].id,
                    });
                }
                c.programEnd = offsetDay(assign.weeks * 7 - 1);
                decision(d, c.id, "Programme assigned", assign.name);
              })) return;
              setAssign(null);
            }}
          >
            {saving ? t('Assigning programme…') : t('Confirm assignment')}
          </Button>
          {saveError && <p className="error" role="alert">{saveError}</p>}
          </fieldset>
        </Modal>
      )}
    </>
  );
}

