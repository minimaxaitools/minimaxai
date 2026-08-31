// tokens.js - Token estimation heuristics and character counts

export function estimateTokenCount(text) {
  if (!text) return 0;
  // Standard heuristic for English text and code: 1 token ~ 4 characters
  return Math.ceil(text.length / 4);
}

export function formatCharCount(chars) {
  if (chars >= 1000000) {
    return (chars / 1000000).toFixed(1) + 'M';
  }
  if (chars >= 1000) {
    return (chars / 1000).toFixed(1) + 'K';
  }
  return chars.toString();
}
