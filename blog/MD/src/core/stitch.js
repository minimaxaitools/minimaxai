// stitch.js - F2.3 Stitcher & Overlap Remover

import { stripPreamble, overlapLength } from '../util/text.js';

export function stitchChunks(chunks, options = {}) {
  if (!chunks || chunks.length === 0) return '';
  if (chunks.length === 1) return chunks[0].text;

  const removeOverlap = options.removeOverlap !== false;
  const removePreamble = options.removePreamble !== false;
  const showSeams = options.showSeams || false;

  let result = chunks[0].text;

  for (let i = 1; i < chunks.length; i++) {
    let nextText = chunks[i].text;

    if (removePreamble) {
      nextText = stripPreamble(nextText);
    }

    if (removeOverlap) {
      const matchLen = overlapLength(result, nextText, 30, 3000);
      if (matchLen > 0) {
        nextText = nextText.slice(matchLen);
      }
    }

    if (showSeams) {
      result += `\n\n<!-- --- CHUNK SEAM ${i + 1} --- -->\n\n` + nextText;
    } else {
      result += '\n' + nextText;
    }
  }

  return result;
}
