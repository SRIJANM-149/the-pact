// api/pact/rules.js — PUT /api/pact/rules
import supabase from '../../lib/supabase.js';
import { getUserFromRequest, cors, err } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'PUT') return err(res, 405, 'Method not allowed.');

  let user;
  try { user = getUserFromRequest(req); }
  catch (e) { return err(res, 401, 'Not authenticated.'); }

  const uid   = user.userId;
  const rules = req.body?.rules;

  if (!Array.isArray(rules) || !rules.length)
    return err(res, 400, 'rules must be a non-empty array.');

  const cleaned = rules.map(r => String(r).trim()).filter(Boolean).slice(0, 25);
  if (!cleaned.length) return err(res, 400, 'At least one rule is required.');

  try {
    // Only creator can edit
    const { data: mem } = await supabase
      .from('pact_members').select('pact_id, pacts(status)')
      .eq('user_id', uid).eq('role', 'creator').single();

    if (!mem || mem.pacts?.status !== 'active')
      return err(res, 403, 'Only the pact creator can edit rules.');

    const pactId = mem.pact_id;

    await supabase.from('rules').delete().eq('pact_id', pactId);
    const rows = cleaned.map((text, i) => ({ pact_id: pactId, position: i + 1, text }));
    await supabase.from('rules').insert(rows);

    res.json({ ok: true, rules: cleaned });
  } catch (e) {
    console.error('[rules PUT]', e.message);
    err(res, 500, 'Server error.');
  }
}