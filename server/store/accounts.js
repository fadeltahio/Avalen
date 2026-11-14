// Logins, sign-in sessions, retry keys, invitations and coach codes.
const unique = (e) => e?.code === "23505" || /UNIQUE constraint failed/.test(e?.message || "");

export function accountStore(db) {
  const users = {
    any: async () => Boolean(await db.get("SELECT id FROM users LIMIT 1")),
    byEmail: (email) => db.get("SELECT * FROM users WHERE email=$1", [email]),
    byId: (id) => db.get("SELECT * FROM users WHERE id=$1", [id]),
    // A client joining a coach; release() in relationships is the reverse.
    attach: (id, workspaceId, clientId) => db.run("UPDATE users SET workspace_id=$1, client_id=$2 WHERE id=$3", [workspaceId, clientId, id]),
    release: (id) => db.run("UPDATE users SET workspace_id=NULL, client_id=NULL WHERE id=$1", [id]),
    clientLoginsIn: (workspaceId) => db.all("SELECT id, client_id FROM users WHERE workspace_id=$1 AND role='client'", [workspaceId]),
    passwordOf: async (id) => (await db.get("SELECT password FROM users WHERE id=$1", [id]))?.password ?? null,
    setPassword: (id, passwordHash) => db.run("UPDATE users SET password=$1 WHERE id=$2", [passwordHash, id]),
    emailTaken: async (email) => Boolean(await db.get("SELECT id FROM users WHERE email=$1", [email])),
    // Two sign-ups racing with one email: the second gets the same answer as a taken email.
    insert: (u) =>
      db
        .run("INSERT INTO users(id, email, password, role, workspace_id, client_id) VALUES($1, $2, $3, $4, $5, $6)", [
          u.id, u.email, u.password, u.role, u.workspace_id, u.client_id,
        ])
        .catch((e) => {
          if (unique(e)) throw Object.assign(new Error("An account with this email already exists. Sign in instead."), { status: 409 });
          throw e;
        }),
    clientHasLogin: async (workspaceId, clientId) =>
      Boolean(await db.get("SELECT id FROM users WHERE workspace_id=$1 AND client_id=$2", [workspaceId, clientId])),
    workspaceHasClientLogin: async (workspaceId) =>
      Boolean(await db.get("SELECT id FROM users WHERE workspace_id=$1 AND role='client' LIMIT 1", [workspaceId])),
    idsForClient: async (workspaceId, clientId) =>
      (await db.all("SELECT id FROM users WHERE workspace_id=$1 AND client_id=$2", [workspaceId, clientId])).map((r) => r.id),
    idsInWorkspace: async (workspaceId) => (await db.all("SELECT id FROM users WHERE workspace_id=$1", [workspaceId])).map((r) => r.id),
    delete: (id) => db.run("DELETE FROM users WHERE id=$1", [id]),
    deleteWorkspace: (workspaceId) => db.run("DELETE FROM users WHERE workspace_id=$1", [workspaceId]),
  };

  const sessions = {
    create: (tokenHash, userId, csrf, expires) =>
      db.run("INSERT INTO sessions(token, user_id, csrf, expires) VALUES($1, $2, $3, $4)", [tokenHash, userId, csrf, expires]),
    userFor: (tokenHash, now) =>
      db.get("SELECT users.*, sessions.csrf FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=$1 AND sessions.expires>$2", [tokenHash, now]),
    end: (userId, csrf) => db.run("DELETE FROM sessions WHERE user_id=$1 AND csrf=$2", [userId, csrf]),
    endAllFor: (userId) => db.run("DELETE FROM sessions WHERE user_id=$1", [userId]),
    deleteExpired: (now) => db.run("DELETE FROM sessions WHERE expires<$1", [now]),
  };

  // Emailed password reset codes (only their hashes). See routes/accounts.js for the rules.
  const passwordResets = {
    create: (r) =>
      db.run("INSERT INTO password_resets(id, user_id, code_hash, created, expires, attempts) VALUES($1, $2, $3, $4, $5, 0)", [r.id, r.userId, r.codeHash, r.created, r.expires]),
    // The newest code still usable: not used, not expired.
    current: (userId, now) =>
      db.get("SELECT * FROM password_resets WHERE user_id=$1 AND used_at IS NULL AND expires>$2 ORDER BY created DESC LIMIT 1", [userId, now]),
    sentSince: async (userId, since) => Number((await db.get("SELECT COUNT(*) AS n FROM password_resets WHERE user_id=$1 AND created>$2", [userId, since])).n),
    // Counts a wrong guess; returns the attempts so far.
    wrongGuess: async (id) => {
      await db.run("UPDATE password_resets SET attempts=attempts+1 WHERE id=$1", [id]);
      return Number((await db.get("SELECT attempts FROM password_resets WHERE id=$1", [id]))?.attempts ?? 0);
    },
    // Uses a code once: only one of two simultaneous attempts gets true.
    use: async (id, now) => (await db.run("UPDATE password_resets SET used_at=$1 WHERE id=$2 AND used_at IS NULL", [now, id])).changes === 1,
    retireOthers: (userId, now) => db.run("UPDATE password_resets SET used_at=$1 WHERE user_id=$2 AND used_at IS NULL", [now, userId]),
    deleteFor: (userId) => db.run("DELETE FROM password_resets WHERE user_id=$1", [userId]),
  };

  // A save repeated with the same retry key returns the earlier result instead of applying twice.
  const requests = {
    seen: async (userId, key) => Boolean(await db.get("SELECT key FROM requests WHERE user_id=$1 AND key=$2", [userId, key])),
    record: (userId, key, result) =>
      db.run("INSERT INTO requests(user_id, key, result) VALUES($1, $2, $3)", [userId, key, JSON.stringify(result)]),
    deleteFor: (userId) => db.run("DELETE FROM requests WHERE user_id=$1", [userId]),
  };

  const invitations = {
    create: (tokenHash, workspaceId, clientId, expires) =>
      db.run("INSERT INTO invitations(token, workspace_id, client_id, expires, used) VALUES($1, $2, $3, $4, 0)", [tokenHash, workspaceId, clientId, expires]),
    findOpen: (tokenHash, now) => db.get("SELECT * FROM invitations WHERE token=$1 AND used=0 AND expires>$2", [tokenHash, now]),
    markUsed: (tokenHash) => db.run("UPDATE invitations SET used=1 WHERE token=$1", [tokenHash]),
    deleteForClient: (workspaceId, clientId) => db.run("DELETE FROM invitations WHERE workspace_id=$1 AND client_id=$2", [workspaceId, clientId]),
    deleteWorkspace: (workspaceId) => db.run("DELETE FROM invitations WHERE workspace_id=$1", [workspaceId]),
  };

  const coachCodes = {
    exists: async (code) => Boolean(await db.get("SELECT code FROM coach_codes WHERE code=$1", [code])),
    insert: (code, workspaceId) =>
      db.run("INSERT INTO coach_codes(code, workspace_id, created_at, active) VALUES($1, $2, $3, 1)", [code, workspaceId, new Date().toISOString()]),
    activeFor: async (workspaceId) => (await db.get("SELECT code FROM coach_codes WHERE workspace_id=$1 AND active=1", [workspaceId]))?.code ?? null,
    retire: (workspaceId) => db.run("UPDATE coach_codes SET active=0 WHERE workspace_id=$1 AND active=1", [workspaceId]),
    workspaceFor: async (code) => (await db.get("SELECT workspace_id FROM coach_codes WHERE code=$1 AND active=1", [code]))?.workspace_id ?? null,
    deleteWorkspace: (workspaceId) => db.run("DELETE FROM coach_codes WHERE workspace_id=$1", [workspaceId]),
  };

  return { users, sessions, requests, invitations, coachCodes, passwordResets };
}
