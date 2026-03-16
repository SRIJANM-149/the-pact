'use strict';

const BASE    = window.location.origin;
const TK      = 'pact_token';
const DK      = 'pact_dark';
const POLL_MS = 14000;

const S = { token:null,user:null,pact:null,role:null,_poll:null,_tab:'today' };

var $ = function(id){ return document.getElementById(id); };
function tx(id,v){ $(id).textContent=v; }
function hm(id,v){ $(id).innerHTML=v; }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtDate(k){ return new Date(String(k).slice(0,10)+'T12:00:00Z').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); }

var _tt;
function toast(msg,type,ms){
  type=type||'';ms=ms||2800;
  var el=$('toast');el.textContent=msg;el.className='toast show'+(type?' '+type:'');
  clearTimeout(_tt);_tt=setTimeout(function(){el.className='toast';},ms);
}
function showErr(id,msg){var el=$(id);el.textContent=msg||'';el.classList.toggle('hidden',!msg);}

function goScreen(id){
  document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');s.classList.add('hidden');});
  var el=$(id);el.classList.remove('hidden');el.classList.add('active');
}

async function api(method,path,body){
  var h={'Content-Type':'application/json'};
  if(S.token) h['Authorization']='Bearer '+S.token;
  var res=await fetch(BASE+path,{method:method,headers:h,body:body!=null?JSON.stringify(body):undefined});
  var data=await res.json().catch(function(){return{};});
  if(!res.ok) throw new Error(data.error||'Error '+res.status);
  return data;
}

/* ── THEME ── */
var Theme = {
  init:function(){
    if(localStorage.getItem(DK)==='1') document.body.classList.add('dark');
    Theme._updateToggles();
  },
  toggle:function(){
    document.body.classList.toggle('dark');
    localStorage.setItem(DK, document.body.classList.contains('dark')?'1':'0');
    Theme._updateToggles();
  },
  isDark:function(){ return document.body.classList.contains('dark'); },
  _updateToggles:function(){
    var dark=Theme.isDark();
    var icon=dark?'☀️':'🌙';
    var txt=dark?'Light':'Dark';
    document.querySelectorAll('.dark-toggle').forEach(function(btn){
      var iconEl=btn.querySelector('.toggle-icon');
      var txtEl=btn.querySelector('.toggle-txt');
      if(iconEl) iconEl.textContent=icon;
      if(txtEl) txtEl.textContent=txt;
    });
    // update theme-color meta
    var meta=$('theme-meta');
    if(meta) meta.setAttribute('content', dark?'#0d1b2a':'#faf8f4');
  },
};

/* ── AUTH ── */
var Auth={
  switchTab:function(t){
    $('tab-in').classList.toggle('active',t==='login');
    $('tab-up').classList.toggle('active',t==='signup');
    $('frm-login').classList.toggle('hidden',t!=='login');
    $('frm-signup').classList.toggle('hidden',t!=='signup');
    showErr('l-err','');showErr('s-err','');
  },
  login:async function(){
    var email=$('l-email').value.trim(),pass=$('l-pass').value;
    if(!email||!pass){showErr('l-err','Please fill in all fields.');return;}
    var btn=$('l-btn');btn.disabled=true;btn.textContent='Signing in…';
    try{var d=await api('POST','/api/auth/login',{email:email,password:pass});Auth._persist(d);await App.afterLogin();}
    catch(e){showErr('l-err',e.message);btn.disabled=false;btn.textContent='Sign In →';}
  },
  signup:async function(){
    var name=$('s-name').value.trim(),email=$('s-email').value.trim(),pass=$('s-pass').value;
    if(!name||!email||!pass){showErr('s-err','Please fill in all fields.');return;}
    var btn=$('s-btn');btn.disabled=true;btn.textContent='Creating…';
    try{var d=await api('POST','/api/auth/signup',{displayName:name,email:email,password:pass});Auth._persist(d);await App.afterLogin();}
    catch(e){showErr('s-err',e.message);btn.disabled=false;btn.textContent='Create Account →';}
  },
  forgotPassword:async function(){
    var email=$('fp-email').value.trim();
    if(!email){showErr('fp-err','Enter your email.');return;}
    var btn=$('fp-btn');btn.disabled=true;btn.textContent='Sending…';
    try{
      await api('POST','/api/auth/forgot',{email:email});
      showErr('fp-err','');
      var ok=$('fp-ok');ok.textContent='Reset link sent! Check your email.';ok.classList.remove('hidden');
    }catch(e){showErr('fp-err',e.message);}
    finally{btn.disabled=false;btn.textContent='Send Reset Link →';}
  },
  _persist:function(d){S.token=d.token;S.user=d.user;localStorage.setItem(TK,d.token);},
  logout:function(){
    S.token=null;S.user=null;S.pact=null;localStorage.removeItem(TK);clearInterval(S._poll);
    goScreen('v-auth');Auth.switchTab('login');$('l-email').value='';$('l-pass').value='';
    toast('Signed out.');
  },
};

/* ── APP BOOT ── */
var App={
  init:async function(){
    Theme.init();
    var saved=localStorage.getItem(TK);
    if(saved){
      S.token=saved;
      try{var me=await api('GET','/api/auth/me');S.user={id:me.id,email:me.email,displayName:me.displayName};await App.afterLogin();return;}
      catch(_){localStorage.removeItem(TK);}
    }
    App._fadeLoad();goScreen('v-auth');
  },
  _fadeLoad:function(){
    var ls=$('v-loading');ls.style.transition='opacity 0.4s';ls.style.opacity='0';
    setTimeout(function(){ls.classList.add('hidden');ls.classList.remove('active');},400);
  },
  afterLogin:async function(){
    try{var d=await api('GET','/api/pact');S.pact=d.pact;}catch(_){S.pact=null;}
    App._fadeLoad();
    if(!S.pact){tx('hi-name',S.user.displayName);goScreen('v-home');}
    else{S.role=S.pact.me.role;Dash.render();Dash.startPoll();goScreen('v-dash');}
  },
};

/* ── NAV ── */
var Nav={
  go:function(screen){
    if(screen==='home'){tx('hi-name',S.user&&S.user.displayName||'');goScreen('v-home');return;}
    if(screen==='auth'){goScreen('v-auth');return;}
    if(screen==='create'){CreatePact.open();return;}
    if(screen==='forgot'){$('fp-email').value='';showErr('fp-err','');var ok=$('fp-ok');ok.textContent='';ok.classList.add('hidden');goScreen('v-forgot');return;}
    if(screen==='join'){$('j-code').value='';showErr('j-err','');goScreen('v-join');return;}
    if(screen==='dashboard'){Dash.render();Dash.startPoll();goScreen('v-dash');return;}
  },
  copyCode:function(){
    var code=$('invite-code').textContent,btn=$('copy-btn');
    if(navigator.clipboard){navigator.clipboard.writeText(code).then(function(){toast('Code copied! 📋','success');});}
    else{var el=document.createElement('textarea');el.value=code;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);toast('Code copied!','success');}
    btn.textContent='✓ Copied';setTimeout(function(){btn.textContent='Copy';},2000);
  },
};

/* ── CREATE PACT ── */
var CreatePact={
  open:function(){
    var ol=$('c-rules-ol');ol.innerHTML='';
    for(var i=1;i<=25;i++){var li=document.createElement('li');li.innerHTML='<input class="ri field" id="cr-'+i+'" placeholder="Rule '+i+'…" maxlength="120"/>';ol.appendChild(li);}
    showErr('c-err','');var btn=$('c-btn');btn.disabled=false;btn.textContent='Create & Get Invite Code →';goScreen('v-create');
  },
  submit:async function(){
    var rules=Array.from(document.querySelectorAll('#c-rules-ol .ri')).map(function(i){return i.value.trim();}).filter(Boolean);
    if(!rules.length){showErr('c-err','Add at least 1 rule.');return;}
    var fine=parseInt($('c-fine').value)||100;
    var btn=$('c-btn');btn.disabled=true;btn.textContent='Creating…';
    try{
      var d=await api('POST','/api/pact/create',{rules:rules,fineAmount:fine});
      $('invite-code').textContent=d.inviteCode;S.role='creator';
      api('GET','/api/pact').then(function(r){if(r.pact)S.pact=r.pact;}).catch(function(){});
      goScreen('v-code');
    }catch(e){showErr('c-err',e.message);btn.disabled=false;btn.textContent='Create & Get Invite Code →';}
  },
};

/* ── JOIN PACT ── */
var JoinPact={
  submit:async function(){
    var code=$('j-code').value.trim().toUpperCase();
    if(code.length<4){showErr('j-err','Enter a valid invite code.');return;}
    var btn=$('j-btn');btn.disabled=true;btn.textContent='Joining…';
    try{await api('POST','/api/pact/join',{inviteCode:code});S.role='joiner';$('n-nick').value='';showErr('n-err','');goScreen('v-nick');}
    catch(e){showErr('j-err',e.message);btn.disabled=false;btn.textContent='Join Pact →';}
  },
};

/* ── NICKNAME ── */
var Nickname={
  submit:async function(){
    var nick=$('n-nick').value.trim();
    if(!nick){showErr('n-err','Enter a nickname for your partner.');return;}
    try{await api('PATCH','/api/pact/nickname',{nickname:nick});var d=await api('GET','/api/pact');S.pact=d.pact;S.role=S.pact.me.role;Dash.render();Dash.startPoll();goScreen('v-dash');}
    catch(e){showErr('n-err',e.message);}
  },
};

function daysBetween(dateStr){
  if(!dateStr)return 0;
  return Math.floor((Date.now()-new Date(String(dateStr).slice(0,10)+'T00:00:00Z'))/(86400000));
}
function calcStreak(history,userId){
  var keys=Object.keys(history).sort().reverse(),streak=0;
  for(var i=0;i<keys.length;i++){var day=history[keys[i]];if(day[userId]&&day[userId].fineAmount===0)streak++;else break;}
  return streak;
}

/* ── DASHBOARD ── */
var Dash={
  _history:{},

  render:function(){
    if(!S.pact)return;
    var pact=S.pact;
    $('v-dash').className='screen active';

    // Header
    tx('dh-name', pact.me.name||S.user.displayName);
    var ptLabel=pact.partner?('vs '+(pact.partner.nickname||pact.partner.name)):'Waiting for partner…';
    tx('dh-meta', new Date().toDateString().toUpperCase()+' · '+ptLabel);
    tx('dh-age', 'Day '+(daysBetween(pact.createdAt)+1));

    // Waiting state
    var waiting=$('dash-waiting'),content=$('dash-content');
    if(!pact.partner){
      waiting.classList.remove('hidden');content.classList.add('hidden');
      hm('dash-waiting',
        '<div class="waiting-card">'+
          '<div class="waiting-ico">⏳</div>'+
          '<div class="waiting-ttl">Waiting for your partner</div>'+
          '<p class="waiting-sub">Share this code with them. They sign up, then enter it to join your pact.</p>'+
          '<div class="waiting-code">'+esc(pact.inviteCode)+'</div><br>'+
          '<button class="waiting-copy" onclick="Dash.copyInvite()">Copy Invite Code</button>'+
        '</div>'
      );
      return;
    }
    waiting.classList.add('hidden');content.classList.remove('hidden');

    var me=pact.me,partner=pact.partner;
    var total=pact.rules.length,myChk=me.today.length,ptChk=partner.today.length;
    var pct=total>0?Math.round(myChk/total*100):0;
    var ptPct=total>0?Math.round(ptChk/total*100):0;
    var streak=calcStreak(Dash._history,me.userId);

    hm('dash-stats',
      '<div class="stat-card"><div class="s-lbl">Today</div><div class="s-val">'+myChk+'/'+total+'</div></div>'+
      '<div class="stat-card"><div class="s-lbl">My Fines</div><div class="s-val red">₹'+me.owed+'</div></div>'+
      '<div class="stat-card"><div class="s-lbl">I Earn</div><div class="s-val grn">₹'+partner.owed+'</div></div>'+
      '<div class="stat-card"><div class="s-lbl">Perfect</div><div class="s-val">'+me.perfect+'</div></div>'
    );
    hm('dash-info-bar',
      '<div class="fine-bar">'+
        '<span>Fine per missed day: <strong>₹'+pact.fineAmount+'</strong></span>'+
        (streak>0?'<span class="streak-badge">🔥 '+streak+' day streak</span>':'<span class="streak-badge">⭐ '+me.perfect+' perfect days</span>')+
      '</div>'
    );
    hm('dash-partner-bar',
      '<div class="partner-bar">'+
        '<span class="pb-name">'+esc(partner.nickname||partner.name)+'</span>'+
        '<div class="pb-track"><div class="pb-fill'+(ptPct===100?' done':'')+'" style="width:'+ptPct+'%"></div></div>'+
        '<span class="pb-ct">'+ptChk+'/'+total+'</span>'+
      '</div>'
    );
    $('prog-fill').style.width=pct+'%';
    tx('rules-ct',myChk+' / '+total);

    var grid=$('dash-rules');grid.innerHTML='';
    pact.rules.forEach(function(rule,i){
      var done=me.today.includes(i);
      var div=document.createElement('div');
      div.className='rrow'+(done?' done':'');
      div.innerHTML='<input type="checkbox" '+(done?'checked':'')+'/>'+
        '<span class="rtxt">'+esc(rule)+'</span>';
      div.querySelector('input').addEventListener('change',function(e){Dash.tick(i,e.target.checked,div);});
      div.addEventListener('click',function(e){if(e.target.tagName!=='INPUT')div.querySelector('input').click();});
      grid.appendChild(div);
    });
  },

  copyInvite:function(){
    if(!S.pact)return;
    var code=S.pact.inviteCode;
    if(navigator.clipboard){navigator.clipboard.writeText(code).then(function(){toast('Invite code copied! 📋','success');});}
    else{var el=document.createElement('textarea');el.value=code;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);toast('Code copied!','success');}
  },

  tick:async function(idx,checked,el){
    el.classList.add('busy');
    try{var d=await api('POST','/api/pact/tick',{ruleIndex:idx,checked:checked});S.pact.me.today=d.checked;Dash.render();}
    catch(e){toast('Save failed — check your connection','error');var cb=el.querySelector('input');if(cb)cb.checked=!checked;el.classList.remove('busy');}
  },

  tab:function(t){
    S._tab=t;
    ['today','history','settings'].forEach(function(x){$('bn-'+x).classList.toggle('active',x===t);});
    $('pan-history').classList.add('hidden');$('pan-settings').classList.add('hidden');
    if(t==='history'){Dash.loadHistory();$('pan-history').classList.remove('hidden');}
    if(t==='settings'){Dash.renderSettings();$('pan-settings').classList.remove('hidden');}
  },

  loadHistory:async function(){
    var hb=$('hist-body');hb.innerHTML='<p style="color:var(--muted);font-size:.83rem;padding:.5rem 0">Loading…</p>';
    try{
      var d=await api('GET','/api/pact/history');Dash._history=d.history;
      var hist=d.history,keys=Object.keys(hist).sort().reverse();
      var me=S.pact.me,partner=S.pact.partner,myId=me.userId,ptId=partner&&partner.userId;
      if(!keys.length){hb.innerHTML='<p style="color:var(--muted);font-size:.83rem;padding:.5rem 0">No history yet — check back after midnight.</p>';return;}
      var t='<table class="htbl"><thead><tr><th>Date</th><th>'+esc(me.name||'Me')+'</th><th>Fine</th><th>'+esc((partner&&(partner.nickname||partner.name))||'Partner')+'</th><th>Fine</th></tr></thead><tbody>';
      keys.forEach(function(k){
        var row=hist[k],m=row[myId]||{checked:0,total:25,fineAmount:0,finePaid:false},p=ptId?(row[ptId]||{checked:0,total:25,fineAmount:0,finePaid:false}):null;
        t+='<tr><td style="font-family:var(--mono);font-size:.68rem;white-space:nowrap">'+fmtDate(k)+'</td>'+
          '<td>'+m.checked+'/'+m.total+' <span class="bdg '+(m.fineAmount===0?'bdg-ok':'bdg-fine')+'">'+(m.fineAmount===0?'✓':'miss')+'</span></td>'+
          '<td>'+Dash._fCell(k,myId,m)+'</td>'+
          '<td>'+(p?p.checked+'/'+p.total+' <span class="bdg '+(p.fineAmount===0?'bdg-ok':'bdg-fine')+'">'+(p.fineAmount===0?'✓':'miss')+'</span>':'—')+'</td>'+
          '<td>'+(p?Dash._fCell(k,ptId,p):'—')+'</td></tr>';
      });
      hb.innerHTML=t+'</tbody></table>';
    }catch(e){hb.innerHTML='<p style="color:var(--red);font-size:.82rem">'+esc(e.message)+'</p>';}
  },

  _fCell:function(k,uid,d){
    if(d.fineAmount===0)return '<span class="bdg bdg-ok">none</span>';
    var badge='<span class="bdg '+(d.finePaid?'bdg-paid':'bdg-fine')+'">₹'+d.fineAmount+' '+(d.finePaid?'paid':'owed')+'</span>';
    var btn=!d.finePaid?'<button class="pay-btn" onclick="Dash.pay(\''+k+'\','+uid+')">Paid</button>':'';
    return badge+btn;
  },

  pay:async function(k,uid){
    try{await api('POST','/api/pact/history',{dateKey:k,userId:uid});toast('Marked as paid ✓','success');Dash.loadHistory();}
    catch(e){toast(e.message,'error');}
  },

  renderSettings:function(){
    var pact=S.pact;$('set-nick').value=(pact.partner&&pact.partner.nickname)||'';
    var sec=$('rules-edit-sec');
    if(S.role==='creator'){
      sec.classList.remove('hidden');
      var ol=$('set-rules-ol');ol.innerHTML='';
      pact.rules.forEach(function(r,i){var li=document.createElement('li');li.innerHTML='<input class="ri field" data-i="'+i+'" value="'+esc(r)+'" maxlength="120"/>';ol.appendChild(li);});
    }else{sec.classList.add('hidden');}
  },

  saveNick:async function(){
    var nick=$('set-nick').value.trim();if(!nick){toast('Enter a nickname.','error');return;}
    try{await api('PATCH','/api/pact/nickname',{nickname:nick});var d=await api('GET','/api/pact');S.pact=d.pact;Dash.render();toast('Nickname saved ✓','success');}
    catch(e){toast(e.message,'error');}
  },

  saveRules:async function(){
    var rules=Array.from(document.querySelectorAll('#set-rules-ol .ri')).map(function(i){return i.value.trim();}).filter(Boolean);
    if(!rules.length){toast('Need at least 1 rule.','error');return;}
    try{await api('PUT','/api/pact/rules',{rules:rules});var d=await api('GET','/api/pact');S.pact=d.pact;Dash.render();toast(rules.length+' rules saved ✓','success');}
    catch(e){toast(e.message,'error');}
  },

  leave:async function(){
    if(!confirm('Leave pact?\n\nThis dissolves the pact for both people. Cannot be undone.'))return;
    try{await api('DELETE','/api/pact');S.pact=null;clearInterval(S._poll);tx('hi-name',S.user.displayName);goScreen('v-home');toast('You left the pact.','success');}
    catch(e){toast(e.message,'error');}
  },

  startPoll:function(){
    clearInterval(S._poll);
    S._poll=setInterval(async function(){
      if(!S.token||!S.pact||S._tab!=='today')return;
      try{var d=await api('GET','/api/pact');if(d.pact){S.pact=d.pact;Dash.render();}}catch(_){}
    },POLL_MS);
  },
};

window.addEventListener('error',function(e){
  console.error('App error:',e.message,e.lineno);
  var ls=$('v-loading');if(ls){ls.classList.add('hidden');ls.classList.remove('active');}
  var auth=$('v-auth');if(auth&&!auth.classList.contains('active'))goScreen('v-auth');
});

document.addEventListener('DOMContentLoaded',function(){
  try{App.init();}
  catch(e){console.error('Init error:',e);var ls=$('v-loading');if(ls){ls.classList.add('hidden');ls.classList.remove('active');}goScreen('v-auth');}
});
