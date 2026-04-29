// content-slicer.js — Content Slicer Tab Component
// Registers: window.ContentSlicerTab

(function () {
    const { useState, useRef, useCallback } = React;

    window.ContentSlicerTab = function ContentSlicerTab({
        sourceText, setSourceText,
        slices, setSlices,
        commonTexts, setCommonTexts,
        showNotification
    }) {
        const previewRef = useRef(null);
        const [selectionInfo, setSelectionInfo] = useState(null);
        const [editingSliceId, setEditingSliceId] = useState(null);
        const [dragOverIndex, setDragOverIndex] = useState(null);
        const [manualCommonText, setManualCommonText] = useState('');

        // Handle text selection in the preview div
        const handleMouseUp = useCallback(() => {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();

            if (selectedText && previewRef.current && previewRef.current.contains(selection.anchorNode)) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                setSelectionInfo({
                    text: selectedText,
                    top: rect.bottom + window.scrollY + 8,
                    left: Math.max(10, rect.left + rect.width / 2 - 120)
                });
            } else {
                setTimeout(() => {
                    const sel = window.getSelection();
                    if (!sel.toString().trim()) setSelectionInfo(null);
                }, 200);
            }
        }, []);

        const markAsSlice = () => {
            if (!selectionInfo) return;
            const newSlice = {
                id: 'slice_' + Date.now(),
                title: 'Part ' + (slices.length + 1),
                content: selectionInfo.text,
                order: slices.length + 1
            };
            setSlices(prev => [...prev, newSlice]);
            setSelectionInfo(null);
            window.getSelection().removeAllRanges();
            showNotification('✂️ Slice created: ' + newSlice.title);
        };

        const markAsCommon = () => {
            if (!selectionInfo) return;
            setCommonTexts(prev => [...prev, {
                id: 'common_' + Date.now(),
                content: selectionInfo.text
            }]);
            setSelectionInfo(null);
            window.getSelection().removeAllRanges();
            showNotification('🔗 Common text marked!');
        };

        const deleteSlice = (id) => {
            setSlices(prev => prev.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i + 1 })));
        };

        const moveSlice = (index, direction) => {
            const newIndex = index + direction;
            if (newIndex < 0 || newIndex >= slices.length) return;
            const arr = [...slices];
            [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
            setSlices(arr.map((s, i) => ({ ...s, order: i + 1 })));
        };

        // Drag-and-drop
        const handleDragStart = (e, index) => {
            e.dataTransfer.setData('text/plain', index.toString());
            e.dataTransfer.effectAllowed = 'move';
        };
        const handleDragOver = (e, index) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOverIndex(index);
        };
        const handleDragLeave = () => setDragOverIndex(null);
        const handleDrop = (e, dropIndex) => {
            e.preventDefault();
            const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
            if (dragIndex === dropIndex) { setDragOverIndex(null); return; }
            const arr = [...slices];
            const [dragged] = arr.splice(dragIndex, 1);
            arr.splice(dropIndex, 0, dragged);
            setSlices(arr.map((s, i) => ({ ...s, order: i + 1 })));
            setDragOverIndex(null);
        };

        const updateSliceTitle = (id, title) => setSlices(prev => prev.map(s => s.id === id ? { ...s, title } : s));
        const updateSliceContent = (id, content) => setSlices(prev => prev.map(s => s.id === id ? { ...s, content } : s));
        const deleteCommonText = (id) => setCommonTexts(prev => prev.filter(c => c.id !== id));

        const addManualCommonText = () => {
            if (!manualCommonText.trim()) return;
            setCommonTexts(prev => [...prev, { id: 'common_' + Date.now(), content: manualCommonText.trim() }]);
            setManualCommonText('');
            showNotification('🔗 Common text added!');
        };

        // Build preview with highlighted common texts
        const renderPreview = () => {
            if (!sourceText) return null;
            if (commonTexts.length === 0) return sourceText;

            let parts = [{ text: sourceText, isCommon: false }];
            commonTexts.forEach(ct => {
                const next = [];
                parts.forEach(part => {
                    if (part.isCommon) { next.push(part); return; }
                    const segments = part.text.split(ct.content);
                    segments.forEach((seg, i) => {
                        if (seg) next.push({ text: seg, isCommon: false });
                        if (i < segments.length - 1) next.push({ text: ct.content, isCommon: true });
                    });
                });
                parts = next;
            });

            return parts.map((p, i) =>
                p.isCommon
                    ? React.createElement('mark', {
                        key: i,
                        className: 'bg-yellow-200 dark:bg-yellow-600/40 px-0.5 rounded',
                        title: 'Common text — shared across all prompts'
                    }, p.text)
                    : React.createElement('span', { key: i }, p.text)
            );
        };

        const charCount = sourceText.length;
        const wordCount = sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0;
        const Ic = window.Icons || {};

        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Information Box */}
                <div className="p-4 md:p-5 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <span className="text-lg">📋</span> Information Box
                        </h3>
                        {sourceText && (
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                                <span>{charCount.toLocaleString()} chars</span>
                                <span className="w-px h-3 bg-gray-300 dark:bg-gray-700"></span>
                                <span>{wordCount.toLocaleString()} words</span>
                            </div>
                        )}
                    </div>
                    <textarea
                        value={sourceText}
                        onChange={(e) => setSourceText(e.target.value)}
                        className="w-full h-32 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg resize-y focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm text-gray-800 dark:text-gray-200 font-mono leading-relaxed transition-colors"
                        placeholder="Paste your long-form content here (articles, reports, guides, etc.)..."
                    />
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-5">

                    {/* Text Preview with Selection */}
                    {sourceText && (
                        <div className="relative">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    📖 Text Preview
                                    <span className="text-xs font-normal normal-case text-gray-400">(Select text → slice or mark common)</span>
                                </h4>
                            </div>

                            {/* Floating selection toolbar */}
                            {selectionInfo && (
                                <div
                                    className="fixed z-50 flex items-center gap-1 p-1 bg-gray-900 dark:bg-gray-100 rounded-lg shadow-2xl border border-gray-700 dark:border-gray-300"
                                    style={{ top: selectionInfo.top + 'px', left: selectionInfo.left + 'px' }}
                                >
                                    <button
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={markAsSlice}
                                        className="px-3 py-1.5 text-xs font-medium text-white dark:text-gray-900 bg-indigo-600 dark:bg-indigo-400 hover:bg-indigo-700 dark:hover:bg-indigo-500 rounded-md transition-colors"
                                    >✂️ Mark as Slice</button>
                                    <button
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={markAsCommon}
                                        className="px-3 py-1.5 text-xs font-medium text-white dark:text-gray-900 bg-amber-600 dark:bg-amber-400 hover:bg-amber-700 dark:hover:bg-amber-500 rounded-md transition-colors"
                                    >🔗 Mark as Common</button>
                                </div>
                            )}

                            <div
                                ref={previewRef}
                                onMouseUp={handleMouseUp}
                                className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto cursor-text select-text transition-colors"
                            >
                                {renderPreview()}
                            </div>
                        </div>
                    )}

                    {/* Common Text Panel */}
                    {(commonTexts.length > 0 || sourceText) && (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                🔗 Common/Shared Text
                                <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full text-xs">{commonTexts.length}</span>
                            </h4>
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text" value={manualCommonText}
                                    onChange={(e) => setManualCommonText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addManualCommonText()}
                                    className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors"
                                    placeholder="Type common text manually..."
                                />
                                <button onClick={addManualCommonText} className="px-3 py-1.5 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-md transition-colors">Add</button>
                            </div>
                            {commonTexts.length > 0 && (
                                <div className="space-y-2">
                                    {commonTexts.map(ct => (
                                        <div key={ct.id} className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-md group">
                                            <span className="text-amber-500 mt-0.5 flex-shrink-0">🔗</span>
                                            <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{ct.content}</span>
                                            <button onClick={() => deleteCommonText(ct.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100" title="Remove">
                                                {Ic.X ? <Ic.X /> : '✕'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Slices List */}
                    {slices.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                ✂️ Content Slices
                                <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-full text-xs">{slices.length}</span>
                            </h4>
                            <div className="space-y-2">
                                {slices.map((slice, index) => (
                                    <div
                                        key={slice.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, index)}
                                        className={`p-3 bg-white dark:bg-gray-900 border rounded-lg transition-all duration-200 ${dragOverIndex === index ? 'border-indigo-400 dark:border-indigo-500 shadow-lg ring-2 ring-indigo-200 dark:ring-indigo-800' : 'border-gray-200 dark:border-gray-700'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 select-none" title="Drag to reorder">⠿</span>
                                            <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0">{slice.order}</span>

                                            {editingSliceId === slice.id ? (
                                                <input
                                                    type="text" value={slice.title}
                                                    onChange={(e) => updateSliceTitle(slice.id, e.target.value)}
                                                    onBlur={() => setEditingSliceId(null)}
                                                    onKeyDown={(e) => e.key === 'Enter' && setEditingSliceId(null)}
                                                    className="flex-1 px-2 py-0.5 text-sm font-medium bg-transparent border border-indigo-300 dark:border-indigo-600 rounded focus:ring-1 focus:ring-indigo-500 text-gray-800 dark:text-gray-200"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span
                                                    className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-200 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                                    onClick={() => setEditingSliceId(slice.id)}
                                                    title="Click to edit title"
                                                >{slice.title}</span>
                                            )}

                                            <div className="flex items-center gap-0.5 flex-shrink-0">
                                                <button onClick={() => moveSlice(index, -1)} disabled={index === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors text-xs" title="Move up">▲</button>
                                                <button onClick={() => moveSlice(index, 1)} disabled={index === slices.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors text-xs" title="Move down">▼</button>
                                                <button onClick={() => deleteSlice(slice.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Delete slice">
                                                    {Ic.Trash ? <Ic.Trash /> : '🗑'}
                                                </button>
                                            </div>
                                        </div>

                                        {editingSliceId === slice.id ? (
                                            <textarea
                                                value={slice.content}
                                                onChange={(e) => updateSliceContent(slice.id, e.target.value)}
                                                className="w-full p-2 text-xs font-mono bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-600 dark:text-gray-400 resize-y"
                                                rows={4}
                                            />
                                        ) : (
                                            <div className="text-xs font-mono text-gray-500 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 p-2 rounded line-clamp-3 whitespace-pre-wrap">
                                                {slice.content}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {!sourceText && (
                        <div className="text-center py-16 text-gray-400">
                            <div className="text-5xl mb-4">📋</div>
                            <p className="text-lg font-medium mb-1">Paste your content to get started</p>
                            <p className="text-sm">Your long-form text will appear here for slicing into multiple infographic prompts</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };
})();
