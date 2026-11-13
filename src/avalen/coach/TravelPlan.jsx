// Travel mode: replaces a client's scheduled workouts with a simple bodyweight
// session for a date range, then restores their regular plan.
import { useState } from 'react';
import { useApp } from '../context.js';
import { dayKey, decision, offsetDay, shortDate, uid } from '../store.js';
import { Button, Field, Notice, SectionHead } from '../ui.jsx';
import { t } from '../i18n.js';

export function TravelPlan({ client }) {
  const { data, update } = useApp();
  const [start, setStart] = useState(dayKey()),
    [end, setEnd] = useState(offsetDay(7));
  return (
    <section className="card">
      <SectionHead title={t('Training, wherever life takes them')} />
      <p className="muted">
        {t('Travel mode replaces scheduled workouts with a simple bodyweight session for the dates you choose.')}
      </p>
      {client.travel ? (
        <>
          <Notice>
            {t('Active')} {shortDate(client.travel.start)} –{" "}
            {shortDate(client.travel.end)}
          </Notice>
          <Button
            secondary
            onClick={() =>
              update((d) => {
                d.clients.find((c) => c.id === client.id).travel = null;
                decision(
                  d,
                  client.id,
                  "Travel plan ended",
                  "Regular training restored.",
                );
              })
            }
          >
            {t('Restore regular plan')}
          </Button>
        </>
      ) : (
        <>
          <div className="form-grid">
            <Field
              label={t('From')}
              type="date"
              min={dayKey()}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <Field
              label={t('Through')}
              type="date"
              min={start}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
          <Button
            secondary
            disabled={!start || end < start}
            onClick={() =>
              update((d) => {
                d.clients.find((c) => c.id === client.id).travel = {
                  start,
                  end,
                  days: [
                    {
                      id: "travel",
                      name: "Travel · Full Body",
                      cover: 3,
                      minutes: 25,
                      exercises: data.library
                        .filter((e) =>
                          ["Push-up", "Bodyweight squat"].includes(e.name),
                        )
                        .map((e) => ({ ...e, id: uid() })),
                    },
                  ],
                };
                decision(
                  d,
                  client.id,
                  "Travel plan activated",
                  `${start} to ${end}. Bodyweight programme.`,
                );
              })
            }
          >
            {t('Activate travel mode')}
          </Button>
        </>
      )}
    </section>
  );
}

