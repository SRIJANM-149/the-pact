const supabase = require('../../lib/supabase');
const { getUserFromRequest, cors, err, todayKey } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return err(res, 405, 'Method not allowed.');

  let user;
  try { user = getUserFromRequest(req); }
  catch (e) { return err(res, 401, 'Not authenticated.'); }

  const uid = user.userId;
  const { ruleIndex, checked } = req.body || {};

  if (typeof ruleIndex !== 'number' || ruleIndex < 0)
    return err(res, 400, 'ruleIndex must be a non-negative number.');
  if (typeof checked !== 'boolean')
    return err(res, 400, 'checked must be true or false.');

  try {
    const { data: memRows } = await supabase
      .from('pact_members').select('pact_id, pacts(status)').eq('user_id', uid);
    const mem = memRows && memRows.find(m => m.pacts && m.pacts.status === 'active');
    if (!mem) return err(res, 404, 'Not in an active pact.');

    const pactId = mem.pact_id;
    const today  = todayKey();

    // Ensure record exists
    await supabase.from('daily_records').upsert(
      { pact_id: pactId, user_id: uid, date_key: today, checked: [], fine_amount: 0, fine_paid: false, archived: false },
      { onConflict: 'pact_id,user_id,date_key', ignoreDuplicates: true }
    );

    // Get current checked array
    const { data: rec } = await supabase.from('daily_records')
      .select('checked')
      .eq('pact_id', pactId).eq('user_id', uid).eq('date_key', today)
      .single();

    let ticked = Array.isArray(rec && rec.checked) ? [...rec.checked] : [];

    if (checked && !ticked.includes(ruleIndex)) {
      ticked.push(ruleIndex);
    } else if (!checked) {
      ticked = ticked.filter(i => i !== ruleIndex);
    }

    await supabase.from('daily_records')
      .update({ checked: ticked, updated_at: new Date().toISOString() })
      .eq('pact_id', pactId).eq('user_id', uid).eq('date_key', today);

    res.json({ ok: true, checked: ticked });
  } catch (e) {
    console.error('[tick]', e.message);
    err(res, 500, 'Server error.');
  }
};