// Solo backend Vercel, mai importare dal frontend.
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, code: 'method_not_allowed' });
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return res.status(503).json({ ok: false, code: 'database_not_configured' });
  try {
    const parsed = new URL(connectionString);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname.endsWith('.neon.tech')) {
      return res.status(503).json({ ok: false, code: 'invalid_database_configuration' });
    }
    const sql = neon(connectionString);
    const result = await sql`select 1 as connected`;
    const ok = result?.[0]?.connected === 1;
    return res.status(ok ? 200 : 503).json({ ok });
  } catch {
    return res.status(503).json({ ok: false, code: 'database_unavailable' });
  }
}
