// Lightweight endpoint — only returns today's checked arrays for both users
// Called every 4 seconds for fast partner sync without loading full pact
const supabase = require('../../lib/supabase');
const { getUserFromRequest, cors, err, todayKey } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return err(res, 405, 'Method not allowed.');
  let user;
  try { user = getUserFromRequest(req); } catch (e) { return err(res, 401, 'Not authenticated.'); }
  const uid = user.userId;

  try {
    const { data: memRows } = await supabase.from('pact_members').select('pact_id, pacts(status)').eq('user_id', uid);
    const mem = memRows && memRows.find(m => m.pacts && m.pacts.status === 'active');
    if (!mem) return res.json({ today: null });

    const pactId = mem.pact_id;
    const today  = todayKey();

    // Get partner user_id
    const { data: allMembers } = await supabase.from('pact_members').select('user_id').eq('pact_id', pactId);
    const partnerMem = allMembers && allMembers.find(m => m.user_id !== uid);

    const { data: recs } = await supabase.from('daily_records')
      .select('user_id, checked').eq('pact_id', pactId).eq('date_key', today);

    const myRec = recs && recs.find(r => r.user_id === uid);
    const ptRec = partnerMem && recs && recs.find(r => r.user_id === partnerMem.user_id);

    res.json({
      today: {
        me:      (myRec && myRec.checked) || [],
        partner: (ptRec && ptRec.checked) || [],
      }
    });
  } catch (e) {
    console.error('[today]', e.message);
    err(res, 500, 'Server error.');
  }
};