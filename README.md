# agent-review-pipeline-poc

A small, self-contained proof of concept: **an AI agent performing code review inside a CI/CD pipeline.**

The repository holds a tiny TypeScript library (`semver-diff`) wired to a GitHub Actions
pipeline. On every pull request, one workflow runs lint + unit tests, and a second workflow
runs a code-review agent over the PR diff and posts the resulting review back to the pull
request as a comment.

> Status: PoC. The app is deliberately small so the pipeline and the agent's review are the
> interesting parts.

## What's here

```
src/semver-diff.ts   SemVer 2.0.0 parsing, formatting and bump classification
src/cli.ts           tiny CLI: `npm run cli -- <from> <to>`
tests/               vitest unit tests (happy paths + edge cases)
scripts/ai-review.mjs  local driver for the review agent (gh + OpenAI-compatible LLM)
prompts/code-review.md the review agent's system prompt (findings with file:line, severity, fix)
.github/workflows/ci.yml        lint + test jobs
.github/workflows/ai-review.yml review agent on PR opened/synchronize
```

Requirements: Node 22+, npm. No runtime dependencies.

```bash
npm ci
npm run lint      # tsc --noEmit
npm test          # vitest run
npm run cli -- 1.2.3 2.0.0   # -> bump: major
```

## Architecture

```mermaid
flowchart LR
    Dev[Developer] -->|push feature branch| GH[(GitHub repo)]
    GH -->|pull_request event| CI[ci.yml]
    GH -->|pull_request opened/synchronize| REV[ai-review.yml]
    CI --> L[lint: tsc --noEmit]
    CI --> T[test: vitest]
    REV --> D[gh pr diff PR_NUMBER]
    D --> AG[review agent<br/>codex exec / scripts/ai-review.mjs]
    AG -->|findings, file:line, severity, fix| C[gh pr comment]
    C --> PR[PR conversation]
    L --> PR
    T --> PR
```

## How the review agent works

1. A pull request is opened or updated (`opened`, `synchronize`, `reopened`).
2. `.github/workflows/ai-review.yml` checks the repository out and fetches the PR diff with
   `gh pr diff $PR_NUMBER`.
3. The diff is combined with the system prompt in `prompts/code-review.md`, which instructs the
   agent to return findings that each cite `path:line`, carry a severity
   (`blocker` / `major` / `minor` / `nit`) and include a concrete fix.
4. The agent (`codex exec --sandbox read-only` in CI, or `scripts/ai-review.mjs` locally
   against any OpenAI-compatible gateway) produces a Markdown review.
5. The review is posted to the PR conversation with `gh pr comment`.

Run the same agent locally:

```bash
export LLM_BASE_URL=https://your-gateway/v1
export LLM_API_KEY=...
node scripts/ai-review.mjs <pr-number>
```

## Demo pull requests

- **PR #1** — adds `compareSemver` (SemVer §11 precedence) with a deliberate subtle defect; the
  agent's review flags it with a fix.
- **PR #2** — stacks a thorough test suite for the new function on top of PR #1.

## Screenshots

### 1. CI pipeline in the Actions tab
![Actions tab with CI jobs](docs/screenshots/shot-1-pipeline.png)

### 2. `ai-review` job logs
Not captured yet. The `AI Code Review` workflow currently fails with `401 Unauthorized` because the
repo has no `OPENAI_API_KEY` secret. Add it, re-run the job, then save the log view as
`docs/screenshots/shot-2-review-logs.png`. Until then the reviews on #1 and #2 were posted by running
`scripts/ai-review.mjs` against an OpenAI-compatible gateway.

### 3. Agent review comment on PR #1
![PR #1 with the agent review comment](docs/screenshots/shot-3-pr-comment.png)
