const supabase = require('../../lib/supabase');
const { getUserFromRequest, cors, err } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  let user;
  try { user = getUserFromRequest(req); } catch (e) { return err(res, 401, 'Not authenticated.'); }
  const uid = user.userId;

  if (req.method === 'GET') {
    try {
      const { data: memRows } = await supabase.from('pact_members').select('pact_id, pacts(status)').eq('user_id', uid);
      const mem = memRows && memRows.find(m => m.pacts && m.pacts.status === 'active');
      if (!mem) return res.json({ history: {} });
      const pactId = mem.pact_id;
      const { count: total } = await supabase.from('rules').select('*', { count: 'exact', head: true }).eq('pact_id', pactId);
      const { data: rows } = await supabase.from('daily_records').select('user_id, date_key, checked, points_earned, perfect_day').eq('pact_id', pactId).eq('archived', true).order('date_key', { ascending: false });
      const grouped = {};
      (rows || []).forEach(r => {
        const k = String(r.date_key).slice(0, 10);
        if (!grouped[k]) grouped[k] = {};
        const checkedArr = Array.isArray(r.checked) ? r.checked : [];
        grouped[k][r.user_id] = { checked: checkedArr.length, total: total || 25, points: r.points_earned || 0, perfect: !!r.perfect_day };
      });
      res.json({ history: grouped });
    } catch (e) { err(res, 500, 'Server error.'); }
    return;
  }
  err(res, 405, 'Method not allowed.');
};
