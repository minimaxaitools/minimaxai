// project-manager.js — Project Save/Load + Enhanced History Tab
// Registers: window.EnhancedHistoryTab, window.SaveProjectButton

(function () {
    const { useState } = React;

    // Enhanced History Tab — shows both simple prompts and full projects
    window.EnhancedHistoryTab = function EnhancedHistoryTab({
        history, setHistory,
        projects, setProjects,
        loadHistoryItem,
        deleteHistoryItem,
        // For project loading
        setSourceText, setSlices, setCommonTexts,
        setMasterStyles, setActiveMasterStyleId,
        setGeneratedPrompts, setPromptText,
        setActiveTab,
        showNotification
    }) {
        const [viewFilter, setViewFilter] = useState('all'); // 'all' | 'projects' | 'prompts'

        const loadProject = (project) => {
            setSourceText(project.sourceText || '');
            setSlices(project.slices || []);
            setCommonTexts(project.commonTexts || []);
            if (project.activeMasterStyle) {
                // Ensure the master style exists, or add it
                setMasterStyles(prev => {
                    const existing = prev.find(s => s.id === project.activeMasterStyle.id);
                    if (!existing) {
                        return [...prev, project.activeMasterStyle];
                    }
                    return prev;
                });
                setActiveMasterStyleId(project.activeMasterStyle.id);
            }
            if (project.generatedPrompts) setGeneratedPrompts(project.generatedPrompts);
            if (project.editorPrompt) setPromptText(project.editorPrompt);
            setActiveTab('slicer');
            showNotification('📁 Project loaded: ' + project.name);
        };

        const deleteProject = (id) => {
            if (!confirm('Delete this project? This cannot be undone.')) return;
            setProjects(prev => prev.filter(p => p.id !== id));
            showNotification('Project deleted');
        };

        const exportProject = (project) => {
            const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'project_' + project.name.replace(/\s+/g, '_') + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showNotification('Project exported!');
        };

        const Ic = window.Icons || {};

        // Combined items for display
        const allItems = [];

        if (viewFilter === 'all' || viewFilter === 'projects') {
            projects.forEach(p => allItems.push({ ...p, _type: 'project' }));
        }
        if (viewFilter === 'all' || viewFilter === 'prompts') {
            history.forEach(h => allItems.push({ ...h, _type: 'prompt' }));
        }

        // Sort by date descending
        allItems.sort((a, b) => {
            const da = new Date(a.date || a.savedAt || 0);
            const db = new Date(b.date || b.savedAt || 0);
            return db - da;
        });

        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header with filters */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <span className="text-lg">📂</span> History
                        <span className="text-xs text-gray-500">({projects.length} projects, {history.length} prompts)</span>
                    </h3>
                    <div className="flex bg-gray-100 dark:bg-gray-800 rounded-md p-0.5">
                        {['all', 'projects', 'prompts'].map(f => (
                            <button
                                key={f}
                                onClick={() => setViewFilter(f)}
                                className={`px-2.5 py-1 text-xs font-medium rounded capitalize transition-colors ${
                                    viewFilter === f
                                        ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                            >{f}</button>
                        ))}
                    </div>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3">
                    {allItems.length === 0 ? (
                        <div className="text-center py-20 text-gray-500">
                            {Ic.History ? <Ic.History /> : '🕐'}
                            <p className="mt-4">No items saved yet.</p>
                        </div>
                    ) : (
                        allItems.map(item => (
                            item._type === 'project' ? (
                                /* Project Card */
                                <div key={item.id} className="bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-800/50 rounded-lg overflow-hidden shadow-sm transition-colors duration-200">
                                    <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-indigo-100 dark:border-indigo-800/30 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded text-xs font-bold">📁 Project</span>
                                            <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{item.name}</span>
                                        </div>
                                        <span className="text-xs text-gray-400">{item.savedAt || item.date}</span>
                                    </div>
                                    <div className="px-4 py-3">
                                        <div className="flex flex-wrap gap-2 mb-3 text-xs text-gray-500">
                                            <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{(item.slices || []).length} slices</span>
                                            <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{(item.commonTexts || []).length} common</span>
                                            {item.activeMasterStyle && (
                                                <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded">🎨 {item.activeMasterStyle.title}</span>
                                            )}
                                            {item.generatedPrompts && (
                                                <span className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded">{item.generatedPrompts.length} prompts</span>
                                            )}
                                        </div>
                                        {item.sourceText && (
                                            <div className="text-xs font-mono text-gray-500 bg-gray-50 dark:bg-gray-800/50 p-2 rounded line-clamp-2 mb-3">{item.sourceText.substring(0, 200)}…</div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => loadProject(item)} className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors">Load Project</button>
                                            <button onClick={() => exportProject(item)} className="px-3 py-1.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors">Export</button>
                                            <button onClick={() => deleteProject(item.id)} className="px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors">Delete</button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Simple Prompt Card (existing style) */
                                <div key={item.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 shadow-sm transition-colors duration-200">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs text-gray-400">{item.date}</span>
                                        <div className="flex space-x-2">
                                            <button onClick={() => loadHistoryItem(item.text)} className="p-1.5 text-gray-500 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition-colors" title="Load to Editor">
                                                {Ic.Edit ? <Ic.Edit /> : '✏️'}
                                            </button>
                                            <button onClick={() => deleteHistoryItem(item.id)} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors" title="Delete">
                                                {Ic.Trash ? <Ic.Trash /> : '🗑'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 font-mono bg-gray-50 dark:bg-gray-800/50 p-2 rounded border border-gray-100 dark:border-gray-700/50">{item.text}</div>
                                    <button
                                        onClick={() => { navigator.clipboard.writeText(item.text); showNotification('Copied from history!'); }}
                                        className="mt-3 text-sm text-primary-600 dark:text-primary-400 font-medium hover:underline flex items-center space-x-1"
                                    >
                                        {Ic.Copy ? <Ic.Copy /> : '📋'} <span>Copy Prompt</span>
                                    </button>
                                </div>
                            )
                        ))
                    )}
                </div>
            </div>
        );
    };

    // Save Project Button Component (used in the slicer/header area)
    window.SaveProjectButton = function SaveProjectButton({
        sourceText, slices, commonTexts,
        masterStyles, activeMasterStyleId,
        generatedPrompts, promptText,
        projects, setProjects,
        showNotification
    }) {
        const saveProject = () => {
            const name = prompt('Enter a project name:', 'Infographic Project ' + (projects.length + 1));
            if (!name) return;

            const activeStyle = masterStyles.find(s => s.id === activeMasterStyleId) || null;

            const project = {
                id: 'proj_' + Date.now(),
                name: name.trim(),
                savedAt: new Date().toLocaleString(),
                date: new Date().toISOString(),
                sourceText,
                slices,
                commonTexts,
                activeMasterStyle: activeStyle ? { id: activeStyle.id, title: activeStyle.title, content: activeStyle.content } : null,
                generatedPrompts,
                editorPrompt: promptText
            };

            setProjects(prev => [project, ...prev]);
            showNotification('📁 Project saved: ' + name);
        };

        const Ic = window.Icons || {};

        return (
            <button
                onClick={saveProject}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm transition-colors"
                title="Save entire project (slices + style + common text)"
            >
                {Ic.Save ? <Ic.Save /> : '💾'} <span className="hidden sm:inline">Save Project</span>
            </button>
        );
    };
})();
