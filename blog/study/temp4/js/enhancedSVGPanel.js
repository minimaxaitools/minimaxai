// enhancedSVGPanel.js
const EnhancedSVGPanel = {
        currentFilter: '',
        isExpanded: false,
        hoverPreviewEnabled: false,
        isPanelCollapsed: false,

        initialize() {
            this.setupEventListeners();
            this.renderSVGGrid();
            this.initializeControls();
            this.setupPanelToggle();
        },

        setupPanelToggle() {
            const panel = document.getElementById('enhanced-svg-panel');
            const toggle = panel.querySelector('.panel-toggle');
            const content = panel.querySelector('.panel-content');

            if (!panel || !toggle || !content) {
                console.warn('Panel elements not found');
                return;
            }

            toggle.addEventListener('click', () => {
                this.isPanelCollapsed = !this.isPanelCollapsed;
                toggle.classList.toggle('collapsed', this.isPanelCollapsed);
                content.classList.toggle('collapsed', this.isPanelCollapsed);

                localStorage.setItem('svgPanelCollapsed', this.isPanelCollapsed);
                toggle.textContent = this.isPanelCollapsed ? '►' : '▼';
            });

            const savedState = localStorage.getItem('svgPanelCollapsed');
            if (savedState !== null) {
                this.isPanelCollapsed = savedState === 'true';
                toggle.classList.toggle('collapsed', this.isPanelCollapsed);
                content.classList.toggle('collapsed', this.isPanelCollapsed);
                toggle.textContent = this.isPanelCollapsed ? '►' : '▼';
            }
        },

    initializeControls() {
        const inputs = document.querySelectorAll('#enhanced-svg-panel input[data-prop]');

        inputs.forEach(input => {
            const props = input.dataset.prop.split('.');
            let value = data.settings;
            for (const prop of props) {
                value = value[prop];
            }

            if (input.type === 'checkbox') {
                input.checked = value;
            } else {
                input.value = value;
            }

            input.addEventListener('input', (e) => {
                let setting = data.settings;
                const props = input.dataset.prop.split('.');

                for (let i = 0; i < props.length - 1; i++) {
                    setting = setting[props[i]];
                }

                const lastProp = props[props.length - 1];
                if (input.type === 'checkbox') {
                    setting[lastProp] = e.target.checked;
                } else if (input.type === 'number') {
                    setting[lastProp] = parseFloat(e.target.value);
                } else {
                    setting[lastProp] = e.target.value;
                }

                // Update selected shapes while maintaining aspect ratio
                if (window.selectedShapes) {
                    selectedShapes.forEach(shape => {
                        if (shape.shapeType === 5) { // SVG shape type
                            if (lastProp === 'w') {
                                shape.w = new Decimal(e.target.value).mul(data.cam.range);
                                shape.maintainAspectRatio(); // This will update height automatically
                            } else if (lastProp === 'h') {
                                shape.h = new Decimal(e.target.value).mul(data.cam.range);
                                // Optionally update width to maintain ratio
                                shape.w = shape.h.mul(shape.aspectRatio);
                            } else {
                                shape[lastProp] = parseFloat(e.target.value);
                            }
                        }
                    });
                }
            });
        });
    },


        setupEventListeners() {
            const panel = document.getElementById('enhanced-svg-panel');
            if (!panel) {
                console.warn('SVG panel not found');
                return;
            }

            const searchInput = panel.querySelector('#svg-search');
            const hoverPreviewCheckbox = panel.querySelector('#hover-preview');

            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.currentFilter = e.target.value.toLowerCase();
                    this.renderSVGGrid();
                });

                searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        searchInput.value = '';
                        this.currentFilter = '';
                        this.renderSVGGrid();
                    }
                });
            }

            if (hoverPreviewCheckbox) {
                hoverPreviewCheckbox.addEventListener('change', (e) => {
                    this.hoverPreviewEnabled = e.target.checked;
                    localStorage.setItem('svgHoverPreview', e.target.checked);
                });

                const savedHoverState = localStorage.getItem('svgHoverPreview');
                if (savedHoverState !== null) {
                    hoverPreviewCheckbox.checked = savedHoverState === 'true';
                    this.hoverPreviewEnabled = savedHoverState === 'true';
                }
            }
        },

    renderSVGGrid(container = '.svg-grid') {
        const grid = document.querySelector(container);
        grid.innerHTML = '';

        // Get filtered SVGs but keep their original indices
        const filteredSVGs = svgCollection.map((svg, index) => ({
            svg,
            originalIndex: index
        })).filter(item =>
            item.svg.name.toLowerCase().includes(this.currentFilter)
        );

        // Use the saved original indices when creating items
        filteredSVGs.forEach(({svg, originalIndex}, displayIndex) => {
            const item = this.createSVGItem(svg, displayIndex, originalIndex);
            grid.appendChild(item);
        });
    },

        // Update the createSVGItem method to use both display and original indices
    createSVGItem(svg, displayIndex, originalIndex) {
        const item = document.createElement('div');
        item.className = 'svg-item';
        item.dataset.originalIndex = originalIndex;

        const preview = document.createElement('div');
        preview.className = 'svg-preview';
        preview.innerHTML = svg.data;

        const name = document.createElement('div');
        name.className = 'svg-name';
        name.textContent = svg.name;

        const index = document.createElement('div');
        index.className = 'svg-index';
        index.textContent = `${displayIndex + 1} (#${originalIndex + 1})`;

        item.appendChild(preview);
        item.appendChild(name);
        item.appendChild(index);

        item.addEventListener('click', () => {
            this.selectSVG(originalIndex);

            document.querySelectorAll('.svg-item').forEach(i =>
                i.classList.remove('selected')
            );
            item.classList.add('selected');
        });

        if (this.hoverPreviewEnabled) {
            this.setupHoverPreview(item, svg);
        }

        item.title = `Search Result #${displayIndex + 1}\nOriginal SVG #${originalIndex + 1}\nName: ${svg.name}`;

        return item;
    },


    // but before any closing brace
    syncWithMainPanel() {
        const mainPanelInputs = document.querySelectorAll('.toolbar input[data-prop^="svg."]');
        const enhancedPanelInputs = document.querySelectorAll('#enhanced-svg-panel input[data-prop]');

        // Create a mapping for quick lookup
        const enhancedInputMap = new Map();
        enhancedPanelInputs.forEach(input => {
            enhancedInputMap.set(input.dataset.prop, input);
        });

        // Sync values from main panel to enhanced panel
        mainPanelInputs.forEach(mainInput => {
            const enhancedInput = enhancedInputMap.get(mainInput.dataset.prop);
            if (enhancedInput) {
                enhancedInput.value = mainInput.value;
                if (mainInput.type === 'checkbox') {
                    enhancedInput.checked = mainInput.checked;
                }
            }
        });
    },


    setupHoverPreview(item, svg) {
        const preview = document.createElement('div');
        preview.className = 'svg-preview-large';
        preview.innerHTML = svg.data;

        item.addEventListener('mouseenter', (e) => {
            document.body.appendChild(preview);
            const rect = item.getBoundingClientRect();
            preview.style.left = `${rect.right + 10}px`;
            preview.style.top = `${rect.top}px`;
            preview.style.display = 'block';
        });

        item.addEventListener('mouseleave', () => {
            preview.remove();
        });
    },

    toggleExpandedView() {
        const expandedPanel = document.createElement('div');
        expandedPanel.className = 'expanded-panel';
        expandedPanel.innerHTML = `
            <div class="panel-header">
                <span>SVG Library (Expanded View)</span>
                <button class="close-expanded">×</button>
            </div>
            <div class="svg-grid expanded"></div>
        `;

        document.body.appendChild(expandedPanel);
        this.renderSVGGrid('.expanded-panel .svg-grid');

        expandedPanel.querySelector('.close-expanded').onclick = () => {
            expandedPanel.remove();
        };
    },

    // Add this method near selectSVG in enhancedSVGPanel.js
    selectSVG(index) {
        if (index >= 0 && index < svgCollection.length) {
            data.settings.svg.currentIndex = index;

            // Calculate aspect ratio for the selected SVG
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgCollection[index].data, 'image/svg+xml');
            const svgElement = svgDoc.documentElement;

            let width, height;
            const viewBox = svgElement.getAttribute('viewBox');
            if (viewBox) {
                const [, , w, h] = viewBox.split(' ').map(Number);
                width = w;
                height = h;
            } else {
                width = parseFloat(svgElement.getAttribute('width')) || 100;
                height = parseFloat(svgElement.getAttribute('height')) || 100;
            }

            const aspectRatio = width / height;

            // Update width/height controls maintaining aspect ratio
            const currentWidth = parseFloat(data.settings.svg.w);
            data.settings.svg.h = (currentWidth / aspectRatio).toString();

            // Update all SVG controls to reflect current settings
            const inputs = document.querySelectorAll('#enhanced-svg-panel input[data-prop]');
            inputs.forEach(input => {
                const props = input.dataset.prop.split('.');
                let value = data.settings;
                for (const prop of props) {
                    value = value[prop];
                }
                if (input.type === 'checkbox') {
                    input.checked = value;
                } else {
                    input.value = value;
                }
            });

            // Visual feedback for both panels
            document.querySelectorAll('.svg-item').forEach(item => {
                item.classList.remove('selected');
            });
            const selectedItems = document.querySelectorAll(`.svg-item[data-original-index="${index}"]`);
            selectedItems.forEach(item => item.classList.add('selected'));

            // Log selection for debugging
            console.log(`Selected SVG #${index + 1}: ${svgCollection[index]?.name || 'Unknown'}`);

            // Show notification
            this.showNotification(`Selected SVG: ${svgCollection[index].name}`, 'success');
        } else {
            console.warn(`Invalid SVG index: ${index}`);
            this.showNotification('Invalid SVG selection', 'error');
        }
    },

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
};