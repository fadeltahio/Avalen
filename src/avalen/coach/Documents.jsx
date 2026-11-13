// A client's uploaded files (PDFs, photos) and their verified InBody measurements.
import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { useApp } from '../context.js';
import { useWorkspaceSave } from '../workspace-save.js';
import { dayKey, decision, download, getFile, saveFile, shortDate, uid } from '../store.js';
import { connection } from '../ecosystem/connection.js';
import { Button, Field, Notice, SectionHead } from '../ui.jsx';
import { t } from '../i18n.js';

export function Documents({ client }) {
  const { data, update } = useApp();
  const {save, saving, error:saveError} = useWorkspaceSave();
  const [saved, setSaved] = useState(false);
  const [pendingDocument, setPendingDocument] = useState(null);
  const [error, setError] = useState(""),
    [form, setForm] = useState({
      date: dayKey(),
      weight: "",
      bodyFat: "",
      muscle: "",
    }),
    [report, setReport] = useState(null),
    [busy, setBusy] = useState(false);
  const docs = data.documents.filter((d) => d.clientId === client.id);
  async function addDocument(row) {
    const result = await update(d => {
      if (!d.documents.some(doc => doc.id === row.id)) d.documents.push(row);
    });
    if (result?.error) throw new Error(result.error);
    setPendingDocument(null);
    setError('');
  }
  return (
    <>
      <section className="card">
        <SectionHead title={t('Client files')} />
        <label className="upload-zone">
          <FileText size={25} />
          <b>{busy ? t('Saving…') : t('Add a PDF or image report')}</b>
          <span>{connection() ? t('Private workspace storage') : t('Stored on this device')} {t('· up to 15 MB')}</span>
          <input
            disabled={busy || Boolean(pendingDocument)}
            type="file"
            accept="application/pdf,image/*"
            onChange={async (e) => {
              if (!e.target.files[0]) return;
              setBusy(true);
              try {
                const file = await saveFile(e.target.files[0], {
                  types: ["application/pdf", "image/"],
                  maxMB: 15,clientId:client.id,
                });
                const row = {
                    id: uid(),
                    clientId: client.id,
                    file,
                    date: dayKey(),
                };
                setPendingDocument(row);
                await addDocument(row);
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {pendingDocument && <div><p className="muted">{t('{name} is prepared, but its report entry has not been confirmed. Retry the save to keep it in this client’s files.', { name: pendingDocument.file.name })}</p><Button secondary disabled={busy} onClick={async () => {setBusy(true);try {await addDocument(pendingDocument);} catch(cause) {setError(cause.message);} finally {setBusy(false);}}}>{busy ? t('Saving report…') : t('Retry adding report')}</Button></div>}
        {docs.map((doc) => (
          <button
            className="simple-row"
            key={doc.id}
            onClick={async () => {
              try {
                const file = await getFile(doc.file.id);
                if (!file) throw Error();
                download(file, doc.file.name);
              } catch {
                setError(t('This file is not available in this browser.'));
              }
            }}
          >
            <FileText size={18} />
            <span>
              <b>{t(doc.file.name)}</b>
              <small>{shortDate(doc.date)}</small>
            </span>
            <Download size={17} />
          </button>
        ))}
      </section>
      <section className="card">
        <SectionHead title={t('Verified InBody values')} />
        <p className="muted">
          {t('Enter values from the report. They appear in the client’s body-composition graphs. Automatic PDF extraction is not connected.')}
        </p>
        <form
          onChangeCapture={() => setSaved(false)}
          onSubmit={async (e) => {
            e.preventDefault();
            setSaved(false);
            if (!await save((d) => {
              if (d.inbodies.some(record => record.clientId === client.id && record.date === form.date && record.documentId === report && ['weight', 'bodyFat', 'muscle'].every(key => Number(record[key]) === Number(form[key])))) return;
              d.inbodies.push({
                ...form,
                id: uid(),
                clientId: client.id,
                weight: Number(form.weight),
                bodyFat: Number(form.bodyFat),
                muscle: Number(form.muscle),
                documentId: report,
              });
              decision(
                d,
                client.id,
                "InBody report verified",
                `${form.weight} kg · ${form.bodyFat}% body fat · ${form.muscle} kg skeletal muscle.`,
              );
            })) return;
            setForm({ ...form, weight: "", bodyFat: "", muscle: "" });
            setSaved(true);
          }}
        >
          <fieldset className="save-fields" disabled={saving}>
          <Field label={t('Report')}>
            <select
              value={report || ""}
              onChange={(e) => setReport(e.target.value)}
            >
              <option value="">{t('No file linked')}</option>
              {docs.map((d) => (
                <option value={d.id} key={d.id}>
                  {t(d.file.name)}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={t('Measurement date')}
            type="date"
            max={dayKey()}
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <div className="form-grid">
            {[
              ["weight", "Weight (kg)", 20, 400],
              ["bodyFat", "Body fat (%)", 1, 70],
              ["muscle", "Skeletal muscle (kg)", 1, 150],
            ].map(([key, label, min, max]) => (
              <Field
                key={key}
                label={label}
                type="number"
                min={min}
                max={max}
                step=".1"
                required
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            ))}
          </div>
          {saveError && <p className="error" role="alert">{saveError}</p>}
          <Button type="submit">{saving ? t('Saving measurements…') : t('Save verified measurements')}</Button>
          {saved && <Notice>{t('Verified measurements saved to this client’s body-composition history.')}</Notice>}
          </fieldset>
        </form>
        {data.inbodies
          .filter((r) => r.clientId === client.id)
          .map((r) => (
            <div className="simple-row" key={r.id}>
              <span>{shortDate(r.date)}</span>
              <b>{t('{weight} kg · {bodyFat}% · {muscle} kg muscle', { weight: r.weight, bodyFat: r.bodyFat, muscle: r.muscle })}</b>
            </div>
          ))}
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

