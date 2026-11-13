// The coach's own business settings: connected payments, manually tracked
// subscriptions, and their coaching brand (name, logo).
import { useState } from 'react';
import { ChevronRight, Download } from 'lucide-react';
import { useApp } from '../context.js';
import { CoachPayments } from '../payments.jsx';
import { useWorkspaceSave } from '../workspace-save.js';
import { connection } from '../ecosystem/connection.js';
import { download, saveFile, shortDate } from '../store.js';
import { Avatar, Button, Field, Heading, Media, Notice, SectionHead, Stat, Tabs } from '../ui.jsx';
import { t } from '../i18n.js';

export function Business() {
  const { data, selectClient, update, subtab, setSubtab } = useApp();
  const {save, saving, error:saveError} = useWorkspaceSave();
  const tab = subtab === "Brand" ? "Brand" : subtab === "Subscriptions" ? "Subscriptions" : "Payments",
    setTab = setSubtab;
  const [logoError, setLogoError] = useState("");
  const [brand, setBrand] = useState(data.coach.brand),
    [name, setName] = useState(data.coach.name),
    [saved, setSaved] = useState(false);
  const [logo, setLogo] = useState(data.coach.logo),
    [uploading, setUploading] = useState(false);
  return (
    <>
      <Heading title={t('Business')} />
      <Tabs items={["Payments", "Subscriptions", "Brand"]} value={tab} onChange={setTab} />
      {tab === "Payments" ? <CoachPayments/> : tab === "Subscriptions" ? (
        <>
          <div className="three-stats">
            <Stat
              label={t('Active memberships')}
              value={
                data.clients.filter((c) => c.subscription.status === "Active")
                  .length
              }
            />
            <Stat
              label={t('Overdue')}
              value={
                data.clients.filter((c) => c.subscription.status === "Overdue")
                  .length
              }
            />
            <Stat
              label={t('Billing method')}
              value="Manual"
              note={t('No payment processor connected')}
            />
          </div>
          <SectionHead
            title={t('Subscription records')}
            action={
              <button
                className="text-link"
                onClick={() => {
                  const csv = [
                    [
                      "Client",
                      "Plan",
                      "Amount",
                      "Currency",
                      "Status",
                      "Next due",
                    ],
                    ...data.clients.map((c) => [
                      c.name,
                      c.subscription.plan,
                      c.subscription.amount,
                      c.subscription.currency,
                      c.subscription.status,
                      c.subscription.nextDate,
                    ]),
                  ]
                    .map((r) =>
                      r
                        .map(
                          (v) =>
                            '"' +
                            String(v)
                              .replaceAll('"', '""')
                              .replace(/^[=+@-]/, "'$&") +
                            '"',
                        )
                        .join(","),
                    )
                    .join("\n");
                  download(
                    new Blob([csv], { type: "text/csv" }),
                    "avalen-subscriptions.csv",
                  );
                }}
              >
                <Download size={15} />
                {t('Export')}
              </button>
            }
          />
          <div className="card list">
            {data.clients.map((c) => (
              <button
                className="simple-row"
                key={c.id}
                onClick={() => selectClient(c.id, "Billing")}
              >
                <Avatar name={c.name} />
                <span>
                  <b>{t(c.name)}</b>
                  <small>
                    {shortDate(c.subscription.nextDate)} ·{" "}
                    {c.subscription.status}
                  </small>
                </span>
                <b>
                  {c.subscription.amount.toLocaleString()}
                  <small>{c.subscription.currency}</small>
                </b>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
          <Notice>
            {t('These are coach-maintained records, not verified payments. No cards are stored and no money is collected by this preview.')}
          </Notice>
        </>
      ) : (
        <section className="card">
          <SectionHead title={t('Your coaching identity')} />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSaved(false);
              if (!await save((d) => {
                d.coach.brand = brand;
                d.coach.name = name;
                d.coach.logo = logo;
              })) return;
              setSaved(true);
            }}
          >
            <fieldset className="save-fields" disabled={saving}>
            <Field
              label={t('Coaching brand')}
              required
              maxLength={35}
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setSaved(false);
              }}
            />
            <Field
              label={t('Coach name')}
              required
              maxLength={60}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
            />
            <label className="upload-zone">
              {t('Upload your logo')}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploading}
                onChange={async (e) => {
                  if (e.target.files[0]) {
                    setUploading(true);
                    setSaved(false);
                    try {
                      const file = await saveFile(e.target.files[0], {
                        types: ["image/png", "image/jpeg", "image/webp"],
                        maxMB: 5,scope:'workspace',
                      });
                      setLogo(file);
                      setLogoError("");
                    } catch (e) {
                      setLogoError(e.message);
                    } finally {
                      setUploading(false);
                    }
                  }
                }}
              />
            </label>
            {logo && (
              <>
                <Media
                  className="brand-preview"
                  fileId={logo.id}
                  alt={t('Coaching logo')}
                />
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setLogo(null);
                    setSaved(false);
                  }}
                >
                  {t('Use Avalen mark')}
                </button>
              </>
            )}
            <Notice>
              {t('Applies to all')} {data.clients.length} {t('clients connected to this coach’s workspace, including future clients. Your logo appears in their app, desktop sidebar and workout-share images. It does not change the installed iPhone or Android app icon.')} {connection() ? t('Changes are saved to your private workspace for your connected clients.') : t('This preview saves branding locally. Connect a private workspace to share changes across devices.')}
            </Notice>
            <Button type="submit" disabled={uploading}>
              {saving ? t('Saving brand…') : uploading ? t('Preparing logo…') : t('Save brand')}
            </Button>
            {saved && (
              <Notice>{t('Brand saved for all {length} connected clients.', { length: data.clients.length })}</Notice>
            )}
            {logoError && <p className="error">{logoError}</p>}
            {saveError && <p className="error" role="alert">{saveError}</p>}
            </fieldset>
          </form>
        </section>
      )}
    </>
  );
}

