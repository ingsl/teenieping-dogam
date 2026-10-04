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
 *  2) 인포박스(첫 "성별" 칸) 바로 위의 이미지
 *  3) alt 에 이름이 들어간 이미지
 */
export function mainImage(html, nameKo) {
  const imgs = [...html.matchAll(/<img[^>]*?src='(\/\/i\.namu\.wiki\/[^']+)'[^>]*?alt='([^']*)'/g)]
    .map((m) => ({ url: `https:${m[1]}`, alt: decode(m[2]).replace(/\[\d+\]/g, '').trim(), at: m.index }))
    .filter((i) => !/\.svg$/i.test(i.url) && !/로고|아이콘|logo/i.test(i.alt));
  const profileAt = html.search(/>\s*(?:<strong[^>]*>)?성별(?:<\/strong>)?\s*</);
  const beforeProfile = profileAt > -1 ? imgs.filter((i) => i.at < profileAt).pop() : null;
  return (imgs.find((i) => i.alt === nameKo) || beforeProfile || imgs.find((i) => i.alt.includes(nameKo)))?.url || '';
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
