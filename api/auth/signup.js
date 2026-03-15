const supabase = require('../../lib/supabase');
const { signToken, cors, err } = require('../../lib/auth');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return err(res, 405, 'Method not allowed.');

  const { email, password, displayName } = req.body || {};
  if (!email || !password || !displayName)
    return err(res, 400, 'Email, password, and display name are required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return err(res, 400, 'Enter a valid email address.');
  if (password.length < 6)
    return err(res, 400, 'Password must be at least 6 characters.');
  if (!displayName.trim() || displayName.trim().length > 40)
    return err(res, 400, 'Display name must be 1–40 characters.');

  const norm = email.trim().toLowerCase();
  try {
    const { data: existing } = await supabase.from('users').select('id').eq('email', norm).single();
    if (existing) return err(res, 409, 'An account with this email already exists.');

    const hash = await bcrypt.hash(password, 12);
    const { data: user, error } = await supabase
      .from('users')
      .insert({ email: norm, password: hash, display_name: displayName.trim() })
      .select('id, email, display_name')
      .single();
    if (error) throw error;

    const token = signToken({ userId: user.id, email: user.email });
    res.status(201).json({ token, user: { id: user.id, email: user.email, displayName: user.display_name } });
  } catch (e) {
    console.error('[signup]', e.message);
    err(res, 500, 'Server error. Please try again.');
  }
};