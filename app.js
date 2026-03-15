'use strict';

/* ═══════════════════════════════════
   CONFIG
═══════════════════════════════════ */
const BASE     = window.location.origin;
const TK       = 'pact_token';
const POLL_MS  = 14000;

/* ═══════════════════════════════════
   STATE
═══════════════════════════════════ */
const S = {
  token : null,
  user  : null,   // { id, email, displayName }
  pact  : null,   // full pact object
  role  : null,   // 'creator' | 'joiner'
  theme : 'light',
  _poll : null,
  _tab  : 'today',
};

/* ═══════════════════════════════════
   UTILS
═══════════════════════════════════ */
const $  = id => document.getElementById(id);
const tx = (id,v) => $(id).textContent = v;
const hm = (id,v) => $(id).innerHTML   = v;
const esc = s => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmtDate = k =>
  new Date((k+'').slice(0,10)+'T12:00:00Z')
    .toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});

let _tt;
function toast(msg, type='', ms=2800){
  const el=$('toast');
  el.textContent=msg;
  el.className='toast show'+(type?' '+type:'');
  clearTimeout(_tt);
  _tt=setTimeout(()=>{el.className='toast';},ms);
}

function showErr(id,msg){
  const el=$(id);
  el.textContent=msg;
  el.classList.toggle('hidden',!msg);
}

function goScreen(id){
  document.querySelectorAll('.screen').forEach(function(s){
    s.classList.remove('active');
    s.classList.add('hidden');
  });
  var el = $(id);
  el.classList.remove('hidden');
  el.classList.add('active');
}

/* ═══════════════════════════════════
   API
═══════════════════════════════════ */
async function api(method, path, body){
  const h={'Content-Type':'application/json'};
  if(S.token) h['Authorization']='Bearer '+S.token;
  const res = await fetch(BASE+path,{
    method,headers:h,
    body:body!=null?JSON.stringify(body):undefined,
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||'Error '+res.status);
  return data;
}

/* ═══════════════════════════════════
   AUTH
═══════════════════════════════════ */
const Auth = {
  switchTab(t){
    $('tab-in').classList.toggle('active', t==='login');
    $('tab-up').classList.toggle('active', t==='signup');
    $('frm-login').classList.toggle('hidden',  t!=='login');
    $('frm-signup').classList.toggle('hidden', t!=='signup');
    showErr('l-err',''); showErr('s-err','');
  },

  async login(){
    const email=$('l-email').value.trim();
    const pass =$('l-pass').value;
    if(!email||!pass){showErr('l-err','Please fill in all fields.');return;}
    const btn=$('l-btn'); btn.disabled=true; btn.textContent='Signing in…';
    try{
      const d=await api('POST','/api/auth/login',{email,password:pass});
      Auth._persist(d);
      await App.afterLogin();
    }catch(e){
      showErr('l-err',e.message);
      btn.disabled=false; btn.textContent='Sign In →';
    }
  },

  async signup(){
    const name =$('s-name').value.trim();
    const email=$('s-email').value.trim();
    const pass =$('s-pass').value;
    if(!name||!email||!pass){showErr('s-err','Please fill in all fields.');return;}
    const btn=$('s-btn'); btn.disabled=true; btn.textContent='Creating…';
    try{
      const d=await api('POST','/api/auth/signup',{displayName:name,email,password:pass});
      Auth._persist(d);
      await App.afterLogin();
    }catch(e){
      showErr('s-err',e.message);
      btn.disabled=false; btn.textContent='Create Account →';
    }
  },

  _persist(d){
    S.token=d.token; S.user=d.user;
    localStorage.setItem(TK,d.token);
  },

  logout(){
    S.token=null; S.user=null; S.pact=null;
    localStorage.removeItem(TK);
    clearInterval(S._poll);
    goScreen('v-auth');
    Auth.switchTab('login');
    $('l-email').value=''; $('l-pass').value='';
    toast('Signed out.');
  },
};

/* ═══════════════════════════════════
   APP BOOT
═══════════════════════════════════ */
const App = {
  async init(){
    const saved=localStorage.getItem(TK);
    if(saved){
      S.token=saved;
      try{
        const me=await api('GET','/api/auth/me');
        S.user={id:me.id,email:me.email,displayName:me.displayName};
        await App.afterLogin();
        return;
      }catch(_){localStorage.removeItem(TK);}
    }
    App._fadeLoad();
    goScreen('v-auth');
  },

  _fadeLoad(){
    var ls = $('v-loading');
    ls.style.transition = 'opacity 0.4s';
    ls.style.opacity = '0';
    setTimeout(function(){
      ls.classList.add('hidden');
      ls.classList.remove('active');
    }, 400);
  },

  async afterLogin(){
    try{
      const d=await api('GET','/api/pact');
      S.pact=d.pact;
    }catch(_){S.pact=null;}

    App._fadeLoad();

    if(!S.pact){
      tx('hi-name',S.user.displayName);
      goScreen('v-home');
    }else{
      App._applyRole();
      Dash.render();
      Dash.startPoll();
      goScreen('v-dash');
    }
  },

  _applyRole(){
    if(!S.pact)return;
    S.role  = S.pact.me.role;           // 'creator' | 'joiner'
    S.theme = S.role==='creator' ? 'light' : 'dark';
  },
};

/* ═══════════════════════════════════
   NAV
═══════════════════════════════════ */
const Nav = {
  go(screen){
    if(screen==='home'){
      tx('hi-name',S.user?.displayName||'');
      goScreen('v-home'); return;
    }
    if(screen==='create'){ CreatePact.open(); return; }
    if(screen==='join'){
      $('j-code').value=''; showErr('j-err','');
      goScreen('v-join'); return;
    }
    if(screen==='dashboard'){ Dash.render(); Dash.startPoll(); goScreen('v-dash'); return; }
  },

  copyCode(){
    const code=$('invite-code').textContent;
    const btn=$('copy-btn');
    if(navigator.clipboard){
      navigator.clipboard.writeText(code).then(()=>toast('Code copied! 📋','success'));
    }else{
      const el=document.createElement('textarea');
      el.value=code; document.body.appendChild(el);
      el.select(); document.execCommand('copy');
      document.body.removeChild(el);
      toast('Code copied!','success');
    }
    btn.textContent='✓ Copied';
    setTimeout(()=>{btn.textContent='Copy';},2000);
  },
};

/* ═══════════════════════════════════
   CREATE PACT
═══════════════════════════════════ */
const CreatePact = {
  open(){
    const ol=$('c-rules-ol'); ol.innerHTML='';
    for(let i=1;i<=25;i++){
      const li=document.createElement('li');
      li.innerHTML=`<input class="ri field" id="cr-${i}" placeholder="Rule ${i}…" maxlength="120"/>`;
      ol.appendChild(li);
    }
    showErr('c-err','');
    const btn=$('c-btn'); btn.disabled=false; btn.textContent='Create & Get Invite Code →';
    goScreen('v-create');
  },

  async submit(){
    const rules=Array.from(document.querySelectorAll('#c-rules-ol .ri'))
      .map(i=>i.value.trim()).filter(Boolean);
    if(!rules.length){showErr('c-err','Add at least 1 rule.');return;}
    const fine=parseInt($('c-fine').value)||100;
    const btn=$('c-btn'); btn.disabled=true; btn.textContent='Creating…';
    try{
      const d=await api('POST','/api/pact/create',{rules,fineAmount:fine});
      $('invite-code').textContent=d.inviteCode;
      S.role='creator'; S.theme='light';
      // Reload pact data in background
      api('GET','/api/pact').then(r=>{S.pact=r.pact;}).catch(()=>{});
      goScreen('v-code');
    }catch(e){
      showErr('c-err',e.message);
      btn.disabled=false; btn.textContent='Create & Get Invite Code →';
    }
  },
};

/* ═══════════════════════════════════
   JOIN PACT
═══════════════════════════════════ */
const JoinPact = {
  async submit(){
    const code=$('j-code').value.trim().toUpperCase();
    if(code.length<4){showErr('j-err','Enter a valid invite code.');return;}
    const btn=$('j-btn'); btn.disabled=true; btn.textContent='Joining…';
    try{
      await api('POST','/api/pact/join',{inviteCode:code});
      S.role='joiner'; S.theme='dark';
      $('n-nick').value=''; showErr('n-err','');
      goScreen('v-nick');
    }catch(e){
      showErr('j-err',e.message);
      btn.disabled=false; btn.textContent='Join Pact →';
    }
  },
};

/* ═══════════════════════════════════
   NICKNAME
═══════════════════════════════════ */
const Nickname = {
  async submit(){
    const nick=$('n-nick').value.trim();
    if(!nick){showErr('n-err','Enter a nickname for your partner.');return;}
    try{
      await api('PATCH','/api/pact/nickname',{nickname:nick});
      const d=await api('GET','/api/pact');
      S.pact=d.pact;
      App._applyRole();
      Dash.render();
      Dash.startPoll();
      goScreen('v-dash');
    }catch(e){showErr('n-err',e.message);}
  },
};

/* ═══════════════════════════════════
   DASHBOARD
═══════════════════════════════════ */
const Dash = {
  render(){
    if(!S.pact)return;
    const {pact}=S;
    const dark=S.theme==='dark';

    // Apply theme class to dashboard screen
    $('v-dash').className='screen active t-'+S.theme;

    // Header
    const myName  = esc(pact.me.name||S.user.displayName);
    const ptLabel = pact.partner
      ? esc(pact.partner.nickname||pact.partner.name)
      : 'Waiting for partner…';

    hm('dash-hdr',dark ? `
      <div class="hdr-dark">
        <div>
          <div class="hn">${myName}<span class="hb">// dark</span></div>
          <div class="hm">${new Date().toDateString().toUpperCase()} · vs ${ptLabel}</div>
        </div>
        <button class="hdr-signout" onclick="Auth.logout()">Sign out</button>
      </div>` : `
      <div class="hdr-light">
        <div>
          <div class="hn">${myName}<span class="hb">light</span></div>
          <div class="hm">${new Date().toDateString().toUpperCase()} · vs ${ptLabel}</div>
        </div>
        <button class="hdr-signout" onclick="Auth.logout()">Sign out</button>
      </div>`
    );

    // Bottom nav bg
    const bnav=$('bnav');
    bnav.style.background = dark ? 'var(--navy)' : 'var(--ink)';
    bnav.style.borderTopColor = dark ? 'var(--navy-bdr)' : '#2e2820';

    // Stats
    const {me,partner}=pact;
    const total=pact.rules.length;
    const myChk=me.today.length;
    const pct  =total>0?Math.round(myChk/total*100):0;

    hm('dash-stats',`
      <div class="stat-card">
        <div class="s-lbl">Today</div>
        <div class="s-val">${myChk}/${total}</div>
      </div>
      <div class="stat-card">
        <div class="s-lbl">My Fines</div>
        <div class="s-val red">₹${me.owed}</div>
      </div>
      <div class="stat-card">
        <div class="s-lbl">I Earn</div>
        <div class="s-val grn">₹${partner?partner.owed:0}</div>
      </div>
      <div class="stat-card">
        <div class="s-lbl">Perfect</div>
        <div class="s-val">${me.perfect}</div>
      </div>
    `);

    // Progress
    $('prog-fill').style.width=pct+'%';
    tx('rules-ct', myChk+' / '+total);

    // Rules grid
    const grid=$('dash-rules');
    grid.innerHTML='';
    pact.rules.forEach((rule,i)=>{
      const done=me.today.includes(i);
      const div=document.createElement('div');
      div.className='rrow'+(done?' done':'');
      div.dataset.i=i;
      div.innerHTML=`<input type="checkbox" ${done?'checked':''}/>
        <span class="rtxt">${esc(rule)}</span>`;
      div.querySelector('input').addEventListener('change',e=>Dash.tick(i,e.target.checked,div));
      div.addEventListener('click',e=>{if(e.target.tagName!=='INPUT')div.querySelector('input').click();});
      grid.appendChild(div);
    });
  },

  async tick(idx,checked,el){
    el.classList.add('busy');
    try{
      const d=await api('POST','/api/pact/tick',{ruleIndex:idx,checked});
      S.pact.me.today=d.checked;
      Dash.render();
    }catch(e){
      toast('Save failed — check your connection','error');
      const cb=el.querySelector('input');
      if(cb)cb.checked=!checked;
      el.classList.remove('busy');
    }
  },

  tab(t){
    S._tab=t;
    ['today','history','settings'].forEach(x=>{
      $('bn-'+x).classList.toggle('active',x===t);
    });
    $('pan-history').classList.add('hidden');
    $('pan-settings').classList.add('hidden');
    if(t==='history'){Dash.loadHistory(); $('pan-history').classList.remove('hidden');}
    if(t==='settings'){Dash.renderSettings(); $('pan-settings').classList.remove('hidden');}
  },

  async loadHistory(){
    const hb=$('hist-body');
    hb.innerHTML='<p style="color:#aaa;font-size:.83rem;padding:.5rem 0">Loading…</p>';
    try{
      const d=await api('GET','/api/pact/history');
      const hist=d.history;
      const keys=Object.keys(hist).sort().reverse();
      const {me,partner}=S.pact;
      const myId=me.userId;
      const ptId=partner?.userId;

      if(!keys.length){
        hb.innerHTML='<p style="color:#aaa;font-size:.83rem;padding:.5rem 0">No history yet — check back after midnight.</p>';
        return;
      }

      let t=`<table class="htbl"><thead><tr>
        <th>Date</th>
        <th>${esc(me.name||'Me')}</th><th>Fine</th>
        <th>${esc(partner?.nickname||partner?.name||'Partner')}</th><th>Fine</th>
      </tr></thead><tbody>`;

      keys.forEach(k=>{
        const row=hist[k];
        const m=row[myId]||{checked:0,total:25,fineAmount:0,finePaid:false};
        const p=ptId?(row[ptId]||{checked:0,total:25,fineAmount:0,finePaid:false}):null;
        t+=`<tr>
          <td style="font-family:var(--mono);font-size:.68rem;white-space:nowrap">${fmtDate(k)}</td>
          <td>${m.checked}/${m.total} <span class="bdg ${m.fineAmount===0?'bdg-ok':'bdg-fine'}">${m.fineAmount===0?'✓':'miss'}</span></td>
          <td>${Dash._fCell(k,myId,m)}</td>
          <td>${p?`${p.checked}/${p.total} <span class="bdg ${p.fineAmount===0?'bdg-ok':'bdg-fine'}">${p.fineAmount===0?'✓':'miss'}</span>`:'—'}</td>
          <td>${p?Dash._fCell(k,ptId,p):'—'}</td>
        </tr>`;
      });
      hb.innerHTML=t+'</tbody></table>';
    }catch(e){
      hb.innerHTML=`<p style="color:var(--red);font-size:.82rem">${esc(e.message)}</p>`;
    }
  },

  _fCell(k,uid,d){
    if(d.fineAmount===0) return `<span class="bdg bdg-ok">none</span>`;
    const badge=`<span class="bdg ${d.finePaid?'bdg-paid':'bdg-fine'}">₹${d.fineAmount} ${d.finePaid?'paid':'owed'}</span>`;
    const btn=!d.finePaid?`<button class="pay-btn" onclick="Dash.pay('${k}',${uid})">Paid</button>`:'';
    return badge+btn;
  },

  async pay(k,uid){
    try{
      await api('POST','/api/pact/history',{dateKey:k,userId:uid});
      toast('Marked as paid ✓','success');
      Dash.loadHistory();
    }catch(e){toast(e.message,'error');}
  },

  renderSettings(){
    const {pact}=S;
    $('set-nick').value=pact.partner?.nickname||'';

    const rulesSection=$('rules-edit-sec');
    if(S.role==='creator'){
      rulesSection.classList.remove('hidden');
      const ol=$('set-rules-ol'); ol.innerHTML='';
      pact.rules.forEach((r,i)=>{
        const li=document.createElement('li');
        li.innerHTML=`<input class="ri field" data-i="${i}" value="${esc(r)}" maxlength="120"/>`;
        ol.appendChild(li);
      });
    }else{
      rulesSection.classList.add('hidden');
    }

    // Apply dark panel background
    const panels=document.querySelectorAll('.panel');
    panels.forEach(p=>{
      p.style.background=S.theme==='dark'?'var(--navy)':'var(--cream)';
    });
  },

  async saveNick(){
    const nick=$('set-nick').value.trim();
    if(!nick){toast('Enter a nickname.','error');return;}
    try{
      await api('PATCH','/api/pact/nickname',{nickname:nick});
      const d=await api('GET','/api/pact');
      S.pact=d.pact; Dash.render();
      toast('Nickname saved ✓','success');
    }catch(e){toast(e.message,'error');}
  },

  async saveRules(){
    const rules=Array.from(document.querySelectorAll('#set-rules-ol .ri'))
      .map(i=>i.value.trim()).filter(Boolean);
    if(!rules.length){toast('Need at least 1 rule.','error');return;}
    try{
      await api('PUT','/api/pact/rules',{rules});
      const d=await api('GET','/api/pact');
      S.pact=d.pact; Dash.render();
      toast(rules.length+' rules saved ✓','success');
    }catch(e){toast(e.message,'error');}
  },

  async leave(){
    if(!confirm('Leave pact?\n\nThis dissolves the pact for both people. Cannot be undone.'))return;
    try{
      await api('DELETE','/api/pact');
      S.pact=null; clearInterval(S._poll);
      tx('hi-name',S.user.displayName);
      goScreen('v-home');
      toast('You left the pact.','success');
    }catch(e){toast(e.message,'error');}
  },

  startPoll(){
    clearInterval(S._poll);
    S._poll=setInterval(async()=>{
      if(!S.token||!S.pact)return;
      if(S._tab!=='today')return;
      try{
        const d=await api('GET','/api/pact');
        if(d.pact){S.pact=d.pact; Dash.render();}
      }catch(_){}
    },POLL_MS);
  },
};

/* ═══════════════════════════════════
   BOOT
═══════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function(){ try{ App.init(); } catch(e){ console.error('init error:',e); document.getElementById('v-loading').style.display='none'; document.getElementById('v-auth').classList.remove('hidden'); } });

// Global error fallback
window.addEventListener('error', function(e) {
  console.error('App error:', e.message, e.filename, e.lineno);
  document.getElementById('v-loading').style.display = 'none';
  document.getElementById('v-auth').classList.remove('hidden');
});
