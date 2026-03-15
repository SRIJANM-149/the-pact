// api/pact/index.js  — GET /api/pact  |  DELETE /api/pact
import supabase from '../../lib/supabase.js';
import { getUserFromRequest, cors, err, todayKey } from '../../lib/auth.js';

async function ensureRecord(pactId, userId, date) {
  await supabase.from('daily_records').upsert(
    { pact_id: pactId, user_id: userId, date_key: date, checked: [], fine_amount: 0, fine_paid: false, archived: false },
    { onConflict: 'pact_id,user_id,date_key', ignoreDuplicates: true }
  );
  const { data } = await supabase.from('daily_records')
    .select('*').eq('pact_id', pactId).eq('user_id', userId).eq('date_key', date).single();
  return data;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  let user;
  try { user = getUserFromRequest(req); }
  catch (e) { return err(res, 401, 'Not authenticated.'); }

  const uid = user.userId;

  // ── GET ────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      // Find membership in active pact
      const { data: mem } = await supabase
        .from('pact_members')
        .select('*, pacts(*)')
        .eq('user_id', uid)
        .eq('pacts.status', 'active')
        .not('pacts', 'is', null)
        .single();

      if (!mem || !mem.pacts) return res.json({ pact: null });

      const pact   = mem.pacts;
      const pactId = pact.id;
      const today  = todayKey();

      // All members with user info
      const { data: members } = await supabase
        .from('pact_members')
        .select('*, users(id, display_name, email)')
        .eq('pact_id', pactId);

      // Rules
      const { data: rules } = await supabase
        .from('rules').select('position, text')
        .eq('pact_id', pactId).order('position');

      // Ensure today records
      await ensureRecord(pactId, uid, today);
      const partner = members?.find(m => m.user_id !== uid);
      if (partner) await ensureRecord(pactId, partner.user_id, today);

      // Today records
      const { data: todayRecs } = await supabase
        .from('daily_records').select('*')
        .eq('pact_id', pactId).eq('date_key', today);

      const myRec = todayRecs?.find(r => r.user_id === uid);
      const ptRec = partner ? todayRecs?.find(r => r.user_id === partner.user_id) : null;

      // History stats
      const { data: myHist } = await supabase
        .from('daily_records').select('fine_amount, fine_paid')
        .eq('pact_id', pactId).eq('user_id', uid).eq('archived', true);

      const { data: ptHist } = partner ? await supabase
        .from('daily_records').select('fine_amount, fine_paid')
        .eq('pact_id', pactId).eq('user_id', partner.user_id).eq('archived', true)
        : { data: [] };

      const myOwed    = (myHist || []).reduce((s, r) => s + (r.fine_amount > 0 && !r.fine_paid ? r.fine_amount : 0), 0);
      const ptOwed    = (ptHist || []).reduce((s, r) => s + (r.fine_amount > 0 && !r.fine_paid ? r.fine_amount : 0), 0);
      const myPerfect = (myHist || []).filter(r => r.fine_amount === 0).length;
      const ptPerfect = (ptHist || []).filter(r => r.fine_amount === 0).length;

      const myMem = members?.find(m => m.user_id === uid);
      const myUser = await supabase.from('users').select('display_name').eq('id', uid).single();

      res.json({
        pact: {
          id:         pactId,
          inviteCode: pact.invite_code,
          fineAmount: pact.fine_amount,
          creatorId:  pact.creator_id,
          rules:      (rules || []).map(r => r.text),
          me: {
            userId:   uid,
            name:     myUser.data?.display_name || '',
            role:     myMem?.role || 'creator',
            nickname: myMem?.nickname_given || '',
            today:    myRec?.checked || [],
            owed:     myOwed,
            perfect:  myPerfect,
          },
          partner: partner ? {
            userId:   partner.user_id,
            name:     partner.users?.display_name || '',
            role:     partner.role,
            nickname: partner.nickname_given || '',
            today:    ptRec?.checked || [],
            owed:     ptOwed,
            perfect:  ptPerfect,
          } : null,
          today,
        },
      });
    } catch (e) {
      console.error('[GET /api/pact]', e.message);
      err(res, 500, 'Server error.');
    }
    return;
  }

  // ── DELETE ─────────────────────────────────────────
  if (req.method === 'DELETE') {
    try {
      const { data: mem } = await supabase
        .from('pact_members').select('pact_id, pacts(status)')
        .eq('user_id', uid).single();

      if (!mem || mem.pacts?.status !== 'active')
        return err(res, 404, 'You are not in an active pact.');

      await supabase.from('pacts').update({ status: 'dissolved' }).eq('id', mem.pact_id);
      res.json({ ok: true });
    } catch (e) {
      console.error('[DELETE /api/pact]', e.message);
      err(res, 500, 'Server error.');
    }
    return;
  }

  err(res, 405, 'Method not allowed.');
}