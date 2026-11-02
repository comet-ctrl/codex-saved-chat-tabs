// Native persistent side conversations own rendering, input and tab lifecycle.
// This module only selects existing chats; it never submits a prompt.
var regularTabsState;
function regularTabsVisible(node) {
  for(let el=node;el;el=el.parentElement){
    const s=getComputedStyle(el);
    if(el.hidden||el.inert||el.getAttribute('aria-hidden')==='true'||s.display==='none'||s.visibility==='hidden')return false;
  }
  return true;
}
function regularTabsBind(context) {
  const row=[...document.querySelectorAll('[data-app-action-sidebar-thread-active="true"]')].find(regularTabsVisible);
  if(row&&row.getAttribute('data-app-action-sidebar-thread-id')?.replace(/^local:/,'')!==context.id)return;
  if(!regularTabsState)regularTabsState=regularTabsCreate();
  regularTabsState.context=context;regularTabsState.schedule();
}
function regularTabsCreate() {
  const key='regular-split-tabs:v2';let saved=[];
  try{saved=JSON.parse(localStorage.getItem(key)||'[]');}catch{}
  const state={tabs:Array.isArray(saved)?saved.filter(t=>typeof t.id==='string'&&typeof t.title==='string'):[],context:null,timer:null,busy:false,error:'',controls:[],dialog:null};
  state.schedule=()=>{if(!state.timer)state.timer=setTimeout(()=>{state.timer=null;render();},60);};
  function chats(){
    const rows=[...document.querySelectorAll('[data-app-action-sidebar-thread-row][data-app-action-sidebar-thread-id]')].filter(regularTabsVisible).map(n=>({id:n.getAttribute('data-app-action-sidebar-thread-id').replace(/^local:/,''),title:n.getAttribute('data-app-action-sidebar-thread-title')||'Chat',hostId:state.context.hostId})).filter(t=>/^[0-9a-f-]{36}$/i.test(t.id));
    for(const row of rows){const old=state.tabs.find(t=>t.id===row.id);if(old)Object.assign(old,row);else state.tabs.push(row);}
    state.tabs=state.tabs.slice(-80);try{localStorage.setItem(key,JSON.stringify(state.tabs));}catch{}
    return state.tabs.filter(t=>t.id!==state.context.id);
  }
  async function open(tab){
    if(state.busy||tab.id===state.context.id)return false;
    state.busy=true;state.error='';
    try{
      const result=await state.context.open(tab);
      if(result==null)throw Error('The saved chat could not be opened.');
      return true;
    }catch(e){state.error=e.message||String(e);return false;}
    finally{state.busy=false;state.schedule();}
  }
  function pick(){
    if(state.dialog){state.dialog.querySelector('input').focus();return;}
    const dialog=document.createElement('dialog');state.dialog=dialog;dialog.dataset.regularChatPicker='true';
    dialog.setAttribute('aria-labelledby','regular-chat-picker-title');
    dialog.innerHTML='<h2 id="regular-chat-picker-title">Open saved chat in a tab</h2><input type="search" aria-label="Search saved chats" placeholder="Search chats…"><div data-chat-results role="list"></div><p role="alert"></p><p data-chat-hint>Each chat opens in its own tab beside the main chat. Select an already-open chat to return to its tab.</p><button type="button" data-cancel>Cancel</button>';
    const input=dialog.querySelector('input'),list=dialog.querySelector('[data-chat-results]'),alert=dialog.querySelector('[role=alert]');
    const close=()=>{dialog.remove();state.dialog=null;};dialog.querySelector('[data-cancel]').onclick=close;
    dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    function populate(){
      list.replaceChildren();const items=chats().filter(t=>t.title.toLocaleLowerCase().includes(input.value.toLocaleLowerCase()));
      for(const tab of items){const b=document.createElement('button');b.type='button';b.textContent=tab.title;b.title=tab.title;b.dataset.chatId=tab.id;
        b.onclick=async()=>{if(state.busy)return;list.querySelectorAll('button').forEach(n=>n.disabled=true);alert.textContent='Opening…';if(await open(tab))close();else{alert.textContent=state.error;list.querySelectorAll('button').forEach(n=>n.disabled=false);}};list.append(b);}
      if(!items.length){const p=document.createElement('p');p.textContent='No matching saved chats.';list.append(p);}
    }
    input.oninput=populate;input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();list.querySelector('button')?.click();}};
    document.body.append(dialog);populate();dialog.showModal();input.focus();
  }
  function control(parent,side){
    let b=state.controls.find(b=>b.isConnected);
    for(const old of document.querySelectorAll('[data-regular-chat-open]'))if(old!==b)old.remove();
    if(!b){b=document.createElement('button');b.type='button';b.onclick=pick;}
    b.textContent='Open saved chat';b.dataset.regularChatOpen=side?'right':'main';
    b.setAttribute('aria-label','Open saved chat in a new tab');b.title=b.getAttribute('aria-label');
    b.style.cssText='';b.hidden=false;
    if(b.parentElement!==parent)parent.append(b);
    state.controls=[b];return b;
  }
  function render(){
    if(!state.context)return;
    if(!document.getElementById('regular-chat-style')){
      const s=document.createElement('style');s.id='regular-chat-style';s.textContent=`
      [data-regular-chat-open]{flex-shrink:0;align-self:center;position:relative;z-index:40;-webkit-app-region:no-drag;border:0;border-radius:7px;background:transparent;color:inherit;font:inherit;font-size:12px;padding:6px 9px;margin:0 4px;cursor:pointer;white-space:nowrap}
      [data-regular-chat-open]:hover{background:#8882}
      [data-regular-chat-open]:focus-visible{outline:2px solid #7596e8;outline-offset:-2px}
      [data-regular-chat-picker]{position:fixed;inset:0;margin:auto;color:var(--token-text-primary,#eee);background:var(--token-bg-elevated-secondary,#242424);border:1px solid #7775;border-radius:14px;padding:20px;width:440px;max-width:calc(100vw - 48px);max-height:calc(100vh - 48px);box-shadow:0 16px 70px #0008;font:inherit}
      [data-regular-chat-picker]::backdrop{background:#0006}
      [data-regular-chat-picker] h2{font-size:16px;margin:0 0 16px;font-weight:600}
      [data-regular-chat-picker] input{width:100%;box-sizing:border-box;padding:10px 12px;background:transparent;color:inherit;border:1px solid #8886;border-radius:8px;font:inherit}
      [data-chat-results]{max-height:45vh;overflow-y:auto;margin:12px 0}
      [data-regular-chat-picker] button{color:inherit;background:transparent;border:0;border-radius:7px;padding:10px 12px;text-align:left;cursor:pointer;font:inherit}
      [data-chat-results] button{display:block;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      [data-regular-chat-picker] button:hover{background:#8882}
      [data-regular-chat-picker] button:disabled{opacity:.5;cursor:wait}
      [data-chat-hint]{font-size:12px;opacity:.65;line-height:1.5}
      [data-regular-chat-picker] [role=alert]{font-size:13px;color:#e6a37c}`;document.head.append(s);
    }
    state.controls=state.controls.filter(b=>b.isConnected);
    const row=[...document.querySelectorAll('[data-app-action-sidebar-thread-active="true"]')].find(regularTabsVisible);
    const active=row?row.getAttribute('data-app-action-sidebar-thread-id')?.replace(/^local:/,'')===state.context.id:(state.context.getPath?.()??location.pathname).includes(state.context.id);
    for(const b of state.controls)b.hidden=!active;
    if(!active){state.controls.forEach(b=>b.remove());state.controls=[];return;}chats();
    const right=[...document.querySelectorAll('[data-app-shell-tab-row] [data-app-shell-focus-area="right-panel"]')].find(regularTabsVisible);
    if(right){control(right,true);return;}
    const main=[...document.querySelectorAll('[data-app-shell-main-toolbar-trailing-slot]')].find(regularTabsVisible);
    if(main)control(main,false);
    else{const surface=[...document.querySelectorAll('main[data-app-shell-main-surface],main.main-surface')].find(regularTabsVisible);if(surface)control(surface,false).style.cssText='position:absolute;top:12px;right:100px';}
  }
  const observer=new MutationObserver(records=>{if(records.some(r=>!r.target.closest?.('[data-regular-chat-picker]')&&!r.target.matches?.('[data-regular-chat-open]')))state.schedule();});
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-app-action-sidebar-thread-title','data-app-action-sidebar-thread-active','aria-hidden']});
  window.addEventListener('popstate',state.schedule);
  state.destroy=()=>{observer.disconnect();clearTimeout(state.timer);window.removeEventListener('popstate',state.schedule);state.dialog?.remove();state.controls.forEach(b=>b.remove());document.getElementById('regular-chat-style')?.remove();};
  state.open=open;state.pick=pick;return state;
}
