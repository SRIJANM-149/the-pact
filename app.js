'use strict';
const BASE=window.location.origin,TK='pact_token',DK='pact_dark';
const POLL_FAST=4000;   // partner tick sync — lightweight
const POLL_FULL=30000;  // full pact refresh — heavier
const S={token:null,user:null,pact:null,role:null,_pollFast:null,_pollFull:null,_tab:'today'};

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
  c:null,x:null,pts:[],
  init:function(){
    this.c=$('bg-canvas');if(!this.c)return;
    this.x=this.c.getContext('2d');
    this.resize();window.addEventListener('resize',function(){BG.resize();});
    for(var i=0;i<22;i++)this.pts.push(this.mk());
    this.draw();
  },
  resize:function(){if(!this.c)return;this.c.width=window.innerWidth;this.c.height=window.innerHeight;},
  mk:function(){var dark=document.body.classList.contains('dark');return{x:Math.random()*window.innerWidth,y:Math.random()*window.innerHeight,r:Math.random()*2.5+.8,dx:(Math.random()-.5)*.3,dy:(Math.random()-.5)*.3,o:Math.random()*.35+.05,h:dark?Math.random()*40+220:Math.random()*40+210};},
  draw:function(){
    if(!this.x)return;
    var w=this.c.width,h=this.c.height,dark=document.body.classList.contains('dark');
    this.x.clearRect(0,0,w,h);
    this.pts.forEach(function(p){
      p.x+=p.dx;p.y+=p.dy;
      if(p.x<-8)p.x=w+8;if(p.x>w+8)p.x=-8;
      if(p.y<-8)p.y=h+8;if(p.y>h+8)p.y=-8;
      BG.x.beginPath();BG.x.arc(p.x,p.y,p.r,0,Math.PI*2);
      BG.x.fillStyle='hsla('+p.h+',35%,'+(dark?'65%':'45%')+','+p.o+')';
      BG.x.fill();
    });
    requestAnimationFrame(function(){BG.draw();});
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
    S.token=null;S.user=null;S.pact=null;
    localStorage.removeItem(TK);
    clearInterval(S._pollFast);clearInterval(S._pollFull);
    goScreen('v-auth');Auth.tab('login');$('l-email').value='';$('l-pass').value='';
    toast('Signed out.');
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
    else{S.role=S.pact.me.role;Dash.render();Dash.startPolling();goScreen('v-dash');}
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
    if(s==='dashboard'){Dash.render();Dash.startPolling();goScreen('v-dash');return;}
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
    try{
      await api('PATCH','/api/pact/nickname',{nickname:nick});
      var d=await api('GET','/api/pact');S.pact=d.pact;S.role=S.pact.me.role;
      Dash.render();Dash.startPolling();goScreen('v-dash');
    }catch(e){serr('n-err',e.message);}
  }
};

function daysAgo(ds){if(!ds)return 0;return Math.floor((Date.now()-new Date(String(ds).slice(0,10)+'T00:00:00Z'))/86400000);}

/* ── CHARTS ── */
var Charts={
  _chart1:null,_chart2:null,

  draw:function(pact){
    if(!pact||!pact.me.history)return;
    var container=$('charts-row');
    if(!container)return;

    var dark=document.body.classList.contains('dark');
    var ink=dark?'rgba(240,239,233,.7)':'rgba(17,17,16,.6)';
    var bdr=dark?'rgba(42,42,40,1)':'rgba(232,232,228,1)';
    var myColor=dark?'rgba(240,239,233,1)':'rgba(17,17,16,1)';
    var ptColor=dark?'rgba(96,94,87,1)':'rgba(138,138,133,1)';

    var myHist=pact.me.history||[];
    var ptHist=(pact.partner&&pact.partner.history)||[];
    var ppr=pact.pointsPerRule||10;
    var totalRules=pact.rules.length;
    var maxDayPts=totalRules*ppr;
    var myTodayPts=pact.me.today.length*ppr;
    var ptTodayPts=(pact.partner&&pact.partner.today.length*ppr)||0;
    var myRemainingPts=maxDayPts-myTodayPts;

    container.innerHTML=
      '<div class="chart-card">'+
        '<div class="chart-title">Today\'s completion</div>'+
        '<canvas id="chart-pie" width="160" height="160" style="display:block;margin:0 auto"></canvas>'+
        '<div class="chart-legend" id="chart-legend"></div>'+
      '</div>'+
      '<div class="chart-card">'+
        '<div class="chart-title">Points over time</div>'+
        '<canvas id="chart-line" style="width:100%;height:160px"></canvas>'+
      '</div>';

    // PIE CHART
    Charts._drawPie($('chart-pie'), myTodayPts, myRemainingPts, ptTodayPts, maxDayPts, dark, pact);

    // LEGEND
    var myName=pact.me.nicknameFromPartner||pact.me.name||'You';
    var ptName=(pact.partner&&(pact.partner.nickname||pact.partner.name))||'Partner';
    hm('chart-legend',
      '<div class="cl-item"><span class="cl-dot" style="background:'+myColor+'"></span>'+esc(myName)+': '+myTodayPts+'pts</div>'+
      (pact.partner?'<div class="cl-item"><span class="cl-dot" style="background:'+ptColor+'"></span>'+esc(ptName)+': '+ptTodayPts+'pts</div>':'')
    );

    // LINE CHART
    Charts._drawLine($('chart-line'), myHist, ptHist, dark, myColor, ptColor, pact);
  },

  _drawPie:function(canvas, myPts, myRemaining, ptPts, maxPts, dark, pact){
    if(!canvas)return;
    var ctx=canvas.getContext('2d');
    var W=160,H=160,cx=W/2,cy=H/2,R=62,inner=38;
    ctx.clearRect(0,0,W,H);

    var dark=document.body.classList.contains('dark');
    var bgColor=dark?'#1e1e1c':'#f4f4f2';
    var myColor=dark?'rgba(240,239,233,1)':'rgba(17,17,16,.9)';
    var ptColor=dark?'rgba(96,94,87,.8)':'rgba(138,138,133,.7)';
    var emptyColor=dark?'rgba(42,42,40,1)':'rgba(232,232,228,1)';

    var total=pact.rules.length*(pact.pointsPerRule||10)*2||1;
    var slices=[
      {val:myPts, color:myColor},
      {val:ptPts, color:ptColor},
      {val:Math.max(0,total-myPts-ptPts), color:emptyColor}
    ];

    var start=-Math.PI/2;
    slices.forEach(function(sl){
      if(sl.val<=0)return;
      var angle=(sl.val/total)*Math.PI*2;
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,R,start,start+angle);
      ctx.closePath();
      ctx.fillStyle=sl.color;
      ctx.fill();
      start+=angle;
    });

    // Donut hole
    ctx.beginPath();ctx.arc(cx,cy,inner,0,Math.PI*2);
    ctx.fillStyle=bgColor;ctx.fill();

    // Center text
    var pct=total>0?Math.round((myPts+ptPts)/total*100):0;
    ctx.fillStyle=dark?'rgba(240,239,233,.9)':'rgba(17,17,16,.85)';
    ctx.font='600 18px Inter,system-ui,sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(pct+'%',cx,cy-6);
    ctx.font='400 9px Inter,system-ui,sans-serif';
    ctx.fillStyle=dark?'rgba(96,94,87,1)':'rgba(138,138,133,1)';
    ctx.fillText('combined',cx,cy+10);
  },

  _drawLine:function(canvas, myHist, ptHist, dark, myColor, ptColor, pact){
    if(!canvas)return;
    canvas.width=canvas.offsetWidth||300;
    canvas.height=160;
    var ctx=canvas.getContext('2d');
    var W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H);

    if(!myHist.length&&!ptHist.length){
      ctx.fillStyle=dark?'rgba(96,94,87,1)':'rgba(138,138,133,1)';
      ctx.font='12px Inter,system-ui,sans-serif';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('No history yet',W/2,H/2);
      return;
    }

    // Build cumulative data
    var allDates=[];
    var dateSet={};
    myHist.forEach(function(r){dateSet[r.date]=1;});
    ptHist.forEach(function(r){dateSet[r.date]=1;});
    allDates=Object.keys(dateSet).sort();
    if(!allDates.length)return;

    // Build cumulative running totals
    var myCum=0,ptCum=0,myData=[],ptData=[];
    allDates.forEach(function(d){
      var mr=myHist.find(function(r){return r.date===d;});
      var pr=ptHist.find(function(r){return r.date===d;});
      myCum+=(mr?mr.pts:0);ptCum+=(pr?pr.pts:0);
      myData.push(myCum);ptData.push(ptCum);
    });

    var maxVal=Math.max.apply(null,myData.concat(ptData))||1;
    var pad={l:12,r:12,t:12,b:24};
    var gW=W-pad.l-pad.r,gH=H-pad.t-pad.b;
    var n=allDates.length;
    var xStep=n>1?gW/(n-1):gW;

    function px(i){return pad.l+(n>1?(i/(n-1))*gW:gW/2);}
    function py(v){return pad.t+gH*(1-(v/maxVal));}

    // Grid lines
    ctx.strokeStyle=dark?'rgba(42,42,40,.8)':'rgba(232,232,228,.8)';
    ctx.lineWidth=1;
    [0,.5,1].forEach(function(f){
      var y=pad.t+gH*f;
      ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
    });

    // Draw lines
    function drawLine(data,color,dashed){
      if(data.length<1)return;
      ctx.strokeStyle=color;ctx.lineWidth=1.5;
      if(dashed){ctx.setLineDash([4,4]);}else{ctx.setLineDash([]);}
      ctx.beginPath();
      data.forEach(function(v,i){i===0?ctx.moveTo(px(i),py(v)):ctx.lineTo(px(i),py(v));});
      ctx.stroke();ctx.setLineDash([]);
      // Dots
      data.forEach(function(v,i){
        ctx.beginPath();ctx.arc(px(i),py(v),2.5,0,Math.PI*2);
        ctx.fillStyle=color;ctx.fill();
      });
    }

    drawLine(myData, myColor, false);
    if(ptHist.length) drawLine(ptData, ptColor, true);

    // X axis labels (show first, middle, last)
    ctx.fillStyle=dark?'rgba(96,94,87,1)':'rgba(138,138,133,1)';
    ctx.font='9px Inter,system-ui,sans-serif';
    ctx.textAlign='center';ctx.textBaseline='top';
    var labelIdxs=[0];
    if(n>2)labelIdxs.push(Math.floor(n/2));
    if(n>1)labelIdxs.push(n-1);
    labelIdxs.forEach(function(i){
      var d=allDates[i];
      var label=new Date(d+'T12:00:00Z').toLocaleDateString('en-IN',{day:'numeric',month:'short'});
      ctx.fillText(label,px(i),H-pad.b+6);
    });
  }
};

/* ── DASHBOARD ── */
var Dash={
  _rc:0,

  render:function(){
    if(!S.pact)return;
    var p=S.pact;
    $('v-dash').className='screen active';

    // Header — show MY real name (display_name), not nickname
    // nicknameFromPartner = what partner calls me (optional cosmetic)
    var myDisplayName = p.me.name || S.user.displayName;
    tx('dn-name', myDisplayName);
    var ptLabel = p.partner
      ? ('vs ' + (p.partner.nickname || p.partner.name))
      : 'Waiting for partner';
    tx('dn-meta', new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})+' · '+ptLabel);
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

    // Score — show MY real display name on my side
    hm('score-strip',
      '<div class="score-side">'+
        '<div class="score-label">'+esc(myDisplayName)+'</div>'+
        '<div class="score-num'+(myLead&&!tied?' leading':'')+'" id="my-score">'+myTP+'</div>'+
        '<div class="score-today">+'+myChk*ppr+' today</div>'+
      '</div>'+
      '<div class="score-mid"><div class="score-vs-label">VS</div><div class="score-divline"></div></div>'+
      '<div class="score-side" style="text-align:right">'+
        // Partner shown by the nickname I gave them (or their real name)
        '<div class="score-label">'+esc(pt.nickname||pt.name)+'</div>'+
        '<div class="score-num'+((!myLead&&!tied)?' leading':'')+'" id="pt-score">'+ptTP+'</div>'+
        '<div class="score-today">+'+ptChk*ppr+' today</div>'+
      '</div>'
    );

    hm('stats-row',
      '<div class="stat-tile"><div class="st-label">Streak</div><div class="st-val amber">'+me.streak+'d</div></div>'+
      '<div class="stat-tile"><div class="st-label">Perfect days</div><div class="st-val green">'+me.perfectDays+'</div></div>'+
      '<div class="stat-tile"><div class="st-label">Pts / rule</div><div class="st-val">'+ppr+'</div></div>'
    );

    hm('partner-row',
      '<span class="pr-name">'+esc(pt.nickname||pt.name)+'</span>'+
      '<div class="pr-track"><div class="pr-fill'+(ptPct===100?' done':'')+'" style="width:'+ptPct+'%"></div></div>'+
      '<span class="pr-ct">'+ptChk+'/'+total+'</span>'
    );

    $('prog-fill').style.width=pct+'%';
    tx('rules-tally',myChk+' / '+total);

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
    // Instant UI
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

    // Update progress immediately
    var total=S.pact.rules.length,chk=S.pact.me.today.length,pct=total>0?Math.round(chk/total*100):0;
    $('prog-fill').style.width=pct+'%';
    tx('rules-tally',chk+' / '+total);
    var ppr2=S.pact.pointsPerRule||10;
    var myTP=S.pact.me.totalPoints+(chk*ppr2);
    var myEl=$('my-score');if(myEl)myEl.textContent=myTP;

    // Background API
    api('POST','/api/pact/tick',{ruleIndex:idx,checked:checked}).catch(function(){
      el.classList.toggle('done',!checked);
      if(checked)S.pact.me.today=S.pact.me.today.filter(function(i){return i!==idx;});
      else if(!S.pact.me.today.includes(idx))S.pact.me.today.push(idx);
      var chk2=S.pact.me.today.length;
      $('prog-fill').style.width=(S.pact.rules.length>0?Math.round(chk2/S.pact.rules.length*100):0)+'%';
      tx('rules-tally',chk2+' / '+S.pact.rules.length);
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
    // Draw charts from existing pact data first (fast)
    if(S.pact) Charts.draw(S.pact);
    try{
      var d=await api('GET','/api/pact/history');
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
        var myName=me.nicknameFromPartner||me.name||'You';
        var ptName=(pt&&(pt.nickname||pt.name))||'Partner';
        html+='<div class="hist-entry">'+
          '<div class="hist-date">'+fmtD(k)+'</div>'+
          '<div class="hist-prow"><div class="hp-left">'+esc(myName)+' '+badge(m)+'</div><div class="hp-pts">+'+m.points+'</div></div>'+
          (p2?'<div class="hist-prow"><div class="hp-left">'+esc(ptName)+' '+badge(p2)+'</div><div class="hp-pts" style="color:var(--ink3)">+'+p2.points+'</div></div>':'')+
          '</div>';
      });
      hb.innerHTML=html;
    }catch(e){hb.innerHTML='<p style="color:var(--red);font-size:.82rem">'+esc(e.message)+'</p>';}
  },

  renderSet:function(){
    var p=S.pact;
    // Pre-fill with current nickname I gave to partner
    $('set-nick').value=(p.partner&&p.partner.nickname)||'';
    var sec=$('rules-edit-sec');
    if(S.role==='creator'){
      sec.classList.remove('hidden');
      var ol=$('set-rules-ol');ol.innerHTML='';
      p.rules.forEach(function(r,i){var li=document.createElement('li');li.innerHTML='<input class="ri" data-i="'+i+'" value="'+esc(r)+'" maxlength="120"/>';ol.appendChild(li);});
    }else sec.classList.add('hidden');
  },

  saveNick:async function(){
    var nick=$('set-nick').value.trim();if(!nick){toast('Enter a nickname.','error');return;}
    try{
      await api('PATCH','/api/pact/nickname',{nickname:nick});
      var d=await api('GET','/api/pact');S.pact=d.pact;Dash._rc=0;Dash.render();
      toast('Nickname saved — partner now shows as "'+nick+'"','success');
    }catch(e){toast(e.message,'error');}
  },

  saveRules:async function(){
    var rules=Array.from(document.querySelectorAll('#set-rules-ol .ri')).map(function(i){return i.value.trim();}).filter(Boolean);
    if(!rules.length){toast('Need at least one rule.','error');return;}
    try{await api('PUT','/api/pact/rules',{rules:rules});var d=await api('GET','/api/pact');S.pact=d.pact;Dash._rc=0;Dash.render();toast('Rules saved','success');}
    catch(e){toast(e.message,'error');}
  },

  leave:async function(){
    if(!confirm('Leave pact?\n\nThis dissolves the pact for both people permanently.'))return;
    try{
      await api('DELETE','/api/pact');S.pact=null;
      clearInterval(S._pollFast);clearInterval(S._pollFull);
      tx('hi-name',S.user.displayName);goScreen('v-home');
      toast('Left the pact.');
    }catch(e){toast(e.message,'error');}
  },

  startPolling:function(){
    clearInterval(S._pollFast);clearInterval(S._pollFull);

    // Fast poll — only today's ticks (lightweight, every 4 seconds)
    S._pollFast=setInterval(async function(){
      if(!S.token||!S.pact||S._tab!=='today')return;
      if(!S.pact.partner)return;
      try{
        var d=await api('GET','/api/pact?today=1');
        if(!d.today)return;
        // Only update partner's ticks — never overwrite our own
        if(d.today.partner){
          var prev=S.pact.partner.today||[];
          var next=d.today.partner;
          // Only re-render if partner data actually changed
          var changed=JSON.stringify(prev.slice().sort())!==JSON.stringify(next.slice().sort());
          if(changed){
            S.pact.partner.today=next;
            Dash._updatePartnerUI();
          }
        }
      }catch(_){}
    },POLL_FAST);

    // Full poll — refresh everything every 30 seconds
    S._pollFull=setInterval(async function(){
      if(!S.token||!S.pact)return;
      try{
        var d=await api('GET','/api/pact');
        if(d.pact){
          // Merge carefully — preserve our local today ticks
          var myToday=S.pact.me.today;
          S.pact=d.pact;
          S.pact.me.today=myToday;
          if(S._tab==='today')Dash.render();
        }
      }catch(_){}
    },POLL_FULL);
  },

  // Lightweight partner-only UI update (no full re-render)
  _updatePartnerUI:function(){
    if(!S.pact||!S.pact.partner)return;
    var pt=S.pact.partner,total=S.pact.rules.length,ppr=S.pact.pointsPerRule||10;
    var ptChk=pt.today.length;
    var ptPct=total>0?Math.round(ptChk/total*100):0;
    // Update partner bar
    var fill=document.querySelector('.pr-fill');
    if(fill){fill.style.width=ptPct+'%';fill.classList.toggle('done',ptPct===100);}
    var ct=document.querySelector('.pr-ct');if(ct)ct.textContent=ptChk+'/'+total;
    // Update partner score
    var ptTP=pt.totalPoints+(ptChk*ppr);
    var ptEl=$('pt-score');if(ptEl)ptEl.textContent=ptTP;
    // Update score-today
    var todayEls=document.querySelectorAll('.score-today');
    if(todayEls[1])todayEls[1].textContent='+'+ptChk*ppr+' today';
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
