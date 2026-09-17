#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readHistory, findMatches, validateEntry } from './history-lib.mjs';

const DEFAULT_FILE = path.resolve(process.cwd(), 'data', 'ai-knowledge-history.jsonl');

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function candidateFromArgs() {
  return {
    title: arg('title', ''),
    concept_id: arg('concept-id', ''),
    aliases: (arg('aliases', '') || '').split(',').map(x => x.trim()).filter(Boolean),
    keywords: (arg('keywords', '') || '').split(',').map(x => x.trim()).filter(Boolean)
  };
}

function check(file) {
  const candidate = candidateFromArgs();
  if (!candidate.title && !candidate.concept_id) throw new Error('Provide --title or --concept-id');
  const threshold = Number(arg('threshold', '0.55'));
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('--threshold must be between 0 and 1');
  const matches = findMatches(candidate, readHistory(file), threshold);
  console.log(JSON.stringify({ duplicate: matches.length > 0, matches }, null, 2));
}

function record(file) {
  const entryFile = arg('entry-file');
  const raw = entryFile ? fs.readFileSync(path.resolve(entryFile), 'utf8') : arg('entry');
  if (!raw) throw new Error('record requires --entry JSON or --entry-file path');
  const entry = JSON.parse(raw.replace(/^\uFEFF/, '').trim());
  validateEntry(entry);
  const history = readHistory(file);
  const matches = findMatches(entry, history, Number(arg('threshold', '0.55')));
  const duplicate = matches[0];
  if (duplicate && arg('allow-duplicate') !== 'true') {
    if (entry.status === 'review' && duplicate.exact) {
      // Intentional spaced repetition is allowed.
    } else if (entry.status === 'related' && entry.related_to) {
      // A related entry must explicitly link to the prior concept.
    } else {
      throw new Error(`Duplicate or highly similar concept: ${duplicate.concept_id || duplicate.title}. Use status=related with related_to, status=review, or --allow-duplicate=true.`);
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8');
  console.log(JSON.stringify({ recorded: true, file, concept_id: entry.concept_id }));
}

function stats(file) {
  const history = readHistory(file), categories = {}, statuses = {};
  for (const item of history) {
    const category = item.category || 'uncategorized';
    categories[category] = (categories[category] || 0) + 1;
    const status = item.status || 'new';
    statuses[status] = (statuses[status] || 0) + 1;
  }
  console.log(JSON.stringify({ total: history.length, categories, statuses, last: history.at(-1) ?? null }, null, 2));
}

const command = process.argv[2];
const file = path.resolve(arg('file', DEFAULT_FILE));
try {
  if (command === 'check') check(file);
  else if (command === 'record') record(file);
  else if (command === 'stats') stats(file);
  else throw new Error('Usage: check|record|stats [--file path]');
} catch (error) { console.error(error.message); process.exitCode = 1; }
