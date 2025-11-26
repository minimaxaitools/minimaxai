// Modern UI Overlay System
class ModernUIOverlay {
    constructor() {
        this.init();
        this.bindEvents();
        this.activeToolIndex = 0;
        this.imageSelectInitialized = false;
        this.svgSelectInitialized = false;
        this.preventCanvasInteraction = true; // Default state for interaction prevention
    }

    init() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'modern-overlay';

        // Create toggle button for canvas interaction
        this.toggleButton = document.createElement('button');
        this.toggleButton.className = 'modern-button canvas-interaction-toggle';
        this.toggleButton.innerHTML = '🔒 Lock Canvas';
        this.toggleButton.style.position = 'fixed';
        this.toggleButton.style.top = '80px';
        this.toggleButton.style.left = '20px';
        this.toggleButton.style.zIndex = '1002';
        this.toggleButton.style.pointerEvents = 'auto';
        this.updateToggleButton();

        this.toggleButton.addEventListener('click', () => {
            this.preventCanvasInteraction = !this.preventCanvasInteraction;
            this.updateToggleButton();
        });

        // Add event listeners with toggle support
        this.overlay.addEventListener('wheel', (e) => {
            const target = e.target;
            const panel = target.closest('.modern-panel');
            if (panel && this.preventCanvasInteraction) {
                e.stopPropagation();
            }
        }, { passive: false });

        this.overlay.addEventListener('mousedown', (e) => {
            const target = e.target;
            const panel = target.closest('.modern-panel');
            if (panel && this.preventCanvasInteraction) {
                e.stopPropagation();
            }
        });

        this.overlay.addEventListener('mousemove', (e) => {
            const target = e.target;
            const panel = target.closest('.modern-panel');
            if (panel && this.preventCanvasInteraction) {
                e.stopPropagation();
            }
        });

        // Add touch support for modern overlay
        this.overlay.addEventListener('touchstart', (e) => {
            const target = e.target;
            const panel = target.closest('.modern-panel');
            if (panel && this.preventCanvasInteraction) {
                e.stopPropagation();
            }
        }, { passive: false });

        this.overlay.addEventListener('touchmove', (e) => {
            const target = e.target;
            const panel = target.closest('.modern-panel');
            if (panel && this.preventCanvasInteraction) {
                e.stopPropagation();
            }
        }, { passive: false });

        this.overlay.addEventListener('touchend', (e) => {
            const target = e.target;
            const panel = target.closest('.modern-panel');
            if (panel && this.preventCanvasInteraction) {
                e.stopPropagation();
            }
        }, { passive: false });

        document.body.appendChild(this.overlay);
        document.body.appendChild(this.toggleButton);

        this.initTabs();
        this.initPanels();
        this.showPanel('tools');
    }

    updateToggleButton() {
        this.toggleButton.innerHTML = this.preventCanvasInteraction ? '🔒 Lock Canvas' : '🔓 Unlock Canvas';
        this.toggleButton.title = this.preventCanvasInteraction ?
            'Canvas is locked when using panels (Alt+L to toggle)' :
            'Canvas is active even when using panels (Alt+L to toggle)';
    }

    bindEvents() {
        // Existing keyboard shortcuts for tabs (using Alt to avoid conflicts)
        document.addEventListener('keydown', (e) => {
            // Only process shortcuts if not in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            // Alt + number for tabs
            if (e.altKey && !e.ctrlKey && !e.metaKey) {
                switch(e.key) {
                    case '1':
                        this.showPanel('tools');
                        e.preventDefault();
                        break;
                    case '2':
                        this.showPanel('colors');
                        e.preventDefault();
                        break;
                    case '3':
                        this.showPanel('options');
                        e.preventDefault();
                        break;
                    case '4':
                        this.showPanel('shapes');
                        e.preventDefault();
                        break;
                    case 'l':
                    case 'L':
                        // Toggle canvas interaction
                        this.preventCanvasInteraction = !this.preventCanvasInteraction;
                        this.updateToggleButton();
                        e.preventDefault();
                        break;
                }
            }

            // Alt + Shift + number for tools
            // Ctrl + number for tools
            if (e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
                const toolIndex = parseInt(e.key);
                if (!isNaN(toolIndex) && toolIndex >= 0 && toolIndex <= 8) {
                    const toolButton = this.overlay.querySelector(`button[data-tool="${toolIndex}"]`);
                    if (toolButton) {
                        toolButton.click();
                        e.preventDefault();
                    }
                }
            }

        });

        // Existing tooltip functionality
        this.addTooltips();

        // Handle window resize
        window.addEventListener('resize', () => {
            this.updateLayout();
        });
    }

    initTabs() {
        const tabs = document.createElement('div');
        tabs.className = 'modern-tabs';

        const sections = [
            { id: 'tools', label: 'Tools' },
            { id: 'colors', label: 'Colors' },
            { id: 'options', label: 'Options' },
            { id: 'shapes', label: 'Shapes' }
        ];

        sections.forEach(section => {
            const tab = document.createElement('button');
            tab.className = 'modern-tab';
            tab.dataset.panelId = section.id;
            tab.textContent = section.label;
            tab.addEventListener('click', () => this.showPanel(section.id));
            tabs.appendChild(tab);
        });

        this.overlay.appendChild(tabs);
    }

    initPanels() {
        this.panels = {
            tools: this.createToolsPanel(),
            colors: this.createColorsPanel(),
            options: this.createOptionsPanel(),
            shapes: this.createShapesPanel()
        };

        Object.values(this.panels).forEach(panel => {
            this.overlay.appendChild(panel);
        });
    }

    createToolsPanel() {
        const panel = document.createElement('div');
        panel.className = 'modern-panel';
        panel.id = 'tools-panel';

        const wrapper = document.createElement('div');
        wrapper.className = 'scroll';

        const title = document.createElement('h3');
        title.textContent = 'Tools';
        wrapper.appendChild(title);

        const toolsSection = document.querySelector('.toolbar > div.scroll:nth-last-child(2)');
        if (toolsSection) {
            const toolButtons = toolsSection.querySelectorAll('button.tool');
            toolButtons.forEach(button => {
                const clonedButton = button.cloneNode(true);

                const img = clonedButton.querySelector('img');
                if (img) {
                    const originalSrc = img.getAttribute('src');
                    img.src = originalSrc;
                }

                clonedButton.classList.add('modern-button');
                clonedButton.dataset.tool = button.dataset.tool;

                clonedButton.addEventListener('click', () => {
                    const toolIndex = parseInt(button.dataset.tool);
                    this.activeToolIndex = toolIndex;
                    this.updateActiveToolUI(toolIndex);
                    button.click();
                });

                wrapper.appendChild(clonedButton);
            });
        }

        panel.appendChild(wrapper);
        return panel;
    }

    createColorsPanel() {
        const panel = document.createElement('div');
        panel.className = 'modern-panel';
        panel.id = 'colors-panel';

        const colorsSection = document.querySelector('.toolbar .scroll:first-of-type');
        if (colorsSection) {
            const content = colorsSection.cloneNode(true);
            this.enhanceContent(content);

            // Handle color inputs
            content.querySelectorAll('input[type="color"]').forEach(input => {
                input.addEventListener('input', e => {
                    const originalInput = document.querySelector(`input[data-prop="${input.dataset.prop}"]`);
                    if (originalInput) {
                        originalInput.value = e.target.value;
                        originalInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                });
            });

            // Handle color palette buttons
            content.querySelectorAll('button.palette').forEach(button => {
                button.style.backgroundColor = button.dataset.palettecolor;
                button.oncontextmenu = e => false;
                button.onmouseup = e => {
                    const originalButton = document.querySelector(`button.palette[data-palettecolor="${button.dataset.palettecolor}"]`);
                    if (originalButton) {
                        originalButton.dispatchEvent(new MouseEvent('mouseup', {
                            bubbles: true,
                            button: e.button
                        }));
                    }
                };
            });

            panel.appendChild(content);
        }

        return panel;
    }

    createOptionsPanel() {
        const panel = document.createElement('div');
        panel.className = 'modern-panel';
        panel.id = 'options-panel';

        const optionsSection = document.querySelector('.toolbar .scroll:nth-of-type(2)');
        if (optionsSection) {
            const content = optionsSection.cloneNode(true);
            this.enhanceContent(content);

            // Handle numeric inputs with Decimal.js values
            content.querySelectorAll('input[type="number"]').forEach(input => {
                if (input.dataset.prop) {
                    input.addEventListener('input', e => {
                        const originalInput = document.querySelector(`input[data-prop="${input.dataset.prop}"]`);
                        if (originalInput) {
                            originalInput.value = e.target.value;
                            originalInput.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    });
                }
            });

            // Handle scaling controls
            const scaleInput = content.querySelector('#scale-factor');
            const scaleSlider = content.querySelector('#scale-slider');
            const stepInput = content.querySelector('#scale-step');

            if (scaleInput && scaleSlider && stepInput) {
                stepInput.addEventListener('input', e => {
                    const originalInput = document.querySelector('#scale-step');
                    if (originalInput) {
                        originalInput.value = e.target.value;
                        originalInput.dispatchEvent(new Event('input'));
                    }
                });

                scaleInput.addEventListener('input', e => {
                    const originalInput = document.querySelector('#scale-factor');
                    if (originalInput) {
                        originalInput.value = e.target.value;
                        originalInput.dispatchEvent(new Event('input'));
                    }
                });

                scaleSlider.addEventListener('input', e => {
                    const originalSlider = document.querySelector('#scale-slider');
                    if (originalSlider) {
                        originalSlider.value = e.target.value;
                        originalSlider.dispatchEvent(new Event('input'));
                    }
                });
            }

            // Bind special buttons
            [
                'clear_canvas', 'reset_cam', 'move_center', 'download', 'import',
                'move_shape_top', 'move_shape_forward', 'move_shape_backward', 'move_shape_bottom'
            ].forEach(id => {
                const button = content.querySelector(`#${id}`);
                if (button) {
                    button.onclick = e => {
                        const originalButton = document.querySelector(`#${id}`);
                        if (originalButton) {
                            originalButton.click();
                        }
                    };
                }
            });

            panel.appendChild(content);
        }

        return panel;
    }

    createShapesPanel() {
        const panel = document.createElement('div');
        panel.className = 'modern-panel';
        panel.id = 'shapes-panel';

        const shapeViews = document.querySelectorAll('.toolbar [data-toolview]');
        shapeViews.forEach(view => {
            const content = view.cloneNode(true);
            this.enhanceContent(content);

            content.dataset.toolview = view.dataset.toolview;

            // Handle text tool specific controls
            if (content.dataset.toolview === "3") {
                this.initializeTextControls(content);
            }

            // Handle image tool specific controls
            if (content.dataset.toolview === "4") {
                this.initializeImageControls(content);
            }

            // Handle gradient tool specific controls
            if (content.dataset.toolview === "5") {
                this.initializeGradientControls(content);
            }

            // Handle SVG tool specific controls
            if (content.dataset.toolview === "8") {
                this.initializeSVGControls(content);
            }

            panel.appendChild(content);
        });

        return panel;
    }

    initializeTextControls(content) {
        content.querySelectorAll('button.align').forEach(button => {
            button.onclick = e => {
                const originalButton = document.querySelector(`button.align[data-textalign="${button.dataset.textalign}"]`);
                if (originalButton) {
                    originalButton.click();
                }
            };
        });

        const fontInput = content.querySelector('#setting_font');
        if (fontInput) {
            fontInput.addEventListener('input', e => {
                const originalInput = document.querySelector('#setting_font');
                if (originalInput) {
                    originalInput.value = e.target.value;
                    originalInput.dispatchEvent(new Event('input'));
                }
            });
        }
    }

    initializeImageControls(content) {
        const imageSelect = content.querySelector('.image-select');
        if (imageSelect && !this.imageSelectInitialized) {
            this.initializeImageSelect(imageSelect);
            this.imageSelectInitialized = true;
        }

        // Handle image adjustment controls
        ['w', 'h', 'rotation', 'blur', 'hue', 'brightness', 'contrast', 'saturation'].forEach(prop => {
            const input = content.querySelector(`[data-prop="image.${prop}"]`);
            if (input) {
                input.addEventListener('input', e => {
                    const originalInput = document.querySelector(`[data-prop="image.${prop}"]`);
                    if (originalInput) {
                        originalInput.value = e.target.value;
                        originalInput.dispatchEvent(new Event('input'));
                    }
                });
            }
        });
    }

    initializeGradientControls(content) {
        // Handle gradient type and rotation controls
        ['type', 'rotation'].forEach(prop => {
            const input = content.querySelector(`[data-prop="gradient.${prop}"]`);
            if (input) {
                input.addEventListener('input', e => {
                    const originalInput = document.querySelector(`[data-prop="gradient.${prop}"]`);
                    if (originalInput) {
                        originalInput.value = e.target.value;
                        originalInput.dispatchEvent(new Event('input'));
                    }
                });
            }
        });

        // Handle gradient templates
        const templatesDiv = content.querySelector('#gradient_templates');
        if (templatesDiv) {
            templatesDiv.querySelectorAll('button').forEach(button => {
                button.addEventListener('click', () => {
                    const originalButton = document.querySelector(`#gradient_templates button:contains('${button.textContent}')`);
                    if (originalButton) {
                        originalButton.click();
                    }
                });
            });
        }

        // Handle random gradient button
        const randomButton = content.querySelector('#random_gradient');
        if (randomButton) {
            randomButton.addEventListener('click', () => {
                const originalButton = document.querySelector('#random_gradient');
                if (originalButton) {
                    originalButton.click();
                }
            });
        }

        // Handle gradient color controls
        const gradientDiv = content.querySelector('#gradient_div');
        if (gradientDiv) {
            // Sync initial gradient colors
            this.syncGradientColors(gradientDiv);

            // Observe changes in the original gradient div
            const observer = new MutationObserver(() => {
                this.syncGradientColors(gradientDiv);
            });

            const originalGradientDiv = document.querySelector('#gradient_div');
            if (originalGradientDiv) {
                observer.observe(originalGradientDiv, {
                    childList: true,
                    subtree: true,
                    attributes: true
                });
            }
        }

        // Handle add color button
        const addColorButton = content.querySelector('#add_gradient_color');
        if (addColorButton) {
            addColorButton.addEventListener('click', () => {
                const originalButton = document.querySelector('#add_gradient_color');
                if (originalButton) {
                    originalButton.click();
                }
            });
        }
    }

    syncGradientColors(gradientDiv) {
        const originalGradientDiv = document.querySelector('#gradient_div');
        if (!originalGradientDiv) return;

        gradientDiv.innerHTML = '';
        originalGradientDiv.querySelectorAll('[data-id]').forEach(colorControl => {
            const clonedControl = colorControl.cloneNode(true);

            // Bind color input
            const colorInput = clonedControl.querySelector('input[type="color"]');
            const originalColorInput = colorControl.querySelector('input[type="color"]');
            if (colorInput && originalColorInput) {
                colorInput.addEventListener('input', e => {
                    originalColorInput.value = e.target.value;
                    originalColorInput.dispatchEvent(new Event('input'));
                });
            }

            // Bind position input
            const posInput = clonedControl.querySelector('input[type="number"]');
            const originalPosInput = colorControl.querySelector('input[type="number"]');
            if (posInput && originalPosInput) {
                posInput.addEventListener('input', e => {
                    originalPosInput.value = e.target.value;
                    originalPosInput.dispatchEvent(new Event('input'));
                });
            }

            // Bind remove button
            const removeButton = clonedControl.querySelector('button');
            const originalRemoveButton = colorControl.querySelector('button');
            if (removeButton && originalRemoveButton) {
                removeButton.addEventListener('click', () => {
                    originalRemoveButton.click();
                });
            }

            gradientDiv.appendChild(clonedControl);
        });
    }

    initializeImageSelect(container) {
        // Clear existing content
        container.innerHTML = '';

        // Get original image select container
        const originalContainer = document.querySelector('.toolbar .image-select');
        if (!originalContainer) return;

        // Clone and enhance each image button
        originalContainer.querySelectorAll('button').forEach(button => {
            const clonedButton = button.cloneNode(true);
            clonedButton.classList.add('modern-button');

            // Ensure image src is correctly set
            const img = clonedButton.querySelector('img');
            if (img) {
                const originalImg = button.querySelector('img');
                if (originalImg) {
                    img.src = originalImg.src;
                }
            }

            clonedButton.addEventListener('click', () => {
                button.click();
                this.updateImageSelection(clonedButton);
            });

            container.appendChild(clonedButton);
        });

        // Observe original container for changes
        const observer = new MutationObserver(() => {
            this.syncImagePreviews(container, originalContainer);
        });

        observer.observe(originalContainer, {
            childList: true,
            subtree: true
        });
    }

    syncImagePreviews(modernContainer, originalContainer) {
        modernContainer.innerHTML = '';
        originalContainer.querySelectorAll('button').forEach(button => {
            const clonedButton = button.cloneNode(true);
            clonedButton.classList.add('modern-button');

            const img = clonedButton.querySelector('img');
            if (img) {
                const originalImg = button.querySelector('img');
                if (originalImg) {
                    img.src = originalImg.src;
                }
            }

            clonedButton.addEventListener('click', () => {
                button.click();
                this.updateImageSelection(clonedButton);
            });

            modernContainer.appendChild(clonedButton);
        });
    }

    initializeSVGControls(content) {
        const svgUpload = content.querySelector('#svg-upload');
        const svgSelect = content.querySelector('.svg-select');

        if (svgUpload && !this.svgSelectInitialized) {
            svgUpload.addEventListener('change', e => {
                const originalUpload = document.querySelector('#svg-upload');
                if (originalUpload) {
                    originalUpload.files = e.target.files;
                    originalUpload.dispatchEvent(new Event('change'));
                }
            });

            // Initialize SVG preview grid
            if (svgSelect) {
                this.initializeSVGSelect(svgSelect);
                this.svgSelectInitialized = true;
            }
        }

        // Handle SVG adjustment controls
        ['w', 'h', 'rotation'].forEach(prop => {
            const input = content.querySelector(`[data-prop="svg.${prop}"]`);
            if (input) {
                input.addEventListener('input', e => {
                    const originalInput = document.querySelector(`[data-prop="svg.${prop}"]`);
                    if (originalInput) {
                        originalInput.value = e.target.value;
                        originalInput.dispatchEvent(new Event('input'));
                    }
                });
            }
        });
    }

    initializeSVGSelect(container) {
        // Clear existing content
        container.innerHTML = '';

        // Get original SVG select container
        const originalContainer = document.querySelector('.toolbar .svg-select');
        if (!originalContainer) return;

        // Clone and enhance each SVG preview
        originalContainer.querySelectorAll('.svg-preview').forEach(preview => {
            const clonedPreview = preview.cloneNode(true);

            clonedPreview.addEventListener('click', () => {
                preview.click();
                this.updateSVGSelection(clonedPreview);
            });

            container.appendChild(clonedPreview);
        });

        // Observe original container for changes
        const observer = new MutationObserver(() => {
            this.syncSVGPreviews(container, originalContainer);
        });

        observer.observe(originalContainer, {
            childList: true,
            subtree: true
        });
    }

    syncSVGPreviews(modernContainer, originalContainer) {
        modernContainer.innerHTML = '';
        originalContainer.querySelectorAll('.svg-preview').forEach(preview => {
            const clonedPreview = preview.cloneNode(true);

            clonedPreview.addEventListener('click', () => {
                preview.click();
                this.updateSVGSelection(clonedPreview);
            });

            modernContainer.appendChild(clonedPreview);
        });
    }

    updateImageSelection(selectedButton) {
        const container = selectedButton.closest('.image-select');
        container.querySelectorAll('button').forEach(btn => {
            btn.classList.remove('active');
        });
        selectedButton.classList.add('active');
    }

    updateSVGSelection(selectedPreview) {
        const container = selectedPreview.closest('.svg-select');
        container.querySelectorAll('.svg-preview').forEach(preview => {
            preview.classList.remove('active');
        });
        selectedPreview.classList.add('active');
    }

    enhanceContent(content) {
        content.querySelectorAll('input').forEach(input => {
            input.classList.add('modern-input');

            if (input.dataset.prop) {
                const originalInput = document.querySelector(`[data-prop="${input.dataset.prop}"]`);
                if (originalInput) {
                    // Sync initial value
                    input.value = originalInput.value;
                    if (input.type === 'checkbox') {
                        input.checked = originalInput.checked;
                    }

                    // Two-way binding
                    input.addEventListener('input', e => {
                        originalInput.value = e.target.value;
                        if (input.type === 'checkbox') {
                            originalInput.checked = e.target.checked;
                        }
                        originalInput.dispatchEvent(new Event('input', { bubbles: true }));
                    });

                    originalInput.addEventListener('input', e => {
                        input.value = e.target.value;
                        if (input.type === 'checkbox') {
                            input.checked = e.target.checked;
                        }
                    });
                }
            }
        });

        content.querySelectorAll('button').forEach(button => {
            button.classList.add('modern-button');
        });

        content.querySelectorAll('label').forEach(label => {
            label.classList.add('modern-control-label');
        });
    }

    showPanel(panelId) {
        Object.values(this.panels).forEach(panel => {
            panel.classList.remove('visible');
        });

        const panel = this.panels[panelId];
        if (panel) {
            panel.classList.add('visible');
        }

        this.updateTabs(panelId);
    }

    updateTabs(activeId) {
        const tabs = this.overlay.querySelectorAll('.modern-tab');
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.panelId === activeId);
        });
    }

    updateActiveToolUI(toolIndex) {
        // Update tool buttons
        const toolButtons = this.overlay.querySelectorAll('button.tool');
        toolButtons.forEach(button => {
            button.classList.toggle('active', parseInt(button.dataset.tool) === toolIndex);
        });

        // Show/hide shape panels
        const shapePanels = this.overlay.querySelectorAll('[data-toolview]');
        shapePanels.forEach(panel => {
            if (panel.dataset.toolview !== undefined) {
                panel.style.display = toolIndex === parseInt(panel.dataset.toolview) ? 'block' : 'none';
            }
        });

        // Update tabs based on tool context
        if (toolIndex >= 0 && toolIndex <= 8) {
            this.showPanel('tools');
        }
    }

    addTooltips() {
        const buttons = this.overlay.querySelectorAll('button');
        buttons.forEach(button => {
            button.addEventListener('mouseenter', (e) => {
                const tooltip = document.createElement('div');
                tooltip.className = 'modern-tooltip';
                tooltip.textContent = button.getAttribute('data-tooltip') ||
                    button.getAttribute('alt') ||
                    button.textContent;

                const rect = button.getBoundingClientRect();
                tooltip.style.top = `${rect.top - 30}px`;
                tooltip.style.left = `${rect.left + (rect.width/2)}px`;

                this.overlay.appendChild(tooltip);
                requestAnimationFrame(() => tooltip.classList.add('visible'));
            });

            button.addEventListener('mouseleave', () => {
                const tooltip = this.overlay.querySelector('.modern-tooltip');
                if (tooltip) {
                    tooltip.remove();
                }
            });
        });
    }

    updateLayout() {
        // Update layout on window resize
        Object.values(this.panels).forEach(panel => {
            if (panel.classList.contains('visible')) {
                const rect = panel.getBoundingClientRect();
                if (rect.right > window.innerWidth) {
                    panel.style.right = '20px';
                }
                if (rect.bottom > window.innerHeight) {
                    panel.style.maxHeight = `${window.innerHeight - 40}px`;
                }
            }
        });
    }
}

// Initialize the modern UI overlay
document.addEventListener('DOMContentLoaded', () => {
    window.modernUI = new ModernUIOverlay();
});
