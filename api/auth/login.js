const supabase = require('../../lib/supabase');
const { signToken, cors, err } = require('../../lib/auth');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return err(res, 405, 'Method not allowed.');

  const { email, password } = req.body || {};
  if (!email || !password) return err(res, 400, 'Email and password are required.');

  const norm = email.trim().toLowerCase();
  try {
    const { data: user } = await supabase.from('users').select('*').eq('email', norm).single();
    if (!user) return err(res, 401, 'No account found with this email.');

    const match = await bcrypt.compare(password, user.password);
    if (!match) return err(res, 401, 'Wrong password.');

    const token = signToken({ userId: user.id, email: user.email });
    res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name } });
  } catch (e) {
    console.error('[login]', e.message);
    err(res, 500, 'Server error. Please try again.');
  }
};