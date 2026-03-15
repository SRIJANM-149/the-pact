// api/pact/create.js — POST /api/pact/create
import supabase from '../../lib/supabase.js';
import { getUserFromRequest, cors, err, makeCode } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return err(res, 405, 'Method not allowed.');

  let user;
  try { user = getUserFromRequest(req); }
  catch (e) { return err(res, 401, 'Not authenticated.'); }

  const uid = user.userId;
  const { rules, fineAmount = 100 } = req.body || {};

  if (!Array.isArray(rules) || !rules.length)
    return err(res, 400, 'Provide at least 1 rule.');

  const cleanRules = rules.map(r => String(r).trim()).filter(Boolean).slice(0, 25);
  if (!cleanRules.length) return err(res, 400, 'Rules cannot be empty.');

  try {
    // Check not already in active pact
    const { data: existing } = await supabase
      .from('pact_members').select('pact_id, pacts(status)')
      .eq('user_id', uid).eq('pacts.status', 'active').single();
    if (existing?.pacts?.status === 'active')
      return err(res, 400, 'You are already in an active pact. Leave it first.');

    // Unique code
    let code;
    for (let i = 0; i < 10; i++) {
      code = makeCode();
      const { data } = await supabase.from('pacts').select('id').eq('invite_code', code).single();
      if (!data) break;
    }

    // Create pact
    const { data: pact, error: pErr } = await supabase
      .from('pacts')
      .insert({ invite_code: code, creator_id: uid, status: 'pending', fine_amount: parseInt(fineAmount) || 100 })
      .select('id').single();
    if (pErr) throw pErr;

    // Add creator as member
    await supabase.from('pact_members').insert({ pact_id: pact.id, user_id: uid, role: 'creator' });

    // Insert rules
    const ruleRows = cleanRules.map((text, i) => ({ pact_id: pact.id, position: i + 1, text }));
    await supabase.from('rules').insert(ruleRows);

    res.status(201).json({ inviteCode: code, pactId: pact.id });
  } catch (e) {
    console.error('[create pact]', e.message);
    err(res, 500, 'Server error.');
  }
}