// useHotkeys.js - F5.2 Global Keyboard Shortcuts Map Hook

import { useEffect } from 'preact/hooks';

export function useHotkeys(keyMap) {
  useEffect(() => {
    function handleKeyDown(e) {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (keyMap.onCommandPalette) keyMap.onCommandPalette();
      } else if (isCtrlOrCmd && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        if (keyMap.onContinuePrompt) keyMap.onContinuePrompt();
      } else if (isCtrlOrCmd && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        if (keyMap.onHandoffPack) keyMap.onHandoffPack();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyMap]);
}
