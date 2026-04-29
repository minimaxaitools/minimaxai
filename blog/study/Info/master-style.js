// master-style.js — Master Style Tab Component
// Registers: window.MasterStyleTab

(function () {
    const { useState } = React;

    window.MasterStyleTab = function MasterStyleTab({
        masterStyles, setMasterStyles,
        activeMasterStyleId, setActiveMasterStyleId,
        masterStyleRef,
        showNotification
    }) {
        const [editTitle, setEditTitle] = useState('');
        const [editContent, setEditContent] = useState('');
        const [isEditing, setIsEditing] = useState(false);
        const [editingPresetId, setEditingPresetId] = useState(null);

        const activeStyle = masterStyles.find(s => s.id === activeMasterStyleId) || null;

        // Initialize edit fields when active style changes
        React.useEffect(() => {
            if (activeStyle) {
                setEditTitle(activeStyle.title);
                setEditContent(activeStyle.content);
            } else {
                setEditTitle('');
                setEditContent('');
            }
        }, [activeMasterStyleId]);

        const createNewStyle = () => {
            const newStyle = {
                id: 'style_' + Date.now(),
                title: 'New Style ' + (masterStyles.length + 1),
                content: ''
            };
            setMasterStyles(prev => [...prev, newStyle]);
            setActiveMasterStyleId(newStyle.id);
            setEditTitle(newStyle.title);
            setEditContent('');
            setIsEditing(true);
            showNotification('🎨 New style created!');
        };

        const saveCurrentEdit = () => {
            if (!activeMasterStyleId) return;
            setMasterStyles(prev => prev.map(s =>
                s.id === activeMasterStyleId
                    ? { ...s, title: editTitle.trim() || 'Untitled Style', content: editContent }
                    : s
            ));
            setIsEditing(false);
            showNotification('💾 Style saved!');
        };

        const deleteStyle = (id) => {
            if (!confirm('Delete this style preset?')) return;
            setMasterStyles(prev => prev.filter(s => s.id !== id));
            if (activeMasterStyleId === id) {
                setActiveMasterStyleId(null);
                setEditTitle('');
                setEditContent('');
            }
            showNotification('Style deleted');
        };

        const duplicateStyle = (style) => {
            const dup = {
                id: 'style_' + Date.now(),
                title: style.title + ' (Copy)',
                content: style.content
            };
            setMasterStyles(prev => [...prev, dup]);
            showNotification('Style duplicated!');
        };

        const Ic = window.Icons || {};

        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 md:p-5 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <span className="text-lg">🎨</span> Master Style Prompt
                        </h3>
                        <button
                            onClick={createNewStyle}
                            className="px-3 py-1.5 text-sm font-medium bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-md shadow-sm transition-all flex items-center gap-1"
                        >
                            {Ic.Plus ? <Ic.Plus /> : '+'} New Style
                        </button>
                    </div>

                    {/* Style Presets */}
                    {masterStyles.length > 0 && (
                        <div className="space-y-1.5">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Presets</span>
                            <div className="flex flex-wrap gap-2">
                                {masterStyles.map(style => (
                                    <div key={style.id} className="group relative">
                                        <button
                                            onClick={() => {
                                                setActiveMasterStyleId(style.id);
                                                setEditTitle(style.title);
                                                setEditContent(style.content);
                                                setIsEditing(false);
                                            }}
                                            className={`px-3 py-1.5 text-sm rounded-md border transition-all duration-200 ${
                                                activeMasterStyleId === style.id
                                                    ? 'border-purple-400 bg-purple-50 text-purple-700 dark:border-purple-500 dark:bg-purple-500/20 dark:text-purple-300 ring-2 ring-purple-200 dark:ring-purple-800'
                                                    : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300 hover:bg-purple-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-purple-600'
                                            }`}
                                        >
                                            {activeMasterStyleId === style.id && <span className="mr-1">✦</span>}
                                            {style.title}
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteStyle(style.id); }}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                            title="Delete preset"
                                        >
                                            {Ic.X ? <Ic.X /> : '✕'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Editor Area */}
                <div className="flex-1 flex flex-col p-4 md:p-5 overflow-hidden">
                    {activeStyle ? (
                        <>
                            {/* Title */}
                            <div className="mb-3">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Style Title</label>
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => { setEditTitle(e.target.value); setIsEditing(true); }}
                                    className="w-full px-3 py-2 text-sm font-semibold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800 dark:text-gray-200 transition-colors"
                                    placeholder="e.g., Clean Corporate Blue Style"
                                />
                            </div>

                            {/* Style Content Textarea */}
                            <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-inner overflow-hidden transition-colors duration-200">
                                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        Style prompt content — click keywords from the library when target is set to "Master Style"
                                    </span>
                                    {isEditing && (
                                        <span className="text-xs text-amber-500 font-medium">● Unsaved</span>
                                    )}
                                </div>
                                <textarea
                                    ref={masterStyleRef}
                                    value={editContent}
                                    onChange={(e) => { setEditContent(e.target.value); setIsEditing(true); }}
                                    className="flex-1 w-full p-4 bg-transparent border-none resize-none focus:ring-0 text-gray-800 dark:text-gray-200 leading-relaxed font-mono text-sm"
                                    placeholder="Describe the visual style for your infographics... e.g., 'Create a modern, minimalist infographic with a blue and white color palette, flat icons, sans-serif typography, clean layout with plenty of white space, optimized for Pinterest at 1000x2000px'"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-3 flex items-center justify-between">
                                <button
                                    onClick={() => duplicateStyle(activeStyle)}
                                    className="text-sm text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors px-2 py-1"
                                >
                                    Duplicate
                                </button>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(editContent);
                                            showNotification('Style copied!');
                                        }}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                                    >
                                        {Ic.Copy ? <Ic.Copy /> : '📋'} <span>Copy</span>
                                    </button>
                                    <button
                                        onClick={saveCurrentEdit}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all"
                                    >
                                        {Ic.Save ? <Ic.Save /> : '💾'} <span>Save Style</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* Empty state */
                        <div className="flex-1 flex items-center justify-center text-center text-gray-400">
                            <div>
                                <div className="text-5xl mb-4">🎨</div>
                                <p className="text-lg font-medium mb-2">No style selected</p>
                                <p className="text-sm mb-4">Create a master style to define the visual look for all your infographic prompts</p>
                                <button
                                    onClick={createNewStyle}
                                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-lg font-medium transition-all"
                                >
                                    Create Your First Style
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };
})();
