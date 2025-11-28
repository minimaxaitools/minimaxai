class SVGEditor {
    constructor() {
        this.panel = null;
        this.currentShape = null;
        this.isOpen = false;
        this.selectedInternalElement = null;
        this.svgDoc = null;
        this.undoStack = [];
        this.redoStack = [];
        this.clipboard = null;
        this.multiSelect = [];
        this.dragMode = null;
        this.dragStart = null;
        this.initialize();
    }

    initialize() {
        this.createPanel();
        this.setupEventListeners();
    }

    createPanel() {
        this.panel = document.createElement('div');
        this.panel.id = 'svg-editor-panel';
        this.panel.className = 'fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-[100] transform translate-x-full transition-transform duration-300 flex flex-col border-l border-gray-200';

        this.panel.innerHTML = `
            <div class="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                <h2 class="text-lg font-bold text-gray-800">SVG Editor Pro</h2>
                <div class="flex gap-2">
                    <button id="undo-svg" class="p-2 rounded hover:bg-gray-200 text-gray-500" title="Undo (Ctrl+Z)">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                    </button>
                    <button id="redo-svg" class="p-2 rounded hover:bg-gray-200 text-gray-500" title="Redo (Ctrl+Y)">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                        </svg>
                    </button>
                    <button id="close-svg-editor" class="p-2 rounded-full hover:bg-gray-200 text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="flex border-b border-gray-200 overflow-x-auto">
                <button class="flex-1 py-2 px-3 text-xs font-medium text-blue-600 border-b-2 border-blue-600 whitespace-nowrap" data-tab="structure">Structure</button>
                <button class="flex-1 py-2 px-3 text-xs font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap" data-tab="attributes">Attributes</button>
                <button class="flex-1 py-2 px-3 text-xs font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap" data-tab="transform">Transform</button>
                <button class="flex-1 py-2 px-3 text-xs font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap" data-tab="styles">Styles</button>
                <button class="flex-1 py-2 px-3 text-xs font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap" data-tab="add">Add</button>
                <button class="flex-1 py-2 px-3 text-xs font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap" data-tab="code">Code</button>
            </div>

            <div class="flex-1 overflow-y-auto p-4" id="svg-editor-content">
                <!-- Structure Tab -->
                <div id="tab-structure" class="space-y-2">
                    <div class="flex gap-2 mb-3">
                        <input type="text" id="search-elements" placeholder="Search elements..." class="flex-1 px-2 py-1 text-xs border rounded">
                        <button id="clear-selection" class="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300" title="Clear Selection">Clear</button>
                    </div>
                    <div id="structure-tree"></div>
                </div>

                <!-- Attributes Tab -->
                <div id="tab-attributes" class="hidden space-y-4"></div>

                <!-- Transform Tab -->
                <div id="tab-transform" class="hidden space-y-4">
                    <div class="text-xs text-gray-500 mb-2">Select an element to transform</div>
                </div>

                <!-- Styles Tab -->
                <div id="tab-styles" class="hidden space-y-4">
                    <div class="text-xs text-gray-500 mb-2">Advanced styling options</div>
                </div>

                <!-- Add Elements Tab -->
                <div id="tab-add" class="hidden space-y-3">
                    <h3 class="text-sm font-semibold text-gray-700">Add Elements</h3>
                    <div class="grid grid-cols-2 gap-2">
                        <button class="add-element-btn p-2 border rounded hover:bg-blue-50 hover:border-blue-500 text-xs" data-shape="rect">
                            <svg class="h-6 w-6 mx-auto mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <rect x="3" y="3" width="18" height="18" stroke-width="2"/>
                            </svg>
                            Rectangle
                        </button>
                        <button class="add-element-btn p-2 border rounded hover:bg-blue-50 hover:border-blue-500 text-xs" data-shape="circle">
                            <svg class="h-6 w-6 mx-auto mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <circle cx="12" cy="12" r="9" stroke-width="2"/>
                            </svg>
                            Circle
                        </button>
                        <button class="add-element-btn p-2 border rounded hover:bg-blue-50 hover:border-blue-500 text-xs" data-shape="ellipse">
                            <svg class="h-6 w-6 mx-auto mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <ellipse cx="12" cy="12" rx="9" ry="6" stroke-width="2"/>
                            </svg>
                            Ellipse
                        </button>
                        <button class="add-element-btn p-2 border rounded hover:bg-blue-50 hover:border-blue-500 text-xs" data-shape="line">
                            <svg class="h-6 w-6 mx-auto mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <line x1="3" y1="21" x2="21" y2="3" stroke-width="2"/>
                            </svg>
                            Line
                        </button>
                        <button class="add-element-btn p-2 border rounded hover:bg-blue-50 hover:border-blue-500 text-xs" data-shape="polygon">
                            <svg class="h-6 w-6 mx-auto mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <polygon points="12,2 22,20 2,20" stroke-width="2"/>
                            </svg>
                            Polygon
                        </button>
                        <button class="add-element-btn p-2 border rounded hover:bg-blue-50 hover:border-blue-500 text-xs" data-shape="path">
                            <svg class="h-6 w-6 mx-auto mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path d="M3 12 Q 6 3, 12 12 T 21 12" stroke-width="2"/>
                            </svg>
                            Path
                        </button>
                        <button class="add-element-btn p-2 border rounded hover:bg-blue-50 hover:border-blue-500 text-xs" data-shape="text">
                            <svg class="h-6 w-6 mx-auto mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Text
                        </button>
                        <button class="add-element-btn p-2 border rounded hover:bg-blue-50 hover:border-blue-500 text-xs" data-shape="group">
                            <svg class="h-6 w-6 mx-auto mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            Group
                        </button>
                    </div>
                </div>

                <!-- Code Tab -->
                <div id="tab-code" class="hidden h-full flex flex-col">
                    <div class="flex gap-2 mb-2">
                        <button id="format-svg-code" class="px-3 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300">Format</button>
                        <button id="minify-svg-code" class="px-3 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300">Minify</button>
                        <button id="export-svg" class="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">Export SVG</button>
                    </div>
                    <textarea id="svg-code-editor" class="flex-1 w-full h-full p-2 font-mono text-xs border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" spellcheck="false"></textarea>
                    <button id="apply-svg-code" class="mt-2 w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Apply Changes</button>
                </div>
            </div>

            <!-- Quick Actions Bar -->
            <div class="border-t border-gray-200 p-3 bg-gray-50">
                <div class="flex gap-2 text-xs">
                    <button id="duplicate-element" class="flex-1 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed" disabled>Duplicate</button>
                    <button id="copy-element" class="flex-1 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed" disabled>Copy</button>
                    <button id="paste-element" class="flex-1 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed" disabled>Paste</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.panel);

        // Tab switching logic
        const tabs = this.panel.querySelectorAll('[data-tab]');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => {
                    t.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
                    t.classList.add('text-gray-500');
                });
                tab.classList.remove('text-gray-500');
                tab.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');

                const targetId = `tab-${tab.dataset.tab}`;
                this.panel.querySelectorAll('#svg-editor-content > div').forEach(div => {
                    div.classList.add('hidden');
                });
                this.panel.querySelector(`#${targetId}`).classList.remove('hidden');
            });
        });

        // Event listeners
        this.panel.querySelector('#close-svg-editor').addEventListener('click', () => this.close());
        this.panel.querySelector('#apply-svg-code').addEventListener('click', () => this.applyCodeChanges());
        this.panel.querySelector('#undo-svg').addEventListener('click', () => this.undo());
        this.panel.querySelector('#redo-svg').addEventListener('click', () => this.redo());
        this.panel.querySelector('#duplicate-element').addEventListener('click', () => this.duplicateElement());
        this.panel.querySelector('#copy-element').addEventListener('click', () => this.copyElement());
        this.panel.querySelector('#paste-element').addEventListener('click', () => this.pasteElement());
        this.panel.querySelector('#clear-selection').addEventListener('click', () => this.clearSelection());
        this.panel.querySelector('#search-elements').addEventListener('input', (e) => this.searchElements(e.target.value));
        this.panel.querySelector('#format-svg-code').addEventListener('click', () => this.formatSVGCode());
        this.panel.querySelector('#minify-svg-code').addEventListener('click', () => this.minifySVGCode());
        this.panel.querySelector('#export-svg').addEventListener('click', () => this.exportSVG());

        // Add element buttons
        this.panel.querySelectorAll('.add-element-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const shape = e.currentTarget.dataset.shape;
                this.addElement(shape);
            });
        });

        // Prevent canvas interactions when hovering/using the panel
        ['mousedown', 'touchstart', 'wheel', 'keydown', 'keyup'].forEach(eventType => {
            this.panel.addEventListener(eventType, (e) => {
                e.stopPropagation();
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!this.isOpen) return;

            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    this.undo();
                } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
                    e.preventDefault();
                    this.redo();
                } else if (e.key === 'c') {
                    e.preventDefault();
                    this.copyElement();
                } else if (e.key === 'v') {
                    e.preventDefault();
                    this.pasteElement();
                } else if (e.key === 'd') {
                    e.preventDefault();
                    this.duplicateElement();
                }
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.selectedInternalElement && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    this.deleteInternalElement();
                }
            }
        });
    }

    setupEventListeners() {
        // Listen for shape selection
        // We'll expose a method to open/close that main.js can call
    }

    open(shape) {
        if (!shape || shape.shapeType !== 5) return; // Only for SVG shapes
        this.currentShape = shape;
        this.isOpen = true;
        this.panel.classList.remove('translate-x-full');
        this.undoStack = [];
        this.redoStack = [];
        this.saveState();

        this.renderStructure();
        this.renderAttributes();
        this.renderCode();
    }

    close() {
        this.isOpen = false;
        this.currentShape = null;
        this.selectedInternalElement = null;
        this.multiSelect = [];
        this.panel.classList.add('translate-x-full');
    }

    saveState() {
        if (!this.currentShape) return;
        this.undoStack.push(this.currentShape.svgData);
        if (this.undoStack.length > 50) this.undoStack.shift(); // Limit stack size
        this.redoStack = []; // Clear redo on new action
    }

    undo() {
        if (this.undoStack.length <= 1) return;
        const current = this.undoStack.pop();
        this.redoStack.push(current);
        const previous = this.undoStack[this.undoStack.length - 1];
        this.currentShape.svgData = previous;
        this.currentShape.updateImage();
        this.renderAll();
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const next = this.redoStack.pop();
        this.undoStack.push(next);
        this.currentShape.svgData = next;
        this.currentShape.updateImage();
        this.renderAll();
    }

    renderAll() {
        this.renderStructure();
        this.renderAttributes();
        this.renderTransform();
        this.renderStyles();
        this.renderCode();
    }

    clearSelection() {
        this.selectedInternalElement = null;
        this.multiSelect = [];
        this.renderAll();
        this.updateQuickActions();
    }

    searchElements(query) {
        const items = this.panel.querySelectorAll('#structure-tree > div');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(query.toLowerCase()) ? '' : 'none';
        });
    }

    handleCanvasClick(x, y) {
        if (!this.isOpen || !this.currentShape) return;

        const screenPos = this.currentShape.getScreenPos(this.currentShape.pos);
        const screenSizeW = this.currentShape.getScreenSize(this.currentShape.w);
        const screenSizeH = this.currentShape.getScreenSize(this.currentShape.h);

        const parser = new DOMParser();
        const doc = parser.parseFromString(this.currentShape.svgData, 'image/svg+xml');
        const svgRoot = doc.documentElement;

        let viewBox = svgRoot.getAttribute('viewBox');
        let vbX = 0, vbY = 0, vbW = 100, vbH = 100;

        if (viewBox) {
            [vbX, vbY, vbW, vbH] = viewBox.split(' ').map(parseFloat);
        } else {
            vbW = parseFloat(svgRoot.getAttribute('width')) || 100;
            vbH = parseFloat(svgRoot.getAttribute('height')) || 100;
        }

        const scaleX = screenSizeW / vbW;
        const scaleY = screenSizeH / vbH;

        const relMouseX = x - screenPos.x;
        const relMouseY = y - screenPos.y;

        const svgCenterX = vbX + vbW / 2;
        const svgCenterY = vbY + vbH / 2;

        const svgMouseX = (relMouseX / scaleX) + svgCenterX;
        const svgMouseY = (relMouseY / scaleY) + svgCenterY;

        let hitNode = null;

        const checkNode = (node) => {
            if (node.nodeType !== 1) return;
            for (let i = node.children.length - 1; i >= 0; i--) {
                const result = checkNode(node.children[i]);
                if (result) return result;
            }
            if (this.isPointInElement(node, svgMouseX, svgMouseY)) {
                return node;
            }
            return null;
        };

        hitNode = checkNode(svgRoot);

        if (hitNode) {
            this.selectInternalElement(hitNode);
        } else {
            this.selectedInternalElement = null;
            this.renderAttributes();
            this.renderTransform();
            this.renderStyles();
        }
    }

    isPointInElement(node, x, y) {
        const tag = node.tagName.toLowerCase();
        if (tag === 'rect') {
            const rx = parseFloat(node.getAttribute('x')) || 0;
            const ry = parseFloat(node.getAttribute('y')) || 0;
            const width = parseFloat(node.getAttribute('width')) || 0;
            const height = parseFloat(node.getAttribute('height')) || 0;
            return x >= rx && x <= rx + width && y >= ry && y <= ry + height;
        }
        if (tag === 'circle') {
            const cx = parseFloat(node.getAttribute('cx')) || 0;
            const cy = parseFloat(node.getAttribute('cy')) || 0;
            const r = parseFloat(node.getAttribute('r')) || 0;
            return ((x - cx) ** 2 + (y - cy) ** 2) <= r ** 2;
        }
        if (tag === 'ellipse') {
            const cx = parseFloat(node.getAttribute('cx')) || 0;
            const cy = parseFloat(node.getAttribute('cy')) || 0;
            const rx = parseFloat(node.getAttribute('rx')) || 0;
            const ry = parseFloat(node.getAttribute('ry')) || 0;
            return ((x - cx) ** 2 / rx ** 2) + ((y - cy) ** 2 / ry ** 2) <= 1;
        }
        if (tag === 'path') {
            const d = node.getAttribute('d');
            if (d && window.ctx) {
                const path = new Path2D(d);
                return window.ctx.isPointInPath(path, x, y);
            }
        }
        return false;
    }

    selectInternalElement(node) {
        this.selectedInternalElement = node;
        this.renderStructure();
        this.renderAttributes();
        this.renderTransform();
        this.renderStyles();
        this.updateQuickActions();
    }

    updateQuickActions() {
        const hasSelection = !!this.selectedInternalElement;
        this.panel.querySelector('#duplicate-element').disabled = !hasSelection;
        this.panel.querySelector('#copy-element').disabled = !hasSelection;
        this.panel.querySelector('#paste-element').disabled = !this.clipboard;
    }

    renderStructure() {
        const container = this.panel.querySelector('#structure-tree');
        container.innerHTML = '';

        if (!this.currentShape.svgData) return;

        const parser = new DOMParser();
        const doc = parser.parseFromString(this.currentShape.svgData, 'image/svg+xml');
        const root = doc.documentElement;

        let selectedXPath = this.selectedInternalElement ? this.getXPath(this.selectedInternalElement) : null;

        const createNodeItem = (node, depth = 0) => {
            if (node.nodeType !== 1) return null;

            const item = document.createElement('div');
            const isSelected = selectedXPath && this.getXPath(node) === selectedXPath;

            item.className = `flex items-center gap-2 p-1 rounded cursor-pointer ${isSelected ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'} group`;
            item.style.paddingLeft = `${depth * 16}px`;

            const type = node.tagName;
            const id = node.id ? `#${node.id}` : '';
            const fill = node.getAttribute('fill');
            const colorDot = fill && fill !== 'none' ? `<span class="w-2 h-2 rounded-full inline-block mr-1" style="background-color: ${fill}"></span>` : '';

            // Visibility State
            const isHidden = node.getAttribute('display') === 'none';
            const opacity = isHidden ? '0.5' : '1';

            item.innerHTML = `
                <div class="flex-1 flex items-center min-w-0" style="opacity: ${opacity}">
                    ${colorDot}
                    <span class="text-xs font-mono truncate">&lt;${type}${id}&gt;</span>
                </div>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700" title="Move Up" data-action="move-up">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                        </svg>
                    </button>
                    <button class="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700" title="Move Down" data-action="move-down">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    <button class="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700" title="Toggle Visibility" data-action="toggle-vis">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            ${isHidden
                ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />'
                : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />'
            }
                        </svg>
                    </button>
                    <button class="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600" title="Delete" data-action="delete">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            `;

            item.onclick = (e) => {
                e.stopPropagation();

                const btn = e.target.closest('button');
                if (btn) {
                    const action = btn.dataset.action;
                    this.selectedInternalElement = node;

                    if (action === 'toggle-vis') {
                        const currentDisplay = node.getAttribute('display');
                        this.updateInternalAttribute('display', currentDisplay === 'none' ? 'inline' : 'none');
                    } else if (action === 'delete') {
                        this.deleteInternalElement();
                    } else if (action === 'move-up') {
                        this.moveElement('up');
                    } else if (action === 'move-down') {
                        this.moveElement('down');
                    }
                    return;
                }

                this.selectInternalElement(node);
            };

            return item;
        };

        const traverse = (node, parentEl, depth) => {
            const item = createNodeItem(node, depth);
            if (item) {
                parentEl.appendChild(item);
                Array.from(node.children).forEach(child => traverse(child, parentEl, depth + 1));
            }
        };

        traverse(root, container, 0);
    }

    getXPath(node) {
        if (node.nodeType !== 1) return '';
        let index = 0;
        let sibling = node.previousSibling;
        while (sibling) {
            if (sibling.nodeType === 1) index++;
            sibling = sibling.previousSibling;
        }
        return (node.parentNode ? this.getXPath(node.parentNode) + '/' : '') + node.tagName + '[' + index + ']';
    }

    renderAttributes() {
        const container = this.panel.querySelector('#tab-attributes');

        if (this.selectedInternalElement) {
            const node = this.selectedInternalElement;
            const fill = node.getAttribute('fill') || '#000000';
            const stroke = node.getAttribute('stroke') || 'none';
            const strokeWidth = node.getAttribute('stroke-width') || '1';
            const opacity = node.getAttribute('opacity') || '1';
            const fillOpacity = node.getAttribute('fill-opacity') || '1';
            const strokeOpacity = node.getAttribute('stroke-opacity') || '1';

            container.innerHTML = `
                <div class="space-y-3">
                    <div class="flex justify-between items-center">
                        <h3 class="text-sm font-semibold text-gray-700">${node.tagName} Properties</h3>
                        <button id="delete-internal-el" class="text-xs text-red-600 hover:text-red-800">Delete</button>
                    </div>
                    
                    <label class="block text-sm">
                        <span class="text-gray-600">Fill</span>
                        <div class="flex gap-2">
                            <input type="color" id="attr-fill-color" value="${fill === 'none' ? '#ffffff' : fill}" class="h-8 w-8 rounded cursor-pointer">
                            <input type="text" id="attr-fill-text" value="${fill}" class="flex-1 p-1 border rounded text-xs">
                        </div>
                    </label>

                    <label class="block text-sm">
                        <span class="text-gray-600">Fill Opacity</span>
                        <div class="flex gap-2 items-center">
                            <input type="range" id="attr-fill-opacity" value="${parseFloat(fillOpacity)}" min="0" max="1" step="0.1" class="flex-1">
                            <span class="text-xs w-8">${(parseFloat(fillOpacity) * 100).toFixed(0)}%</span>
                        </div>
                    </label>

                    <label class="block text-sm">
                        <span class="text-gray-600">Stroke</span>
                        <div class="flex gap-2">
                            <input type="color" id="attr-stroke-color" value="${stroke === 'none' ? '#ffffff' : stroke}" class="h-8 w-8 rounded cursor-pointer">
                            <input type="text" id="attr-stroke-text" value="${stroke}" class="flex-1 p-1 border rounded text-xs">
                        </div>
                    </label>

                    <label class="block text-sm">
                        <span class="text-gray-600">Stroke Width</span>
                        <input type="number" id="attr-stroke-width" value="${parseFloat(strokeWidth)}" step="0.5" min="0" class="w-full mt-1 p-1 border rounded">
                    </label>

                    <label class="block text-sm">
                        <span class="text-gray-600">Stroke Opacity</span>
                        <div class="flex gap-2 items-center">
                            <input type="range" id="attr-stroke-opacity" value="${parseFloat(strokeOpacity)}" min="0" max="1" step="0.1" class="flex-1">
                            <span class="text-xs w-8">${(parseFloat(strokeOpacity) * 100).toFixed(0)}%</span>
                        </div>
                    </label>

                    <label class="block text-sm">
                        <span class="text-gray-600">Overall Opacity</span>
                        <div class="flex gap-2 items-center">
                            <input type="range" id="attr-opacity" value="${parseFloat(opacity)}" min="0" max="1" step="0.1" class="flex-1">
                            <span class="text-xs w-8">${(parseFloat(opacity) * 100).toFixed(0)}%</span>
                        </div>
                    </label>

                    ${this.getAttributeInputsForElement(node)}
                </div>
            `;

            container.querySelector('#attr-fill-color').oninput = (e) => this.updateInternalAttribute('fill', e.target.value);
            container.querySelector('#attr-fill-text').onchange = (e) => this.updateInternalAttribute('fill', e.target.value);
            container.querySelector('#attr-stroke-color').oninput = (e) => this.updateInternalAttribute('stroke', e.target.value);
            container.querySelector('#attr-stroke-text').onchange = (e) => this.updateInternalAttribute('stroke', e.target.value);
            container.querySelector('#attr-stroke-width').oninput = (e) => this.updateInternalAttribute('stroke-width', e.target.value);
            container.querySelector('#attr-opacity').oninput = (e) => {
                this.updateInternalAttribute('opacity', e.target.value);
                e.target.nextElementSibling.textContent = (parseFloat(e.target.value) * 100).toFixed(0) + '%';
            };
            container.querySelector('#attr-fill-opacity').oninput = (e) => {
                this.updateInternalAttribute('fill-opacity', e.target.value);
                e.target.nextElementSibling.textContent = (parseFloat(e.target.value) * 100).toFixed(0) + '%';
            };
            container.querySelector('#attr-stroke-opacity').oninput = (e) => {
                this.updateInternalAttribute('stroke-opacity', e.target.value);
                e.target.nextElementSibling.textContent = (parseFloat(e.target.value) * 100).toFixed(0) + '%';
            };
            container.querySelector('#delete-internal-el').onclick = () => this.deleteInternalElement();

            // Add specific attribute listeners
            this.attachSpecificAttributeListeners(node, container);

        } else {
            container.innerHTML = `
                <div class="space-y-3">
                    <h3 class="text-sm font-semibold text-gray-700">General</h3>
                    <label class="block text-sm">
                        <span class="text-gray-600">Width</span>
                        <input type="number" class="w-full mt-1 p-1 border rounded" value="${this.currentShape.w}" disabled title="Edit in main toolbar">
                    </label>
                     <label class="block text-sm">
                        <span class="text-gray-600">Height</span>
                        <input type="number" class="w-full mt-1 p-1 border rounded" value="${this.currentShape.h}" disabled title="Edit in main toolbar">
                    </label>
                    <div class="p-2 bg-blue-50 text-blue-700 text-xs rounded">
                        Click on elements in the SVG to edit their specific properties.
                    </div>
                </div>
            `;
        }
    }

    getAttributeInputsForElement(node) {
        const tag = node.tagName.toLowerCase();
        let html = '<div class="border-t pt-3 mt-3"><h4 class="text-xs font-semibold text-gray-600 mb-2">Element-Specific</h4>';

        if (tag === 'rect') {
            const x = node.getAttribute('x') || '0';
            const y = node.getAttribute('y') || '0';
            const width = node.getAttribute('width') || '100';
            const height = node.getAttribute('height') || '100';
            const rx = node.getAttribute('rx') || '0';
            html += `
                <label class="block text-xs mb-2">
                    <span class="text-gray-600">X</span>
                    <input type="number" data-attr="x" value="${x}" step="1" class="w-full p-1 border rounded text-xs">
                </label>
                <label class="block text-xs mb-2">
                    <span class="text-gray-600">Y</span>
                    <input type="number" data-attr="y" value="${y}" step="1" class="w-full p-1 border rounded text-xs">
                </label>
                <label class="block text-xs mb-2">
                    <span class="text-gray-600">Width</span>
                    <input type="number" data-attr="width" value="${width}" step="1" min="1" class="w-full p-1 border rounded text-xs">
                </label>
                <label class="block text-xs mb-2">
                    <span class="text-gray-600">Height</span>
                    <input type="number" data-attr="height" value="${height}" step="1" min="1" class="w-full p-1 border rounded text-xs">
                </label>
                <label class="block text-xs mb-2">
                    <span class="text-gray-600">Border Radius</span>
                    <input type="number" data-attr="rx" value="${rx}" step="1" min="0" class="w-full p-1 border rounded text-xs">
                </label>
            `;
        } else if (tag === 'circle') {
            const cx = node.getAttribute('cx') || '50';
            const cy = node.getAttribute('cy') || '50';
            const r = node.getAttribute('r') || '25';
            html += `
                <label class="block text-xs mb-2">
                    <span class="text-gray-600">Center X</span>
                    <input type="number" data-attr="cx" value="${cx}" step="1" class="w-full p-1 border rounded text-xs">
                </label>
                <label class="block text-xs mb-2">
                    <span class="text-gray-600">Center Y</span>
                    <input type="number" data-attr="cy" value="${cy}" step="1" class="w-full p-1 border rounded text-xs">
                </label>
                <label class="block text-xs mb-2">
                    <span class="text-gray-600">Radius</span>
                    <input type="number" data-attr="r" value="${r}" step="1" min="1" class="w-full p-1 border rounded text-xs">
                </label>
            `;
        } else if (tag === 'ellipse') {
            const cx = node.getAttribute('cx') || '50';
            const cy = node.getAttribute('cy') || '50';
            const rx = node.getAttribute('rx') || '40';
            const ry = node.getAttribute('ry') || '25';
            html += `
                <label class="block text-xs mb-2">
                    <span class="text-gray-600">Center X</span>
                    <input type="number" data-attr="cx" value="${cx}" step="1" class="w-full p-1 border rounded text-xs">
                </label>
                <label class="block text-xs mb-2">
                    <span class="text-gray-600">Center Y</span>
                    <input type="number" data-attr="cy" value="${cy}" step="1" class="w-full p-1 border rounded text-xs">
                </label>
                <label class="block text-xs mb-2">
                    <span class="text-gray-600">Radius X</span>
                    <input type="number" data-attr="rx" value="${rx}" step="1" min="1" class="w-full p-1 border rounded text-xs">
                </label>
                <label class="block text-xs mb-2">
                    <span class="text-gray-600">Radius Y</span>
                    <input type="number" data-attr="ry" value="${ry}" step="1" min="1" class="w-full p-1 border rounded text-xs">
                </label>
            `;
        } else if (tag === 'text') {
            const x = node.getAttribute('x') || '0';
            const y = node.getAttribute('y') || '0';
            const fontSize = node.getAttribute('font-size') || '16';
            const fontFamily = node.getAttribute('font-family') || 'Arial';
            const textContent = node.textContent || '';
            html += `
                <label class="block text-xs mb-2">
                    <span class="text-gray-600">Text Content</span>
                    <input type="text" id="text-content" value="${textContent}" class="w-full p-1 border rounded text-xs">
                </label>
                <label class="block text-xs mb-2">
                    <span class="text-gray-600">X</span>
                    <input type="number" data-attr="x" value="${x}" step="1" class="w-full p-1 border rounded text-xs">
                </label>
                <label class="block text-xs mb-2">
                    <span class="text-gray-600">Y</span>
                    <input type="number" data-attr="y" value="${y}" step="1" class="w-full p-1 border rounded text-xs">
                </label>
                <label class="block text-xs mb-2">
                    <span class="text-gray-600">Font Size</span>
                    <input type="number" data-attr="font-size" value="${fontSize}" step="1" min="1" class="w-full p-1 border rounded text-xs">
                </label>
                <label class="block text-xs mb-2">
                    <span class="text-gray-600">Font Family</span>
                    <input type="text" data-attr="font-family" value="${fontFamily}" class="w-full p-1 border rounded text-xs">
                </label>
            `;
        }

        html += '</div>';
        return html;
    }

    attachSpecificAttributeListeners(node, container) {
        const inputs = container.querySelectorAll('[data-attr]');
        inputs.forEach(input => {
            input.oninput = (e) => {
                this.updateInternalAttribute(e.target.dataset.attr, e.target.value);
            };
        });

        // Text content special handling
        const textInput = container.querySelector('#text-content');
        if (textInput) {
            textInput.oninput = (e) => {
                node.textContent = e.target.value;
                const serializer = new XMLSerializer();
                const root = node.ownerDocument;
                this.currentShape.svgData = serializer.serializeToString(root);
                this.currentShape.updateImage();
            };
        }
    }

    renderTransform() {
        const container = this.panel.querySelector('#tab-transform');

        if (this.selectedInternalElement) {
            const node = this.selectedInternalElement;
            const transform = node.getAttribute('transform') || '';

            // Parse transform values
            let translateX = 0, translateY = 0, rotate = 0, scaleX = 1, scaleY = 1;

            const translateMatch = transform.match(/translate\(([^,]+),?\s*([^\)]+)?\)/);
            if (translateMatch) {
                translateX = parseFloat(translateMatch[1]) || 0;
                translateY = parseFloat(translateMatch[2]) || 0;
            }

            const rotateMatch = transform.match(/rotate\(([^)]+)\)/);
            if (rotateMatch) {
                rotate = parseFloat(rotateMatch[1]) || 0;
            }

            const scaleMatch = transform.match(/scale\(([^,]+),?\s*([^\)]+)?\)/);
            if (scaleMatch) {
                scaleX = parseFloat(scaleMatch[1]) || 1;
                scaleY = parseFloat(scaleMatch[2]) || scaleX;
            }

            container.innerHTML = `
                <div class="space-y-3">
                    <h3 class="text-sm font-semibold text-gray-700">Transform</h3>
                    
                    <label class="block text-sm">
                        <span class="text-gray-600">Translate X</span>
                        <input type="number" id="transform-tx" value="${translateX}" step="1" class="w-full mt-1 p-1 border rounded">
                    </label>

                    <label class="block text-sm">
                        <span class="text-gray-600">Translate Y</span>
                        <input type="number" id="transform-ty" value="${translateY}" step="1" class="w-full mt-1 p-1 border rounded">
                    </label>

                    <label class="block text-sm">
                        <span class="text-gray-600">Rotate (degrees)</span>
                        <div class="flex gap-2 items-center">
                            <input type="range" id="transform-rotate" value="${rotate}" min="-180" max="180" step="1" class="flex-1">
                            <input type="number" id="transform-rotate-num" value="${rotate}" min="-180" max="180" step="1" class="w-16 p-1 border rounded text-xs">
                        </div>
                    </label>

                    <label class="block text-sm">
                        <span class="text-gray-600">Scale X</span>
                        <input type="number" id="transform-sx" value="${scaleX}" step="0.1" min="0.1" class="w-full mt-1 p-1 border rounded">
                    </label>

                    <label class="block text-sm">
                        <span class="text-gray-600">Scale Y</span>
                        <input type="number" id="transform-sy" value="${scaleY}" step="0.1" min="0.1" class="w-full mt-1 p-1 border rounded">
                    </label>

                    <button id="reset-transform" class="w-full py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm">Reset Transform</button>
                </div>
            `;

            const updateTransform = () => {
                const tx = parseFloat(container.querySelector('#transform-tx').value) || 0;
                const ty = parseFloat(container.querySelector('#transform-ty').value) || 0;
                const r = parseFloat(container.querySelector('#transform-rotate').value) || 0;
                const sx = parseFloat(container.querySelector('#transform-sx').value) || 1;
                const sy = parseFloat(container.querySelector('#transform-sy').value) || 1;

                let transformStr = '';
                if (tx !== 0 || ty !== 0) transformStr += `translate(${tx},${ty}) `;
                if (r !== 0) transformStr += `rotate(${r}) `;
                if (sx !== 1 || sy !== 1) transformStr += `scale(${sx},${sy})`;

                this.updateInternalAttribute('transform', transformStr.trim());
            };

            container.querySelector('#transform-tx').oninput = updateTransform;
            container.querySelector('#transform-ty').oninput = updateTransform;
            container.querySelector('#transform-rotate').oninput = (e) => {
                container.querySelector('#transform-rotate-num').value = e.target.value;
                updateTransform();
            };
            container.querySelector('#transform-rotate-num').oninput = (e) => {
                container.querySelector('#transform-rotate').value = e.target.value;
                updateTransform();
            };
            container.querySelector('#transform-sx').oninput = updateTransform;
            container.querySelector('#transform-sy').oninput = updateTransform;
            container.querySelector('#reset-transform').onclick = () => {
                this.updateInternalAttribute('transform', '');
                this.renderTransform();
            };

        } else {
            container.innerHTML = `
                <div class="p-2 bg-blue-50 text-blue-700 text-xs rounded">
                    Select an element to transform it.
                </div>
            `;
        }
    }

    renderStyles() {
        const container = this.panel.querySelector('#tab-styles');

        if (this.selectedInternalElement) {
            const node = this.selectedInternalElement;
            const filter = node.getAttribute('filter') || '';
            const clipPath = node.getAttribute('clip-path') || '';
            const mask = node.getAttribute('mask') || '';
            const strokeDasharray = node.getAttribute('stroke-dasharray') || '';
            const strokeLinecap = node.getAttribute('stroke-linecap') || 'butt';
            const strokeLinejoin = node.getAttribute('stroke-linejoin') || 'miter';

            container.innerHTML = `
                <div class="space-y-3">
                    <h3 class="text-sm font-semibold text-gray-700">Advanced Styles</h3>
                    
                    <label class="block text-sm">
                        <span class="text-gray-600">Stroke Line Cap</span>
                        <select id="style-linecap" class="w-full mt-1 p-1 border rounded text-xs">
                            <option value="butt" ${strokeLinecap === 'butt' ? 'selected' : ''}>Butt</option>
                            <option value="round" ${strokeLinecap === 'round' ? 'selected' : ''}>Round</option>
                            <option value="square" ${strokeLinecap === 'square' ? 'selected' : ''}>Square</option>
                        </select>
                    </label>

                    <label class="block text-sm">
                        <span class="text-gray-600">Stroke Line Join</span>
                        <select id="style-linejoin" class="w-full mt-1 p-1 border rounded text-xs">
                            <option value="miter" ${strokeLinejoin === 'miter' ? 'selected' : ''}>Miter</option>
                            <option value="round" ${strokeLinejoin === 'round' ? 'selected' : ''}>Round</option>
                            <option value="bevel" ${strokeLinejoin === 'bevel' ? 'selected' : ''}>Bevel</option>
                        </select>
                    </label>

                    <label class="block text-sm">
                        <span class="text-gray-600">Stroke Dasharray</span>
                        <input type="text" id="style-dasharray" value="${strokeDasharray}" placeholder="e.g., 5,5" class="w-full mt-1 p-1 border rounded text-xs">
                    </label>

                    <label class="block text-sm">
                        <span class="text-gray-600">Filter</span>
                        <select id="style-filter" class="w-full mt-1 p-1 border rounded text-xs">
                            <option value="">None</option>
                            <option value="url(#blur)" ${filter.includes('blur') ? 'selected' : ''}>Blur</option>
                            <option value="url(#shadow)" ${filter.includes('shadow') ? 'selected' : ''}>Drop Shadow</option>
                        </select>
                    </label>

                    <div class="border-t pt-3 mt-3">
                        <h4 class="text-xs font-semibold text-gray-600 mb-2">Quick Filters</h4>
                        <div class="grid grid-cols-2 gap-2">
                            <button class="quick-filter-btn px-2 py-1 text-xs border rounded hover:bg-gray-100" data-filter="none">None</button>
                            <button class="quick-filter-btn px-2 py-1 text-xs border rounded hover:bg-gray-100" data-filter="blur(2)">Blur</button>
                            <button class="quick-filter-btn px-2 py-1 text-xs border rounded hover:bg-gray-100" data-filter="brightness(1.5)">Brighten</button>
                            <button class="quick-filter-btn px-2 py-1 text-xs border rounded hover:bg-gray-100" data-filter="contrast(2)">Contrast</button>
                            <button class="quick-filter-btn px-2 py-1 text-xs border rounded hover:bg-gray-100" data-filter="grayscale(1)">Grayscale</button>
                            <button class="quick-filter-btn px-2 py-1 text-xs border rounded hover:bg-gray-100" data-filter="sepia(1)">Sepia</button>
                        </div>
                    </div>
                </div>
            `;

            container.querySelector('#style-linecap').onchange = (e) => this.updateInternalAttribute('stroke-linecap', e.target.value);
            container.querySelector('#style-linejoin').onchange = (e) => this.updateInternalAttribute('stroke-linejoin', e.target.value);
            container.querySelector('#style-dasharray').oninput = (e) => this.updateInternalAttribute('stroke-dasharray', e.target.value);
            container.querySelector('#style-filter').onchange = (e) => this.updateInternalAttribute('filter', e.target.value);

            container.querySelectorAll('.quick-filter-btn').forEach(btn => {
                btn.onclick = () => {
                    const filterValue = btn.dataset.filter;
                    this.updateInternalAttribute('filter', filterValue === 'none' ? '' : filterValue);
                };
            });

        } else {
            container.innerHTML = `
                <div class="p-2 bg-blue-50 text-blue-700 text-xs rounded">
                    Select an element to apply styles.
                </div>
            `;
        }
    }

    renderCode() {
        const editor = this.panel.querySelector('#svg-code-editor');
        editor.value = this.currentShape.svgData || '';
    }

    getOrCreateDoc() {
        if (!this.svgDoc) {
            const parser = new DOMParser();
            this.svgDoc = parser.parseFromString(this.currentShape.svgData, 'image/svg+xml');
        }
        return this.svgDoc;
    }

    updateInternalAttribute(attr, value) {
        if (this.selectedInternalElement) {
            this.saveState();

            if (value === '' || value === null) {
                this.selectedInternalElement.removeAttribute(attr);
            } else {
                this.selectedInternalElement.setAttribute(attr, value);
            }

            const serializer = new XMLSerializer();
            const root = this.selectedInternalElement.ownerDocument;
            const newSvgData = serializer.serializeToString(root);

            this.currentShape.svgData = newSvgData;
            this.currentShape.updateImage();

            // Update structure view if visibility changed
            if (attr === 'display') {
                this.renderStructure();
            }
        }
    }

    deleteInternalElement() {
        if (this.selectedInternalElement) {
            this.saveState();

            const parent = this.selectedInternalElement.parentNode;
            parent.removeChild(this.selectedInternalElement);

            const serializer = new XMLSerializer();
            const root = this.selectedInternalElement.ownerDocument;
            const newSvgData = serializer.serializeToString(root);

            this.currentShape.svgData = newSvgData;
            this.currentShape.updateImage();

            this.selectedInternalElement = null;
            this.renderAll();
            this.updateQuickActions();
        }
    }

    duplicateElement() {
        if (!this.selectedInternalElement) return;

        this.saveState();

        const clone = this.selectedInternalElement.cloneNode(true);

        // Offset the clone slightly
        const tag = clone.tagName.toLowerCase();
        if (tag === 'rect' || tag === 'text') {
            const x = parseFloat(clone.getAttribute('x') || 0);
            const y = parseFloat(clone.getAttribute('y') || 0);
            clone.setAttribute('x', x + 10);
            clone.setAttribute('y', y + 10);
        } else if (tag === 'circle' || tag === 'ellipse') {
            const cx = parseFloat(clone.getAttribute('cx') || 0);
            const cy = parseFloat(clone.getAttribute('cy') || 0);
            clone.setAttribute('cx', cx + 10);
            clone.setAttribute('cy', cy + 10);
        }

        this.selectedInternalElement.parentNode.appendChild(clone);

        const serializer = new XMLSerializer();
        const root = clone.ownerDocument;
        this.currentShape.svgData = serializer.serializeToString(root);
        this.currentShape.updateImage();

        this.selectedInternalElement = clone;
        this.renderAll();
    }

    copyElement() {
        if (!this.selectedInternalElement) return;

        const serializer = new XMLSerializer();
        this.clipboard = serializer.serializeToString(this.selectedInternalElement);
        this.updateQuickActions();

        // Visual feedback
        const btn = this.panel.querySelector('#copy-element');
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 1000);
    }

    pasteElement() {
        if (!this.clipboard) return;

        this.saveState();

        const parser = new DOMParser();
        const doc = parser.parseFromString(this.currentShape.svgData, 'image/svg+xml');
        const root = doc.documentElement;

        const tempDoc = parser.parseFromString(this.clipboard, 'image/svg+xml');
        const elementToPaste = doc.importNode(tempDoc.documentElement, true);

        root.appendChild(elementToPaste);

        const serializer = new XMLSerializer();
        this.currentShape.svgData = serializer.serializeToString(doc);
        this.currentShape.updateImage();

        this.selectedInternalElement = root.lastElementChild;
        this.renderAll();
    }

    moveElement(direction) {
        if (!this.selectedInternalElement) return;

        this.saveState();

        const parent = this.selectedInternalElement.parentNode;
        const sibling = direction === 'up' ? this.selectedInternalElement.previousElementSibling : this.selectedInternalElement.nextElementSibling;

        if (sibling) {
            if (direction === 'up') {
                parent.insertBefore(this.selectedInternalElement, sibling);
            } else {
                parent.insertBefore(sibling, this.selectedInternalElement);
            }

            const serializer = new XMLSerializer();
            const root = this.selectedInternalElement.ownerDocument;
            this.currentShape.svgData = serializer.serializeToString(root);
            this.currentShape.updateImage();

            this.renderStructure();
        }
    }

    addElement(shapeType) {
        this.saveState();

        const parser = new DOMParser();
        const doc = parser.parseFromString(this.currentShape.svgData, 'image/svg+xml');
        const root = doc.documentElement;

        let newElement;
        const ns = 'http://www.w3.org/2000/svg';

        switch (shapeType) {
            case 'rect':
                newElement = doc.createElementNS(ns, 'rect');
                newElement.setAttribute('x', '25');
                newElement.setAttribute('y', '25');
                newElement.setAttribute('width', '50');
                newElement.setAttribute('height', '50');
                newElement.setAttribute('fill', '#3b82f6');
                break;
            case 'circle':
                newElement = doc.createElementNS(ns, 'circle');
                newElement.setAttribute('cx', '50');
                newElement.setAttribute('cy', '50');
                newElement.setAttribute('r', '25');
                newElement.setAttribute('fill', '#ef4444');
                break;
            case 'ellipse':
                newElement = doc.createElementNS(ns, 'ellipse');
                newElement.setAttribute('cx', '50');
                newElement.setAttribute('cy', '50');
                newElement.setAttribute('rx', '40');
                newElement.setAttribute('ry', '25');
                newElement.setAttribute('fill', '#10b981');
                break;
            case 'line':
                newElement = doc.createElementNS(ns, 'line');
                newElement.setAttribute('x1', '10');
                newElement.setAttribute('y1', '10');
                newElement.setAttribute('x2', '90');
                newElement.setAttribute('y2', '90');
                newElement.setAttribute('stroke', '#000000');
                newElement.setAttribute('stroke-width', '2');
                break;
            case 'polygon':
                newElement = doc.createElementNS(ns, 'polygon');
                newElement.setAttribute('points', '50,10 90,90 10,90');
                newElement.setAttribute('fill', '#f59e0b');
                break;
            case 'path':
                newElement = doc.createElementNS(ns, 'path');
                newElement.setAttribute('d', 'M 10 50 Q 30 10, 50 50 T 90 50');
                newElement.setAttribute('stroke', '#8b5cf6');
                newElement.setAttribute('stroke-width', '2');
                newElement.setAttribute('fill', 'none');
                break;
            case 'text':
                newElement = doc.createElementNS(ns, 'text');
                newElement.setAttribute('x', '50');
                newElement.setAttribute('y', '50');
                newElement.setAttribute('font-size', '16');
                newElement.setAttribute('fill', '#000000');
                newElement.textContent = 'Text';
                break;
            case 'group':
                newElement = doc.createElementNS(ns, 'g');
                newElement.setAttribute('id', 'group-' + Date.now());
                break;
        }

        if (newElement) {
            root.appendChild(newElement);

            const serializer = new XMLSerializer();
            this.currentShape.svgData = serializer.serializeToString(doc);
            this.currentShape.updateImage();

            this.selectedInternalElement = newElement;
            this.renderAll();
            this.updateQuickActions();

            // Switch to attributes tab
            this.panel.querySelector('[data-tab="attributes"]').click();
        }
    }

    formatSVGCode() {
        const editor = this.panel.querySelector('#svg-code-editor');
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(editor.value, 'image/svg+xml');

            if (doc.querySelector('parsererror')) {
                throw new Error('Invalid XML');
            }

            const serializer = new XMLSerializer();
            let formatted = serializer.serializeToString(doc);

            // Basic formatting
            formatted = formatted.replace(/></g, '>\n<');

            editor.value = formatted;
        } catch (e) {
            alert('Cannot format: Invalid SVG');
        }
    }

    minifySVGCode() {
        const editor = this.panel.querySelector('#svg-code-editor');
        editor.value = editor.value.replace(/>\s+</g, '><').trim();
    }

    exportSVG() {
        const svgData = this.currentShape.svgData;
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `svg-export-${Date.now()}.svg`;
        a.click();
        URL.revokeObjectURL(url);
    }

    applyCodeChanges() {
        if (!this.currentShape) return;

        const editor = this.panel.querySelector('#svg-code-editor');
        const newCode = editor.value;

        // Validate XML
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(newCode, 'image/svg+xml');
            if (doc.querySelector('parsererror')) {
                throw new Error('Invalid XML');
            }

            this.saveState();
            this.currentShape.svgData = newCode;
            this.currentShape.updateImage();

            // Refresh other tabs
            this.renderAll();

            // Show success feedback
            const btn = this.panel.querySelector('#apply-svg-code');
            const originalText = btn.textContent;
            btn.textContent = 'Saved!';
            btn.classList.add('bg-green-600');
            setTimeout(() => {
                btn.textContent = originalText;
                btn.classList.remove('bg-green-600');
            }, 2000);

        } catch (e) {
            alert('Error parsing SVG code: ' + e.message);
        }
    }

    drawHighlight(ctx) {
        if (!this.isOpen || !this.currentShape || !this.selectedInternalElement) return;

        const shape = this.currentShape;
        const pos = shape.pos;
        const w = shape.w;
        const h = shape.h;

        const parser = new DOMParser();
        const doc = parser.parseFromString(shape.svgData, 'image/svg+xml');
        const svgRoot = doc.documentElement;

        let viewBox = svgRoot.getAttribute('viewBox');
        let vbX = 0, vbY = 0, vbW = 100, vbH = 100;

        if (viewBox) {
            [vbX, vbY, vbW, vbH] = viewBox.split(' ').map(parseFloat);
        } else {
            vbW = parseFloat(svgRoot.getAttribute('width')) || 100;
            vbH = parseFloat(svgRoot.getAttribute('height')) || 100;
        }

        const scaleX = w / vbW;
        const scaleY = h / vbH;

        ctx.save();

        ctx.translate(pos.x, pos.y);

        if (shape.rotation) {
            ctx.rotate(shape.rotation);
        }

        ctx.translate(-w / 2, -h / 2);
        ctx.scale(scaleX, scaleY);
        ctx.translate(-vbX, -vbY);

        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 2 / Math.max(scaleX, scaleY);
        ctx.setLineDash([5 / Math.max(scaleX, scaleY), 3 / Math.max(scaleX, scaleY)]);

        this.drawElementPath(ctx, this.selectedInternalElement);

        ctx.restore();
    }

    drawElementPath(ctx, node) {
        const tag = node.tagName.toLowerCase();

        ctx.beginPath();

        if (tag === 'rect') {
            const x = parseFloat(node.getAttribute('x')) || 0;
            const y = parseFloat(node.getAttribute('y')) || 0;
            const width = parseFloat(node.getAttribute('width')) || 0;
            const height = parseFloat(node.getAttribute('height')) || 0;
            ctx.rect(x, y, width, height);
        } else if (tag === 'circle') {
            const cx = parseFloat(node.getAttribute('cx')) || 0;
            const cy = parseFloat(node.getAttribute('cy')) || 0;
            const r = parseFloat(node.getAttribute('r')) || 0;
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
        } else if (tag === 'ellipse') {
            const cx = parseFloat(node.getAttribute('cx')) || 0;
            const cy = parseFloat(node.getAttribute('cy')) || 0;
            const rx = parseFloat(node.getAttribute('rx')) || 0;
            const ry = parseFloat(node.getAttribute('ry')) || 0;
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        } else if (tag === 'line') {
            const x1 = parseFloat(node.getAttribute('x1')) || 0;
            const y1 = parseFloat(node.getAttribute('y1')) || 0;
            const x2 = parseFloat(node.getAttribute('x2')) || 0;
            const y2 = parseFloat(node.getAttribute('y2')) || 0;
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        } else if (tag === 'path') {
            const d = node.getAttribute('d');
            if (d) {
                const path = new Path2D(d);
                ctx.stroke(path);
                return;
            }
        } else if (tag === 'polygon' || tag === 'polyline') {
            const points = node.getAttribute('points');
            if (points) {
                const pairs = points.trim().split(/\s+|,/);
                if (pairs.length >= 2) {
                    ctx.moveTo(parseFloat(pairs[0]), parseFloat(pairs[1]));
                    for (let i = 2; i < pairs.length; i += 2) {
                        ctx.lineTo(parseFloat(pairs[i]), parseFloat(pairs[i + 1]));
                    }
                    if (tag === 'polygon') ctx.closePath();
                }
            }
        }

        ctx.stroke();
    }
}

// Expose globally
window.SVGEditor = SVGEditor;
