// Cloudflare Worker — 좋아요 카운터 / 인기 순위 (KV 바인딩: LIKES)
//
//   POST /like/:id   → { id, count }   (같은 IP는 하루 1회만 증가)
//   GET  /likes/:id  → { id, count }
//   GET  /ranks      → [{ id, count }, ...] 상위 50
//
// 배포: cd worker && npx wrangler kv namespace create LIKES  → wrangler.toml 에 id 입력 → npx wrangler deploy
// 그 다음 public/js/config.js 의 counterUrl 에 배포 주소를 넣는다.

const ID_RE = /^[a-z0-9-]{1,64}$/;

function cors(env, origin) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin || '');
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] || '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

const json = (data, headers, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export default {
  async fetch(req, env) {
    const headers = cors(env, req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return new Response(null, { headers });
    const { pathname } = new URL(req.url);
    const [, action, id] = pathname.split('/');

    if (action === 'ranks' && req.method === 'GET') {
      const ranks = (await env.LIKES.get('_ranks', 'json')) || {};
      const list = Object.entries(ranks).map(([k, count]) => ({ id: k, count })).sort((a, b) => b.count - a.count).slice(0, 50);
      return json(list, { ...headers, 'Cache-Control': 'public, max-age=60' });
    }
    if (!id || !ID_RE.test(id)) return json({ error: 'bad id' }, headers, 400);

    if (action === 'likes' && req.method === 'GET') {
      return json({ id, count: Number(await env.LIKES.get(`c:${id}`)) || 0 }, headers);
    }
    if (action === 'like' && req.method === 'POST') {
      const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
      const day = new Date().toISOString().slice(0, 10);
      const seenKey = `s:${day}:${id}:${ip}`;
      let count = Number(await env.LIKES.get(`c:${id}`)) || 0;
      if (!(await env.LIKES.get(seenKey))) {
        count++;
        await env.LIKES.put(`c:${id}`, String(count));
        await env.LIKES.put(seenKey, '1', { expirationTtl: 60 * 60 * 26 });
        // KV는 원자적 증가가 없어 동시 요청 시 약간 어긋날 수 있다 (팬 사이트 규모에선 허용).
        const ranks = (await env.LIKES.get('_ranks', 'json')) || {};
        ranks[id] = count;
        await env.LIKES.put('_ranks', JSON.stringify(ranks));
      }
      return json({ id, count }, headers);
    }
    return json({ error: 'not found' }, headers, 404);
  },
};
