// artifacts.js - Code block extraction, hashing, deduplication & versioning

import { newId } from '../util/ids.js';
import { hashText } from '../util/hash.js';
import { firstHeadingOrLine } from '../util/text.js';

export function extractArtifacts(text, turn) {
  if (!text) return [];

  const artifacts = [];
  const codeBlockRegex = /```([A-Za-z0-9_+-]*)\n([\s\S]*?)```/g;

  let match;
  let index = 0;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    index++;
    const lang = (match[1] || 'text').toLowerCase();
    const content = match[2].trim();

    if (!content) continue;

    let type = 'code';
    if (lang === 'json') type = 'json';
    else if (lang === 'sql') type = 'sql';
    else if (lang === 'sh' || lang === 'bash' || lang === 'zsh') type = 'shell';
    else if (lang === 'markdown' || lang === 'md') type = 'markdown';
    else if (lang === 'mermaid') type = 'diagram';

    // Auto-extract title from first comment or code line
    const titleMatch = content.match(/^(?:\/\/|#|\/\*|<!--)\s*(?:file:?\s*)?([A-Za-z0-9_.\-\/]+\.[A-Za-z0-9]+)/i);
    const title = titleMatch ? titleMatch[1] : `${firstHeadingOrLine(content, 40)} (Snippet #${index})`;
    const hash = hashText(content);

    artifacts.push({
      id: newId(),
      turnId: turn.id,
      threadId: turn.threadId,
      projectId: turn.projectId,
      type,
      lang,
      title,
      content,
      version: 1,
      starred: false,
      tags: [lang],
      hash
    });
  }

  return artifacts;
}
