import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/service.js';

test('a client sends their own intake but cannot clear its health flag or review', async () => {
  const service = await fixture();
  try {
    const clientId = service.coach.data.clients[0].id;
    const invite = await service.call('/api/invitations', {method: 'POST', account: service.coach, body: {clientId}});
    const client = await service.call('/api/join', {method: 'POST', body: {invite: invite.invite, email: 'client@test.app', password: 'client-password-123'}});
    const saved = structuredClone(client.data);
    saved.clients[0].intake = {answers: {experience: 'Under a year', health: 'Yes'}, flagged: false, submittedAt: '2026-11-01T10:00:00.000Z', reviewedAt: '2026-11-01T10:00:00.000Z'};
    const result = await service.call('/api/workspace', {method: 'PATCH', account: client, body: {revision: client.revision, data: saved}});
    assert.equal(result.status, 200);
    const stored = await service.call('/api/workspace', {account: service.coach});
    assert.equal(stored.data.clients[0].intake.flagged, true);
    assert.equal(stored.data.clients[0].intake.reviewedAt, null);
    assert.equal(stored.data.clients[0].intake.answers.experience, 'Under a year');

    const oversized = structuredClone(result.data);
    oversized.clients[0].intake = {answers: {notes: 'x'.repeat(7000)}};
    const rejected = await service.call('/api/workspace', {method: 'PATCH', account: client, body: {revision: result.revision, data: oversized}});
    assert.equal(rejected.status, 400);
  } finally {
    await service.close();
  }
});
