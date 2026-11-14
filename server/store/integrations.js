// Paymob connections and wearable links, sign-in states and daily readings.
export function integrationStore(db) {
  const paymentAccounts = {
    get: (workspaceId) => db.get("SELECT * FROM payment_accounts WHERE workspace_id=$1", [workspaceId]),
    save: (a) =>
      db.run(
        `INSERT INTO payment_accounts(workspace_id, region, public_key, secret_key, hmac_secret, integration_ids, connected_at)
         VALUES($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT(workspace_id) DO UPDATE SET region=excluded.region, public_key=excluded.public_key, secret_key=excluded.secret_key,
           hmac_secret=excluded.hmac_secret, integration_ids=excluded.integration_ids, connected_at=excluded.connected_at`,
        [a.workspace_id, a.region, a.public_key, a.secret_key, a.hmac_secret, a.integration_ids, a.connected_at],
      ),
    delete: (workspaceId) => db.run("DELETE FROM payment_accounts WHERE workspace_id=$1", [workspaceId]),
  };

  const scope = (workspaceId, clientId) =>
    clientId ? { where: "workspace_id=$1 AND client_id=$2", args: [workspaceId, clientId] } : { where: "workspace_id=$1", args: [workspaceId] };

  const wearables = {
    link: (ws, client, provider) => db.get("SELECT * FROM wearable_links WHERE workspace_id=$1 AND client_id=$2 AND provider=$3", [ws, client, provider]),
    linksFor: (ws, client) =>
      db.all("SELECT provider, connected_at, last_sync_at, last_error FROM wearable_links WHERE workspace_id=$1 AND client_id=$2", [ws, client]),
    linksInWorkspace: (ws) => db.all("SELECT client_id, provider, last_sync_at, last_error FROM wearable_links WHERE workspace_id=$1", [ws]),
    linksToSync: () => db.all("SELECT * FROM wearable_links WHERE last_error IS DISTINCT FROM 'reconnect'"),
    linksMatching: (ws, clientId) => {
      const { where, args } = scope(ws, clientId);
      return db.all(`SELECT * FROM wearable_links WHERE ${where}`, args);
    },
    linksForExternalUser: (provider, external) =>
      db.all("SELECT workspace_id, client_id FROM wearable_links WHERE provider=$1 AND external_user=$2", [provider, external]),
    saveLink: (l) =>
      db.run(
        `INSERT INTO wearable_links(workspace_id, client_id, provider, external_user, access_token, refresh_token, expires_at, connected_at, last_sync_at, last_error, retry_at)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8, NULL, NULL, NULL)
         ON CONFLICT(workspace_id, client_id, provider) DO UPDATE SET external_user=excluded.external_user, access_token=excluded.access_token,
           refresh_token=excluded.refresh_token, expires_at=excluded.expires_at, connected_at=excluded.connected_at,
           last_sync_at=NULL, last_error=NULL, retry_at=NULL`,
        [l.workspace_id, l.client_id, l.provider, l.external_user, l.access_token, l.refresh_token, l.expires_at, l.connected_at],
      ),
    updateTokens: (row, accessToken, refreshToken, expiresAt) =>
      db.run(
        "UPDATE wearable_links SET access_token=$1, refresh_token=COALESCE($2, refresh_token), expires_at=$3 WHERE workspace_id=$4 AND client_id=$5 AND provider=$6",
        [accessToken, refreshToken, expiresAt, row.workspace_id, row.client_id, row.provider],
      ),
    markSync: (ws, client, provider, lastSyncAt, error, retryAt) =>
      db.run("UPDATE wearable_links SET last_sync_at=$1, last_error=$2, retry_at=$3 WHERE workspace_id=$4 AND client_id=$5 AND provider=$6", [
        lastSyncAt, error, retryAt, ws, client, provider,
      ]),
    flagForSync: (ws, client, provider) =>
      db.run("UPDATE wearable_links SET last_sync_at=NULL WHERE workspace_id=$1 AND client_id=$2 AND provider=$3", [ws, client, provider]),
    deleteLink: (ws, client, provider) => db.run("DELETE FROM wearable_links WHERE workspace_id=$1 AND client_id=$2 AND provider=$3", [ws, client, provider]),

    saveDay: (ws, client, provider, date, metrics, at) =>
      db.run(
        `INSERT INTO wearable_days(workspace_id, client_id, provider, date, metrics, synced_at) VALUES($1, $2, $3, $4, $5, $6)
         ON CONFLICT(workspace_id, client_id, provider, date) DO UPDATE SET metrics=excluded.metrics, synced_at=excluded.synced_at`,
        [ws, client, provider, date, JSON.stringify(metrics), at],
      ),
    day: async (ws, client, provider, date) => {
      const row = await db.get("SELECT metrics FROM wearable_days WHERE workspace_id=$1 AND client_id=$2 AND provider=$3 AND date=$4", [ws, client, provider, date]);
      return row ? JSON.parse(row.metrics) : null;
    },
    daysSince: (ws, client, from) =>
      db.all("SELECT provider, date, metrics, synced_at FROM wearable_days WHERE workspace_id=$1 AND client_id=$2 AND date>=$3 ORDER BY date DESC", [ws, client, from]),
    lastUploads: (ws, client) =>
      db.all("SELECT provider, MAX(synced_at) AS at FROM wearable_days WHERE workspace_id=$1 AND client_id=$2 GROUP BY provider", [ws, client]),
    deleteDays: (ws, client, provider) => db.run("DELETE FROM wearable_days WHERE workspace_id=$1 AND client_id=$2 AND provider=$3", [ws, client, provider]),

    saveState: (stateHash, ws, client, provider, expires) =>
      db.run("INSERT INTO wearable_states(state, workspace_id, client_id, provider, expires) VALUES($1, $2, $3, $4, $5)", [stateHash, ws, client, provider, expires]),
    // Returns the sign-in state once and removes it, so a callback cannot be replayed.
    takeState: (stateHash) => db.get("DELETE FROM wearable_states WHERE state=$1 RETURNING *", [stateHash]),
    deleteExpiredStates: (now) => db.run("DELETE FROM wearable_states WHERE expires<$1", [now]),

    // A webhook delivery seen in the last week is ignored, so a retried delivery doesn't queue twice.
    async firstDelivery(id, now) {
      await db.run("DELETE FROM wearable_events WHERE at<$1", [now - 7 * 86400e3]);
      return (await db.run("INSERT INTO wearable_events(id, at) VALUES($1, $2) ON CONFLICT DO NOTHING", [id, now])).changes > 0;
    },
    // keepReadings: the connection goes but the client's readings stay with their history.
    async deleteAll(ws, clientId, { keepReadings = false } = {}) {
      const { where, args } = scope(ws, clientId);
      for (const table of keepReadings ? ["wearable_links", "wearable_states"] : ["wearable_links", "wearable_days", "wearable_states"]) await db.run(`DELETE FROM ${table} WHERE ${where}`, args);
    },
  };

  return { paymentAccounts, wearables };
}
