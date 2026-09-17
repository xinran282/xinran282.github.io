#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readHistory, findMatches, isoDate, shanghaiDate } from './history-lib.mjs';

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function readJson(file) {
  const raw = fs.readFileSync(path.resolve(file), 'utf8').replace(/^\uFEFF/, '');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('Candidates file must contain a JSON array');
  return data;
}

function ageDays(date, today) {
  if (!isoDate(date)) return Infinity;
  return Math.max(0, (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000);
}

function validateCandidate(candidate, today) {
  for (const key of ['concept_id', 'title', 'category']) if (!candidate?.[key] || typeof candidate[key] !== 'string') throw new Error(`Candidate missing ${key}`);
  if (candidate.kind && !['evergreen', 'current'].includes(candidate.kind)) throw new Error(`Invalid kind for ${candidate.concept_id}`);
  if (candidate.kind === 'current' && !isoDate(candidate.published)) throw new Error(`Current candidate needs valid published date: ${candidate.concept_id}`);
  if (candidate.published !== undefined && !isoDate(candidate.published)) throw new Error(`Invalid published date: ${candidate.concept_id}`);
  if (candidate.published && Date.parse(`${candidate.published}T00:00:00Z`) > Date.parse(`${today}T00:00:00Z`)) throw new Error(`Published date is in the future: ${candidate.concept_id}`);
  if (candidate.level !== undefined && (!Number.isInteger(candidate.level) || candidate.level < 1 || candidate.level > 5)) throw new Error(`Invalid level: ${candidate.concept_id}`);
  if (candidate.source_quality !== undefined && (!Number.isFinite(Number(candidate.source_quality)) || Number(candidate.source_quality) < 0 || Number(candidate.source_quality) > 1)) throw new Error(`Invalid source_quality: ${candidate.concept_id}`);
  if (!Array.isArray(candidate.sources) || candidate.sources.length === 0) throw new Error(`Candidate needs at least one source: ${candidate.concept_id}`);
  for (const source of candidate.sources) if (!source || typeof source.title !== 'string' || typeof source.url !== 'string' || !/^https?:\/\//.test(source.url)) throw new Error(`Invalid source for ${candidate.concept_id}`);
}

function score(candidate, history, today) {
  const count = history.filter(item => item.category === candidate.category).length;
  const recentCount = history.filter(item => item.category === candidate.category && Number.isFinite(ageDays(item.date, today)) && ageDays(item.date, today) <= 7).length;
  const last = history.at(-1);
  const recentSameCategory = last?.category === candidate.category;
  const age = ageDays(candidate.published, today);
  const freshness = candidate.kind === 'current' ? (age <= 30 ? 1 : age <= 90 ? 0.6 : 0.2) : 0.5;
  const coverage = 0.7 / (1 + recentCount) + 0.3 / (1 + count);
  const source = Math.min(1, Number(candidate.source_quality ?? 0.5));
  const level = Math.max(0, Math.min(1, Number(candidate.level ?? 3) / 5));
  const knownIds = new Set(history.map(item => item.concept_id));
  const prerequisites = Array.isArray(candidate.prerequisites) ? candidate.prerequisites : [];
  const prerequisiteBonus = prerequisites.length === 0 ? 0.5 : prerequisites.every(id => knownIds.has(id)) ? 1 : 0.15;
  const penalty = recentSameCategory ? 0.25 : 1;
  return penalty * (freshness * 0.3 + coverage * 0.22 + source * 0.18 + level * 0.1 + prerequisiteBonus * 0.1 + (candidate.kind === 'current' ? 0.1 : 0));
}

const candidatesFile = arg('candidates-file');
if (process.argv[2] !== 'select' || !candidatesFile) { console.error('Usage: planner.mjs select --candidates-file path [--history path] [--date YYYY-MM-DD]'); process.exit(1); }
const historyFile = path.resolve(arg('history', path.resolve(process.cwd(), 'data', 'ai-knowledge-history.jsonl')));
const today = arg('date', shanghaiDate());
if (!isoDate(today)) { console.error('--date must use YYYY-MM-DD'); process.exit(1); }
const history = readHistory(historyFile);
const threshold = Number(arg('threshold', '0.55'));
const allowRelated = arg('allow-related') === 'true';
const ranked = readJson(candidatesFile).map(candidate => { validateCandidate(candidate, today); return { candidate, matches: findMatches(candidate, history, threshold) }; })
  .filter(item => allowRelated || item.matches.length === 0)
  .map(item => ({ ...item, score: Number(score(item.candidate, history, today).toFixed(4)) }))
  .sort((a, b) => b.score - a.score);
if (!ranked.length) { console.error('No non-duplicate candidate remains'); process.exit(2); }
console.log(JSON.stringify({ date: today, selected: ranked[0].candidate, score: ranked[0].score, alternatives: ranked.slice(1, 4).map(x => ({ concept_id: x.candidate.concept_id, title: x.candidate.title, score: x.score })) }, null, 2));
