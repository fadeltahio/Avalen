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
      setError("The account service is unavailable. Start the Avalen service, then retry.");
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
      <span className="eyebrow">YOUR COACHING, CONNECTED</span>
      <h1>
        {mode === "setup"
          ? "Build your coaching workspace."
          : mode === "join"
            ? "Your next chapter."
            : "Welcome back."}
      </h1>
      <p className="muted">
        {mode === "setup"
          ? "Create the owner account using your service setup token."
          : "Sign in to your private coaching workspace."}
      </p>
      <form onSubmit={submit}>
        {mode === "setup" && (
          <>
            <Field
              label="Setup token"
              name="setupToken"
              type="password"
              required
              autoComplete="off"
            />
            <Field label="Coach name" name="name" required maxLength={100} />
            <Field
              label="First client name"
              name="clientName"
              required
              maxLength={100}
            />
          </>
        )}
        {mode === "join" && (
          <Field
            label="Invitation"
            name="invite"
            required
            defaultValue={
              new URLSearchParams(location.search).get("invite") || ""
            }
          />
        )}
        <Field
          label="Email"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
        <Field
          label="Password"
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
            ? "Opening workspace…"
            : mode === "setup"
              ? "Create workspace"
              : mode === "join"
                ? "Accept invitation"
                : "Sign in"}
        </Button>
      </form>
      {!status && error && <Button secondary disabled={busy} onClick={checkConnection}>{busy ? 'Checking connection…' : 'Retry connection'}</Button>}
      {status?.configured && (
        <button
          className="text-link"
          onClick={() => {
            setMode(mode === "join" ? "login" : "join");
            setError("");
          }}
        >
          {mode === "join"
            ? "I already have an account"
            : "I have a coach invitation"}
        </button>
      )}
      <a className="text-link muted" href="/?connected=0&preview=welcome">
        Open device preview
      </a>
      <small className="muted">
        Private recordings and coaching notes are available only to authorized
        accounts.
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
      if (!raw) throw new Error("No device workspace was found.");
      const data = JSON.parse(raw);
      const result = await migrateDeviceMedia(data, setMigrationProgress);
      setError(
        result.failed.length
          ? `Records remain imported. ${result.total - result.failed.length}/${result.total} files transferred. Retry to transfer the remaining files: ${result.failed
              .map((x) => `${x.name}: ${x.error}`)
              .slice(0, 3)
              .join("; ")}`
          : `Records and ${result.total} files are now available in your private workspace. Device originals remain untouched.`,
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
      if (!raw) throw new Error("No device workspace was found.");
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
    <Modal title="Your connected workspace" onClose={onClose} canClose={!busy}>
      <p>
        {account.user.email} · {account.user.role}
      </p>
      {account.user.role === "coach" && (
        <>
          <SectionHead title="Invite a client" />
          <form onSubmit={createInvite}>
            <Field label="Client">
              <select name="clientId">
                {account.data.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Button disabled={busy} type="submit">
              Create private invitation
            </Button>
          </form>
          {invite && (
            <Field label="Invitation link · valid for 48 hours">
              <textarea
                readOnly
                value={invite}
                onFocus={(e) => e.target.select()}
              />
            </Field>
          )}
          <details>
            <summary>Bring your device workspace</summary>
            <p className="muted">
              Available before live activity. Review the device preview first.
              An archive of this new server workspace is kept, and your browser
              originals remain untouched.
            </p>
            <Button secondary disabled={busy} onClick={migrate}>
              Import device records and files
            </Button>
            <Button secondary disabled={busy} onClick={transfer}>
              Retry file transfer
            </Button>
            {migrationProgress && (
              <p role="status">Transferring {migrationProgress}</p>
            )}
          </details>
        </>
      )}
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
            setError(`Sign out was not confirmed. ${cause.message}`);
          } finally {
            setBusy(false);
          }
        }}
      >
        Sign out
      </Button>
    </Modal>
  );
}
