import { migrateDeviceMedia, collectDeviceMedia } from "./migration.js";
import React, { useEffect, useState } from "react";
import { Button, Field, Notice, Modal, SectionHead } from "../ui.jsx";
import { leaveBoot } from "../BrandMark.jsx";
import {
  acceptConnection,
  connection,
  connectedMode,
  request,
} from "./connection.js";
import { t } from '../i18n.js';
export function AccountGate({ children }) {
  const [ready, setReady] = useState(!connectedMode()),
    [status, setStatus] = useState(null),
    [mode, setMode] = useState(
      new URLSearchParams(location.search).has("invite") ? "join" : "login",
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function checkConnection() {
    let signedIn = false;
    setBusy(true);
    setError('');
    try {
      const [session, service] = await Promise.all([request("/session"), request("/status")]);
        setStatus(service);
        if (session.user) {
          acceptConnection(session);
          signedIn = true;
          setReady(true);
        } else if (!service.configured) setMode("setup");
    } catch {
      setStatus(null);
      setError(t('The account service is unavailable. Start the Avalen service, then retry.'));
    } finally {
      setBusy(false);
      if (!signedIn) leaveBoot();
    }
  }
  useEffect(() => {
    if (connectedMode()) checkConnection();
  }, []);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fields = Object.fromEntries(new FormData(e.currentTarget));
      const result = await request(`/${mode}`, {
        method: "POST",
        body: fields,
      });
      acceptConnection(result);
      try {
        sessionStorage.setItem("avalen.editorial.splash", "seen");
        if (mode === "join") sessionStorage.setItem("avalen.intake.open", "1");
      } catch {}
      setReady(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (ready) return children;
  return (
    <main className="account-screen">
      <div className="account-wordmark">AVALEN</div>
      <span className="eyebrow">{t('YOUR COACHING, CONNECTED')}</span>
      <h1>
        {mode === "setup"
          ? t('Build your coaching workspace.')
          : mode === "join"
            ? t('Your next chapter.')
            : t('Welcome back.')}
      </h1>
      <p className="muted">
        {mode === "setup"
          ? t('Create the owner account using your service setup token.')
          : t('Sign in to your private coaching workspace.')}
      </p>
      <form onSubmit={submit}>
        {mode === "setup" && (
          <>
            <Field
              label={t('Setup token')}
              name="setupToken"
              type="password"
              required
              autoComplete="off"
            />
            <Field label={t('Coach name')} name="name" required maxLength={100} />
            <Field
              label={t('First client name')}
              name="clientName"
              required
              maxLength={100}
            />
          </>
        )}
        {mode === "join" && (
          <Field
            label={t('Invitation')}
            name="invite"
            required
            defaultValue={
              new URLSearchParams(location.search).get("invite") || ""
            }
          />
        )}
        <Field
          label={t('Email')}
          name="email"
          type="email"
          required
          autoComplete="email"
        />
        <Field
          label={t('Password')}
          name="password"
          type="password"
          required
          minLength={12}
          maxLength={200}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !status}>
          {busy
            ? t('Opening workspace…')
            : mode === "setup"
              ? t('Create workspace')
              : mode === "join"
                ? t('Accept invitation')
                : t('Sign in')}
        </Button>
      </form>
      {!status && error && <Button secondary disabled={busy} onClick={checkConnection}>{busy ? t('Checking connection…') : t('Retry connection')}</Button>}
      {status?.configured && (
        <button
          className="text-link"
          onClick={() => {
            setMode(mode === "join" ? "login" : "join");
            setError("");
          }}
        >
          {mode === "join"
            ? t('I already have an account')
            : t('I have a coach invitation')}
        </button>
      )}
      <a className="text-link muted" href="/?connected=0&preview=welcome">
        {t('Open device preview')}
      </a>
      <small className="muted">
        {t('Private recordings and coaching notes are available only to authorized accounts.')}
      </small>
    </main>
  );
}
export function AccountSettings({ onClose }) {
  const account = connection();
  const [invite, setInvite] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [migrationProgress, setMigrationProgress] = useState("");
  async function createInvite(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await request("/invitations", {
        method: "POST",
        body: { clientId: new FormData(e.currentTarget).get("clientId") },
      });
      setInvite(
        `${location.origin}/?connected=1&invite=${encodeURIComponent(result.invite)}`,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function transfer() {
    setBusy(true);
    setError("");
    try {
      const raw = localStorage.getItem("avalen.workspace.v1");
      if (!raw) throw new Error(t('No device workspace was found.'));
      const data = JSON.parse(raw);
      const result = await migrateDeviceMedia(data, setMigrationProgress);
      setError(
        result.failed.length
          ? t('Records remain imported. {value}/{total} files transferred. Retry to transfer the remaining files: {value2}', { value: result.total - result.failed.length, total: result.total, value2: result.failed
              .map((x) => `${x.name}: ${x.error}`)
              .slice(0, 3)
              .join("; ") })
          : t('Records and {total} files are now available in your private workspace. Device originals remain untouched.', { total: result.total }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setMigrationProgress("");
    }
  }
  async function migrate() {
    setBusy(true);
    setError("");
    try {
      const raw = localStorage.getItem("avalen.workspace.v1");
      if (!raw) throw new Error(t('No device workspace was found.'));
      const data = JSON.parse(raw);
      const result = await request("/import", {
        method: "POST",
        body: { data, revision: connection().revision },
      });
      acceptConnection(result);
      await transfer();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t('Your connected workspace')} onClose={onClose} canClose={!busy}>
      <p>
        {account.user.email} · {account.user.role}
      </p>
      {account.user.role === "coach" && (
        <>
          <SectionHead title={t('Invite a client')} />
          <form onSubmit={createInvite}>
            <Field label={t('Client')}>
              <select name="clientId">
                {account.data.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {t(c.name)}
                  </option>
                ))}
              </select>
            </Field>
            <Button disabled={busy} type="submit">
              {t('Create private invitation')}
            </Button>
          </form>
          {invite && (
            <Field label={t('Invitation link · valid for 48 hours')}>
              <textarea
                readOnly
                value={invite}
                onFocus={(e) => e.target.select()}
              />
            </Field>
          )}
          <details>
            <summary>{t('Bring your device workspace')}</summary>
            <p className="muted">
              {t('Available before live activity. Review the device preview first. An archive of this new server workspace is kept, and your browser originals remain untouched.')}
            </p>
            <Button secondary disabled={busy} onClick={migrate}>
              {t('Import device records and files')}
            </Button>
            <Button secondary disabled={busy} onClick={transfer}>
              {t('Retry file transfer')}
            </Button>
            {migrationProgress && (
              <p role="status">{t('Transferring {migrationProgress}', { migrationProgress })}</p>
            )}
          </details>
        </>
      )}
      <p className="account-legal-links"><a href="/privacy.html" target="_blank" rel="noreferrer">{t('Privacy policy')}</a> · <a href="/support.html" target="_blank" rel="noreferrer">{t('Help & support')}</a></p>
      <DeleteAccount role={account.user.role} />
      {error && <Notice>{error}</Notice>}
      <Button
        secondary
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await request("/logout", { method: "POST" });
            location.reload();
          } catch (cause) {
            setError(t('Sign out was not confirmed. {message}', { message: cause.message }));
          } finally {
            setBusy(false);
          }
        }}
      >
        {t('Sign out')}
      </Button>
    </Modal>
  );
}

// Apple requires that people can delete their account from inside the app.
function DeleteAccount({ role }) {
  const [open, setOpen] = useState(false),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const coach = role === "coach";
  async function remove(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await request("/account/delete", { method: "POST", body: { password, confirm } });
      location.replace("/");
    } catch (cause) {
      setError(cause.message);
      setBusy(false);
    }
  }
  return (
    <details className="account-delete" open={open || undefined} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{t('Delete account')}</summary>
      <p>
        {coach
          ? t('This permanently deletes your coaching workspace: every client’s records, logins, photos, videos, voice notes, wearable readings and your Paymob connection. Your clients will no longer be able to sign in.')
          : t('This permanently deletes your account and everything about you: workouts, check-ins, messages, photos, voice notes, measurements and wearable readings. Connected wearables are disconnected. Your coach keeps payment records without your personal details.')}
      </p>
      <p className="muted">{t('This can’t be undone.')}</p>
      <form onSubmit={remove}>
        <fieldset disabled={busy} className="save-fields">
          <Field label={t('Your password')} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Field label={t('Type DELETE to confirm')} autoComplete="off" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <p className="error" role="alert">{error}</p>}
          <Button type="submit" disabled={confirm !== "DELETE" || !password}>{busy ? t('Deleting…') : coach ? t('Delete workspace and account') : t('Delete my account')}</Button>
        </fieldset>
      </form>
    </details>
  );
}
