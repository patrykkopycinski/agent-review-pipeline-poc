#!/usr/bin/env node
/**
 * AI code-review agent (PoC).
 *
 * Fetches a pull-request diff with the GitHub CLI, sends it to an LLM through
 * any OpenAI-compatible gateway, and posts the resulting Markdown review back
 * to the PR conversation as a comment. Mirrors .github/workflows/ai-review.yml
 * but runs from a developer machine / CI runner that has `gh` authenticated.
 *
 * Usage:
 *   node scripts/ai-review.mjs <pr-number> [--repo owner/name] [--dry-run]
 *
 * Env:
 *   OPENROUTER_API_KEY                    API key (CI secret). Fallbacks: LLM_API_KEY | OPENAI_API_KEY
 *   LLM_BASE_URL | OPENAI_BASE_URL        default: https://openrouter.ai/api/v1
 *   REVIEW_MODEL | LLM_MODEL              default: anthropic/claude-sonnet-4.5
 *   GH_TOKEN | GITHUB_TOKEN               used by gh to read the diff and post the comment
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const prNumber = argv.find((a) => /^\d+$/.test(a));
const dryRun = argv.includes('--dry-run');
const repoIdx = argv.indexOf('--repo');
const repo = repoIdx >= 0 ? argv[repoIdx + 1] : undefined;

if (!prNumber) {
  console.error('usage: node scripts/ai-review.mjs <pr-number> [--repo owner/name] [--dry-run]');
  process.exit(2);
}

const baseUrl = (
  process.env.LLM_BASE_URL ||
  process.env.OPENAI_BASE_URL ||
  'https://openrouter.ai/api/v1'
).replace(/\/+$/, '');
const apiKey = process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
const model = process.env.REVIEW_MODEL || process.env.LLM_MODEL || 'anthropic/claude-sonnet-4.5';

if (!apiKey) {
  console.error('missing OPENROUTER_API_KEY (see script header)');
  process.exit(2);
}

if (!process.env.GH_TOKEN && process.env.GITHUB_TOKEN) {
  process.env.GH_TOKEN = process.env.GITHUB_TOKEN;
}

const repoFlag = repo ? ['--repo', repo] : [];
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const diff = gh(['pr', 'diff', String(prNumber), ...repoFlag]);
if (!diff.trim()) {
  console.error(`PR #${prNumber} produced an empty diff`);
  process.exit(1);
}

const systemPrompt = readFileSync(join(root, 'prompts', 'code-review.md'), 'utf8');
const userPrompt = `Review the following pull-request diff (PR #${prNumber}).\n\n\`\`\`diff\n${diff}\n\`\`\``;

console.error(`[ai-review] PR #${prNumber}: ${diff.split('\n').length} diff lines -> ${model} @ ${baseUrl}`);

const res = await fetch(`${baseUrl}/chat/completions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: 4000,
  }),
});

if (!res.ok) {
  console.error(`[ai-review] LLM error ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const data = await res.json();
const review = data?.choices?.[0]?.message?.content?.trim();
if (!review) {
  console.error('[ai-review] model returned an empty review');
  process.exit(1);
}

if (dryRun) {
  process.stdout.write(`${review}\n`);
  process.exit(0);
}

const bodyFile = join(mkdtempSync(join(tmpdir(), 'ai-review-')), 'review.md');
writeFileSync(bodyFile, `${review}\n`);
gh(['pr', 'comment', String(prNumber), '--body-file', bodyFile, ...repoFlag]);
console.error(`[ai-review] posted review comment to PR #${prNumber}`);
