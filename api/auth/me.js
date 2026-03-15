// api/auth/me.js
import supabase from '../../lib/supabase.js';
import { getUserFromRequest, cors, err } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return err(res, 405, 'Method not allowed.');

  try {
    const { userId } = getUserFromRequest(req);
    const { data: u } = await supabase
      .from('users').select('id, email, display_name').eq('id', userId).single();
    if (!u) return err(res, 404, 'User not found.');
    res.json({ id: u.id, email: u.email, displayName: u.display_name });
  } catch (e) {
    err(res, 401, 'Not authenticated.');
  }
}