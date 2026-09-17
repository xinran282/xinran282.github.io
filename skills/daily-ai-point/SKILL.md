---
name: daily-ai-point
description: Generate one non-repetitive, well-sourced and technically deep AI knowledge point per day. Use when the user asks for today's AI lesson, a daily AI learning series, a new AI concept, recent AI developments, or a structured AI knowledge digest.
---

# Daily AI Point

每天输出一个可验证、能建立知识体系的 AI 知识点。技能只负责生成内容；定时发送需由 Codex automation、计划任务或 CI 触发。

## Workflow

1. Determine the date in `Asia/Shanghai` and read the history file (default: `data/ai-knowledge-history.jsonl`). If the file does not exist, start with an empty history.
2. Build 3–5 candidate concepts from reliable, current material. Sources may include original papers, official model or product release posts, documentation and release notes, AI Skill specifications/examples, official repositories, maintainer announcements, and carefully sourced technical blogs or expert viewpoints. Prefer first-party sources for behavior and version claims; record publication dates and versions. Candidate JSON shape is documented in `references/candidate-schema.md`.
3. Normalize each candidate into a stable English `concept_id`, aliases, category, level (1–5), and keywords. Run the bundled checker:

   ```text
   node skills/daily-ai-point/scripts/history.mjs check --title "..." --concept-id "..." --aliases "a,b" --keywords "x,y,z"
   ```

   Reject exact matches and strong keyword-overlap matches. For borderline matches, compare mechanism and learning objective; treat a genuinely different angle as `related`, not `new`.
4. Select one topic using the taxonomy in `references/taxonomy.md`. For a deterministic first pass, put candidates in a JSON array and run:

   ```text
   node skills/daily-ai-point/scripts/planner.mjs select --candidates-file path/to/candidates.json --date YYYY-MM-DD
   ```

   Avoid the same category on consecutive days and prefer prerequisite order. Balance evergreen fundamentals with recent developments; never call a claim “latest” without a dated source.
5. Write using `references/output-template.md`. Explain the mechanism, give a concrete example (code or numbers where useful), contrast a nearby concept, state limitations, and finish with sources and one self-check question. Keep the main article around 800–1500 Chinese characters unless the user asks for another length.
6. Fact-check every time-sensitive claim against its source. Mark uncertain or fast-changing details with an explicit “截至日期/版本”. Do not invent paper results, benchmarks, API behavior, or links.
7. Only after a successful answer, append the entry to history. The recorder validates required fields and refuses exact duplicates by default:

   ```text
   node skills/daily-ai-point/scripts/history.mjs record --entry-file path/to/entry.json

   `entry.json` should contain `date`, `concept_id`, `title`, `category`, `level`, `keywords`, at least one HTTP(S) `source`, and `status` (`new`, `related`, or `review`). Use `status: review` for intentional spaced repetition.
   ```

## Anti-repetition policy

- `new`: new mechanism or concept; do not reuse an existing `concept_id` or alias.
- `related`: related concept with a materially different mechanism, use case, or evaluation question; link the prior entry and explain the difference.
- `review`: deliberate spaced review (suggested intervals: 1, 7, 30 days); label it as review rather than pretending it is new.

Use `history.mjs stats` to inspect category coverage. If current sources are weak, choose a stable foundational topic and state that no sufficiently reliable update was found. Run `node skills/daily-ai-point/scripts/self-test.mjs` after changing the scripts.

## Resources

- Read `references/taxonomy.md` when choosing a category, level, or learning sequence.
- Read `references/source-policy.md` when researching current topics or validating citations.
- Read `references/output-template.md` before drafting the daily entry.
- Use `scripts/history.mjs` for deterministic history operations; it uses only Node.js built-ins and creates the history directory when recording.
