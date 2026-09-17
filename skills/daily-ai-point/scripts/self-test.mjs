#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findMatches, similarity, validateEntry, shanghaiDate } from './history-lib.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-ai-point-'));
try {
  const history = [{ date: '2026-09-01', concept_id: 'rag-retrieval', title: 'RAG 检索', aliases: ['retrieval augmented generation'], keywords: ['向量检索'], category: '检索与知识' }];
  assert.equal(findMatches({ concept_id: 'rag-retrieval', title: '别名' }, history).length, 1);
  assert.ok(similarity('向量检索 RAG', 'RAG 检索与向量检索') > 0.3);
  assert.match(shanghaiDate(new Date('2026-09-02T00:30:00Z')), /^2026-09-02$/);
  assert.throws(() => validateEntry({ title: 'bad' }), /Missing or invalid field/);
  validateEntry({ date: '2026-09-02', concept_id: 'kv-cache', title: 'KV Cache', category: '推理与效率', level: 3, status: 'new', sources: [{ title: 'Spec', url: 'https://example.com/spec', published: '2026-09-01' }] });
  console.log('daily-ai-point self-test: OK');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
