const supabase = require('../../lib/supabase');
const { getUserFromRequest, cors, err } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'PATCH') return err(res, 405, 'Method not allowed.');

  let user;
  try { user = getUserFromRequest(req); }
  catch (e) { return err(res, 401, 'Not authenticated.'); }

  const uid      = user.userId;
  const nickname = ((req.body && req.body.nickname) || '').trim();
  if (!nickname || nickname.length > 30)
    return err(res, 400, 'Nickname must be 1–30 characters.');

  try {
    const { data: memRows } = await supabase
      .from('pact_members').select('pact_id, pacts(status)').eq('user_id', uid);
    const mem = memRows && memRows.find(m => m.pacts && m.pacts.status === 'active');
    if (!mem) return err(res, 404, 'You are not in an active pact.');

    await supabase.from('pact_members')
      .update({ nickname_given: nickname })
      .eq('pact_id', mem.pact_id).eq('user_id', uid);

    res.json({ ok: true });
  } catch (e) {
    console.error('[nickname]', e.message);
    err(res, 500, 'Server error.');
  }
};