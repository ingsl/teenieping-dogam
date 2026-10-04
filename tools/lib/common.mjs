// 수집·빌드 스크립트 공용 유틸
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PUBLIC = path.join(ROOT, 'public');
export const CACHE_FANDOM = path.join(ROOT, 'cache', 'fandom');
export const CACHE_AUX = path.join(ROOT, 'cache', 'extra'); // 'aux'는 Windows 예약 장치명이라 extra
export const RAW_IMAGES = path.join(ROOT, 'cache', 'images');

export const USER_AGENT =
  process.env.DOGAM_USER_AGENT ||
  'TeeniepingDogam/0.1 (non-commercial fan site; https://github.com/; contact via repo issues)';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const args = new Set(process.argv.slice(2));
export function argValue(name, fallback) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}

export function slugify(title) {
  return String(title)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-');
}

export async function readJson(file, fallback = null) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function writeJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export async function readJsonDir(dir) {
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  return Promise.all(files.map((f) => readJson(path.join(dir, f))));
}

// 요청 간 최소 간격을 지키는 정중한 fetch (위키 서버 부하 방지)
let lastRequest = 0;
export async function politeFetch(url, { minIntervalMs = 1000, headers = {}, retries = 3 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequest + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, ...headers } });
    if (res.ok) return res;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= retries) {
      throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
    }
    const retryAfter = Number(res.headers.get('retry-after')) || 5 * (attempt + 1);
    console.warn(`  ! ${res.status}, ${retryAfter}s 후 재시도`);
    await sleep(retryAfter * 1000);
  }
}
