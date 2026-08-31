// clipboard.js - F1.2 Clipboard Assist & optional background focus watcher

export async function readClipboardText() {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      return await navigator.clipboard.readText();
    }
  } catch (err) {
    console.warn('Clipboard read access denied or unsupported:', err);
  }
  return '';
}

export async function writeClipboardText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard write failed:', err);
  }

  // Fallback to legacy execCommand copy
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}

let watcherInterval = null;
let lastClipboardText = '';

export function startClipboardWatcher(onNewText, intervalMs = 1500) {
  stopClipboardWatcher();
  watcherInterval = setInterval(async () => {
    if (!document.hasFocus()) return;
    const text = await readClipboardText();
    if (text && text !== lastClipboardText && text.trim().length > 10) {
      lastClipboardText = text;
      onNewText(text);
    }
  }, intervalMs);
}

export function stopClipboardWatcher() {
  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
  }
}
