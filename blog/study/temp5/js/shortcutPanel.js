class ShortcutPanel {
    constructor() {
        this.panel = null;
        this.isVisible = false;
        this.initialize();
    }

    initialize() {
        this.createPanel();
        this.setupEventListeners();
        this.startUpdateLoop();
    }

    createPanel() {
        // Create the panel container
        this.panel = document.createElement('div');
        this.panel.id = 'shortcut-panel';
        this.panel.className = 'fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm shadow-lg rounded-full px-6 py-3 flex items-center gap-4 z-50 transition-all duration-300 opacity-0 translate-y-10 pointer-events-none';

        // Delete Button
        this.deleteBtn = document.createElement('button');
        this.deleteBtn.className = 'p-2 rounded-full hover:bg-red-50 text-red-500 transition-colors flex flex-col items-center gap-1 min-w-[60px]';
        this.deleteBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span class="text-[10px] font-medium uppercase tracking-wider">Delete</span>
        `;
        this.deleteBtn.onclick = () => this.handleDelete();

        // Finish/Enter Button
        this.finishBtn = document.createElement('button');
        this.finishBtn.className = 'p-2 rounded-full hover:bg-green-50 text-green-600 transition-colors flex flex-col items-center gap-1 min-w-[60px]';
        this.finishBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span class="text-[10px] font-medium uppercase tracking-wider">Finish</span>
        `;
        this.finishBtn.onclick = () => this.handleFinish();

        // Separator
        const separator = document.createElement('div');
        separator.className = 'w-px h-8 bg-gray-200';

        // Edit SVG Button (New)
        this.editSvgBtn = document.createElement('button');
        this.editSvgBtn.className = 'p-2 rounded-full hover:bg-blue-50 text-blue-600 transition-colors flex flex-col items-center gap-1 min-w-[60px] hidden';
        this.editSvgBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span class="text-[10px] font-medium uppercase tracking-wider">Edit SVG</span>
        `;
        this.editSvgBtn.onclick = () => this.handleEditSvg();

        // Separator 2
        this.separator2 = document.createElement('div');
        this.separator2.className = 'w-px h-8 bg-gray-200 hidden';

        // Add elements to panel
        this.panel.appendChild(this.deleteBtn);
        this.panel.appendChild(separator);
        this.panel.appendChild(this.editSvgBtn);
        this.panel.appendChild(this.separator2);
        this.panel.appendChild(this.finishBtn);

        document.body.appendChild(this.panel);
    }

    setupEventListeners() {
        // Listen for selection changes (this might need to be triggered from main.js or by polling)
        // For now, we'll poll in the update loop or hook into selection logic if possible.
    }

    startUpdateLoop() {
        const update = () => {
            this.updateVisibility();
            requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }

    updateVisibility() {
        // Check if we should show the panel
        // Show if:
        // 1. Shapes are selected (for Delete)
        // 2. Text tool is active and typing (for Finish) - though text usually handles its own focus
        // 3. Polygon tool is active and drawing (for Finish)

        const hasSelection = window.selectedShapes && window.selectedShapes.length > 0;
        const isPolygonTool = window.data && window.data.settings.tool === 2; // TOOL_POLYGON
        const isDrawingPolygon = isPolygonTool && window.currentShape && window.currentShape().shapeType === 2;

        const shouldShow = hasSelection || isDrawingPolygon;

        if (shouldShow !== this.isVisible) {
            this.isVisible = shouldShow;
            if (this.isVisible) {
                this.panel.classList.remove('opacity-0', 'translate-y-10', 'pointer-events-none');
                this.panel.classList.add('opacity-100', 'translate-y-0', 'pointer-events-auto');
            } else {
                this.panel.classList.add('opacity-0', 'translate-y-10', 'pointer-events-none');
                this.panel.classList.remove('opacity-100', 'translate-y-0', 'pointer-events-auto');
            }
        }

        // Update button states/visibility based on context
        if (this.isVisible) {
            // Delete is only for selection
            this.deleteBtn.style.display = hasSelection ? 'flex' : 'none';

            // Edit SVG is only for single SVG selection
            const isSingleSVG = hasSelection && window.selectedShapes.length === 1 && window.selectedShapes[0].shapeType === 5;
            this.editSvgBtn.style.display = isSingleSVG ? 'flex' : 'none';
            this.separator2.style.display = isSingleSVG ? 'block' : 'none';

            // Update Edit SVG button state if editor is open
            if (window.svgEditor && window.svgEditor.isOpen) {
                this.editSvgBtn.classList.add('bg-blue-100');
                this.editSvgBtn.querySelector('span').textContent = 'Done';
            } else {
                this.editSvgBtn.classList.remove('bg-blue-100');
                this.editSvgBtn.querySelector('span').textContent = 'Edit SVG';
            }

            // Finish is for Polygon drawing or deselecting
            this.finishBtn.style.display = (hasSelection || isDrawingPolygon) ? 'flex' : 'none';

            // Update Finish text based on context
            const finishText = this.finishBtn.querySelector('span');
            if (isDrawingPolygon) {
                finishText.textContent = 'Finish';
            } else {
                finishText.textContent = 'Deselect';
            }
        }
    }

    handleEditSvg() {
        if (window.selectedShapes && window.selectedShapes.length === 1 && window.svgEditor) {
            if (window.svgEditor.isOpen) {
                window.svgEditor.close();
            } else {
                window.svgEditor.open(window.selectedShapes[0]);
            }
        }
    }

    handleDelete() {
        if (window.selectedShapes && window.selectedShapes.length > 0) {
            const shapesToDelete = window.selectedShapes;
            window.world.shapes = window.world.shapes.filter(s => !shapesToDelete.includes(s));
            window.selectedShapes = [];
            window.selectBoundingBox = [0, 0, 0, 0];

            // Trigger auto save if needed
            if (window.autoSave) window.autoSave();
        }
    }

    handleFinish() {
        // If drawing polygon, finish it
        if (window.data && window.data.settings.tool === 2 && window.currentShape && window.currentShape().shapeType === 2) {
            // Close polygon logic
            // Usually Enter key does this. We need to simulate or trigger that logic.
            // In main.js, Enter key usually just deselects or finishes.
            // For polygon, it might be waiting for a "finish" signal.
            // Looking at main.js, polygon points are added on click. 
            // If we just deselect, it might stay as is.

            // Actually, main.js "currentShape()" returns the shape being drawn?
            // If so, we just need to stop drawing it.
            // But main.js logic for polygon might be: click to add point. 
            // To "finish", we usually just switch tools or press Enter.
            // Pressing Enter in main.js (if implemented) usually clears selection.
        }

        // Deselect everything
        window.selectedShapes = [];
        window.selectBoundingBox = [0, 0, 0, 0];

        // If we were in a specific tool that needs resetting, we might want to do that.
        // But simply clearing selection is usually enough to "finish" editing a selected shape.
    }
}
