// Toasts.js - Toast Notification Manager

import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

let addToastFn = null;

export function showToast(message, type = 'info', duration = 3000) {
  if (addToastFn) {
    addToastFn({ id: Date.now(), message, type, duration });
  }
}

export function ToastsContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    addToastFn = toast => {
      setToasts(prev => [...prev, toast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, toast.duration);
    };
  }, []);

  return h('div', { className: 'toasts' },
    toasts.map(t =>
      h('div', { key: t.id, className: `toast toast-${t.type}` },
        h('span', null, t.message)
      )
    )
  );
}
