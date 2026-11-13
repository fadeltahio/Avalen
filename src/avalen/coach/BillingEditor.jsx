// A manual record of one client's membership and billing status. Not a payment
// processor: see payments.jsx and Business.jsx for the connected Paymob flow.
import { useState } from 'react';
import { useApp } from '../context.js';
import { useWorkspaceSave } from '../workspace-save.js';
import { decision } from '../store.js';
import { Button, Field, Notice, SectionHead } from '../ui.jsx';
import { t } from '../i18n.js';

export function BillingEditor({ client }) {
  const { update } = useApp();
  const {save, saving, error:saveError} = useWorkspaceSave();
  const [form, setForm] = useState({ ...client.subscription }),
    [saved, setSaved] = useState(false);
  return (
    <section className="card">
      <SectionHead title={t('Membership & billing')} />
      <form
        onChangeCapture={() => setSaved(false)}
        onSubmit={async (e) => {
          e.preventDefault();
          setSaved(false);
          if (!await save((d) => {
            d.clients.find((c) => c.id === client.id).subscription = { ...form, plan: form.plan.trim() };
            decision(
              d,
              client.id,
              "Membership updated",
              `${form.plan} · ${form.currency} ${form.amount} · ${form.status} · next due ${form.nextDate}. Manual record.`,
            );
          })) return;
          setSaved(true);
        }}
      >
        <fieldset className="save-fields" disabled={saving}>
        <Field
          label={t('Membership')}
          required
          value={form.plan}
          onChange={(e) => setForm({ ...form, plan: e.target.value })}
        />
        <div className="form-grid">
          <Field
            label={t('Amount')}
            type="number"
            min="0"
            required
            value={form.amount}
            onChange={(e) =>
              setForm({ ...form, amount: Number(e.target.value) })
            }
          />
          <Field label={t('Currency')}>
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            >
              {["EGP", "USD", "EUR", "GBP", "AED", "SAR"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field
            label={t('Next due date')}
            type="date"
            required
            value={form.nextDate}
            onChange={(e) => setForm({ ...form, nextDate: e.target.value })}
          />
          <Field label={t('Status')}>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {["Active", "Overdue", "Paused", "Cancelled"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
        </div>
        <Notice>
          {t('Manual record only. Saving this form does not charge a client or verify a payment.')}
        </Notice>
        {saveError && <p className="error" role="alert">{saveError}</p>}
        <Button type="submit">{saving ? t('Saving membership…') : t('Save membership')}</Button>
        {saved && <Notice>{t('Membership updated.')}</Notice>}
        </fieldset>
      </form>
    </section>
  );
}

