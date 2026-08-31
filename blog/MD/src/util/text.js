// text.js - String processing, token estimates, tail anchor extraction, overlap detection, clean prompt formatting

export const chars = s => (s ? s.length : 0);
export const estTokens = s => Math.ceil(chars(s) / 4);
export const pct = (a, b) => (b ? Math.min(999, Math.round((a / b) * 100)) : 0);

export function firstHeadingOrLine(text, max = 70) {
  if (!text) return 'Untitled';
  const h = text.match(/^#{1,3}\s+(.+)$/m);
  const raw = (h ? h[1] : text.split('\n').find(l => l.trim()) || 'Untitled').trim();
  return raw.length > max ? raw.slice(0, max - 1) + '…' : raw;
}

export function tail(text, n = 300) {
  if (!text) return '';
  return text.length <= n ? text : text.slice(-n);
}

export function stripPreamble(text) {
  if (!text) return '';
  return text.replace(
    /^\s*(?:sure(?:!|,)?|certainly(?:!|,)?|of course(?:!|,)?|continuing(?: from where (?:i|we) left off)?|here'?s the (?:rest|continuation)|picking up where we left off)[^\n]*\n+/i,
    ''
  );
}

// Longest suffix of a that is a prefix of b (min length guard)
export function overlapLength(a, b, min = 40, maxWindow = 4000) {
  if (!a || !b) return 0;
  const A = a.slice(-maxWindow);
  const B = b.slice(0, maxWindow);
  const limit = Math.min(A.length, B.length);
  for (let len = limit; len >= min; len--) {
    if (A.endsWith(B.slice(0, len))) return len;
  }
  return 0;
}

export function countFences(text) {
  if (!text) return 0;
  return (text.match(/^```/gm) || []).length;
}

export function lastOpenFenceLang(text) {
  if (!text) return null;
  const fences = [...text.matchAll(/^```([A-Za-z0-9_+-]*)\s*$/gm)];
  if (fences.length % 2 === 0) return null;
  return fences[fences.length - 1][1] || '';
}

export function truncateString(str, maxLen = 100) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

export function cleanPromptText(text) {
  if (!text) return '';
  return text.replace(/\n\n\[OUTPUT CONTRACT\][\s\S]*$/, '').trim();
}
