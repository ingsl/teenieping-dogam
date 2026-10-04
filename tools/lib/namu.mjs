// 나무위키 문서 HTML(서버 렌더링본)에서 인포박스·개요·대표 이미지를 뽑는 파서

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
export function decode(s = '') {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;/g, (e) => ENTITIES[e] ?? e);
}

/** HTML 조각 → 평문. 각주 [1] 제거, <br>·문단은 줄바꿈 */
export function htmlToText(html = '') {
  let s = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<a[^>]*class='wiki-fn-content'[\s\S]*?<\/a>/gi, '') // 각주 링크
    .replace(/<br\b[^>]*>/gi, '\n')
    .replace(/<\/(div|p|li|tr|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  s = decode(s)
    .replace(/\[\d+\]/g, '')
    .replace(/[ \t ]+/g, ' ');
  return s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

/** 인포박스 "라벨 칸 | 값 칸" 쌍. 같은 라벨은 처음 것만 (문서 최상단 인포박스 우선) */
export function infobox(html) {
  const out = {};
  const re = /<td[^>]*>\s*<div class='wiki-paragraph'[^>]*>\s*(?:<strong[^>]*>)?([^<]{1,24})(?:<\/strong>)?\s*<\/div>\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g;
  for (const m of html.matchAll(re)) {
    const label = decode(m[1]).trim();
    if (label && !(label in out)) out[label] = htmlToText(m[2]);
  }
  return out;
}

/** "개요" 절에서 대사 인용이 아닌 첫 단락(인용 상자 속 소개문 포함) */
export function overview(html) {
  const h = html.search(/<span id='개요'/);
  if (h === -1) return '';
  const body = html.slice(html.indexOf('</h2>', h) + 5);
  const end = body.search(/<h[23][^>]*>/);
  const section = end === -1 ? body : body.slice(0, end);
  const para = [...section.matchAll(/<div class='wiki-paragraph'[^>]*>([\s\S]*?)<\/div>/g)]
    .map((m) => htmlToText(m[1]))
    .find((t) => t.length > 15 && !/^["“'‘]/.test(t));
  return para ? para.replace(/\n/g, ' ') : '';
}

/**
 * 대표 이미지 (svg·로고 제외)
 *  1) alt 가 캐릭터 이름과 정확히 같은 이미지
 *  2) 인포박스 표 안의 첫 이미지 — 여러 모습(평상시/변신/각성…)이 탭으로 있으면 첫 탭이 기본 모습
 *  3) 인포박스("성별" 칸) 바로 위의 이미지
 *  4) alt 에 이름이 들어간 이미지
 * 다른 티니핑 이름이 붙은 이미지(문서 위 시리즈 목록의 사진 등)는 절대 쓰지 않는다.
 * 자기 사진이 없는 문서(미공개 캐릭터)는 '' → Fandom 으로 넘어가고, 거기도 없으면 도감에서 빠진다.
 */
export function mainImage(html, nameKo) {
  // 사진 설명(alt)에 다른 티니핑 이름만 있고 자기 이름은 없으면 남의 사진. ("티니핑" 이라는 단어 자체는 이름이 아님)
  const otherPing = (alt) => !alt.includes(nameKo)
    && (alt.match(/[가-힣]+핑/g) || []).some((n) => !n.endsWith('티니핑') && !nameKo.includes(n));
  const imgs = [...html.matchAll(/<img[^>]*?src='(\/\/i\.namu\.wiki\/[^']+)'[^>]*?alt='([^']*)'/g)]
    .map((m) => ({ url: `https:${m[1]}`, alt: decode(m[2]).replace(/\[\d+\]/g, '').trim(), at: m.index }))
    .filter((i) => !/\.svg$/i.test(i.url) && !/로고|아이콘|logo/i.test(i.alt) && !otherPing(i.alt));
  const profileAt = html.search(/>\s*(?:<strong[^>]*>)?성별(?:<\/strong>)?\s*</);
  const boxAt = profileAt > -1 ? infoboxStart(html, profileAt) : -1;
  const firstInBox = boxAt > -1 ? imgs.find((i) => i.at > boxAt && i.at < profileAt) : null;
  const beforeProfile = profileAt > -1 ? imgs.filter((i) => i.at < profileAt).pop() : null;
  return (imgs.find((i) => i.alt === nameKo) || firstInBox || beforeProfile || imgs.find((i) => i.alt.includes(nameKo)))?.url || '';
}

/** pos 를 감싸고 있는 가장 바깥 <table> 의 시작 위치 (= 인포박스 표) */
export function infoboxStart(html, pos) {
  const stack = [];
  for (const m of html.slice(0, pos).matchAll(/<(\/?)table\b/g)) {
    if (m[1]) stack.pop();
    else stack.push(m.index);
  }
  return stack.length ? stack[0] : -1;
}

/** 티니핑 문서가 맞는지 대략 확인 */
export const looksLikeTeenieping = (html) => /티니핑/.test(html) && /성별|분류|첫 등장/.test(html);

// 나무위키 표기 → 사이트 필드
/**
 * 한 문서에 여러 캐릭터 인포박스가 있으면(예: 노라핑&노리핑) 이 캐릭터 것의 구간을 고른다.
 * 인포박스의 "한국 외 국가 번안명" 칸에 영문명(Fandom 문서명)이 있는 것을 고르고, 없으면 첫 인포박스.
 */
export function profileSlice(html, nameEn = '') {
  const starts = [...html.matchAll(/>\s*(?:<strong[^>]*>)?성별(?:<\/strong>)?\s*</g)].map((m) => m.index);
  if (starts.length < 2 || !nameEn) return { box: html, images: html };
  // k번째 인포박스 = "성별" 칸이 든 행의 시작 ~ 다음 인포박스의 "성별" 행 시작
  const rowStart = (p) => html.lastIndexOf('<tr', p);
  const section = (k) => html.slice(rowStart(starts[k]), k + 1 < starts.length ? rowStart(starts[k + 1]) : undefined);
  const re = new RegExp(`\\b${nameEn.replace(/[^\w]/g, '')}\\b`, 'i');
  const k = starts.findIndex((_, i) => re.test(infobox(section(i))['한국 외 국가 번안명'] || ''));
  if (k <= 0) return { box: html, images: html };
  // 인포박스는 그 캐릭터 구간에서, 이미지는 앞 캐릭터 표 이후부터 찾는다
  return { box: section(k), images: html.slice(html.indexOf('</tr>', starts[k - 1])) };
}

export function toRecord(html, nameKo, nameEn = '') {
  const own = profileSlice(html, nameEn);
  const box = infobox(own.box);
  const pick = (...labels) => labels.map((l) => box[l]).find(Boolean) || '';
  const arrows = (s) => s.replace(/\s*→\s*/g, '\n');
  const bySeason = (s) => s.replace(/(\(\d+(?:~\d+)?기\))\s*(?=\S)/g, '$1\n');
  const magic = pick('마법', '능력').replace(/\s*([①②③④⑤⑥⑦⑧⑨⑩])/g, '\n$1').trim();
  const intro = overview(html);
  // 감정 라벨이 없으면 개요의 "즐거움의 티니핑" → 마법 이름 "<사랑의 빛>" 순으로
  const fromIntro = intro.match(/([가-힣]+)의 (?:로열 |레전드 )?티니핑/)?.[1] || '';
  const fromMagic = magic.match(/<([^<>\s]+)의 /)?.[1] || '';
  return {
    gender: pick('성별'),
    classification: pick('분류'),
    birthday: pick('생일'),
    nameOrigin: pick('이름의 유래'),
    motif: arrows(pick('모티브')),
    emotion: pick('감정', '상징 감정', '속성') || fromIntro || fromMagic,
    symbol: pick('심볼'),
    item: arrows(pick('소품', '무기')),
    jewel: pick('보석'),
    magic,
    likes: bySeason(pick('좋아하는 것')),
    dislikes: bySeason(pick('싫어하는 것')),
    favoriteFood: pick('좋아하는 음식'),
    partner: pick('파트너'),
    debut: pick('첫 등장'),
    voice: pick('성우').split(/\s/)[0] || '',
    intro,
    imageUrl: mainImage(own.images, nameKo),
    labels: Object.keys(box),
  };
}

// ── 나무위키 「티니핑」 문서 → 전체 명단 ──────────────────────────────
const SEASON_BY_NO = { 1: 'emotion', 2: 'twinkle', 3: 'secret', 4: 'dessert', 5: 'star', 6: 'princess', 7: 'jewelstar' };

/**
 * 「애니메이션 기수별 티니핑 분류」의 소제목별 목록을 읽는다.
 *  - "N기 ○○ 티니핑"(종류 목록) → 기수
 *  - "N기 로열/레전드/일반 티니핑" → 등급
 *  - "극장판 시즌별 등장 티니핑" 아래 → 극장판 (이미 TV 기수가 있으면 그쪽 유지)
 * 반환: [{ nameKo, season, grade, page }]  page = 링크가 가리키는 문서 제목(없으면 null)
 */
export function parseRoster(html) {
  const heads = [...html.matchAll(/<h[2-6][^>]*>[\s\S]*?<span id='([^']+)'/g)].map((m) => ({ id: decode(m[1]), at: m.index }));
  const from = heads.findIndex((h) => h.id === '애니메이션 기수별 티니핑 분류');
  const to = heads.findIndex((h) => h.id === '그 외 티니핑');
  if (from === -1) throw new Error('「애니메이션 기수별 티니핑 분류」 절을 찾지 못했습니다 (문서 구조 변경?)');
  const byName = new Map();
  const get = (name) => byName.get(name) || byName.set(name, { nameKo: name, season: '', grade: '', page: null, order: 99 }).get(name);
  let movie = false;
  for (let i = from + 1; i < (to === -1 ? heads.length : to); i++) {
    const title = heads[i].id;
    if (title.startsWith('극장판')) movie = true;
    const seg = html.slice(heads[i].at, heads[i + 1]?.at);
    const m = title.match(/^(\d)기 (.+) 티니핑$/);
    const gradeMatch = m && m[2].match(/^(로열|레전드|일반)$/);
    for (const a of seg.matchAll(/<a class='wiki-link-internal' href='\/w\/([^'#]+)[^']*'[^>]*>([\s\S]*?)<\/a>/g)) {
      const page = decodeURIComponent(a[1]);
      const text = htmlToText(a[2]).replace(/\s*\(.*?\)\s*/g, '');
      for (const name of text.split('&').map((s) => s.trim())) {
        if (!/^[가-힣]+핑$/.test(name) || name.includes('티니핑')) continue; // "다이아 하츄핑" 같은 변신 이름·작품명 제외
        const r = get(name);
        if (!r.page && page !== '티니핑' && page.includes(name)) r.page = page;
        if (m && !gradeMatch && Number(m[1]) < r.order) { r.order = Number(m[1]); r.season = SEASON_BY_NO[m[1]] || ''; }
        if (gradeMatch && !r.grade) r.grade = gradeMatch[1];
        if (movie && !r.season) r.season = 'movie';
      }
    }
  }
  return [...byName.values()].filter((r) => r.season).map(({ order, ...r }) => r);
}

/** 인포박스 "한국 외 국가 번안명" 의 첫 영문 이름 (예: "Heartsping") */
export const englishName = (box) => (box['한국 외 국가 번안명'] || '').match(/\b[A-Z][A-Za-z]*ping\b/)?.[0] || ''; // "…ping" 형태만 영문명으로 인정
