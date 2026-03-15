const { createClient } = require('@supabase/supabase-js');
const { cors, err } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return err(res, 405, 'Method not allowed.');

  const email = (req.body && req.body.email || '').trim().toLowerCase();
  if (!email) return err(res, 400, 'Email is required.');

  try {
    // Use Supabase Auth to send reset email
    // We create a separate anon client just for this auth operation
    const supabaseAuth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY
    );

    const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
      redirectTo: (process.env.APP_URL || 'https://the-pact-eta.vercel.app') + '/reset-password',
    });

    // Always return success to prevent email enumeration
    if (error) console.error('[forgot]', error.message);
    res.json({ ok: true });
  } catch (e) {
    console.error('[forgot]', e.message);
    // Still return ok to prevent enumeration
    res.json({ ok: true });
  }
};