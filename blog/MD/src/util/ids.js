// ids.js - ULID fallback & timestamp helpers

// Minimal ULID generator implementation if external library fails to load
function getRandomValues(buf) {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(buf);
  }
  for (let i = 0; i < buf.length; i++) {
    buf[i] = Math.floor(Math.random() * 256);
  }
  return buf;
}

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ENCODING_LEN = ENCODING.length;

export function newId() {
  const now = Date.now();
  let timeStr = '';
  let time = now;
  for (let i = 9; i >= 0; i--) {
    const mod = time % ENCODING_LEN;
    timeStr = ENCODING[mod] + timeStr;
    time = Math.floor(time / ENCODING_LEN);
  }

  const randBytes = new Uint8Array(10);
  getRandomValues(randBytes);
  let randStr = '';
  for (let i = 0; i < 10; i++) {
    randStr += ENCODING[randBytes[i] % ENCODING_LEN];
  }

  return (timeStr + randStr).toLowerCase();
}

export const now = () => Date.now();
export const iso = (t = Date.now()) => new Date(t).toISOString();

export function formatDate(t) {
  if (!t) return '';
  const d = new Date(t);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
