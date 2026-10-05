/**
 * Output hardening for the AI review comment.
 *
 * The review quotes the PR diff, and the diff is attacker-controlled. Before the
 * comment is posted we (1) drop workflow-trigger lines and neutralize fenced
 * workflow YAML so quoted content cannot read as a runnable workflow or as
 * instructions to a downstream agent, and (2) cap the length.
 */

export const MAX_COMMENT_CHARS = 6000;
export const TRUNCATION_NOTICE = '\n\n_…review truncated at 6000 characters._';
export const YAML_BLOCK_NOTICE = '_[workflow YAML block removed by sanitizer]_';

// `on:`, `runs-on:`, `uses:` at line start, tolerating diff markers (+/-), list dashes and indentation.
const TRIGGER_LINE_RE = /^[ \t+\-]*(?:on|runs-on|uses)[ \t]*:/i;
const FENCE_RE = /^[ \t]{0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)/;
const WORKFLOW_YAML_LANGS = new Set(['yaml', 'yml']);

/** Replace fenced yaml/yml blocks (and fenced blocks containing workflow keys) with a notice. */
export function neutralizeWorkflowBlocks(text) {
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const open = FENCE_RE.exec(lines[i]);
    if (!open) {
      out.push(lines[i]);
      continue;
    }
    const [, fence, lang] = open;
    let end = -1;
    for (let j = i + 1; j < lines.length; j++) {
      const close = FENCE_RE.exec(lines[j]);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length && !close[2]) {
        end = j;
        break;
      }
    }
    const last = end === -1 ? lines.length - 1 : end;
    const body = lines.slice(i + 1, end === -1 ? lines.length : end);
    const isWorkflow =
      WORKFLOW_YAML_LANGS.has(lang.toLowerCase()) || body.some((l) => TRIGGER_LINE_RE.test(l));
    if (isWorkflow) {
      out.push(YAML_BLOCK_NOTICE);
    } else {
      out.push(...lines.slice(i, last + 1));
    }
    i = last;
  }
  return out.join('\n');
}

/** Remove lines that look like GitHub workflow trigger syntax. */
export function stripTriggerLines(text) {
  return text
    .split('\n')
    .filter((l) => !TRIGGER_LINE_RE.test(l))
    .join('\n');
}

/** Cap at `max` chars including the notice; close any code fence the cut left open. */
export function capLength(text, max = MAX_COMMENT_CHARS) {
  if (text.length <= max) return text;
  const reserve = TRUNCATION_NOTICE.length + 4; // room for a closing fence
  let head = text.slice(0, max - reserve);
  const fences = head.split('\n').filter((l) => FENCE_RE.test(l)).length;
  if (fences % 2 === 1) head += '\n```';
  return head + TRUNCATION_NOTICE;
}

/** Full pipeline applied to the comment body right before it is posted. */
export function sanitizeAndCap(body, max = MAX_COMMENT_CHARS) {
  return capLength(stripTriggerLines(neutralizeWorkflowBlocks(String(body))), max);
}
