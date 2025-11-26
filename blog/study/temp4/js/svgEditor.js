class SVGEditor {
    constructor() {
        this.panel = null;
        this.currentShape = null;
        this.isOpen = false;
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
                <h2 class="text-lg font-bold text-gray-800">SVG Editor</h2>
                <button id="close-svg-editor" class="p-2 rounded-full hover:bg-gray-200 text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            <div class="flex border-b border-gray-200">
                <button class="flex-1 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600" data-tab="structure">Structure</button>
                <button class="flex-1 py-2 text-sm font-medium text-gray-500 hover:text-gray-700" data-tab="attributes">Attributes</button>
                <button class="flex-1 py-2 text-sm font-medium text-gray-500 hover:text-gray-700" data-tab="code">Code</button>
            </div>

            <div class="flex-1 overflow-y-auto p-4" id="svg-editor-content">
                <!-- Content will be injected here -->
                <div id="tab-structure" class="space-y-2"></div>
                <div id="tab-attributes" class="hidden space-y-4"></div>
                <div id="tab-code" class="hidden h-full flex flex-col">
                    <textarea id="svg-code-editor" class="flex-1 w-full h-full p-2 font-mono text-xs border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" spellcheck="false"></textarea>
                    <button id="apply-svg-code" class="mt-2 w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Apply Changes</button>
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

        this.panel.querySelector('#close-svg-editor').addEventListener('click', () => this.close());
        this.panel.querySelector('#apply-svg-code').addEventListener('click', () => this.applyCodeChanges());

        // Prevent canvas interactions when hovering/using the panel
        ['mousedown', 'touchstart', 'wheel', 'keydown', 'keyup'].forEach(eventType => {
            this.panel.addEventListener(eventType, (e) => {
                e.stopPropagation();
            });
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

        this.renderStructure();
        this.renderAttributes();
        this.renderCode();
    }

    close() {
        this.isOpen = false;
        this.currentShape = null;
        this.selectedInternalElement = null;
        this.panel.classList.add('translate-x-full');
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
        if (tag === 'path') {
            const d = node.getAttribute('d');
            if (d) {
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
    }

    renderStructure() {
        const container = this.panel.querySelector('#tab-structure');
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

            item.className = `flex items-center gap-2 p-1 rounded cursor-pointer pl-${depth * 4} ${isSelected ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'} group`;

            const type = node.tagName;
            const id = node.id ? `#${node.id}` : '';
            const fill = node.getAttribute('fill');
            const colorDot = fill ? `<span class="w-2 h-2 rounded-full inline-block mr-1" style="background-color: ${fill}"></span>` : '';

            // Visibility State
            const isHidden = node.getAttribute('display') === 'none';
            const opacity = isHidden ? '0.5' : '1';

            item.innerHTML = `
                <div class="flex-1 flex items-center min-w-0" style="opacity: ${opacity}">
                    ${colorDot}
                    <span class="text-xs font-mono truncate">&lt;${type}${id}&gt;</span>
                </div>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

                // Check if button clicked
                const btn = e.target.closest('button');
                if (btn) {
                    const action = btn.dataset.action;
                    if (action === 'toggle-vis') {
                        this.selectedInternalElement = node; // Temporarily select to operate
                        const currentDisplay = node.getAttribute('display');
                        this.updateInternalAttribute('display', currentDisplay === 'none' ? 'inline' : 'none');
                        // Re-render structure to update icon
                        this.renderStructure();
                    } else if (action === 'delete') {
                        this.selectedInternalElement = node;
                        this.deleteInternalElement();
                    }
                    return;
                }

                this.selectedInternalElement = node;
                this.renderStructure();
                this.renderAttributes();
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
                </div>
            `;

            container.querySelector('#attr-fill-color').oninput = (e) => this.updateInternalAttribute('fill', e.target.value);
            container.querySelector('#attr-fill-text').onchange = (e) => this.updateInternalAttribute('fill', e.target.value);
            container.querySelector('#attr-stroke-color').oninput = (e) => this.updateInternalAttribute('stroke', e.target.value);
            container.querySelector('#attr-stroke-text').onchange = (e) => this.updateInternalAttribute('stroke', e.target.value);
            container.querySelector('#attr-stroke-width').oninput = (e) => this.updateInternalAttribute('stroke-width', e.target.value);

            container.querySelector('#delete-internal-el').onclick = () => this.deleteInternalElement();

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
            this.selectedInternalElement.setAttribute(attr, value);

            const serializer = new XMLSerializer();
            const root = this.selectedInternalElement.ownerDocument;
            const newSvgData = serializer.serializeToString(root);

            this.currentShape.svgData = newSvgData;
            this.currentShape.updateImage();
        }
    }

    deleteInternalElement() {
        if (this.selectedInternalElement) {
            const parent = this.selectedInternalElement.parentNode;
            parent.removeChild(this.selectedInternalElement);

            const serializer = new XMLSerializer();
            const root = this.selectedInternalElement.ownerDocument;
            const newSvgData = serializer.serializeToString(root);

            this.currentShape.svgData = newSvgData;
            this.currentShape.updateImage();

            this.selectedInternalElement = null;
            this.renderStructure();
            this.renderAttributes();
        }
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

            this.currentShape.svgData = newCode;
            this.currentShape.updateImage();

            // Refresh other tabs
            this.renderStructure();

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
        // Use World Coordinates because ctx is already in World Space (Camera applied)
        const pos = shape.pos;
        const w = shape.w;
        const h = shape.h;

        // Parse SVG to get viewBox for scaling
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

        // Apply transformations to match SVG coordinate space
        // 1. Translate to Shape Center (World Space)
        ctx.translate(pos.x, pos.y);

        // 2. Rotate (if shape has rotation)
        if (shape.rotation) {
            ctx.rotate(shape.rotation);
        }

        // 3. Translate to Top-Left of Shape
        ctx.translate(-w / 2, -h / 2);

        // 4. Scale to match SVG units
        ctx.scale(scaleX, scaleY);

        // 5. Translate by viewBox origin (negative) to align (0,0)
        ctx.translate(-vbX, -vbY);

        // Set highlight style
        ctx.strokeStyle = '#00FFFF'; // Cyan
        ctx.lineWidth = 2 / Math.max(scaleX, scaleY);
        ctx.setLineDash([5 / Math.max(scaleX, scaleY), 3 / Math.max(scaleX, scaleY)]); // Dashed line

        // Draw the element
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
                return; // Path2D draws itself with stroke()
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
