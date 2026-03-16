const supabase = require('../../lib/supabase');
const { getUserFromRequest, cors, err, todayKey } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return err(res, 405, 'Method not allowed.');
  let user;
  try { user = getUserFromRequest(req); } catch (e) { return err(res, 401, 'Not authenticated.'); }
  const uid = user.userId;
  const { ruleIndex, checked } = req.body || {};
  if (typeof ruleIndex !== 'number' || ruleIndex < 0) return err(res, 400, 'ruleIndex must be a non-negative number.');
  if (typeof checked !== 'boolean') return err(res, 400, 'checked must be true or false.');

  try {
    const { data: memRows } = await supabase.from('pact_members').select('pact_id, pacts(status, points_per_rule)').eq('user_id', uid);
    const mem = memRows && memRows.find(m => m.pacts && m.pacts.status === 'active');
    if (!mem) return err(res, 404, 'Not in an active pact.');
    const pactId = mem.pact_id;
    const ppr    = (mem.pacts && mem.pacts.points_per_rule) || 10;
    const today  = todayKey();

    await supabase.from('daily_records').upsert(
      { pact_id: pactId, user_id: uid, date_key: today, checked: [], points_earned: 0, perfect_day: false, archived: false },
      { onConflict: 'pact_id,user_id,date_key', ignoreDuplicates: true }
    );

    const { data: rec } = await supabase.from('daily_records').select('checked').eq('pact_id', pactId).eq('user_id', uid).eq('date_key', today).single();
    let ticked = Array.isArray(rec && rec.checked) ? [...rec.checked] : [];
    if (checked && !ticked.includes(ruleIndex)) ticked.push(ruleIndex);
    else if (!checked) ticked = ticked.filter(i => i !== ruleIndex);

    // Get total rules count to check perfect day
    const { count: totalRules } = await supabase.from('rules').select('*', { count: 'exact', head: true }).eq('pact_id', pactId);
    const points    = ticked.length * ppr;
    const isPerfect = ticked.length >= (totalRules || 25);

    await supabase.from('daily_records')
      .update({ checked: ticked, points_earned: points, perfect_day: isPerfect, updated_at: new Date().toISOString() })
      .eq('pact_id', pactId).eq('user_id', uid).eq('date_key', today);

    res.json({ ok: true, checked: ticked, points, isPerfect });
  } catch (e) { console.error('[tick]', e.message); err(res, 500, 'Server error.'); }
};
