import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const load = async name => {
  const source = await readFile(new URL(`../src/utils/${name}.ts`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
};
const { restoreSecretRaceSession: restore, validateSecretRaceState: valid, secretRaceSessionKey } = await load('secretRaceSession');
const now = Date.now();
const state = {matchId:'r1',round:1,operation:'+',phase:'picking',hostLocked:true,partnerLocked:false,scores:{host:0,partner:0}};
const session = {version:1,roomCode:'1234',isHost:true,savedAt:now,state,numbers:{host:7},guestLockedNumber:null,countdownEndsAt:null,candidate:null,cooldowns:{host:0,partner:0},rewardedRounds:[]};
const read = value => restore(JSON.stringify(value),'1234',true,now);
assert.deepEqual(read(session),session,'restore locked private pick with its public state');
assert.equal(read({...session,state:{...state,privateNumbers:{host:7,partner:4}}}).state.privateNumbers,undefined,'unknown private fields cannot enter a replay snapshot');
assert.equal(restore('{broken','1234',true),null);
assert.equal(restore(JSON.stringify(session),'9999',true),null,'different room never restores');
assert.equal(restore(JSON.stringify(session),'1234',false),null,'different role never restores');
for(const invalid of [
  {...session,numbers:{}}, {...session,numbers:{host:7,partner:4}},
  {...session,state:{...state,equation:{hostNumber:7,partnerNumber:4,answer:11}}},
  {...session,state:{...state,operation:'×'},numbers:{host:13}},
  {...session,state:{...state,phase:'countdown'},countdownEndsAt:now+3000},
  {...session,candidate:{role:'host',receivedAt:now}},
  {...session,cooldowns:{host:now+3000,partner:0}},
]) assert.equal(read(invalid),null,'reject inconsistent or leaking save');
const countdown={...session,state:{...state,phase:'countdown',partnerLocked:true},numbers:{host:7,partner:4},countdownEndsAt:now-500};
assert.deepEqual(read(countdown),countdown,'elapsed countdown restores and can advance immediately');
const answering={...countdown,state:{...countdown.state,phase:'answering',equation:{hostNumber:7,partnerNumber:4,answer:11}},countdownEndsAt:null,candidate:{role:'partner',receivedAt:now-100}};
assert.deepEqual(read(answering),answering,'pending adjudication preserves its first correct answer');
const result={...answering,state:{...answering.state,phase:'result',winner:'partner',scores:{host:0,partner:1}},candidate:null,rewardedRounds:['r1']};
assert.deepEqual(read(result).rewardedRounds,['r1'],'award markers survive result recovery');
assert.equal(valid({...result.state,equation:{hostNumber:7,partnerNumber:4,answer:99}}),false,'equation must match the operation');
assert.equal(valid({...result.state,phase:'complete'}),false,'only round five completes a match');
const guest={...result,isHost:false,numbers:{},guestLockedNumber:4};
assert.deepEqual(restore(JSON.stringify(guest),'1234',false,now),guest);
assert.equal(restore(JSON.stringify({...guest,numbers:{host:7}}),'1234',false,now),null,'guest save cannot carry the host private pick');
const {GAME_SESSION_KEYS}=await load('storage');
for(const host of [true,false])assert.ok(GAME_SESSION_KEYS.includes(secretRaceSessionKey(host)),'ending a game clears both role saves');
console.log('Secret Race sessions: room/role scope, corrupt saves, private picks, equation validation, countdown/adjudication deadlines, award markers and reset keys passed.');
