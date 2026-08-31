// App.js - Root Preact Application Component

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { useLiveQuery } from './hooks/useLiveQuery.js';
import { useHotkeys } from './hooks/useHotkeys.js';
import { db } from '../db/db.js';
import { Shell } from './Shell.js';
import { Sidebar } from './Sidebar.js';
import { CaptureBar } from './CaptureBar.js';
import { ThreadView } from './ThreadView.js';
import { CommandPalette } from './CommandPalette.js';
import { HandoffModal } from './HandoffModal.js';
import { ContextPackerModal } from './ContextPackerModal.js';
import { ArtifactLibrary } from './ArtifactLibrary.js';
import { PlaybookRunner } from './PlaybookRunner.js';
import { Dashboard } from './Dashboard.js';
import { Settings } from './Settings.js';
import { ToastsContainer } from './Toasts.js';

export function App() {
  const [activeView, setActiveView] = useState('thread');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHandoffOpen, setIsHandoffOpen] = useState(false);
  const [isContextPackerOpen, setIsContextPackerOpen] = useState(false);

  const activeThreadIdSetting = useLiveQuery(() => db.settings.get('activeThreadId')) || {};
  const activeSessionIdSetting = useLiveQuery(() => db.settings.get('activeSessionId')) || {};
  const activeModelIdSetting = useLiveQuery(() => db.settings.get('activeModelId')) || {};

  const activeThreadId = activeThreadIdSetting.value;
  const activeSessionId = activeSessionIdSetting.value;
  const activeModelId = activeModelIdSetting.value;

  const models = useLiveQuery(() => db.models.toArray()) || [];
  const activeSession = useLiveQuery(() => activeSessionId ? db.sessions.get(activeSessionId) : null, [activeSessionId]);
  const activeThread = useLiveQuery(() => activeThreadId ? db.threads.get(activeThreadId) : null, [activeThreadId]);
  const activeModel = models.find(m => m.id === activeModelId) || models[0];

  useHotkeys({
    onCommandPalette: () => setIsSearchOpen(true),
    onHandoffPack: () => setIsHandoffOpen(true)
  });

  return h('div', { style: { width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' } },
    h(Shell, {
      activeThreadId,
      activeSessionId,
      activeModelId,
      onOpenSearch: () => setIsSearchOpen(true),
      onOpenHandoff: () => setIsHandoffOpen(true),
      onOpenContextPacker: () => setIsContextPackerOpen(true),
      onOpenSettings: () => setActiveView('settings')
    },
      h(Sidebar, {
        activeThreadId,
        activeView,
        onSelectThread: id => {
          db.settings.put({ key: 'activeThreadId', value: id });
          setActiveView('thread');
        },
        onSelectView: view => setActiveView(view),
        onOpenHandoff: () => setIsHandoffOpen(true)
      }),

      h('main', { className: 'main-content' },
        activeView === 'thread' && h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
          h(CaptureBar, {
            session: activeSession,
            thread: activeThread,
            activeModel,
            onTurnAdded: () => {}
          }),
          h(ThreadView, { threadId: activeThreadId, models })
        ),
        activeView === 'solutions' && h(ArtifactLibrary, { onSelectThread: id => setActiveView('thread') }),
        activeView === 'playbooks' && h(PlaybookRunner, { threadId: activeThreadId }),
        activeView === 'dashboard' && h(Dashboard),
        activeView === 'settings' && h(Settings)
      )
    ),

    h(CommandPalette, {
      isOpen: isSearchOpen,
      onClose: () => setIsSearchOpen(false),
      onSelectThread: id => {
        db.settings.put({ key: 'activeThreadId', value: id });
        setActiveView('thread');
      }
    }),

    h(HandoffModal, {
      isOpen: isHandoffOpen,
      onClose: () => setIsHandoffOpen(false),
      threadId: activeThreadId,
      activeModel
    }),

    h(ContextPackerModal, {
      isOpen: isContextPackerOpen,
      onClose: () => setIsContextPackerOpen(false),
      threadId: activeThreadId
    }),

    h(ToastsContainer)
  );
}
