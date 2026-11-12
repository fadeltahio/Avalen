const collections = ['sessions', 'foodLogs', 'measurements', 'habitLogs', 'checkins', 'messages', 'posts', 'photos', 'documents', 'inbodies', 'timeline', 'dismissed', 'templates', 'library', 'savedReplies', 'savedViews', 'leads', 'forms', 'automations', 'favorites'];

// Refuse unreadable workspaces rather than replacing private records with demo data.
export function parseWorkspace(raw) {
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.clients) || !data.clients.length || !data.coach || !data.drafts || collections.some(key => !Array.isArray(data[key]))) {
    throw new Error('This workspace has an unsupported or incomplete format.');
  }
  if (data.clients.some(client => !client.id || typeof client.name !== 'string' || !Array.isArray(client.schedule) || !Array.isArray(client.program?.days) || !Array.isArray(client.habits) || !client.nutrition || !client.subscription)) {
    throw new Error('Some client records could not be read safely.');
  }
  data.settings = { theme: 'dark', reducedMotion: false, ...data.settings };
  return data;
}
