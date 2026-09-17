# Candidate JSON schema

The planner accepts a JSON array. Each object should contain:

```json
{
  "concept_id": "speculative-decoding",
  "title": "推测解码",
  "aliases": ["speculative decoding", "draft-and-verify"],
  "keywords": ["推理", "延迟", "草稿模型"],
  "category": "推理与效率",
  "level": 3,
  "kind": "current",
  "published": "2026-08-20",
  "source_quality": 0.9,
  "sources": [{"title": "原始论文", "url": "https://example.com", "published": "2026-08-20"}],
  "prerequisites": ["autoregressive-decoding"]
}
```

`kind` is `evergreen` or `current`; `source_quality` is a 0–1 score (official or primary sources should be highest). `published` is required for `current` items and must be `YYYY-MM-DD`. The planner filters exact duplicates, then ranks by freshness, category coverage, source quality, difficulty and consecutive-category penalty.
