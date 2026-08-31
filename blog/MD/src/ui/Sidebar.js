// Sidebar.js - Workspace Navigation, Project Selector, View Tabs & Thread List

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { useLiveQuery } from './hooks/useLiveQuery.js';
import { db } from '../db/db.js';
import { repo } from '../db/repo.js';
import { showToast } from './Toasts.js';

export function Sidebar({ activeThreadId, activeView = 'thread', onSelectThread, onSelectView, onOpenHandoff }) {
  const [projectSearch, setProjectSearch] = useState('');
  const [threadSearch, setThreadSearch] = useState('');
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const projects = useLiveQuery(() => repo.getProjects()) || [];
  const activeProjectIdSetting = useLiveQuery(() => db.settings.get('activeProjectId')) || {};
  const activeProjectId = activeProjectIdSetting.value;

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

  const threads = useLiveQuery(
    () => activeProjectId ? repo.getThreads(activeProjectId) : repo.getThreads(),
    [activeProjectId]
  ) || [];

  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()));
  const filteredThreads = threads.filter(t => t.title.toLowerCase().includes(threadSearch.toLowerCase()));

  async function handleSelectProject(projectId) {
    await repo.setSetting('activeProjectId', projectId);
    const projThreads = await repo.getThreads(projectId);
    if (projThreads.length > 0) {
      onSelectThread(projThreads[0].id);
    }
  }

  async function handleCreateProject() {
    if (!newProjectName.trim()) return;
    const proj = await repo.createProject(newProjectName.trim());
    await repo.setSetting('activeProjectId', proj.id);
    const thread = await repo.createThread(proj.id, 'General Thread');
    onSelectThread(thread.id);
    setNewProjectName('');
    setShowNewProjectInput(false);
    showToast(`Created Project: ${proj.name}`, 'success');
  }

  async function handleDeleteProject(proj) {
    if (confirm(`Are you sure you want to delete Project "${proj.name}" and all its threads, sessions, and turns?`)) {
      await repo.deleteProject(proj.id);
      showToast(`Deleted Project "${proj.name}"`, 'info');
    }
  }

  async function handleCreateThread() {
    if (!activeProjectId) {
      showToast('Select or create a project first', 'warning');
      return;
    }
    const thread = await repo.createThread(activeProjectId, `Thread #${threads.length + 1}`);
    onSelectThread(thread.id);
    showToast('Created new thread', 'success');
  }

  async function handleDeleteThread(e, thread) {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete Thread "${thread.title}"?`)) {
      await repo.deleteThread(thread.id);
      showToast(`Deleted Thread "${thread.title}"`, 'info');
    }
  }

  return h('aside', { className: 'sidebar' },
    // Project Selector Header
    h('div', { style: { padding: '12px 14px', borderBottom: '1px solid var(--border-color)' } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' } },
        h('strong', { style: { fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.5px' } }, 'PROJECT WORKSPACE'),
        h('button', {
          className: 'btn btn-secondary',
          style: { padding: '2px 6px', fontSize: '11px' },
          onClick: () => setShowNewProjectInput(!showNewProjectInput)
        }, showNewProjectInput ? 'Cancel' : '+ New Project')
      ),

      showNewProjectInput
        ? h('div', { style: { display: 'flex', gap: '6px', marginBottom: '8px' } },
            h('input', {
              className: 'pane-textarea',
              style: { height: '30px', padding: '4px 8px', fontSize: '12px' },
              placeholder: 'Project name...',
              value: newProjectName,
              onInput: e => setNewProjectName(e.target.value)
            }),
            h('button', { className: 'btn btn-primary', style: { padding: '4px 8px', fontSize: '11px' }, onClick: handleCreateProject }, 'Save')
          )
        : h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
            h('select', {
              className: 'model-select',
              style: { flex: 1, fontSize: '12px' },
              value: activeProjectId || '',
              onChange: e => handleSelectProject(e.target.value)
            },
              projects.map(p => h('option', { key: p.id, value: p.id }, p.name))
            ),
            activeProject && h('button', {
              className: 'btn btn-danger',
              style: { padding: '3px 6px', fontSize: '11px' },
              title: 'Delete Active Project',
              onClick: () => handleDeleteProject(activeProject)
            }, '🗑️')
          ),

      projects.length > 3 && h('input', {
        className: 'pane-textarea',
        style: { height: '26px', padding: '2px 8px', fontSize: '11px', marginTop: '6px' },
        placeholder: '🔍 Find project...',
        value: projectSearch,
        onInput: e => setProjectSearch(e.target.value)
      })
    ),

    // Workspace Views Nav Tabs
    h('div', { style: { padding: '8px 10px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '2px' } },
      h('button', {
        className: `sidebar-item ${activeView === 'thread' ? 'active' : ''}`,
        style: { border: 'none', background: activeView === 'thread' ? 'var(--bg-active)' : 'transparent', textAlign: 'left', width: '100%' },
        onClick: () => onSelectView('thread')
      }, '💬 Active Thread'),
      h('button', {
        className: `sidebar-item ${activeView === 'solutions' ? 'active' : ''}`,
        style: { border: 'none', background: activeView === 'solutions' ? 'var(--bg-active)' : 'transparent', textAlign: 'left', width: '100%' },
        onClick: () => onSelectView('solutions')
      }, '⭐ Artifact Library'),
      h('button', {
        className: `sidebar-item ${activeView === 'playbooks' ? 'active' : ''}`,
        style: { border: 'none', background: activeView === 'playbooks' ? 'var(--bg-active)' : 'transparent', textAlign: 'left', width: '100%' },
        onClick: () => onSelectView('playbooks')
      }, '📋 High-Ticket Playbooks'),
      h('button', {
        className: `sidebar-item ${activeView === 'dashboard' ? 'active' : ''}`,
        style: { border: 'none', background: activeView === 'dashboard' ? 'var(--bg-active)' : 'transparent', textAlign: 'left', width: '100%' },
        onClick: () => onSelectView('dashboard')
      }, '📊 Model Analytics'),
      h('button', {
        className: `sidebar-item ${activeView === 'settings' ? 'active' : ''}`,
        style: { border: 'none', background: activeView === 'settings' ? 'var(--bg-active)' : 'transparent', textAlign: 'left', width: '100%' },
        onClick: () => onSelectView('settings')
      }, '⚙ App Settings & Backup')
    ),

    // Threads Header & Quick Filter
    h('div', { style: { padding: '10px 14px 4px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h('strong', { style: { fontSize: '11px', color: 'var(--text-muted)' } }, 'THREADS IN PROJECT'),
      h('button', { className: 'btn btn-primary', style: { padding: '2px 6px', fontSize: '11px' }, onClick: handleCreateThread }, '+ Thread')
    ),

    threads.length > 4 && h('div', { style: { padding: '0 14px 6px 14px' } },
      h('input', {
        className: 'pane-textarea',
        style: { height: '26px', padding: '2px 8px', fontSize: '11px' },
        placeholder: '🔍 Filter threads...',
        value: threadSearch,
        onInput: e => setThreadSearch(e.target.value)
      })
    ),

    // Thread List
    h('div', { className: 'sidebar-nav' },
      filteredThreads.map(thread => {
        const isActive = thread.id === activeThreadId && activeView === 'thread';
        return h('div', {
          key: thread.id,
          className: `sidebar-item ${isActive ? 'active' : ''}`,
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
          onClick: () => {
            onSelectThread(thread.id);
            onSelectView('thread');
          }
        },
          h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 } },
            thread.pinned ? '📌 ' : '💬 ',
            thread.title
          ),
          h('button', {
            className: 'btn btn-secondary',
            style: { padding: '1px 5px', fontSize: '10px', opacity: 0.7 },
            onClick: e => handleDeleteThread(e, thread)
          }, '🗑️')
        );
      })
    ),

    // Bottom Quick Tool Button
    h('div', { style: { padding: '12px 14px', borderTop: '1px solid var(--border-color)' } },
      h('button', {
        className: 'btn btn-primary',
        style: { fontSize: '12px', width: '100%', justifyContent: 'center' },
        onClick: onOpenHandoff
      }, '🔄 Build Handoff Pack')
    )
  );
}
