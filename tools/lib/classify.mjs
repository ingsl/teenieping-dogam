// 기수·등급 판정 (src/seasons.js 설정 기반). 빌드 때마다 다시 계산하므로 설정만 바꾸면 재수집 없이 반영된다.
import { SEASONS, GRADE_CATEGORIES, DEBUT_PATTERNS } from '../../src/seasons.js';

/** Fandom 분류 → 기수. "종류" 분류 우선, 없으면 "작품" 분류. 여러 개면 가장 이른 시즌. */
export function seasonFromCategories(categories = []) {
  const earliest = (field) =>
    SEASONS.filter((s) => s[field].some((c) => categories.includes(c))).sort((a, b) => a.order - b.order)[0];
  return (earliest('fandomCategories') || earliest('fandomSeries'))?.key || '';
}

/** 나무위키 "첫 등장" 문구 → 기수 */
export function seasonFromDebut(debut = '') {
  return DEBUT_PATTERNS.find(([re]) => re.test(debut))?.[1] || '';
}

/** Fandom 분류 → 등급 */
export function gradeFromCategories(categories = []) {
  return GRADE_CATEGORIES.find((g) => g.categories.some((c) => categories.includes(c)))?.grade || '';
}

/** 나무위키 "분류" 문구 → 등급 */
export function gradeFromNamu(classification = '') {
  if (/레전드/.test(classification)) return '레전드';
  if (/로열/.test(classification)) return '로열';
  return '';
}
