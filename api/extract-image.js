// Vercel serverless endpoint: extracts an article's Open Graph / Twitter image.
// No image bytes are downloaded or stored; only the image URL is returned.
const dns = require('node:dns').promises;
const net = require('node:net');

function isPrivateIp(ip) {
  if (net.isIP(ip) === 4) {
    const p = ip.split('.').map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
      (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      p[0] >= 224;
  }
  if (net.isIP(ip) === 6) {
    const x = ip.toLowerCase();
    return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') ||
      x.startsWith('fe8') || x.startsWith('fe9') || x.startsWith('fea') || x.startsWith('feb') || x.startsWith('::ffff:127.') || x.startsWith('::ffff:10.');
  }
  return true;
}

async function assertPublicUrl(value) {
  const u = new URL(value);
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw new Error('URL harus berupa alamat HTTP/HTTPS publik.');
  if (u.hostname === 'localhost' || u.hostname.endsWith('.localhost') || u.hostname.endsWith('.local')) throw new Error('Alamat lokal tidak diizinkan.');
  if (net.isIP(u.hostname)) {
    if (isPrivateIp(u.hostname)) throw new Error('Alamat IP privat tidak diizinkan.');
  } else {
    const records = await dns.lookup(u.hostname, { all: true, verbatim: true });
    if (!records.length || records.some(r => isPrivateIp(r.address))) throw new Error('Host sumber tidak mengarah ke alamat publik.');
  }
  return u;
}

function decodeEntities(s) {
  return s.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(0x10ffff, Number(n))))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(Math.min(0x10ffff, parseInt(n, 16))));
}
function attrs(tag) {
  const out = {};
  const re = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m; while ((m = re.exec(tag))) out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}
function metadata(html, baseUrl) {
  let image = '', title = '', siteName = '';
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const a = attrs(tag), key = (a.property || a.name || a.itemprop || '').toLowerCase();
    const content = a.content || a.href || '';
    if (!image && ['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src', 'image'].includes(key) && content) image = content;
    if (!title && ['og:title', 'twitter:title'].includes(key) && content) title = content;
    if (!siteName && key === 'og:site_name' && content) siteName = content;
  }
  if (!title) {
    const m = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    if (m) title = decodeEntities(m[1].replace(/<[^>]*>/g, '').trim());
  }
  if (image) {
    const u = new URL(image, baseUrl);
    if (!['http:', 'https:'].includes(u.protocol)) image = '';
    else image = u.href;
  }
  return { imageUrl: image, title, siteName };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Metode tidak didukung.' }); }
  try {
    const raw = req.query?.url;
    if (typeof raw !== 'string' || raw.length > 2048) return res.status(400).json({ error: 'URL sumber tidak valid.' });
    let target = await assertPublicUrl(raw);
    let response;
    for (let hop = 0; hop <= 3; hop++) {
      response = await fetch(target.href, {
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LapasNgasemanNewsBot/1.0)', 'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' }
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location || hop === 3) throw new Error('Terlalu banyak pengalihan dari situs sumber.');
        target = await assertPublicUrl(new URL(location, target).href);
        continue;
      }
      break;
    }
    if (!response?.ok) return res.status(422).json({ error: `Situs sumber tidak dapat dibaca (HTTP ${response?.status || 'unknown'}). Coba tempel URL foto secara manual.` });
    const type = response.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml\+xml/i.test(type)) return res.status(422).json({ error: 'URL tersebut bukan halaman artikel HTML.' });
    const reader = response.body.getReader(); let html = '', size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > 1_500_000) { await reader.cancel(); throw new Error('Halaman sumber terlalu besar untuk diproses.'); }
      html += new TextDecoder().decode(value, { stream: true });
    }
    html += new TextDecoder().decode();
    const result = metadata(html, target.href);
    if (!result.imageUrl) return res.status(404).json({ error: 'Metadata foto utama tidak ditemukan pada artikel ini. Tempel URL foto secara manual.' });
    // Validate the returned image host as well; the browser will load this URL directly.
    await assertPublicUrl(result.imageUrl);
    return res.status(200).json(result);
  } catch (error) {
    console.error('extract-image:', error);
    return res.status(400).json({ error: error.name === 'TimeoutError' ? 'Situs sumber terlalu lama merespons.' : (error.message || 'Gagal membaca sumber berita.') });
  }
};
