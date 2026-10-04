import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findTemplate, parseTemplateParams, toPlain, linkTargets, imageFiles, countryName } from '../lib/wikitext.mjs';

const SAMPLE = `{{Spoiler}}{{Character
|color=#EA73AA
|title=Testping
|image=<gallery>
Testping S1 Render 1.png|Season 1
Testping S2 Render 1.png|Season 2
</gallery>
|international={{KR|테스트핑|Teseuteuping}}{{JP|テスト|Tesuto}}
|gender=Female
|prop=Mirror (Season 1)<br>Harp (Season 2)<ref>note</ref>
|friends=[[Heartsping]] (best friend)<br>[[Royal Teeniepings|Royals]]
}}
Body text`;

test('인포박스 틀을 중첩 괄호까지 정확히 잘라낸다', () => {
  const tpl = findTemplate(SAMPLE, 'Character');
  assert.ok(tpl.startsWith('{{Character'));
  assert.ok(tpl.endsWith('}}'));
  assert.ok(!tpl.includes('Body text'));
});

test('매개변수를 나누고 중첩 틀 안의 | 는 무시한다', () => {
  const p = parseTemplateParams(findTemplate(SAMPLE, 'Character'));
  assert.equal(p.title, 'Testping');
  assert.equal(countryName(p.international, 'KR'), '테스트핑');
  assert.equal(toPlain(p.prop), 'Mirror (Season 1)\nHarp (Season 2)');
  assert.deepEqual(linkTargets(p.friends), ['Heartsping', 'Royal Teeniepings']);
  assert.deepEqual(imageFiles(p.image).map((f) => f.file), ['Testping S1 Render 1.png', 'Testping S2 Render 1.png']);
});

test('링크 표시문자를 남기고 마크업을 제거한다', () => {
  assert.equal(toPlain("'''[[Foo|Bar]]''' {{Tpl|x}}baz"), 'Bar baz');
});
