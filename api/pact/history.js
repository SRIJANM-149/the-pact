// api/pact/history.js
import supabase from '../../lib/supabase.js';
import { getUserFromRequest, cors, err } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  let user;
  try { user = getUserFromRequest(req); }
  catch (e) { return err(res, 401, 'Not authenticated.'); }

  const uid = user.userId;

  // ── GET ──────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { data: mem } = await supabase
        .from('pact_members').select('pact_id, pacts(status)')
        .eq('user_id', uid).single();

      if (!mem || mem.pacts?.status !== 'active')
        return res.json({ history: {} });

      const pactId = mem.pact_id;

      const { count: total } = await supabase
        .from('rules').select('*', { count: 'exact', head: true }).eq('pact_id', pactId);

      const { data: rows } = await supabase
        .from('daily_records')
        .select('user_id, date_key, checked, fine_amount, fine_paid')
        .eq('pact_id', pactId)
        .eq('archived', true)
        .order('date_key', { ascending: false });

      const grouped = {};
      (rows || []).forEach(r => {
        const k = typeof r.date_key === 'string' ? r.date_key.slice(0, 10) : new Date(r.date_key).toISOString().slice(0, 10);
        if (!grouped[k]) grouped[k] = {};
        const checkedArr = Array.isArray(r.checked) ? r.checked : [];
        grouped[k][r.user_id] = {
          checked:    checkedArr.length,
          total:      total || 25,
          fineAmount: r.fine_amount,
          finePaid:   !!r.fine_paid,
        };
      });

      res.json({ history: grouped });
    } catch (e) {
      console.error('[history GET]', e.message);
      err(res, 500, 'Server error.');
    }
    return;
  }

  // ── POST: mark paid ───────────────────────────────
  if (req.method === 'POST') {
    const { dateKey, userId } = req.body || {};
    if (!dateKey || !userId) return err(res, 400, 'dateKey and userId required.');

    try {
      const { data: mem } = await supabase
        .from('pact_members').select('pact_id')
        .eq('user_id', uid).single();
      if (!mem) return err(res, 404, 'Not in a pact.');

      await supabase.from('daily_records')
        .update({ fine_paid: true, updated_at: new Date().toISOString() })
        .eq('pact_id', mem.pact_id)
        .eq('user_id', userId)
        .eq('date_key', dateKey)
        .eq('archived', true);

      res.json({ ok: true });
    } catch (e) {
      console.error('[history POST]', e.message);
      err(res, 500, 'Server error.');
    }
    return;
  }

  err(res, 405, 'Method not allowed.');
}
