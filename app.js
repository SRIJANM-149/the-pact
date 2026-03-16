'use strict';

const BASE    = window.location.origin;
const TK      = 'pact_token';
const DK      = 'pact_dark';
const POLL_MS = 12000;

const S = { token:null,user:null,pact:null,role:null,_poll:null,_tab:'today' };

var $ = function(id){ return document.getElementById(id); };
function tx(id,v){ $(id).textContent=v; }
function hm(id,v){ $(id).innerHTML=v; }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtDate(k){
  return new Date(String(k).slice(0,10)+'T12:00:00Z')
    .toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});
}

var _tt;
function toast(msg,type,ms){
  type=type||'';ms=ms||2500;
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

/* ══ ANIMATED BACKGROUND ══ */
var BG = {
  canvas: null, ctx: null, particles: [], raf: null,
  init: function(){
    this.canvas = $('bg-canvas');
    if(!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', BG.resize.bind(BG));
    for(var i=0;i<28;i++) this.particles.push(this.newParticle());
    this.loop();
  },
  resize: function(){
    if(!this.canvas) return;
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },
  newParticle: function(){
    var dark = document.body.classList.contains('dark');
    return {
      x: Math.random()*window.innerWidth,
      y: Math.random()*window.innerHeight,
      r: Math.random()*3+1,
      dx: (Math.random()-.5)*.35,
      dy: (Math.random()-.5)*.35,
      o: Math.random()*.5+.1,
      hue: dark ? (Math.random()*60+240) : (Math.random()*60+220),
    };
  },
  loop: function(){
    var c=this.ctx, w=this.canvas.width, h=this.canvas.height;
    var dark=document.body.classList.contains('dark');
    c.clearRect(0,0,w,h);
    this.particles.forEach(function(p){
      p.x+=p.dx; p.y+=p.dy;
      if(p.x<-10) p.x=w+10;
      if(p.x>w+10) p.x=-10;
      if(p.y<-10) p.y=h+10;
      if(p.y>h+10) p.y=-10;
      var alpha = dark ? p.o*.6 : p.o*.35;
      c.beginPath();
      c.arc(p.x,p.y,p.r,0,Math.PI*2);
      c.fillStyle='hsla('+p.hue+',70%,70%,'+alpha+')';
      c.fill();
    });
    BG.raf = requestAnimationFrame(BG.loop.bind(BG));
  },
};

/* ══ THEME ══ */
var Theme = {
  init: function(){
    if(localStorage.getItem(DK)==='1') document.body.classList.add('dark');
    Theme._sync();
  },
  toggle: function(){
    document.body.classList.toggle('dark');
    localStorage.setItem(DK, document.body.classList.contains('dark')?'1':'0');
    Theme._sync();
  },
  _sync: function(){
    var dark=document.body.classList.contains('dark');
    var icon=dark?'☀️':'🌙';
    document.querySelectorAll('.thm-ico').forEach(function(el){el.textContent=icon;});
    var meta=$('theme-meta');
    if(meta) meta.setAttribute('content', dark?'#0f0e17':'#fafafa');
  },
};

/* ══ AUTH ══ */
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
      var ok=$('fp-ok');ok.textContent='✓ Reset link sent! Check your inbox.';ok.classList.remove('hidden');
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

/* ══ APP ══ */
var App={
  init:async function(){
    Theme.init();
    BG.init();
    var saved=localStorage.getItem(TK);
    if(saved){
      S.token=saved;
      try{var me=await api('GET','/api/auth/me');S.user={id:me.id,email:me.email,displayName:me.displayName};await App.afterLogin();return;}
      catch(_){localStorage.removeItem(TK);}
    }
    App._fadeLoad();goScreen('v-auth');
  },
  _fadeLoad:function(){
    var ls=$('v-loading');ls.style.transition='opacity .4s';ls.style.opacity='0';
    setTimeout(function(){ls.classList.add('hidden');ls.classList.remove('active');},400);
  },
  afterLogin:async function(){
    try{var d=await api('GET','/api/pact');S.pact=d.pact;}catch(_){S.pact=null;}
    App._fadeLoad();
    if(!S.pact){tx('hi-name',S.user.displayName);goScreen('v-home');}
    else{S.role=S.pact.me.role;Dash.render();Dash.startPoll();goScreen('v-dash');}
  },
};

/* ══ NAV ══ */
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
    var code=$('invite-code').textContent;
    if(navigator.clipboard){navigator.clipboard.writeText(code).then(function(){toast('Invite code copied! 📋','success');});}
    else{var el=document.createElement('textarea');el.value=code;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);toast('Copied!','success');}
    var btn=document.querySelector('#v-code .btn-primary');
    if(btn){btn.textContent='✓ Copied!';setTimeout(function(){btn.textContent='📋 Copy Code';},2000);}
  },
};

/* ══ CREATE PACT ══ */
var CreatePact={
  _pts:10,
  open:function(){
    this._pts=10;tx('c-pts-display','10');$('c-pts').value='10';
    var ol=$('c-rules-ol');ol.innerHTML='';
    for(var i=1;i<=25;i++){var li=document.createElement('li');li.innerHTML='<input class="ri" id="cr-'+i+'" placeholder="Rule '+i+'…" maxlength="120"/>';ol.appendChild(li);}
    showErr('c-err','');var btn=$('c-btn');btn.disabled=false;btn.textContent='Create Pact →';goScreen('v-create');
  },
  adjPoints:function(delta){
    this._pts=Math.max(5,Math.min(100,this._pts+delta));
    tx('c-pts-display',this._pts);$('c-pts').value=this._pts;
  },
  submit:async function(){
    var rules=Array.from(document.querySelectorAll('#c-rules-ol .ri')).map(function(i){return i.value.trim();}).filter(Boolean);
    if(!rules.length){showErr('c-err','Add at least 1 rule.');return;}
    var btn=$('c-btn');btn.disabled=true;btn.textContent='Creating…';
    try{
      var d=await api('POST','/api/pact/create',{rules:rules,pointsPerRule:this._pts});
      $('invite-code').textContent=d.inviteCode;S.role='creator';
      api('GET','/api/pact').then(function(r){if(r.pact)S.pact=r.pact;}).catch(function(){});
      goScreen('v-code');
    }catch(e){showErr('c-err',e.message);btn.disabled=false;btn.textContent='Create Pact →';}
  },
};

/* ══ JOIN PACT ══ */
var JoinPact={
  submit:async function(){
    var code=$('j-code').value.trim().toUpperCase();
    if(code.length<4){showErr('j-err','Enter a valid invite code.');return;}
    var btn=$('j-btn');btn.disabled=true;btn.textContent='Joining…';
    try{await api('POST','/api/pact/join',{inviteCode:code});S.role='joiner';$('n-nick').value='';showErr('n-err','');goScreen('v-nick');}
    catch(e){showErr('j-err',e.message);btn.disabled=false;btn.textContent='Join Pact →';}
  },
};

/* ══ NICKNAME ══ */
var Nickname={
  submit:async function(){
    var nick=$('n-nick').value.trim();
    if(!nick){showErr('n-err','Enter a nickname for your partner.');return;}
    try{await api('PATCH','/api/pact/nickname',{nickname:nick});var d=await api('GET','/api/pact');S.pact=d.pact;S.role=S.pact.me.role;Dash.render();Dash.startPoll();goScreen('v-dash');}
    catch(e){showErr('n-err',e.message);}
  },
};

/* ══ HELPERS ══ */
function daysBetween(ds){
  if(!ds)return 0;
  return Math.floor((Date.now()-new Date(String(ds).slice(0,10)+'T00:00:00Z'))/86400000);
}

/* ══ DASHBOARD ══ */
var Dash={
  _history:{},
  _renderCount:0,

  render:function(){
    if(!S.pact)return;
    this._renderCount++;
    var pact=S.pact;
    $('v-dash').className='screen active';

    // Header
    tx('dh-name', pact.me.name||S.user.displayName);
    var ptLabel=pact.partner?('vs '+(pact.partner.nickname||pact.partner.name)):'No partner yet';
    tx('dh-meta', new Date().toDateString().toUpperCase()+' · '+ptLabel);
    tx('dh-day', 'Day '+(daysBetween(pact.createdAt)+1));

    // Waiting state
    var waiting=$('dash-waiting'),content=$('dash-content');
    if(!pact.partner){
      waiting.classList.remove('hidden');content.classList.add('hidden');
      hm('dash-waiting',
        '<div class="waiting-box">'+
          '<div class="waiting-pulse">⏳</div>'+
          '<h3 class="waiting-title">Waiting for your partner</h3>'+
          '<p class="waiting-sub">Share this code — they sign up, then enter it to join</p>'+
          '<div class="big-code" style="margin:1.25rem 0">'+esc(pact.inviteCode)+'</div>'+
          '<button class="btn-primary" onclick="Dash.copyInvite()">📋 Copy Invite Code</button>'+
        '</div>'
      );
      return;
    }
    waiting.classList.add('hidden');content.classList.remove('hidden');

    var me=pact.me, pt=pact.partner;
    var total=pact.rules.length, myChk=me.today.length, ptChk=pt.today.length;
    var pct=total>0?Math.round(myChk/total*100):0;
    var ptPct=total>0?Math.round(ptChk/total*100):0;
    var ppr=pact.pointsPerRule||10;
    var myTodayPts=myChk*ppr, ptTodayPts=ptChk*ppr;
    var myAllTime=me.totalPoints+myTodayPts, ptAllTime=pt.totalPoints+ptTodayPts;

    // Duel card
    var myLead=myAllTime>ptAllTime, tied=myAllTime===ptAllTime;
    hm('duel-card',
      '<div class="duel-row">'+
        '<div class="duel-player">'+
          '<div class="duel-name">'+esc(me.name||'You')+'</div>'+
          '<div class="duel-pts'+((!tied&&myLead)?' leading':'')+'">'+myAllTime+'</div>'+
          '<div class="duel-pts-label">total pts</div>'+
          '<div class="duel-today">+'+myTodayPts+' today</div>'+
        '</div>'+
        '<div class="duel-vs">'+(tied?'TIE':(myLead?'▲':'▼'))+'</div>'+
        '<div class="duel-player">'+
          '<div class="duel-name">'+esc(pt.nickname||pt.name)+'</div>'+
          '<div class="duel-pts'+((!tied&&!myLead)?' leading':'')+'">'+ptAllTime+'</div>'+
          '<div class="duel-pts-label">total pts</div>'+
          '<div class="duel-today">+'+ptTodayPts+' today</div>'+
        '</div>'+
      '</div>'
    );

    // Info chips
    hm('info-row',
      '<div class="info-chip streak">'+
        '<span>🔥</span>'+
        '<div><div class="chip-val">'+me.streak+'</div><div style="font-size:.68rem">day streak</div></div>'+
      '</div>'+
      '<div class="info-chip perfect">'+
        '<span>⭐</span>'+
        '<div><div class="chip-val">'+me.perfectDays+'</div><div style="font-size:.68rem">perfect days</div></div>'+
      '</div>'+
      '<div class="info-chip">'+
        '<span>💎</span>'+
        '<div><div class="chip-val">'+ppr+'</div><div style="font-size:.68rem">pts/rule</div></div>'+
      '</div>'
    );

    // Partner progress
    hm('partner-prog',
      '<span class="pp-name">'+esc(pt.nickname||pt.name)+'</span>'+
      '<div class="pp-track"><div class="pp-fill'+(ptPct===100?' done':'')+'" style="width:'+ptPct+'%"></div></div>'+
      '<span class="pp-ct">'+ptChk+'/'+total+'</span>'
    );

    // Progress bar
    $('prog-fill').style.width=pct+'%';
    tx('rules-ct', myChk+' / '+total);
    tx('prog-pct', pct+'%');

    // Rules — preserve existing DOM where possible for smooth feel
    Dash._renderRules(pact, me, ppr);
  },

  _renderRules:function(pact, me, ppr){
    var grid=$('dash-rules');
    // On first render build from scratch, on update only toggle classes (instant feel)
    if(this._renderCount===1 || grid.children.length !== pact.rules.length){
      grid.innerHTML='';
      pact.rules.forEach(function(rule,i){
        var done=me.today.includes(i);
        var div=document.createElement('div');
        div.className='rule-row'+(done?' done':'');
        div.dataset.i=i;
        div.innerHTML=
          '<div class="rule-check"><span class="rule-check-icon">✓</span></div>'+
          '<span class="rtxt">'+esc(rule)+'</span>';
        div.addEventListener('click',function(){Dash.tick(i,!me.today.includes(i),div,ppr);});
        grid.appendChild(div);
      });
    } else {
      // Just update classes without rebuilding — instant visual feedback
      var rows=grid.querySelectorAll('.rule-row');
      rows.forEach(function(div){
        var i=parseInt(div.dataset.i);
        var done=me.today.includes(i);
        div.classList.toggle('done', done);
      });
    }
  },

  /* INSTANT TICK — optimistic update first, API call second */
  tick:function(idx, checked, el, ppr){
    // 1. Immediate visual update (no waiting for API)
    el.classList.toggle('done', checked);
    if(checked){
      el.classList.add('just-ticked');
      setTimeout(function(){el.classList.remove('just-ticked');},400);
      // Points pop
      var pop=document.createElement('div');
      pop.className='pts-pop';
      pop.textContent='+'+ppr+'pts';
      el.appendChild(pop);
      setTimeout(function(){if(pop.parentNode)pop.parentNode.removeChild(pop);},700);
    }

    // 2. Update local state immediately
    if(checked && !S.pact.me.today.includes(idx)) S.pact.me.today.push(idx);
    else if(!checked) S.pact.me.today=S.pact.me.today.filter(function(i){return i!==idx;});

    // 3. Update progress bar and count immediately
    var total=S.pact.rules.length, myChk=S.pact.me.today.length;
    var pct=total>0?Math.round(myChk/total*100):0;
    $('prog-fill').style.width=pct+'%';
    tx('rules-ct', myChk+' / '+total);
    tx('prog-pct', pct+'%');

    // 4. Duel score update
    var ppr2=S.pact.pointsPerRule||10;
    var myTodayPts=myChk*ppr2;
    var ptChk=(S.pact.partner&&S.pact.partner.today.length)||0;
    var ptTodayPts=ptChk*ppr2;
    var myAllTime=S.pact.me.totalPoints+myTodayPts;
    var ptAllTime=(S.pact.partner&&S.pact.partner.totalPoints||0)+ptTodayPts;
    // Update duel pts displays
    var duelPts=document.querySelectorAll('.duel-pts');
    if(duelPts[0]) duelPts[0].textContent=myAllTime;
    var duelToday=document.querySelectorAll('.duel-today');
    if(duelToday[0]) duelToday[0].textContent='+'+myTodayPts+' today';

    // 5. Fire API in background — no await, no spinner
    api('POST','/api/pact/tick',{ruleIndex:idx,checked:checked}).catch(function(){
      // Rollback on failure
      if(checked) S.pact.me.today=S.pact.me.today.filter(function(i){return i!==idx;});
      else if(!S.pact.me.today.includes(idx)) S.pact.me.today.push(idx);
      el.classList.toggle('done',!checked);
      toast('Could not save — check your connection','error');
      // Re-render correct state
      var total2=S.pact.rules.length, myChk2=S.pact.me.today.length;
      var pct2=total2>0?Math.round(myChk2/total2*100):0;
      $('prog-fill').style.width=pct2+'%';
      tx('rules-ct', myChk2+' / '+total2);
    });
  },

  copyInvite:function(){
    if(!S.pact)return;
    var code=S.pact.inviteCode;
    if(navigator.clipboard){navigator.clipboard.writeText(code).then(function(){toast('Invite code copied! 📋','success');});}
    else{var el=document.createElement('textarea');el.value=code;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);toast('Copied!','success');}
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
      var me=S.pact.me,pt=S.pact.partner,myId=me.userId,ptId=pt&&pt.userId;
      if(!keys.length){hb.innerHTML='<p style="color:var(--muted);font-size:.83rem;padding:.5rem 0">No history yet — check back after midnight.</p>';return;}

      var html='';
      keys.forEach(function(k){
        var row=hist[k];
        var m=row[myId]||{checked:0,total:25,points:0,perfect:false};
        var p=ptId?(row[ptId]||{checked:0,total:25,points:0,perfect:false}):null;

        function badge(r){
          if(r.perfect) return '<span class="hist-badge hb-perfect">⭐ Perfect</span>';
          if(r.checked>=Math.ceil(r.total*0.8)) return '<span class="hist-badge hb-good">✓ '+r.checked+'/'+r.total+'</span>';
          return '<span class="hist-badge hb-miss">'+r.checked+'/'+r.total+'</span>';
        }

        html+='<div class="hist-day">'+
          '<div class="hist-date">'+fmtDate(k)+'</div>'+
          '<div class="hist-row">'+
            '<div class="hist-player">'+esc(me.name||'You')+' '+badge(m)+'</div>'+
            '<div class="hist-pts">+'+m.points+'pts</div>'+
          '</div>'+
          (p?'<div class="hist-row">'+
            '<div class="hist-player">'+esc((pt&&(pt.nickname||pt.name))||'Partner')+' '+badge(p)+'</div>'+
            '<div class="hist-pts" style="color:var(--muted)">+'+p.points+'pts</div>'+
          '</div>':'')+'</div>';
      });
      hb.innerHTML=html;
    }catch(e){hb.innerHTML='<p style="color:var(--red);font-size:.82rem">'+esc(e.message)+'</p>';}
  },

  renderSettings:function(){
    var pact=S.pact;$('set-nick').value=(pact.partner&&pact.partner.nickname)||'';
    var sec=$('rules-edit-sec');
    if(S.role==='creator'){
      sec.classList.remove('hidden');
      var ol=$('set-rules-ol');ol.innerHTML='';
      pact.rules.forEach(function(r,i){var li=document.createElement('li');li.innerHTML='<input class="ri" data-i="'+i+'" value="'+esc(r)+'" maxlength="120"/>';ol.appendChild(li);});
    }else{sec.classList.add('hidden');}
  },

  saveNick:async function(){
    var nick=$('set-nick').value.trim();if(!nick){toast('Enter a nickname.','error');return;}
    try{await api('PATCH','/api/pact/nickname',{nickname:nick});var d=await api('GET','/api/pact');S.pact=d.pact;Dash._renderCount=0;Dash.render();toast('Nickname saved ✓','success');}
    catch(e){toast(e.message,'error');}
  },

  saveRules:async function(){
    var rules=Array.from(document.querySelectorAll('#set-rules-ol .ri')).map(function(i){return i.value.trim();}).filter(Boolean);
    if(!rules.length){toast('Need at least 1 rule.','error');return;}
    try{await api('PUT','/api/pact/rules',{rules:rules});var d=await api('GET','/api/pact');S.pact=d.pact;Dash._renderCount=0;Dash.render();toast(rules.length+' rules saved ✓','success');}
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
      try{
        var d=await api('GET','/api/pact');
        if(d.pact){
          // Only update partner data — don't overwrite our own ticks
          if(d.pact.partner) S.pact.partner=d.pact.partner;
          S.pact.me.totalPoints=d.pact.me.totalPoints;
          S.pact.me.streak=d.pact.me.streak;
          S.pact.me.perfectDays=d.pact.me.perfectDays;
          Dash.render();
        }
      }catch(_){}
    },POLL_MS);
  },
};

/* ══ BOOT ══ */
window.addEventListener('error',function(e){
  console.error('App error:',e.message,e.lineno);
  var ls=$('v-loading');if(ls){ls.classList.add('hidden');ls.classList.remove('active');}
  var auth=$('v-auth');if(auth&&!auth.classList.contains('active'))goScreen('v-auth');
});

document.addEventListener('DOMContentLoaded',function(){
  try{App.init();}
  catch(e){
    console.error('Init error:',e);
    var ls=$('v-loading');if(ls){ls.classList.add('hidden');ls.classList.remove('active');}
    goScreen('v-auth');
  }
});
