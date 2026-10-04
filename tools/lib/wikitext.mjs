// 최소한의 MediaWiki 위키텍스트 파서 (인포박스 추출용)

/** text 안에서 `{{name` 으로 시작하는 첫 틀의 원문을 중괄호 짝을 맞춰 잘라낸다. */
export function findTemplate(text, name) {
  const re = new RegExp(`\\{\\{\\s*${name}\\s*[|\\n}]`, 'i');
  const m = re.exec(text);
  if (!m) return null;
  let depth = 0;
  for (let i = m.index; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') { depth++; i++; }
    else if (text[i] === '}' && text[i + 1] === '}') {
      depth--; i++;
      if (depth === 0) return text.slice(m.index, i + 1);
    }
  }
  return null;
}

/** 틀 원문을 { 매개변수명: 원문값 } 으로 나눈다. 중첩 {{ }}, [[ ]] 안의 | 는 무시. */
export function parseTemplateParams(tpl) {
  const body = tpl.replace(/^\{\{/, '').replace(/\}\}$/, '');
  const parts = [];
  let depthCurly = 0, depthSquare = 0, buf = '';
  for (let i = 0; i < body.length; i++) {
    // <gallery> 안의 "파일|캡션" 구분자는 매개변수 구분자가 아니다 → 통째로 건너뜀
    if (body.startsWith('<gallery', i)) {
      const end = body.indexOf('</gallery>', i);
      const stop = end === -1 ? body.length : end + '</gallery>'.length;
      buf += body.slice(i, stop);
      i = stop - 1;
      continue;
    }
    const two = body.slice(i, i + 2);
    if (two === '{{') { depthCurly++; buf += two; i++; continue; }
    if (two === '}}') { depthCurly--; buf += two; i++; continue; }
    if (two === '[[') { depthSquare++; buf += two; i++; continue; }
    if (two === ']]') { depthSquare--; buf += two; i++; continue; }
    if (body[i] === '|' && depthCurly === 0 && depthSquare === 0) { parts.push(buf); buf = ''; continue; }
    buf += body[i];
  }
  parts.push(buf);
  const params = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq === -1) continue;
    params[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
  }
  return params;
}

/** [[링크]] 대상 문서명 목록 */
export function linkTargets(value = '') {
  return [...value.matchAll(/\[\[([^\]|#]+)(?:[^\]]*)\]\]/g)]
    .map((m) => m[1].trim())
    .filter((t) => !/^(file|image|파일|category|분류|wikipedia):/i.test(t));
}

/** 위키 마크업을 사람이 읽는 평문으로. <br> 은 줄바꿈으로 남긴다. */
export function toPlain(value = '') {
  let s = String(value);
  s = s.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[\s\S]*?<\/ref>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  // 중첩 틀 제거 (안쪽부터 반복)
  for (let i = 0; i < 5 && /\{\{[^{}]*\}\}/.test(s); i++) s = s.replace(/\{\{[^{}]*\}\}/g, '');
  s = s.replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1');
  s = s.replace(/\[https?:\/\/\S+\s([^\]]+)\]/g, '$1');
  s = s.replace(/'''?/g, '');
  s = s.replace(/<[^>]+>/g, '');
  return s
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** <gallery> 블록 또는 [[File:..]] / 단독 파일명에서 이미지 파일명 목록 */
export function imageFiles(value = '') {
  const files = [];
  const gallery = value.match(/<gallery[^>]*>([\s\S]*?)<\/gallery>/i);
  if (gallery) {
    for (const line of gallery[1].split('\n')) {
      const f = line.split('|')[0].trim().replace(/^(file|image):/i, '');
      if (f) files.push({ file: f, caption: (line.split('|')[1] || '').trim() });
    }
  }
  for (const m of value.matchAll(/\[\[(?:file|image):([^|\]]+)/gi)) files.push({ file: m[1].trim(), caption: '' });
  if (!files.length && /\.(png|jpe?g|gif|webp)\s*$/i.test(value.trim())) files.push({ file: value.trim(), caption: '' });
  return files;
}

/** {{KR|하츄핑|Hachyuping}} 처럼 국가 코드 틀의 첫 인자 */
export function countryName(value = '', code = 'KR') {
  const m = value.match(new RegExp(`\\{\\{\\s*${code}\\s*\\|([^|}]+)`));
  return m ? m[1].trim() : '';
}
