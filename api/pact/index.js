// api/pact/index.js
// GET    /api/pact         → full pact load
// DELETE /api/pact         → leave pact
// PATCH  /api/pact         → update nickname
// GET    /api/pact?today=1 → lightweight fast poll
'use strict';
const supabase = require('../../lib/supabase');
const { getUserFromRequest, cors, err, todayKey } = require('../../lib/auth');

async function ensureRecord(pactId, userId, date) {
  await supabase.from('daily_records').upsert(
    { pact_id: pactId, user_id: userId, date_key: date, checked: [], points_earned: 0, perfect_day: false, archived: false },
    { onConflict: 'pact_id,user_id,date_key', ignoreDuplicates: true }
  );
  const { data } = await supabase.from('daily_records').select('*').eq('pact_id', pactId).eq('user_id', userId).eq('date_key', date).single();
  return data;
}

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  let user;
  try { user = getUserFromRequest(req); } catch (e) { return err(res, 401, 'Not authenticated.'); }
  const uid = user.userId;

  // GET ?today=1 — fast poll
  if (req.method === 'GET' && req.query && req.query.today) {
    try {
      const { data: memRows } = await supabase.from('pact_members').select('pact_id, pacts(status)').eq('user_id', uid);
      const mem = memRows && memRows.find(m => m.pacts && m.pacts.status === 'active');
      if (!mem) return res.json({ today: null });
      const pactId = mem.pact_id, today = todayKey();
      const { data: allMem } = await supabase.from('pact_members').select('user_id').eq('pact_id', pactId);
      const partnerMem = allMem && allMem.find(m => m.user_id !== uid);
      const { data: recs } = await supabase.from('daily_records').select('user_id, checked').eq('pact_id', pactId).eq('date_key', today);
      const myRec = recs && recs.find(r => r.user_id === uid);
      const ptRec = partnerMem && recs && recs.find(r => r.user_id === partnerMem.user_id);
      return res.json({ today: { me: (myRec && myRec.checked) || [], partner: (ptRec && ptRec.checked) || [] } });
    } catch (e) { return err(res, 500, 'Server error.'); }
  }

  // GET — full pact
  if (req.method === 'GET') {
    try {
      const { data: memRows } = await supabase.from('pact_members').select('*, pacts(*)').eq('user_id', uid);
      const mem = memRows && memRows.find(m => m.pacts && m.pacts.status === 'active');
      if (!mem) return res.json({ pact: null });
      const pact = mem.pacts, pactId = pact.id, today = todayKey();
      const { data: members } = await supabase.from('pact_members').select('*, users(id, display_name, email)').eq('pact_id', pactId);
      const { data: rules } = await supabase.from('rules').select('position, text').eq('pact_id', pactId).order('position');
      await ensureRecord(pactId, uid, today);
      const partner = members && members.find(m => m.user_id !== uid);
      if (partner) await ensureRecord(pactId, partner.user_id, today);
      const { data: todayRecs } = await supabase.from('daily_records').select('*').eq('pact_id', pactId).eq('date_key', today);
      const myRec = todayRecs && todayRecs.find(r => r.user_id === uid);
      const ptRec = partner && todayRecs && todayRecs.find(r => r.user_id === partner.user_id);
      const { data: myHist } = await supabase.from('daily_records').select('points_earned, perfect_day, date_key').eq('pact_id', pactId).eq('user_id', uid).eq('archived', true).order('date_key', { ascending: true });
      const { data: ptHist } = partner ? await supabase.from('daily_records').select('points_earned, perfect_day, date_key').eq('pact_id', pactId).eq('user_id', partner.user_id).eq('archived', true).order('date_key', { ascending: true }) : { data: [] };
      const myTotal = (myHist||[]).reduce((s,r)=>s+(r.points_earned||0),0);
      const ptTotal = (ptHist||[]).reduce((s,r)=>s+(r.points_earned||0),0);
      const myPerfect = (myHist||[]).filter(r=>r.perfect_day).length;
      const ptPerfect = (ptHist||[]).filter(r=>r.perfect_day).length;
      const { data: streakRecs } = await supabase.from('daily_records').select('date_key, perfect_day').eq('pact_id', pactId).eq('user_id', uid).eq('archived', true).order('date_key', {ascending:false}).limit(60);
      let streak = 0;
      for (const r of (streakRecs||[])) { if (r.perfect_day) streak++; else break; }
      const myMem = members && members.find(m => m.user_id === uid);
      const { data: myUser } = await supabase.from('users').select('display_name').eq('id', uid).single();
      const nickIGavePartner = myMem && myMem.nickname_given || '';
      const myNicknameFromPartner = partner && partner.nickname_given || '';
      return res.json({ pact: {
        id: pactId, inviteCode: pact.invite_code, pointsPerRule: pact.points_per_rule,
        createdAt: pact.created_at, creatorId: pact.creator_id,
        rules: (rules||[]).map(r=>r.text),
        me: { userId: uid, name: myUser && myUser.display_name || '', nicknameFromPartner: myNicknameFromPartner, role: myMem && myMem.role || 'creator', today: (myRec && myRec.checked) || [], totalPoints: myTotal, perfectDays: myPerfect, streak, history: (myHist||[]).map(r=>({ date: String(r.date_key).slice(0,10), pts: r.points_earned||0, perfect: r.perfect_day })) },
        partner: partner ? { userId: partner.user_id, name: partner.users && partner.users.display_name || '', nickname: nickIGavePartner, role: partner.role, today: (ptRec && ptRec.checked) || [], totalPoints: ptTotal, perfectDays: ptPerfect, history: (ptHist||[]).map(r=>({ date: String(r.date_key).slice(0,10), pts: r.points_earned||0, perfect: r.perfect_day })) } : null,
        today,
      }});
    } catch (e) { console.error('[GET pact]', e.message); return err(res, 500, 'Server error.'); }
  }

  // DELETE — leave
  if (req.method === 'DELETE') {
    try {
      const { data: memRows } = await supabase.from('pact_members').select('pact_id, pacts(status)').eq('user_id', uid);
      const mem = memRows && memRows.find(m => m.pacts && m.pacts.status === 'active');
      if (!mem) return err(res, 404, 'Not in an active pact.');
      await supabase.from('pacts').update({ status: 'dissolved' }).eq('id', mem.pact_id);
      return res.json({ ok: true });
    } catch (e) { return err(res, 500, 'Server error.'); }
  }

  // PATCH — nickname
  if (req.method === 'PATCH') {
    const nickname = ((req.body && req.body.nickname) || '').trim();
    if (!nickname || nickname.length > 30) return err(res, 400, 'Nickname must be 1–30 characters.');
    try {
      const { data: memRows } = await supabase.from('pact_members').select('pact_id, pacts(status)').eq('user_id', uid);
      const mem = memRows && memRows.find(m => m.pacts && m.pacts.status === 'active');
      if (!mem) return err(res, 404, 'Not in an active pact.');
      await supabase.from('pact_members').update({ nickname_given: nickname }).eq('pact_id', mem.pact_id).eq('user_id', uid);
      return res.json({ ok: true });
    } catch (e) { return err(res, 500, 'Server error.'); }
  }

  err(res, 405, 'Method not allowed.');
};
