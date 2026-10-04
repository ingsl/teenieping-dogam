import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRecord, htmlToText } from '../lib/namu.mjs';

const row = (label, value, strong = true) =>
  `<tr class='wiki-table-tr'><td style='x'><div class='wiki-paragraph'>${strong ? `<strong>${label}</strong>` : label}</div></td><td><div class='wiki-paragraph'>${value}</div></td></tr>`;
const img = (alt, id) => `<img src='//i.namu.wiki/i/${id}.webp' alt='${alt}'>`;

test('각주·<br 속성> 처리', () => {
  assert.equal(htmlToText("손거울<a class='wiki-fn-content' href='#fn-1'>[1]</a><br data-v-1>하프&#91;2&#93;"), '손거울\n하프');
});

test('라벨에 굵게 표시가 없어도 읽고, 감정은 개요의 "~의 티니핑"에서', () => {
  const html = `<h2><span id='개요'>개요</span></h2><div class='wiki-paragraph'>납작함의 티니핑, 와플핑 뭐든지 빨리!</div>
    <table>${img('와플핑 그림', 'w1')}${row('성별', '남성', false)}${row('소품', '포크(4기)→ 나이프(5기)')}</table>`;
  const r = toRecord(html, '와플핑', 'Waffleping');
  assert.equal(r.gender, '남성');
  assert.equal(r.emotion, '납작함');
  assert.equal(r.item, '포크(4기)\n나이프(5기)');
  assert.match(r.imageUrl, /w1\.webp$/);
});

test('쌍둥이 문서: 영문명으로 자기 인포박스와 이미지를 고른다', () => {
  const html = `${img('무제1', 'a')}<table>${row('성별', '남성')}${row('한국 외 국가 번안명', 'Noraping')}${row('소품', '게임기')}</table>
    ${img('무제2', 'b')}<table>${row('성별', '남성')}${row('한국 외 국가 번안명', 'Noriping')}${row('소품', '젖병')}</table>`;
  const a = toRecord(html, '노라핑', 'Noraping');
  const b = toRecord(html, '노리핑', 'Noriping');
  assert.equal(a.item, '게임기');
  assert.equal(b.item, '젖병');
  assert.match(a.imageUrl, /a\.webp$/);
  assert.match(b.imageUrl, /b\.webp$/);
});

test('인포박스에 여러 모습(평상시·각성…)이 있으면 첫 번째(기본 모습)를 고른다', () => {
  const html = `${img('다른핑', 'nav')}<table><tr><td>${img('풍선껌부는뿌뿌핑', 'normal')}${img('뿌뿌핑1단계각성', 'awake')}${img('뿌뿌핑3단괴수', 'monster')}</td></tr>
    <tr><td><table>${row('성별', '여성')}</table></td></tr></table>`;
  assert.match(toRecord(html, '뿌뿌핑', 'Puffping').imageUrl, /normal\.webp$/);
});
