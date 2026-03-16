const supabase = require('../../lib/supabase');
const { getUserFromRequest, cors, err, todayKey } = require('../../lib/auth');

async function ensureRecord(pactId, userId, date) {
  await supabase.from('daily_records').upsert(
    { pact_id: pactId, user_id: userId, date_key: date, checked: [], points_earned: 0, perfect_day: false, archived: false },
    { onConflict: 'pact_id,user_id,date_key', ignoreDuplicates: true }
  );
  const { data } = await supabase.from('daily_records')
    .select('*').eq('pact_id', pactId).eq('user_id', userId).eq('date_key', date).single();
  return data;
}

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  let user;
  try { user = getUserFromRequest(req); } catch (e) { return err(res, 401, 'Not authenticated.'); }
  const uid = user.userId;

  if (req.method === 'GET') {
    try {
      const { data: memRows } = await supabase.from('pact_members').select('*, pacts(*)').eq('user_id', uid);
      const mem = memRows && memRows.find(m => m.pacts && m.pacts.status === 'active');
      if (!mem) return res.json({ pact: null });
      const pact = mem.pacts, pactId = pact.id, today = todayKey();

      const { data: members } = await supabase.from('pact_members').select('*, users(id, display_name, email)').eq('pact_id', pactId);
      const { data: rules }   = await supabase.from('rules').select('position, text').eq('pact_id', pactId).order('position');

      await ensureRecord(pactId, uid, today);
      const partner = members && members.find(m => m.user_id !== uid);
      if (partner) await ensureRecord(pactId, partner.user_id, today);

      const { data: todayRecs } = await supabase.from('daily_records').select('*').eq('pact_id', pactId).eq('date_key', today);
      const myRec = todayRecs && todayRecs.find(r => r.user_id === uid);
      const ptRec = partner && todayRecs && todayRecs.find(r => r.user_id === partner.user_id);

      const { data: myHist } = await supabase.from('daily_records').select('points_earned, perfect_day').eq('pact_id', pactId).eq('user_id', uid).eq('archived', true);
      const { data: ptHist } = partner ? await supabase.from('daily_records').select('points_earned, perfect_day').eq('pact_id', pactId).eq('user_id', partner.user_id).eq('archived', true) : { data: [] };

      const myTotal   = (myHist||[]).reduce((s,r)=>s+(r.points_earned||0),0);
      const ptTotal   = (ptHist||[]).reduce((s,r)=>s+(r.points_earned||0),0);
      const myPerfect = (myHist||[]).filter(r=>r.perfect_day).length;
      const ptPerfect = (ptHist||[]).filter(r=>r.perfect_day).length;

      const { data: streakRecs } = await supabase.from('daily_records').select('date_key, perfect_day').eq('pact_id', pactId).eq('user_id', uid).eq('archived', true).order('date_key', {ascending:false}).limit(60);
      let streak = 0;
      for (const r of (streakRecs||[])) { if (r.perfect_day) streak++; else break; }

      const myMem = members && members.find(m => m.user_id === uid);
      const { data: myUser } = await supabase.from('users').select('display_name').eq('id', uid).single();

      res.json({ pact: {
        id: pactId, inviteCode: pact.invite_code, pointsPerRule: pact.points_per_rule,
        createdAt: pact.created_at, creatorId: pact.creator_id,
        rules: (rules||[]).map(r=>r.text),
        me: { userId:uid, name:myUser&&myUser.display_name||'', role:myMem&&myMem.role||'creator', nickname:myMem&&myMem.nickname_given||'', today:(myRec&&myRec.checked)||[], totalPoints:myTotal, perfectDays:myPerfect, streak },
        partner: partner ? { userId:partner.user_id, name:partner.users&&partner.users.display_name||'', role:partner.role, nickname:partner.nickname_given||'', today:(ptRec&&ptRec.checked)||[], totalPoints:ptTotal, perfectDays:ptPerfect } : null,
        today,
      }});
    } catch (e) { console.error('[GET /api/pact]', e.message); err(res, 500, 'Server error.'); }
    return;
  }

  if (req.method === 'DELETE') {
    try {
      const { data: memRows } = await supabase.from('pact_members').select('pact_id, pacts(status)').eq('user_id', uid);
      const mem = memRows && memRows.find(m => m.pacts && m.pacts.status === 'active');
      if (!mem) return err(res, 404, 'Not in an active pact.');
      await supabase.from('pacts').update({ status: 'dissolved' }).eq('id', mem.pact_id);
      res.json({ ok: true });
    } catch (e) { err(res, 500, 'Server error.'); }
    return;
  }

  err(res, 405, 'Method not allowed.');
};
