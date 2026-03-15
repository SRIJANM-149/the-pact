// api/pact/join.js — POST /api/pact/join
import supabase from '../../lib/supabase.js';
import { getUserFromRequest, cors, err } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return err(res, 405, 'Method not allowed.');

  let user;
  try { user = getUserFromRequest(req); }
  catch (e) { return err(res, 401, 'Not authenticated.'); }

  const uid  = user.userId;
  const code = (req.body?.inviteCode || '').trim().toUpperCase();
  if (!code) return err(res, 400, 'Invite code is required.');

  try {
    // Not already in active pact
    const { data: existing } = await supabase
      .from('pact_members').select('pact_id, pacts(status)')
      .eq('user_id', uid).eq('pacts.status', 'active').single();
    if (existing?.pacts?.status === 'active')
      return err(res, 400, 'You are already in an active pact.');

    // Find pact by code
    const { data: pact } = await supabase
      .from('pacts').select('*').eq('invite_code', code).eq('status', 'pending').single();
    if (!pact) return err(res, 404, 'Invalid code or pact is already full.');
    if (pact.creator_id === uid) return err(res, 400, "You can't join your own pact.");

    // Add joiner, activate pact
    await supabase.from('pact_members').insert({ pact_id: pact.id, user_id: uid, role: 'joiner' });
    await supabase.from('pacts').update({ joiner_id: uid, status: 'active' }).eq('id', pact.id);

    res.json({ ok: true, pactId: pact.id });
  } catch (e) {
    console.error('[join]', e.message);
    err(res, 500, 'Server error.');
  }
}