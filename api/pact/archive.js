const supabase = require('../../lib/supabase');
const { cors, err } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'POST')
    return err(res, 405, 'Method not allowed.');

  const secret = (req.headers && req.headers['x-cron-secret']) || (req.query && req.query.secret);
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET)
    return err(res, 403, 'Forbidden.');

  try {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().slice(0, 10);

    const { data: activePacts } = await supabase
      .from('pacts').select('id, fine_amount').eq('status', 'active');

    let archived = 0;

    for (const pact of activePacts || []) {
      const { count: ruleCount } = await supabase
        .from('rules').select('*', { count: 'exact', head: true }).eq('pact_id', pact.id);

      const { data: members } = await supabase
        .from('pact_members').select('user_id').eq('pact_id', pact.id);

      for (const { user_id } of members || []) {
        // Insert missing record with full fine
        await supabase.from('daily_records').upsert(
          { pact_id: pact.id, user_id, date_key: yesterday, checked: [], fine_amount: pact.fine_amount, fine_paid: false, archived: true },
          { onConflict: 'pact_id,user_id,date_key', ignoreDuplicates: true }
        );

        // Archive any unarchived record and calculate fine
        const { data: rec } = await supabase
          .from('daily_records').select('checked')
          .eq('pact_id', pact.id).eq('user_id', user_id)
          .eq('date_key', yesterday).eq('archived', false).single();

        if (rec) {
          const checkedArr = Array.isArray(rec.checked) ? rec.checked : [];
          const fine = checkedArr.length < (ruleCount || 0) ? pact.fine_amount : 0;
          await supabase.from('daily_records')
            .update({ fine_amount: fine, archived: true, updated_at: new Date().toISOString() })
            .eq('pact_id', pact.id).eq('user_id', user_id).eq('date_key', yesterday);
        }
        archived++;
      }
    }

    console.log(`[archive] ${yesterday}: ${archived} records`);
    res.json({ ok: true, date: yesterday, archived });
  } catch (e) {
    console.error('[archive]', e.message);
    err(res, 500, 'Archive failed: ' + e.message);
  }
};