import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers/service.js';

test('clients persist personal saved sessions without permission to change training or other profiles', async()=>{
  const service=await fixture();
  try {
    const clientId=service.coach.data.clients[0].id;
    const invite=await service.call('/api/invitations',{method:'POST',account:service.coach,body:{clientId}});
    const client=await service.call('/api/join',{method:'POST',body:{invite:invite.invite,email:'client@test.app',password:'client-password-123'}});
    const saved=structuredClone(client.data),dayId=saved.clients[0].program.days[0].id;
    saved.clients[0].savedSessions=[dayId];
    const result=await service.call('/api/workspace',{method:'PATCH',account:client,body:{revision:client.revision,data:saved}});
    assert.equal(result.status,200);assert.deepEqual(result.data.clients[0].savedSessions,[dayId]);
    const refresh=await service.call('/api/workspace',{account:client});assert.deepEqual(refresh.data.clients[0].savedSessions,[dayId]);
    const invalid=structuredClone(refresh.data);invalid.clients[0].savedSessions=[{unexpected:'object'}];
    assert.equal((await service.call('/api/workspace',{method:'PATCH',account:client,body:{revision:refresh.revision,data:invalid}})).status,400);
    const forged=structuredClone(refresh.data);forged.clients[0].program.name='Client override';
    assert.equal((await service.call('/api/workspace',{method:'PATCH',account:client,body:{revision:refresh.revision,data:forged}})).status,403);
    const other=structuredClone(refresh.data);other.clients[0].id='unrelated-client';
    assert.equal((await service.call('/api/workspace',{method:'PATCH',account:client,body:{revision:refresh.revision,data:other}})).status,403);
    const owner=await service.call('/api/workspace',{account:service.coach});
    assert.deepEqual(owner.data.clients[0].program,service.coach.data.clients[0].program);
    const unsaved=structuredClone(refresh.data);unsaved.clients[0].savedSessions=[];
    const removed=await service.call('/api/workspace',{method:'PATCH',account:client,body:{revision:refresh.revision,data:unsaved}});
    assert.equal(removed.status,200);assert.deepEqual(removed.data.clients[0].savedSessions,[]);
  } finally {await service.close();}
});
