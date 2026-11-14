import { migrateDeviceMedia, collectDeviceMedia } from "./migration.js";
import React, { useEffect, useState } from "react";
import { ArrowLeft, Download, Languages, LogOut, UserMinus } from "lucide-react";
import { download } from "../store.js";
import { Button, Field, Notice, Modal, SectionHead } from "../ui.jsx";
import { leaveBoot } from "../BrandMark.jsx";
import {
  acceptConnection,
  connection,
  connectedMode,
  hasPendingChanges,
  nativeApp,
  request,
  unsavedAction,
} from "./connection.js";
import { LANGUAGES, language, setLanguage, t } from '../i18n.js';
// The way into a connected workspace: sign in, create a coach account, or join a
// coach with their code. Invitation links and the original owner setup still work.
// Changing language reloads the app; the screen and what was typed (never the
// password) are kept for that one reload.
const DRAFT = "avalen.account.draft";
const readDraft = () => {
  try { const value = JSON.parse(sessionStorage.getItem(DRAFT) || "null"); sessionStorage.removeItem(DRAFT); return value || {}; }
  catch { return {}; }
};
const draft = typeof sessionStorage === "undefined" ? {} : readDraft();
const startMode = () => (new URLSearchParams(location.search).has("invite") ? "join" : draft.mode || "welcome");
function switchLanguage(lang, mode) {
  try {
    const form = document.querySelector(".account-screen form");
    const fields = form ? Object.fromEntries([...new FormData(form)].filter(([key]) => ["name", "email", "code", "invite"].includes(key))) : {};
    sessionStorage.setItem(DRAFT, JSON.stringify({ mode, fields }));
  } catch {}
  setLanguage(lang);
}
// One button that offers the other language, written in that language.
function LanguageSwitch({ mode }) {
  const [id, l] = Object.entries(LANGUAGES).find(([key]) => key !== language());
  return (
    <button type="button" className="account-language" lang={id} dir={l.dir} aria-label={`${t('Language')}: ${l.name}`} onClick={() => switchLanguage(id, mode)}>
      <Languages size={16} aria-hidden="true" />{l.name}
    </button>
  );
}
export function AccountGate({ children }) {
  const [ready, setReady] = useState(!connectedMode()),
    [status, setStatus] = useState(null),
    [mode, setModeState] = useState(startMode),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [resetEmail, setResetEmail] = useState(""),
    [busy, setBusy] = useState(false);
  const setMode = (next) => { setModeState(next); setError(""); setNotice(""); };
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
        } else if (!service.configured && !service.coachSignup) setMode("setup");
    } catch {
      setStatus(null);
      setError(t('The account service is unavailable. Check your connection, then retry.'));
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
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const fields = Object.fromEntries(new FormData(e.currentTarget));
      const path = { coach: "/signup/coach", client: "/signup/client" }[mode] || `/${mode}`;
      const result = await request(path, { method: "POST", body: fields });
      acceptConnection(result);
      try {
        sessionStorage.setItem("avalen.editorial.splash", "seen");
        if (mode === "join" || mode === "client") sessionStorage.setItem("avalen.intake.open", "1");
        sessionStorage.setItem("avalen.role", result.user.role);
      } catch {}
      setReady(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  // Forgot password: an emailed 6-digit code, then a new password. Success is shown only
  // after the server confirms; on failure the typed values stay.
  async function submitReset(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const fields = Object.fromEntries(new FormData(e.currentTarget));
      if (mode === "forgot") {
        const result = await request("/password/forgot", { method: "POST", body: { email: fields.email } });
        setResetEmail(fields.email);
        setModeState("reset");
        setNotice(t(result.message || "If an account exists for that email, we’ve sent a 6-digit code. It works for 15 minutes."));
      } else {
        await request("/password/reset", { method: "POST", body: { email: fields.email, code: String(fields.code || "").trim(), password: fields.password } });
        setResetEmail(fields.email);
        setModeState("login");
        setNotice(t("Password changed. Sign in with your new password."));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (ready) return children;
  const copy = {
    welcome: [t('Welcome to Avalen.'), t('Your training, nutrition and coach in one place.')],
    login: [t('Welcome back.'), t('Sign in to your coaching workspace.')],
    coach: [t('Coach with Avalen.'), t('Create your coaching workspace. You get a code to share with your clients.')],
    client: [t('Join your coach.'), t('Enter the code your coach gave you to connect with them.')],
    join: [t('Your next chapter.'), t('Accept your coach’s invitation.')],
    setup: [t('Build your coaching workspace.'), t('Create the owner account using your service setup token.')],
    forgot: [t('Reset your password.'), t('Enter the email you signed up with. We’ll send you a 6-digit code.')],
    reset: [t('Check your email.'), t('Enter the code we sent and choose a new password.')],
  }[mode];
  const resetting = mode === "forgot" || mode === "reset";
  const unavailable = !status && error;
  return (
    <main className="account-screen">
      <div className="account-top">
        <div className="account-wordmark">AVALEN</div>
        <LanguageSwitch mode={mode} />
      </div>
      {mode !== "welcome" && mode !== "setup" && (
        <button type="button" className="text-link account-back" onClick={() => setMode(resetting ? "login" : "welcome")}><ArrowLeft size={16}/>{t('Back')}</button>
      )}
      <span className="eyebrow">{t('YOUR COACHING, CONNECTED')}</span>
      <h1>{copy[0]}</h1>
      <p className="muted">{copy[1]}</p>
      {mode === "welcome" ? (
        <div className="account-choices">
          <Button disabled={busy || !status} onClick={() => setMode("login")}>{t('Sign in')}</Button>
          {status?.coachSignup !== false && <Button secondary disabled={busy || !status} onClick={() => setMode("coach")}>{t('I’m a coach')}<small>{t('Create a coach account')}</small></Button>}
          <Button secondary disabled={busy || !status} onClick={() => setMode("client")}>{t('I have a coach code')}<small>{t('Create a client account')}</small></Button>
          {error && <p role="alert" className="error">{error}</p>}
        </div>
      ) : resetting ? (
        <form key={mode} onSubmit={submitReset}>
          <fieldset className="save-fields" disabled={busy}>
          {notice && <p role="status" className="account-notice">{notice}</p>}
          <Field label={t('Email')} name="email" type="email" required autoComplete="email" dir="ltr" defaultValue={resetEmail} />
          {mode === "reset" && (
            <>
              <Field label={t('6-digit code')} name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} dir="ltr" className="coach-code-input" />
              <Field label={t('New password')} name="password" type="password" required minLength={12} maxLength={200} autoComplete="new-password" hint={t('At least 12 characters')} />
            </>
          )}
          {error && <p role="alert" className="error">{error}</p>}
          <Button type="submit" disabled={busy || !status}>
            {busy ? t('Sending…') : mode === "forgot" ? t('Send code') : t('Change password')}
          </Button>
          </fieldset>
          {mode === "reset" && <button type="button" className="text-link" disabled={busy} onClick={() => setMode("forgot")}>{t('Send a new code')}</button>}
        </form>
      ) : (
        <form key={mode} onSubmit={submit}>
          <fieldset className="save-fields" disabled={busy}>
          {mode === "setup" && (
            <>
              <Field label={t('Setup token')} name="setupToken" type="password" required autoComplete="off" />
              <Field label={t('Coach name')} name="name" required maxLength={100} />
              <Field label={t('First client name')} name="clientName" required maxLength={100} />
            </>
          )}
          {mode === "client" && (
            <Field label={t('Coach code')} name="code" required className="coach-code-input" placeholder="ABC-234" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={9} dir="ltr" defaultValue={draft.fields?.code} />
          )}
          {mode === "join" && (
            <Field label={t('Invitation')} name="invite" required defaultValue={new URLSearchParams(location.search).get("invite") || ""} />
          )}
          {(mode === "coach" || mode === "client") && (
            <Field label={t('Your name')} name="name" required maxLength={100} autoComplete="name" defaultValue={draft.fields?.name} />
          )}
          {notice && <p role="status" className="account-notice">{notice}</p>}
          <Field label={t('Email')} name="email" type="email" required autoComplete="email" dir="ltr" defaultValue={(mode === "login" && resetEmail) || draft.fields?.email} />
          <Field
            label={t('Password')}
            name="password"
            type="password"
            required
            minLength={12}
            maxLength={200}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            hint={mode === "login" ? undefined : t('At least 12 characters')}
          />
          {error && <p role="alert" className="error">{error}</p>}
          <Button type="submit" disabled={busy || !status}>
            {busy
              ? t('Opening workspace…')
              : { setup: t('Create workspace'), join: t('Accept invitation'), coach: t('Create coach account'), client: t('Join your coach'), login: t('Sign in') }[mode]}
          </Button>
          </fieldset>
          {mode === "login" && status?.passwordReset && <button type="button" className="text-link" onClick={() => setMode("forgot")}>{t('Forgot password?')}</button>}
          {mode === "login" && <button type="button" className="text-link" onClick={() => setMode("client")}>{t('New here? Join with a coach code')}</button>}
          {(mode === "coach" || mode === "client") && <button type="button" className="text-link" onClick={() => setMode("login")}>{t('I already have an account')}</button>}
        </form>
      )}
      {unavailable && <Button secondary disabled={busy} onClick={checkConnection}>{busy ? t('Checking connection…') : t('Retry connection')}</Button>}
      <a className="text-link muted" href="/?connected=0&preview=welcome">
        {t('Explore the demo first')}
      </a>
      <small className="muted account-legal">
        <a href="/privacy.html" target="_blank" rel="noreferrer">{t('Privacy policy')}</a> · <a href="/support.html" target="_blank" rel="noreferrer">{t('Help & support')}</a>
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
export function DeleteAccount({ role }) {
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
          ? t('This permanently deletes your coaching workspace: your programmes, notes, client payments, messages, documents and your Paymob connection. Clients with their own account keep it, with their workouts, food logs, measurements, check-ins and photos, and can join another coach.')
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

// The client's full history, across every coach they've had, as one file.
async function downloadHistory() {
  const history = await request("/account/export");
  download(new Blob([JSON.stringify(history, null, 2)], { type: "application/json" }), "avalen-my-history.json");
}

// A client ends coaching. They keep their account and their own records; the coach
// keeps payments, messages and their own notes.
export function LeaveCoachSection() {
  const [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function leave() {
    setBusy(true);
    setError("");
    try {
      acceptConnection(await request("/account/leave-coach", { method: "POST", body: { confirm: true } }));
    } catch (cause) {
      setError(cause.message);
      setBusy(false);
    }
  }
  return (
    <div className="card list">
      <button className="simple-row" onClick={() => setConfirming(true)}>
        <UserMinus size={19} />
        <span><b>{t('End coaching')}</b><small>{t('Keep your account and your history')}</small></span>
      </button>
      {confirming && (
        <Modal title={t('End coaching with your coach?')} onClose={() => setConfirming(false)} canClose={!busy}>
          <p>{t('You keep your account and your own records: workouts, food logs, measurements, check-ins and photos. Your coach keeps your payments, messages and their own notes, and won’t see your activity from now on.')}</p>
          <p className="muted">{t('You can join another coach later with their coach code.')}</p>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="button-row">
            <Button disabled={busy} onClick={leave}>{busy ? t('Ending coaching…') : t('End coaching')}</Button>
            <Button secondary disabled={busy} onClick={() => setConfirming(false)}>{t('Keep my coach')}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// A client between coaches: their history is kept; they can join a coach with a code,
// download what their account holds, sign out or delete their account.
export function CoachlessHome({ coachless }) {
  const [code, setCode] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [exportError, setExportError] = useState("");
  const kept = coachless.kept || {};
  async function join(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      acceptConnection(await request("/account/join-coach", { method: "POST", body: { code } }));
    } catch (cause) {
      setError(cause.message);
      setBusy(false);
    }
  }
  return (
    <>
      <section className="card coachless">
        <SectionHead title={t('You’re not connected to a coach')} />
        <p>{t('Your account and your history are kept: {workouts} workouts, {foodLogs} food logs, {measurements} measurements, {checkins} check-ins and {photos} photos.', { workouts: kept.workouts ?? 0, foodLogs: kept.foodLogs ?? 0, measurements: kept.measurements ?? 0, checkins: kept.checkins ?? 0, photos: kept.photos ?? 0 })}</p>
        <form onSubmit={join}>
          <fieldset disabled={busy} className="save-fields">
            <Field label={t('Coach code')} autoComplete="off" autoCapitalize="characters" required value={code} onChange={(e) => setCode(e.target.value)} />
            <p className="muted">{t('Your new coach starts fresh. Your earlier history stays in your account and isn’t shared with them.')}</p>
            {error && <p className="error" role="alert">{error}</p>}
            <Button type="submit" disabled={!code.trim()}>{busy ? t('Joining…') : t('Join coach')}</Button>
          </fieldset>
        </form>
      </section>
      <div className="card list">
        <button className="simple-row" onClick={() => downloadHistory().catch((cause) => setExportError(cause.message))}>
          <Download size={19} />
          <span><b>{t('Download your history')}</b><small>{t('Every workout and record from all your coaches')}</small></span>
        </button>
        {exportError && <p className="error" role="alert">{exportError}</p>}
      </div>
      <SignOutSection />
      <DeleteAccount role="client" />
    </>
  );
}

// Signing out from More, for coaches and clients. Only for a real account; in the
// iPhone app's demo it returns to the sign-in screen instead.
export function SignOutSection() {
  const [confirming, setConfirming] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const signedIn = Boolean(connection()?.user);
  if (!signedIn && !nativeApp()) return null;
  if (!signedIn)
    return (
      <div className="card list sign-out-section">
        <a className="simple-row" href="/?connected=1">
          <LogOut size={19} />
          <span><b>{t('Exit demo')}</b><small>{t('Return to the sign-in screen')}</small></span>
        </a>
      </div>
    );
  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await request("/logout", { method: "POST" });
      try { sessionStorage.removeItem("avalen.role"); } catch {}
      location.replace(nativeApp() ? "/" : "/?connected=1");
    } catch (cause) {
      setError(t('Sign out was not confirmed. {message}', { message: cause.message }));
      setBusy(false);
    }
  }
  return (
    <div className="card list sign-out-section">
      <button type="button" className="simple-row" onClick={() => setConfirming(true)}>
        <LogOut size={19} />
        <span><b>{t('Sign out')}</b><small>{connection().user.email}</small></span>
      </button>
      {confirming && (
        <Modal title={t('Sign out of Avalen?')} onClose={() => setConfirming(false)} canClose={!busy}>
          <p>{t('You can sign in again any time with your email and password.')}</p>
          {(hasPendingChanges() || unsavedAction()) && <Notice>{t('A change is still being saved. Signing out now may lose it.')}</Notice>}
          {error && <p role="alert" className="error">{error}</p>}
          <Button disabled={busy} onClick={signOut}>{busy ? t('Signing out…') : t('Sign out')}</Button>
          <Button secondary disabled={busy} onClick={() => setConfirming(false)}>{t('Stay signed in')}</Button>
        </Modal>
      )}
    </div>
  );
}
