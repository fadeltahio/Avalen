import React, { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useApp } from "../context.js";
import { SectionHead } from "../ui.jsx";
import { t } from '../i18n.js';
export function CoachingUpdates() {
  const { data, client, navigate, runAction } = useApp();
  const [error, setError] = useState("");
  const rows = (data.notifications || [])
    .filter((n) => n.clientId === client.id && !n.read && !n.resolved)
    .slice(-3)
    .reverse();
  if (!rows.length) return null;
  return (
    <section className="ecosystem-updates">
      <SectionHead title={t('From your coaching team')} />
      {rows.map((n) => (
        <div className="simple-row" key={n.id}>
          <span>
            <b>
              {n.kind === "checkin-reminder"
                ? t('A moment to check in')
                : t('A coaching update')}
            </b>
            <small>{n.text}</small>
          </span>
          <button
            className="icon-btn"
            aria-label={t('Open {value}', { value: n.kind === "checkin-reminder" ? "check-in" : "coaching update" })}
            onClick={async () => {
              try {
                await runAction("notification.read", client.id, { id: n.id });
                navigate(
                  n.kind === "checkin-reminder"
                    ? "coach"
                    : n.text.includes("FormLab")
                      ? "plan"
                      : "you",
                  n.kind === "checkin-reminder"
                    ? "Check-in"
                    : n.text.includes("FormLab")
                      ? "FormLab"
                      : "",
                );
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <ArrowRight size={17} />
          </button>
        </div>
      ))}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}

export function AISharingPreference() {
  const { client, runAction } = useApp();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="card ecosystem-stack">
      <SectionHead title={t('Your AI sharing choice')} />
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={Boolean(client.externalAIConsent?.enabled)}
          disabled={busy}
          onChange={async (e) => {
            const enabled = e.target.checked;
            setBusy(true);
            setError("");
            try {
              await runAction("privacy.aiConsent", client.id, { enabled });
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        />
        {t('Allow my coach to request optional external AI explanations of my recorded progress')}
      </label>
      <p className="fine-print muted">
        {t('Off by default. If enabled, your coach must also approve each request. Record-based observations and human coaching work without this. Meal-photo calorie recognition is still a separate future feature.')}
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
