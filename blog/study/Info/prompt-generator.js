// prompt-generator.js — Prompt Generation Engine + Generated Prompts Tab
// Registers: window.GeneratedPromptsTab

(function () {
    const { useState } = React;

    window.GeneratedPromptsTab = function GeneratedPromptsTab({
        slices, commonTexts,
        masterStyles, activeMasterStyleId,
        generatedPrompts, setGeneratedPrompts,
        wrapMode, setWrapMode,
        showNotification
    }) {
        const [copiedId, setCopiedId] = useState(null);

        const activeStyle = masterStyles.find(s => s.id === activeMasterStyleId) || null;

        // Generate all prompts
        const generateAllPrompts = () => {
            if (slices.length === 0) {
                showNotification('⚠️ No slices to generate from! Go to Content Slicer first.');
                return;
            }

            const sorted = [...slices].sort((a, b) => a.order - b.order);
            const prompts = sorted.map(slice => {
                let prompt = '';

                // 1. Master Style
                if (activeStyle && activeStyle.content.trim()) {
                    prompt += activeStyle.content.trim();
                    prompt += '\n\n---\n';
                }

                // 2. Common Context
                if (commonTexts.length > 0) {
                    prompt += 'Common Context:\n';
                    commonTexts.forEach(ct => {
                        prompt += ct.content + '\n';
                    });
                    prompt += '---\n\n';
                }

                // 3. Slice Content
                prompt += 'Content for this section (' + slice.title + '):\n';
                if (wrapMode === 'backticks') {
                    prompt += '```\n' + slice.content + '\n```';
                } else {
                    prompt += slice.content;
                }

                return {
                    sliceId: slice.id,
                    sliceTitle: slice.title,
                    sliceOrder: slice.order,
                    fullPrompt: prompt
                };
            });

            setGeneratedPrompts(prompts);
            showNotification('🚀 Generated ' + prompts.length + ' prompt' + (prompts.length > 1 ? 's' : '') + '!');
        };

        const copyPrompt = (prompt, id) => {
            navigator.clipboard.writeText(prompt.fullPrompt);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
            showNotification('📋 Prompt copied!');
        };

        const copyAllPrompts = () => {
            const allText = generatedPrompts.map((p, i) =>
                '===== INFOGRAPHIC PART ' + (i + 1) + ': ' + p.sliceTitle + ' =====\n\n' + p.fullPrompt
            ).join('\n\n\n');
            navigator.clipboard.writeText(allText);
            showNotification('📋 All ' + generatedPrompts.length + ' prompts copied!');
        };

        const Ic = window.Icons || {};

        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header Controls */}
                <div className="p-4 md:p-5 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <span className="text-lg">🚀</span> Generated Prompts
                            {generatedPrompts.length > 0 && (
                                <span className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full text-xs font-bold">{generatedPrompts.length}</span>
                            )}
                        </h3>
                        <button
                            onClick={generateAllPrompts}
                            className="px-4 py-2 text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                        >
                            ⚡ Generate All Prompts
                        </button>
                    </div>

                    {/* Options Row */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {/* Wrap mode toggle */}
                            <span className="text-xs text-gray-500 dark:text-gray-400">Wrap mode:</span>
                            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-md p-0.5">
                                <button
                                    onClick={() => setWrapMode('backticks')}
                                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                        wrapMode === 'backticks'
                                            ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                                >``` Backticks</button>
                                <button
                                    onClick={() => setWrapMode('plain')}
                                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                        wrapMode === 'plain'
                                            ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                                >Plain</button>
                            </div>
                        </div>

                        {/* Status indicators */}
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span className={slices.length > 0 ? 'text-green-500' : 'text-red-400'}>
                                {slices.length} slice{slices.length !== 1 ? 's' : ''}
                            </span>
                            <span>·</span>
                            <span className={activeStyle ? 'text-green-500' : 'text-gray-400'}>
                                {activeStyle ? '✓ Style' : '✗ No style'}
                            </span>
                            <span>·</span>
                            <span>{commonTexts.length} common</span>
                        </div>
                    </div>
                </div>

                {/* Generated Prompts List */}
                <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
                    {generatedPrompts.length > 0 ? (
                        <>
                            {/* Copy All Button */}
                            <div className="flex justify-end">
                                <button
                                    onClick={copyAllPrompts}
                                    className="px-4 py-2 text-sm font-medium bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
                                >
                                    {Ic.Copy ? <Ic.Copy /> : '📋'} Copy All ({generatedPrompts.length})
                                </button>
                            </div>

                            {/* Prompt Cards */}
                            {generatedPrompts.map((prompt, i) => (
                                <div key={prompt.sliceId} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm transition-colors duration-200">
                                    {/* Card Header */}
                                    <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-indigo-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                                            <span className="font-semibold text-gray-800 dark:text-gray-200">{prompt.sliceTitle}</span>
                                        </div>
                                        <button
                                            onClick={() => copyPrompt(prompt, prompt.sliceId)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                                                copiedId === prompt.sliceId
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-primary-600 hover:bg-primary-700 text-white'
                                            }`}
                                        >
                                            {copiedId === prompt.sliceId
                                                ? <>{Ic.Check ? <Ic.Check /> : '✓'} <span>Copied!</span></>
                                                : <>{Ic.Copy ? <Ic.Copy /> : '📋'} <span>Copy</span></>
                                            }
                                        </button>
                                    </div>
                                    {/* Prompt Content */}
                                    <pre className="p-4 text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed bg-gray-50 dark:bg-gray-800/50">
                                        {prompt.fullPrompt}
                                    </pre>
                                </div>
                            ))}
                        </>
                    ) : (
                        /* Empty state */
                        <div className="flex-1 flex items-center justify-center text-center text-gray-400 py-16">
                            <div>
                                <div className="text-5xl mb-4">🚀</div>
                                <p className="text-lg font-medium mb-2">No prompts generated yet</p>
                                <p className="text-sm mb-1">1. Paste content in the <strong>Content Slicer</strong> tab</p>
                                <p className="text-sm mb-1">2. Select a <strong>Master Style</strong> (optional)</p>
                                <p className="text-sm mb-4">3. Click <strong>"Generate All Prompts"</strong> above</p>
                                <button
                                    onClick={generateAllPrompts}
                                    disabled={slices.length === 0}
                                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    ⚡ Generate Now
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };
})();
