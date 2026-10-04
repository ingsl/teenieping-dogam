// 한글 조사 자동 선택: josa('하츄핑', '이/가') → '하츄핑이', josa('라라', '을/를') → '라라를'
// 받침 유무로 고르고, '(으)로'는 받침이 ㄹ이면 '로'.
const PAIRS = { '이/가': ['이', '가'], '을/를': ['을', '를'], '은/는': ['은', '는'], '과/와': ['과', '와'], '아/야': ['아', '야'], '이에요/예요': ['이에요', '예요'] };

function lastJong(word) {
  const ch = String(word).trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return -1; // 한글이 아니면 받침 없음으로 처리
  return code % 28;
}

export function josa(word, pair) {
  const jong = lastJong(word);
  if (pair === '(으)로') return word + (jong > 0 && jong !== 8 ? '으로' : '로');
  const [withBatchim, without] = PAIRS[pair] || pair.split('/');
  return word + (jong > 0 ? withBatchim : without);
}
