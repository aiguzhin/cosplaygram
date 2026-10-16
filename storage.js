// Cosplaygram — хранилище фото вне базы.
// Cloudinary (CLOUDINARY_URL=cloudinary://ключ:секрет@облако) или Supabase Storage (SUPABASE_URL + SUPABASE_SERVICE_KEY).
// Без настроек фото хранятся в базе, как раньше.
const crypto = require('crypto');

const CL = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec((process.env.CLOUDINARY_URL || '').trim());
const SB = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SBKEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const kind = CL ? 'cloudinary' : SB && SBKEY ? 'supabase' : '';
const enabled = !!kind;
const EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };
const sbHeaders = (extra = {}) => ({ apikey: SBKEY, ...(SBKEY.startsWith('sb_') ? {} : { Authorization: 'Bearer ' + SBKEY }), ...extra });

async function ensureBucket() {
  if (kind !== 'supabase') return;
  const r = await fetch(`${SB}/storage/v1/bucket`, {
    method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ id: 'images', name: 'images', public: true }),
  });
  if (!r.ok && !/exist|duplicate/i.test(await r.text())) throw new Error('Supabase Storage: не удалось создать бакет (' + r.status + ')');
}

async function upload(id, mime, buf) {
  if (kind === 'cloudinary') {
    const [, key, secret, cloud] = CL;
    const ts = Math.floor(Date.now() / 1000);
    const params = { folder: 'cosplaygram', overwrite: 'true', public_id: id, timestamp: String(ts) };
    const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
    const body = new URLSearchParams({ ...params, api_key: key, signature: crypto.createHash('sha1').update(toSign + secret).digest('hex'),
      file: `data:${mime};base64,${buf.toString('base64')}` });
    const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.secure_url) throw new Error(`Cloudinary ${r.status}: ${j.error?.message || ''}`);
    // f_auto,q_auto — Cloudinary сам выберет лёгкий формат (WebP/AVIF) для телефона
    return j.secure_url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
  }
  const file = `${id}.${EXT[mime] || 'bin'}`;
  const r = await fetch(`${SB}/storage/v1/object/images/${file}`, {
    method: 'POST', headers: sbHeaders({ 'Content-Type': mime, 'x-upsert': 'true', 'cache-control': 'max-age=31536000' }), body: buf,
  });
  if (!r.ok) throw new Error(`Supabase Storage ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return `${SB}/storage/v1/object/public/images/${file}`;
}

module.exports = { enabled, kind, ensureBucket, upload };
