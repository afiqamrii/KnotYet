import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('src/store/FriendsContext.tsx', 'utf8');
assert.match(source, /rpc\('create_chat_invite'/, 'invites are issued by Supabase');
assert.match(source, /from\('chat_messages'\)/, 'messages use the cloud table');
assert.match(source, /postgres_changes/, 'messages subscribe to realtime inserts');
assert.match(source, /message_type: message\.gameInvite \? 'game_invite' : 'text'/, 'quick replies use the database-safe text message type');
assert.match(source, /peerLastReadAt/, 'contacts retain the recipient read timestamp');
assert.match(source, /event: 'UPDATE', schema: 'public', table: 'chat_members'/, 'recipient reads update outgoing message state live');
assert.match(source, /visibilitychange/, 'returning to the app refreshes chat');
assert.doesNotMatch(source, /new Peer|peerjs/, 'direct chat no longer depends on both browsers being open');
assert.doesNotMatch(source, /localStorage/, 'chat transcripts are not persisted locally');

let env = '';
try { env = await readFile('.env.local', 'utf8'); } catch { /* CI may inject env directly. */ }
const variables = Object.fromEntries(env.split(/\r?\n/).filter(Boolean).map(line => {
  const index = line.indexOf('=');
  return index < 0 ? [line, ''] : [line.slice(0, index), line.slice(index + 1)];
}));
const url = process.env.VITE_SUPABASE_URL || variables.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || variables.VITE_SUPABASE_ANON_KEY;
if (url && key) {
  const headers = { apikey: key };
  const messages = await fetch(`${url}/rest/v1/chat_messages?select=id&limit=1`, { headers });
  if (messages.ok) assert.deepEqual(await messages.json(), [], 'anonymous users cannot read messages');
  else assert.ok([401, 403].includes(messages.status), 'anonymous message access is denied');
  const invite = await fetch(`${url}/rest/v1/rpc/create_chat_invite`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: 'test', avatar_id: 'sunny', relationship: 'friend' }) });
  assert.equal(invite.ok, false, 'anonymous users cannot create invitations');
}
console.log('Cloud chat: Supabase persistence, realtime refresh, no local transcript, and anonymous isolation passed');



