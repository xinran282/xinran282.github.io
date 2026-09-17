import fs from 'node:fs';

export function readHistory(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).flatMap((line, n) => {
    try { return [JSON.parse(line.replace(/^\uFEFF/, ''))]; }
    catch { console.error(`Skipping invalid history record at line ${n + 1}`); return []; }
  });
}

export function tokens(value) {
  const out = new Set();
  for (const chunk of String(value ?? '').toLowerCase().match(/[\p{Script=Han}]+|[\p{L}\p{N}_-]+/gu) || []) {
    if (/^[\p{Script=Han}]+$/u.test(chunk)) {
      for (const char of chunk) out.add(char);
      for (let i = 0; i + 1 < chunk.length; i++) out.add(chunk.slice(i, i + 2));
    } else out.add(chunk);
  }
  return out;
}

export function similarity(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let overlap = 0;
  for (const token of A) if (B.has(token)) overlap++;
  return overlap / (A.size + B.size - overlap);
}

export function candidateText(candidate) {
  return [candidate.title, candidate.concept_id, ...(candidate.aliases || []), ...(candidate.keywords || [])].join(' ');
}

export function historyText(item) {
  return [item.title, item.concept_id, ...(item.aliases || []), ...(item.keywords || [])].join(' ');
}

export function findMatches(candidate, history, threshold = 0.55) {
  const exactValues = [candidate.concept_id, candidate.title, ...(candidate.aliases || [])]
    .filter(Boolean).map(value => value.toLowerCase());
  return history.map(item => {
    const knownValues = new Set([item.concept_id, item.title, ...(item.aliases || [])]
      .filter(Boolean).map(value => value.toLowerCase()));
    const exact = exactValues.some(value => knownValues.has(value));
    const score = similarity(candidateText(candidate), historyText(item));
    return { date: item.date, title: item.title, concept_id: item.concept_id, score: Number(score.toFixed(3)), exact };
  }).filter(match => match.exact || match.score >= threshold).sort((a, b) => b.score - a.score);
}

export function isoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function shanghaiDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function validateEntry(entry) {
  for (const key of ['date', 'concept_id', 'title', 'category']) {
    if (!entry?.[key] || typeof entry[key] !== 'string') throw new Error(`Missing or invalid field: ${key}`);
  }
  if (!isoDate(entry.date)) throw new Error('date must use YYYY-MM-DD');
  if (entry.level !== undefined && (!Number.isInteger(entry.level) || entry.level < 1 || entry.level > 5)) throw new Error('level must be an integer from 1 to 5');
  if (entry.status !== undefined && !['new', 'related', 'review'].includes(entry.status)) throw new Error('status must be new, related, or review');
  for (const key of ['aliases', 'keywords', 'sources']) if (entry[key] !== undefined && !Array.isArray(entry[key])) throw new Error(`${key} must be an array`);
  if (!Array.isArray(entry.sources) || entry.sources.length === 0) throw new Error('sources must contain at least one source');
  for (const source of entry.sources) {
    if (!source || typeof source.title !== 'string' || typeof source.url !== 'string' || !/^https?:\/\//.test(source.url)) throw new Error('each source needs a title and http(s) url');
    if (source.published !== undefined && !isoDate(source.published)) throw new Error('source published must use YYYY-MM-DD');
  }
}
