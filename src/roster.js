// ─────────────────────────────────────────────────────────────────────────────
// 공식 도감 전사 명단 (정본 / 진실의 원천)
//
// ★ 이 파일은 사람이 공식 PDF 도감을 직접 보고 채운다. 자동 수집 값으로 채우지 않는다.
// ★ 다른 저장소(예: elsewon/TeeniepingCompendium)의 명단을 복사하지 않는다.
//
// 필드
//   id       영문 slug (소문자, 고유, URL/파일명에 사용). Fandom 영문 문서명을 소문자로 쓰면
//            자동 보강이 바로 연결된다. 예) Heartsping → 'heartsping'
//   nameKo   한글 이름 (도감 표기 그대로)
//   season   src/seasons.js 의 key (emotion | twinkle | secret | dessert | star | princess …)
//   grade    '로열' | '레전드' | '일반' | '빌런'
//   no       (선택) 도감 번호
//
// 여기에 있는 캐릭터는 "검증됨"으로 표시되고, 이름·기수·등급은 다른 어떤 소스보다 우선한다.
// 여기에 없지만 Fandom에서 수집된 캐릭터는 "미검증" 배지와 함께 노출된다
// (`npm run build:data -- --strict` 로 빌드하면 아예 제외).
//
// 아래 3건은 형식 예시(S2 스키마 검증용)다. 실제 도감과 대조해 확인 후 유지/수정할 것.
// ─────────────────────────────────────────────────────────────────────────────

export const ROSTER = [
  { id: 'heartsping', nameKo: '하츄핑', season: 'emotion', grade: '로열' },
  { id: 'lalaping',   nameKo: '라라핑', season: 'emotion', grade: '로열' },
  { id: 'giggleping', nameKo: '악동핑', season: 'emotion', grade: '빌런' },
];
