const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const A='11111111-1111-1111-1111-111111111111',B='22222222-2222-2222-2222-222222222222',C='33333333-3333-3333-3333-333333333333';
const wait=()=>new Promise(r=>setTimeout(r,100));
async function fixture(fail=false){
 const dom=new JSDOM(`<nav>${[[A,'Alpha'],[B,'Beta'],[C,'Gamma']].map(([id,title])=>`<button data-app-action-sidebar-thread-row data-app-action-sidebar-thread-id="local:${id}" data-app-action-sidebar-thread-title="${title}" ${id===A?'data-app-action-sidebar-thread-active="true"':''}></button>`).join('')}</nav><div data-app-shell-main-toolbar-trailing-slot></div><div data-app-shell-tab-row><div data-app-shell-focus-area="right-panel"></div></div><main data-app-shell-main-surface="default"></main>`,{url:`https://test.local/local/${A}`,runScripts:'outside-only'});
 const w=dom.window,opened=[];
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.eval(fs.readFileSync(__dirname+'/tabs.js','utf8'));
 w.regularTabsBind({id:A,hostId:'local',getPath:()=>`/local/${A}`,open:async item=>{if(fail)throw Error('Unavailable');opened.push({...item});return item.id;}});
 await wait();return {w,opened,close:()=>{w.regularTabsState.destroy();w.close();}};
}
test('controls live in native titlebars without changing transcript padding',async()=>{
 const f=await fixture();try{assert.equal(f.w.document.querySelectorAll('[data-regular-chat-open]').length,1);assert.equal(f.w.document.querySelector('[data-regular-split-tabs]'),null);assert.equal(f.w.document.querySelector('main').style.paddingTop,'');}finally{f.close();}
});
test('opening multiple right chat tabs never replaces a tab or navigates the left chat',async()=>{
 const f=await fixture();try{
 f.w.document.querySelector('[data-regular-chat-open]').click();
 assert.equal(f.w.document.querySelector(`[data-chat-id="${A}"]`),null);
 f.w.document.querySelector(`[data-chat-id="${B}"]`).click();await wait();
 assert.equal(f.opened[0].id,B);assert.equal(f.opened[0].replaceTabId,undefined);
 f.w.document.querySelector('[data-regular-chat-open=right]').click();
 f.w.document.querySelector(`[data-chat-id="${C}"]`).click();await wait();
 assert.equal(f.opened[1].id,C);assert.equal(f.opened[1].replaceTabId,undefined);
 assert.equal(f.w.regularTabsState.context.id,A);assert.equal(f.w.location.pathname,`/local/${A}`);
 assert.equal(f.w.document.querySelectorAll('nav button').length,3);
 }finally{f.close();}
});
test('search and Enter select saved chats; failures keep picker and enable retry',async()=>{
 const f=await fixture(true);try{
 f.w.regularTabsState.pick();const input=f.w.document.querySelector('input');input.value='gam';input.dispatchEvent(new f.w.Event('input'));
 assert.equal(f.w.document.querySelectorAll('[data-chat-results] button').length,1);
 input.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Enter'}));await wait();
 assert.equal(f.w.document.querySelector('[role=alert]').textContent,'Unavailable');assert.equal(f.w.document.querySelector('[data-chat-results] button').disabled,false);
 assert.equal(f.w.regularTabsState.right,undefined);
 }finally{f.close();}
});
test('hidden retained titlebars are ignored, side binding cannot replace primary context',async()=>{
 const f=await fixture();try{
 const hidden=f.w.document.createElement('div');hidden.hidden=true;hidden.innerHTML='<div data-app-shell-tab-row><div data-app-shell-focus-area="right-panel"></div></div>';f.w.document.body.prepend(hidden);
 f.w.regularTabsBind({id:B,hostId:'local'});f.w.regularTabsState.schedule();await wait();
 assert.equal(f.w.regularTabsState.context.id,A);assert.equal(hidden.querySelector('[data-regular-chat-open]'),null);
 }finally{f.close();}
});
test('one control survives fallback, toolbar and panel layout changes',async()=>{
 const f=await fixture();try{
 const d=f.w.document, panel=d.querySelector('[data-app-shell-tab-row]'),toolbar=d.querySelector('[data-app-shell-main-toolbar-trailing-slot]');
 panel.hidden=true;toolbar.hidden=true;f.w.regularTabsState.schedule();await wait();
 assert.equal(d.querySelectorAll('[data-regular-chat-open]').length,1);
 assert.equal(d.querySelector('[data-regular-chat-open]').parentElement,d.querySelector('main'));
 toolbar.hidden=false;f.w.regularTabsState.schedule();await wait();
 assert.equal(d.querySelectorAll('[data-regular-chat-open]').length,1);
 assert.equal(d.querySelector('[data-regular-chat-open]').parentElement,toolbar);
 panel.hidden=false;f.w.regularTabsState.schedule();await wait();
 assert.equal(d.querySelectorAll('[data-regular-chat-open]').length,1);
 assert.equal(d.querySelector('[data-regular-chat-open]').dataset.regularChatOpen,'right');
 }finally{f.close();}
});
