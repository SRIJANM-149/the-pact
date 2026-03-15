// lib/auth.js
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-secret-CHANGE-IN-PRODUCTION';

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

export function getUserFromRequest(req) {
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Bearer ')) throw new Error('Not authenticated.');
  return verifyToken(header.slice(7));
}

export function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-cron-secret');
  if (req.method === 'OPTIONS') { res.status(200).end(); return true; }
  return false;
}

export function err(res, status, message) {
  return res.status(status).json({ error: message });
}

export function todayKey() {
  // Returns YYYY-MM-DD in UTC (matches Supabase DATE columns)
  return new Date().toISOString().slice(0, 10);
}

export function makeCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}