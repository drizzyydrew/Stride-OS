import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHydrationSafeStorage} from '../../src/store/hydrationSafeStorage';
import {COACH_CHAT_KEY,createCoachChatHistory} from '../../src/utils/coachChatHistory';

test('brand-new chat can perform its first bounded safe read, then persist a draft before any send',async()=>{
 const data=new Map<string,string>();let reads=0,writes=0;
 const disk=createHydrationSafeStorage({getItem:async key=>{reads++;return data.get(key)??null},setItem:async(key,value)=>{writes++;data.set(key,value)},removeItem:async key=>{data.delete(key)}});
 await assert.rejects(disk.getItemOnce(COACH_CHAT_KEY),/read safely/);
 const history=createCoachChatHistory({getItem:key=>disk.readItemOnce(key),setItem:async(key,value)=>{await disk.setItem(key,value)}},()=>1000);
 await history.setOwner('A');assert.equal(history.getState().ready,true);assert.equal(reads,1);
 await history.append({id:'draft',role:'user',content:'Draft',createdAt:1000},'A');
 assert.equal(writes,1);assert.match(data.get(COACH_CHAT_KEY)!,/Draft/);
});
test('failed initial read stays unwritable; retry reads the real saved copy and never overwrites corrupt data',async()=>{
 let fail=true,writes=0;let raw=JSON.stringify({version:1,owner:'A',clockFloor:1000,messages:[{id:'old',role:'assistant',content:'Existing reply',createdAt:1000}]});
 const disk=createHydrationSafeStorage({getItem:async()=>{if(fail)throw Error('Protected data');return raw},setItem:async(_key,value)=>{writes++;raw=value},removeItem:async()=>{}});
 const history=createCoachChatHistory({getItem:key=>disk.readItemOnce(key),setItem:async(key,value)=>{await disk.setItem(key,value)}},()=>1000);
 await history.setOwner('A');assert.equal(history.getState().ready,false);assert.equal(disk.isKeyReadable(COACH_CHAT_KEY),false);
 await assert.rejects(history.append({id:'new',role:'user',content:'New',createdAt:1000},'A'));assert.equal(writes,0);
 fail=false;await history.setOwner('A');assert.equal(history.getState().messages[0]!.content,'Existing reply');assert.equal(writes,0);
 raw='{corrupt';await history.setOwner('A');assert.equal(history.getState().ready,false);
 await assert.rejects(history.append({id:'new',role:'user',content:'New',createdAt:1000},'A'));assert.equal(raw,'{corrupt');assert.equal(writes,0);
});
test('Coach wiring uses bounded initial hydration, editable draft and explicit active recovery controls',()=>{
 const hook=readFileSync('src/hooks/useCoachChatHistory.ts','utf8'),screen=readFileSync('app/(tabs)/coach/index.tsx','utf8');
 assert.match(hook,/getAppStorage\(\)\.readItemOnce/);assert.doesNotMatch(hook,/getAppStorage\(\)\.getItemOnce/);
 assert.match(screen,/editable=\{!loading\}/);assert.match(screen,/Reading saved chat…/);assert.match(screen,/if\(!chat\.ready\) \{ await retrySavedChat\(\); return; \}/);
 assert.match(screen,/justifyContent:'flex-end'/);
 assert.doesNotMatch(screen,/paddingBottom: spacing\.xxl \+ insets\.bottom \+ 84/);
});
