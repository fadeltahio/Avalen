// What deleting a client's account removes from the coach's workspace.
// Every record about the client goes. The client entry stays as an anonymous,
// paused "Deleted client" so the coach's screens and payment history keep
// working; payment records are kept, without personal details, for the
// coach's accounting.
const PERSONAL = ['email', 'phone', 'intake', 'wearables', 'preferredWearable', 'homeLayout', 'integrations', 'externalAIConsent', 'savedSessions', 'travel'];

export function removeClientData(data, clientId) {
  const client = data.clients.find((c) => c.id === clientId);
  if (!client) return data;
  for (const [key, value] of Object.entries(data)) {
    if (!Array.isArray(value) || key === 'clients' || key === 'payments') continue;
    data[key] = value.filter((row) => !(row && typeof row === 'object' && row.clientId === clientId));
  }
  if (data.drafts && typeof data.drafts === 'object') delete data.drafts[clientId];
  for (const payment of data.payments || []) {
    if (payment.clientId !== clientId) continue;
    delete payment.phone;
    if (payment.paymob) delete payment.paymob.phone;
  }
  for (const key of PERSONAL) delete client[key];
  Object.assign(client, { name: 'Deleted client', goal: '', paused: true, deletedAt: new Date().toISOString() });
  return data;
}
