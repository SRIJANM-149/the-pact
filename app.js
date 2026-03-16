'use strict';
const BASE=window.location.origin,TK='pact_token',DK='pact_dark',POLL=12000;
const S={token:null,user:null,pact:null,role:null,_poll:null,_tab:'today'};

var $=function(id){return document.getElementById(id);};
function tx(id,v){$(id).textContent=v;}
function hm(id,v){$(id).innerHTML=v;}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function fmtD(k){return new Date(String(k).slice(0,10)+'T12:00:00Z').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});}
var _tt;
function toast(m,t,ms){t=t||'';ms=ms||2400;var e=$('toast');e.textContent=m;e.className='toast show'+(t?' '+t:'');clearTimeout(_tt);_tt=setTimeout(function(){e.className='toast';},ms);}
function serr(id,m){var e=$(id);e.textContent=m||'';e.classList.toggle('hidden',!m);}
function goScreen(id){document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');s.classList.add('hidden');});var e=$(id);e.classList.remove('hidden');e.classList.add('active');}
async function api(method,path,body){
  var h={'Content-Type':'application/json'};
  if(S.token)h['Authorization']='Bearer '+S.token;
  var r=await fetch(BASE+path,{method:method,headers:h,body:body!=null?JSON.stringify(body):undefined});
  var d=await r.json().catch(function(){return{};});
  if(!r.ok)throw new Error(d.error||'Error '+r.status);
  return d;
}

/* ── BACKGROUND ── */
var BG={
  c:null,x:null,pts:[],raf:null,
  init:function(){
    this.c=$('bg-canvas');if(!this.c)return;
    this.x=this.c.getContext('2d');
    this.resize();window.addEventListener('resize',function(){BG.resize();});
    for(var i=0;i<22;i++)this.pts.push(this.mk());
    this.draw();
  },
  resize:function(){if(!this.c)return;this.c.width=window.innerWidth;this.c.height=window.innerHeight;},
  mk:function(){
    var dark=document.body.classList.contains('dark');
    return{x:Math.random()*window.innerWidth,y:Math.random()*window.innerHeight,r:Math.random()*2.5+.8,dx:(Math.random()-.5)*.3,dy:(Math.random()-.5)*.3,o:Math.random()*.4+.05,h:dark?Math.random()*40+220:Math.random()*40+210};
  },
  draw:function(){
    if(!this.x)return;
    var w=this.c.width,h=this.c.height,dark=document.body.classList.contains('dark');
    this.x.clearRect(0,0,w,h);
    this.pts.forEach(function(p){
      p.x+=p.dx;p.y+=p.dy;
      if(p.x<-8)p.x=w+8;if(p.x>w+8)p.x=-8;
      if(p.y<-8)p.y=h+8;if(p.y>h+8)p.y=-8;
      BG.x.beginPath();BG.x.arc(p.x,p.y,p.r,0,Math.PI*2);
      BG.x.fillStyle='hsla('+p.h+',40%,'+(dark?'70%':'50%')+','+p.o+')';
      BG.x.fill();
    });
    BG.raf=requestAnimationFrame(function(){BG.draw();});
  }
};

/* ── THEME ── */
var Theme={
  init:function(){if(localStorage.getItem(DK)==='1')document.body.classList.add('dark');Theme._sync();},
  toggle:function(){document.body.classList.toggle('dark');localStorage.setItem(DK,document.body.classList.contains('dark')?'1':'0');Theme._sync();},
  _sync:function(){
    var dark=document.body.classList.contains('dark'),ic=dark?'☀️':'🌙';
    document.querySelectorAll('.thm-ic').forEach(function(e){e.textContent=ic;});
    var m=$('theme-meta');if(m)m.setAttribute('content',dark?'#0c0c0b':'#fafaf9');
  }
};

/* ── AUTH ── */
var Auth={
  tab:function(t){
    $('tab-in').classList.toggle('active',t==='login');
    $('tab-up').classList.toggle('active',t==='signup');
    $('frm-login').classList.toggle('hidden',t!=='login');
    $('frm-signup').classList.toggle('hidden',t!=='signup');
    serr('l-err','');serr('s-err','');
  },
  login:async function(){
    var e=$('l-email').value.trim(),p=$('l-pass').value;
    if(!e||!p){serr('l-err','Please fill in all fields.');return;}
    var btn=$('l-btn');btn.disabled=true;btn.textContent='Signing in…';
    try{var d=await api('POST','/api/auth/login',{email:e,password:p});Auth._save(d);await App.after();}
    catch(err){serr('l-err',err.message);btn.disabled=false;btn.textContent='Sign in';}
  },
  signup:async function(){
    var n=$('s-name').value.trim(),e=$('s-email').value.trim(),p=$('s-pass').value;
    if(!n||!e||!p){serr('s-err','Please fill in all fields.');return;}
    var btn=$('s-btn');btn.disabled=true;btn.textContent='Creating…';
    try{var d=await api('POST','/api/auth/signup',{displayName:n,email:e,password:p});Auth._save(d);await App.after();}
    catch(err){serr('s-err',err.message);btn.disabled=false;btn.textContent='Create account';}
  },
  forgot:async function(){
    var e=$('fp-email').value.trim();if(!e){serr('fp-err','Enter your email.');return;}
    var btn=$('fp-btn');btn.disabled=true;btn.textContent='Sending…';
    try{
      await api('POST','/api/auth/forgot',{email:e});serr('fp-err','');
      var ok=$('fp-ok');ok.textContent='Reset link sent — check your inbox.';ok.classList.remove('hidden');
    }catch(err){serr('fp-err',err.message);}
    finally{btn.disabled=false;btn.textContent='Send reset link';}
  },
  _save:function(d){S.token=d.token;S.user=d.user;localStorage.setItem(TK,d.token);},
  logout:function(){
    S.token=null;S.user=null;S.pact=null;localStorage.removeItem(TK);clearInterval(S._poll);
    goScreen('v-auth');Auth.tab('login');$('l-email').value='';$('l-pass').value='';toast('Signed out.');
  }
};

/* ── BOOT ── */
var App={
  init:async function(){
    Theme.init();BG.init();
    var saved=localStorage.getItem(TK);
    if(saved){
      S.token=saved;
      try{var me=await api('GET','/api/auth/me');S.user={id:me.id,email:me.email,displayName:me.displayName};await App.after();return;}
      catch(_){localStorage.removeItem(TK);}
    }
    App._fade();goScreen('v-auth');
  },
  _fade:function(){var ls=$('v-loading');ls.style.transition='opacity .4s';ls.style.opacity='0';setTimeout(function(){ls.classList.add('hidden');ls.classList.remove('active');},400);},
  after:async function(){
    try{var d=await api('GET','/api/pact');S.pact=d.pact;}catch(_){S.pact=null;}
    App._fade();
    if(!S.pact){tx('hi-name',S.user.displayName);goScreen('v-home');}
    else{S.role=S.pact.me.role;Dash.render();Dash.poll();goScreen('v-dash');}
  }
};

/* ── NAV ── */
var Nav={
  go:function(s){
    if(s==='home'){tx('hi-name',S.user&&S.user.displayName||'');goScreen('v-home');return;}
    if(s==='auth'){goScreen('v-auth');return;}
    if(s==='create'){CP.open();return;}
    if(s==='forgot'){$('fp-email').value='';serr('fp-err','');var ok=$('fp-ok');ok.textContent='';ok.classList.add('hidden');goScreen('v-forgot');return;}
    if(s==='join'){$('j-code').value='';serr('j-err','');goScreen('v-join');return;}
    if(s==='dashboard'){Dash.render();Dash.poll();goScreen('v-dash');return;}
  },
  copyCode:function(){
    var code=$('invite-code').textContent,btn=$('copy-btn');
    if(navigator.clipboard){navigator.clipboard.writeText(code).then(function(){toast('Code copied','success');});}
    else{var el=document.createElement('textarea');el.value=code;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);toast('Copied','success');}
    btn.textContent='Copied ✓';setTimeout(function(){btn.textContent='Copy code';},2000);
  }
};

/* ── CREATE ── */
var CP={
  _pts:10,
  open:function(){
    this._pts=10;tx('c-pts-v','10');$('c-pts').value='10';
    var ol=$('c-rules-ol');ol.innerHTML='';
    for(var i=1;i<=25;i++){var li=document.createElement('li');li.innerHTML='<input class="ri" id="cr-'+i+'" placeholder="Rule '+i+'…" maxlength="120"/>';ol.appendChild(li);}
    serr('c-err','');var btn=$('c-btn');btn.disabled=false;btn.textContent='Create pact →';goScreen('v-create');
  },
  adj:function(d){this._pts=Math.max(5,Math.min(100,this._pts+d));tx('c-pts-v',this._pts);$('c-pts').value=this._pts;},
  submit:async function(){
    var rules=Array.from(document.querySelectorAll('#c-rules-ol .ri')).map(function(i){return i.value.trim();}).filter(Boolean);
    if(!rules.length){serr('c-err','Add at least one rule.');return;}
    var btn=$('c-btn');btn.disabled=true;btn.textContent='Creating…';
    try{
      var d=await api('POST','/api/pact/create',{rules:rules,pointsPerRule:this._pts});
      $('invite-code').textContent=d.inviteCode;S.role='creator';
      api('GET','/api/pact').then(function(r){if(r.pact)S.pact=r.pact;}).catch(function(){});
      goScreen('v-code');
    }catch(e){serr('c-err',e.message);btn.disabled=false;btn.textContent='Create pact →';}
  }
};

/* ── JOIN ── */
var JP={
  submit:async function(){
    var code=$('j-code').value.trim().toUpperCase();
    if(code.length<4){serr('j-err','Enter a valid code.');return;}
    var btn=$('j-btn');btn.disabled=true;btn.textContent='Joining…';
    try{await api('POST','/api/pact/join',{inviteCode:code});S.role='joiner';$('n-nick').value='';serr('n-err','');goScreen('v-nick');}
    catch(e){serr('j-err',e.message);btn.disabled=false;btn.textContent='Join pact →';}
  }
};

/* ── NICKNAME ── */
var Nick={
  submit:async function(){
    var nick=$('n-nick').value.trim();if(!nick){serr('n-err','Enter a nickname.');return;}
    try{await api('PATCH','/api/pact/nickname',{nickname:nick});var d=await api('GET','/api/pact');S.pact=d.pact;S.role=S.pact.me.role;Dash.render();Dash.poll();goScreen('v-dash');}
    catch(e){serr('n-err',e.message);}
  }
};

function daysAgo(ds){if(!ds)return 0;return Math.floor((Date.now()-new Date(String(ds).slice(0,10)+'T00:00:00Z'))/86400000);}

/* ── DASHBOARD ── */
var Dash={
  _hist:{},_rc:0,

  render:function(){
    if(!S.pact)return;
    var p=S.pact;
    $('v-dash').className='screen active';

    // Nav
    tx('dn-name',p.me.name||S.user.displayName);
    var ptLbl=p.partner?('vs '+(p.partner.nickname||p.partner.name)):'Waiting for partner';
    tx('dn-meta',new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})+' · '+ptLbl);
    tx('dn-day','Day '+(daysAgo(p.createdAt)+1));

    // Waiting
    var wEl=$('dash-waiting'),cEl=$('dash-content');
    if(!p.partner){
      wEl.classList.remove('hidden');cEl.classList.add('hidden');
      hm('dash-waiting',
        '<div class="waiting-wrap">'+
          '<div class="waiting-icon">↗</div>'+
          '<div class="waiting-heading">Waiting for your partner</div>'+
          '<p class="waiting-text">Share this code. They create an account, then enter it to join your pact.</p>'+
          '<div class="waiting-code">'+esc(p.inviteCode)+'</div>'+
          '<button class="btn-primary" style="max-width:240px;margin:0 auto" onclick="Dash.copyInvite()">Copy invite code</button>'+
        '</div>'
      );
      return;
    }
    wEl.classList.add('hidden');cEl.classList.remove('hidden');

    var me=p.me,pt=p.partner,total=p.rules.length;
    var myChk=me.today.length,ptChk=pt.today.length;
    var ppr=p.pointsPerRule||10;
    var myTP=me.totalPoints+(myChk*ppr),ptTP=pt.totalPoints+(ptChk*ppr);
    var pct=total>0?Math.round(myChk/total*100):0;
    var ptPct=total>0?Math.round(ptChk/total*100):0;
    var myLead=myTP>ptTP,tied=myTP===ptTP;

    // Score
    hm('score-strip',
      '<div class="score-side">'+
        '<div class="score-label">'+esc(me.name||'You')+'</div>'+
        '<div class="score-num'+(myLead&&!tied?' leading':'')+'" id="my-score">'+myTP+'</div>'+
        '<div class="score-today">+'+myChk*ppr+' today</div>'+
      '</div>'+
      '<div class="score-mid"><div class="score-vs-label">VS</div><div class="score-divline"></div></div>'+
      '<div class="score-side" style="text-align:right">'+
        '<div class="score-label">'+esc(pt.nickname||pt.name)+'</div>'+
        '<div class="score-num'+((!myLead&&!tied)?' leading':'')+'" id="pt-score">'+ptTP+'</div>'+
        '<div class="score-today">+'+ptChk*ppr+' today</div>'+
      '</div>'
    );

    // Stats
    hm('stats-row',
      '<div class="stat-tile"><div class="st-label">Streak</div><div class="st-val amber">'+me.streak+'d</div></div>'+
      '<div class="stat-tile"><div class="st-label">Perfect days</div><div class="st-val green">'+me.perfectDays+'</div></div>'+
      '<div class="stat-tile"><div class="st-label">Pts / rule</div><div class="st-val">'+ppr+'</div></div>'
    );

    // Partner
    hm('partner-row',
      '<span class="pr-name">'+esc(pt.nickname||pt.name)+'</span>'+
      '<div class="pr-track"><div class="pr-fill'+(ptPct===100?' done':'')+'" style="width:'+ptPct+'%"></div></div>'+
      '<span class="pr-ct">'+ptChk+'/'+total+'</span>'
    );

    // Progress
    $('prog-fill').style.width=pct+'%';
    tx('rules-tally',myChk+' / '+total);

    // Rules grid
    Dash._rules(p,me,ppr);
  },

  _rules:function(p,me,ppr){
    var g=$('rules-grid');
    if(this._rc===0||g.children.length!==p.rules.length){
      g.innerHTML='';
      p.rules.forEach(function(rule,i){
        var done=me.today.includes(i);
        var div=document.createElement('div');
        div.className='rule-row'+(done?' done':'');
        div.dataset.i=i;
        div.innerHTML=
          '<div class="rule-cb"><svg class="rule-cb-svg" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3"/></svg></div>'+
          '<span class="rtxt">'+esc(rule)+'</span>';
        div.addEventListener('click',function(){Dash.tick(i,!S.pact.me.today.includes(i),div,ppr);});
        g.appendChild(div);
      });
    } else {
      Array.from(g.children).forEach(function(div){
        var i=parseInt(div.dataset.i);
        div.classList.toggle('done',me.today.includes(i));
      });
    }
    this._rc++;
  },

  tick:function(idx,checked,el,ppr){
    // Instant optimistic update
    el.classList.toggle('done',checked);
    if(checked){
      el.classList.add('ticked');
      setTimeout(function(){el.classList.remove('ticked');},250);
      var f=document.createElement('span');
      f.className='pts-float';f.textContent='+'+ppr+'pts';
      el.appendChild(f);setTimeout(function(){if(f.parentNode)f.parentNode.removeChild(f);},700);
    }

    // Update local state
    if(checked&&!S.pact.me.today.includes(idx))S.pact.me.today.push(idx);
    else if(!checked)S.pact.me.today=S.pact.me.today.filter(function(i){return i!==idx;});

    // Update progress
    var total=S.pact.rules.length,chk=S.pact.me.today.length,pct=total>0?Math.round(chk/total*100):0;
    $('prog-fill').style.width=pct+'%';
    tx('rules-tally',chk+' / '+total);

    // Update score display
    var ppr2=S.pact.pointsPerRule||10;
    var myTP=S.pact.me.totalPoints+(chk*ppr2);
    var myScoreEl=$('my-score');if(myScoreEl)myScoreEl.textContent=myTP;

    // Background API call
    api('POST','/api/pact/tick',{ruleIndex:idx,checked:checked}).catch(function(){
      el.classList.toggle('done',!checked);
      if(checked)S.pact.me.today=S.pact.me.today.filter(function(i){return i!==idx;});
      else if(!S.pact.me.today.includes(idx))S.pact.me.today.push(idx);
      var chk2=S.pact.me.today.length,pct2=S.pact.rules.length>0?Math.round(chk2/S.pact.rules.length*100):0;
      $('prog-fill').style.width=pct2+'%';tx('rules-tally',chk2+' / '+S.pact.rules.length);
      toast('Could not save — check connection','error');
    });
  },

  copyInvite:function(){
    if(!S.pact)return;
    var code=S.pact.inviteCode;
    if(navigator.clipboard){navigator.clipboard.writeText(code).then(function(){toast('Invite code copied','success');});}
    else{var el=document.createElement('textarea');el.value=code;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);toast('Copied','success');}
  },

  tab:function(t){
    S._tab=t;
    ['today','history','settings'].forEach(function(x){$('bn-'+x).classList.toggle('active',x===t);});
    $('pan-history').classList.add('hidden');$('pan-settings').classList.add('hidden');
    if(t==='history'){Dash.loadHist();$('pan-history').classList.remove('hidden');}
    if(t==='settings'){Dash.renderSet();$('pan-settings').classList.remove('hidden');}
  },

  loadHist:async function(){
    var hb=$('hist-body');hb.innerHTML='<p style="color:var(--ink3);font-size:.82rem;padding:.4rem 0">Loading…</p>';
    try{
      var d=await api('GET','/api/pact/history');Dash._hist=d.history;
      var h=d.history,keys=Object.keys(h).sort().reverse();
      var me=S.pact.me,pt=S.pact.partner,myId=me.userId,ptId=pt&&pt.userId;
      if(!keys.length){hb.innerHTML='<p style="color:var(--ink3);font-size:.82rem;padding:.4rem 0">No history yet — check back after midnight.</p>';return;}
      var html='';
      keys.forEach(function(k){
        var row=h[k];
        var m=row[myId]||{checked:0,total:25,points:0,perfect:false};
        var p2=ptId?(row[ptId]||{checked:0,total:25,points:0,perfect:false}):null;
        function badge(r){
          if(r.perfect)return '<span class="hbadge hb-p">Perfect</span>';
          if(r.checked>=r.total)return '<span class="hbadge hb-ok">Complete</span>';
          if(r.checked>=Math.ceil(r.total*.6))return '<span class="hbadge hb-ok">'+r.checked+'/'+r.total+'</span>';
          return '<span class="hbadge hb-miss">'+r.checked+'/'+r.total+'</span>';
        }
        html+='<div class="hist-entry">'+
          '<div class="hist-date">'+fmtD(k)+'</div>'+
          '<div class="hist-prow"><div class="hp-left">'+esc(me.name||'You')+' '+badge(m)+'</div><div class="hp-pts">+'+m.points+'</div></div>'+
          (p2?'<div class="hist-prow"><div class="hp-left">'+esc((pt&&(pt.nickname||pt.name))||'Partner')+' '+badge(p2)+'</div><div class="hp-pts" style="color:var(--ink3)">+'+p2.points+'</div></div>':'')+
          '</div>';
      });
      hb.innerHTML=html;
    }catch(e){hb.innerHTML='<p style="color:var(--red);font-size:.82rem">'+esc(e.message)+'</p>';}
  },

  renderSet:function(){
    var p=S.pact;$('set-nick').value=(p.partner&&p.partner.nickname)||'';
    var sec=$('rules-edit-sec');
    if(S.role==='creator'){
      sec.classList.remove('hidden');
      var ol=$('set-rules-ol');ol.innerHTML='';
      p.rules.forEach(function(r,i){var li=document.createElement('li');li.innerHTML='<input class="ri" data-i="'+i+'" value="'+esc(r)+'" maxlength="120"/>';ol.appendChild(li);});
    }else sec.classList.add('hidden');
  },

  saveNick:async function(){
    var nick=$('set-nick').value.trim();if(!nick){toast('Enter a nickname.','error');return;}
    try{await api('PATCH','/api/pact/nickname',{nickname:nick});var d=await api('GET','/api/pact');S.pact=d.pact;Dash._rc=0;Dash.render();toast('Saved','success');}
    catch(e){toast(e.message,'error');}
  },

  saveRules:async function(){
    var rules=Array.from(document.querySelectorAll('#set-rules-ol .ri')).map(function(i){return i.value.trim();}).filter(Boolean);
    if(!rules.length){toast('Need at least one rule.','error');return;}
    try{await api('PUT','/api/pact/rules',{rules:rules});var d=await api('GET','/api/pact');S.pact=d.pact;Dash._rc=0;Dash.render();toast('Rules saved','success');}
    catch(e){toast(e.message,'error');}
  },

  leave:async function(){
    if(!confirm('Leave pact?\n\nThis dissolves the pact for both people permanently.'))return;
    try{await api('DELETE','/api/pact');S.pact=null;clearInterval(S._poll);tx('hi-name',S.user.displayName);goScreen('v-home');toast('Left the pact.');}
    catch(e){toast(e.message,'error');}
  },

  poll:function(){
    clearInterval(S._poll);
    S._poll=setInterval(async function(){
      if(!S.token||!S.pact||S._tab!=='today')return;
      try{
        var d=await api('GET','/api/pact');
        if(d.pact){
          if(d.pact.partner)S.pact.partner=d.pact.partner;
          S.pact.me.totalPoints=d.pact.me.totalPoints;
          S.pact.me.streak=d.pact.me.streak;
          S.pact.me.perfectDays=d.pact.me.perfectDays;
          Dash.render();
        }
      }catch(_){}
    },POLL);
  }
};

window.addEventListener('error',function(e){
  console.error(e.message,e.lineno);
  var ls=$('v-loading');if(ls){ls.classList.add('hidden');ls.classList.remove('active');}
  var a=$('v-auth');if(a&&!a.classList.contains('active'))goScreen('v-auth');
});

document.addEventListener('DOMContentLoaded',function(){
  try{App.init();}catch(e){console.error(e);var ls=$('v-loading');if(ls){ls.classList.add('hidden');ls.classList.remove('active');}goScreen('v-auth');}
});
