// truncation.js - F2.1 Truncation Detector logic

import { countFences, lastOpenFenceLang } from '../util/text.js';

const TERMINAL_PUNCT = /[.!?;:)\]}`"'’”…]\s*$/;

function unbalancedBrackets(code) {
  if (!code) return false;
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const stack = [];
  let inStr = null;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    const p = code[i - 1];
    if (inStr) {
      if (c === inStr && p !== '\\') inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      continue;
    }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === ')' || c === ']' || c === '}') {
      if (stack.pop() !== c) return true;
    }
  }
  return stack.length > 0;
}

function extractLastCodeBlock(text) {
  const blocks = [...text.matchAll(/```[A-Za-z0-9_+-]*\n([\s\S]*?)(?:```|$)/g)];
  return blocks.length ? blocks[blocks.length - 1][1] : '';
}

export function detectTruncation(text, { maxOutChars = 22000, contractEnabled = true } = {}) {
  const t = (text || '').trim();
  if (!t) {
    return { truncated: false, score: 0, reason: 'empty', signals: [], openFenceLang: null };
  }

  const signals = [];

  if (/\[\[MORE\]\]\s*$/.test(t)) {
    signals.push(['explicit_more', 1.0]);
  }
  if (contractEnabled && /\[\[END\]\]\s*$/.test(t)) {
    return { truncated: false, score: 0, reason: 'explicit_end', signals: [['explicit_end', 1]], openFenceLang: null };
  }

  if (countFences(t) % 2 === 1) {
    signals.push(['unclosed_fence', 0.95]);
  }
  if (t.length > maxOutChars * 0.94) {
    signals.push(['near_limit', 0.85]);
  }
  if (unbalancedBrackets(extractLastCodeBlock(t))) {
    signals.push(['unbalanced_code', 0.8]);
  }
  if (!TERMINAL_PUNCT.test(t)) {
    signals.push(['mid_sentence', 0.7]);
  }
  if (contractEnabled && t.length > 1000 && !/\[\[(END|MORE)\]\]/.test(t)) {
    signals.push(['no_end_marker', 0.6]);
  }

  // Announced item count check (e.g. "7 steps" / "5 parts" but fewer items present)
  const promised = t.match(/\b(\d{1,2})\s+(?:files?|steps?|parts?|sections?|items?)\b/i);
  if (promised) {
    const n = parseInt(promised[1], 10);
    const delivered = new Set((t.match(/^\s{0,3}(\d{1,2})[.)]\s/gm) || []).map(s => parseInt(s.trim(), 10))).size;
    if (n > 2 && delivered > 0 && delivered < n) {
      signals.push(['missing_items', 0.75]);
    }
  }

  const score = signals.length ? Math.max(...signals.map(s => s[1])) : 0;
  const top = signals.sort((a, b) => b[1] - a[1])[0];

  return {
    truncated: score >= 0.7,
    score,
    reason: top ? top[0] : 'none',
    signals,
    openFenceLang: lastOpenFenceLang(t)
  };
}

export const REASON_LABELS = {
  unclosed_fence: 'Unclosed code fence',
  explicit_more: 'Model signaled [[MORE]]',
  near_limit: 'Hit character output ceiling limit',
  unbalanced_code: 'Unbalanced bracket structure in code',
  mid_sentence: 'Ends mid-sentence without terminal punctuation',
  no_end_marker: 'Missing contract [[END]] marker',
  missing_items: 'Number of items delivered is less than announced count'
};
