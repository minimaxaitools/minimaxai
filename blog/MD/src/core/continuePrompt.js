// continuePrompt.js - F2.2 Continuation Prompt Generator

import { tail } from '../util/text.js';

export function buildContinuePrompt(lastChunkText, { openFenceLang = null, mode = 'strict' } = {}) {
  const tailAnchor = tail(lastChunkText, 300);

  if (mode === 'fence' && openFenceLang !== null) {
    return `CONTINUE. Your previous message was cut off by the output limit inside a code block.

Resume EXACTLY from where you stopped. Do not repeat any content already delivered. Do not re-introduce, do not summarize, do not apologize.

The last characters of code you produced were:
---
${tailAnchor}
---

Start your reply immediately with the next line of raw code (no code fences \`\`\`, no commentary).
When complete, close the code fence with \`\`\` and end your message with [[END]].
If cut off again, end with [[MORE]].`;
  }

  if (mode === 'outline') {
    return `CONTINUE. Your previous response was cut off.

1. State in 1 line which section/function you are resuming.
2. Resume EXACTLY from where you stopped without repeating prior text.

The last characters you produced were:
---
${tailAnchor}
---

End your message with [[END]] when fully complete, or [[MORE]] if cut off again.`;
  }

  // Default: Strict resume
  return `CONTINUE. Your previous message was cut off by the output limit.

Resume EXACTLY from where you stopped. Do not repeat any content already delivered. Do not re-introduce, do not summarize, do not apologize.

The last characters you produced were:
---
${tailAnchor}
---

Continue from immediately after that point.
If you were inside a code block, continue inside the same code block (start your reply with the raw next line of code, no fences, no commentary).
When the full answer is finally complete, end your message with [[END]].
If you are cut off again, end with [[MORE]].`;
}

export function buildOutputContract() {
  return `[OUTPUT CONTRACT]
- Hard limit awareness: your reply is capped at ~8K tokens.
- If the full answer won't fit, deliver a complete, self-contained PART 1 ending at a clean boundary and finish with:
  [[MORE]] NEXT: <one-line description of what part 2 will contain>
- If it fits completely, finish with [[END]].
- Never truncate mid-token silently. Never pad with filler.
- Code: full file contents, no "// ... rest unchanged".`;
}
