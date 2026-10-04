// 기수(시즌) 정의. 필터 키·표시 라벨·Fandom 분류 매핑을 한 곳에서 관리한다.
// 신규 시즌이 나오면 여기에 한 줄 추가하고 roster에 캐릭터를 전사한다.
//
// fandomCategories: 영문 Fandom 위키에서 "이 시즌에 처음 등장한 티니핑 종류"를 뜻하는 분류.
// fandomSeries:     해당 시즌 작품 분류(그 시즌에 "등장"한 캐릭터). 종류 분류가 없을 때의 보조 판단용.
// 캐릭터가 여러 분류에 속하면 order가 가장 작은 시즌을 데뷔 기수로 본다.
// 어느 것에도 안 걸리면 seasonKey는 빈 값(미분류) → roster/overrides에서 지정.

export const SEASONS = [
  { key: 'emotion',  order: 1,  label: '1기 감정',     fandomCategories: ['Emotion Teeniepings'], fandomSeries: [] },
  { key: 'twinkle',  order: 2,  label: '2기 반짝반짝', fandomCategories: ['Jewel Teeniepings'], fandomSeries: ['Twinkle Catch! Teenieping'] },
  { key: 'secret',   order: 3,  label: '3기 비밀',     fandomCategories: ['Key Teeniepings'], fandomSeries: ['Secret Catch! Teenieping'] },
  { key: 'dessert',  order: 4,  label: '4기 디저트',   fandomCategories: ['Dessert Teeniepings'], fandomSeries: ['Dessert Catch! Teenieping'] },
  { key: 'star',     order: 5,  label: '5기 스타',     fandomCategories: ['Star Teeniepings'], fandomSeries: ['Star Catch! Teenieping'] },
  { key: 'princess', order: 6,  label: '6기 프린세스', fandomCategories: ['Princess Teeniepings', 'Prince Teeniepings'], fandomSeries: ['Princess Catch! Teenieping'] },
  { key: 'jewelstar', order: 7, label: '7기 쥬얼스타', fandomCategories: [], fandomSeries: ['Jewel Catch! Teenieping'] },
  { key: 'movie',    order: 90, label: '극장판',       fandomCategories: ['Movie Teeniepings'], fandomSeries: [] },
];

// 나무위키 "첫 등장" 문구(예: "…(쥬얼스타 캐치! 티니핑 1화)") → 기수. Fandom으로 못 정할 때의 보조 판단.
// 위에서부터 먼저 맞는 것. 마지막 줄은 접두어 없는 1기 "캐치! 티니핑 N화".
export const DEBUT_PATTERNS = [
  [/쥬얼스타/, 'jewelstar'],
  [/프린세스/, 'princess'],
  [/스타 캐치/, 'star'],
  [/디저트/, 'dessert'],
  [/비밀/, 'secret'],
  [/반짝반짝/, 'twinkle'],
  [/극장판/, 'movie'],
  [/\(캐치! 티니핑 \d+화/, 'emotion'],
];

export const GRADES = ['로열', '레전드', '일반', '빌런'];

// Fandom 분류 → 등급 (위에서부터 먼저 맞는 것)
export const GRADE_CATEGORIES = [
  { grade: '로열', categories: ['Royal Teeniepings'] },
  { grade: '레전드', categories: ['Legend Teeniepings'] },
  { grade: '빌런', categories: ['Antagonists'] },
];

export const seasonByKey = Object.fromEntries(SEASONS.map((s) => [s.key, s]));
