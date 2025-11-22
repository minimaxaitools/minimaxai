class PanelManager {
    constructor() {
        this.panels = document.querySelectorAll('.ui-panel, .side-panel, .video-export-controls');
        this.init();
    }

    init() {
        this.panels.forEach(panel => {
            this.makeDraggable(panel);
            this.makeCollapsible(panel);
        });
        console.log('PanelManager initialized');
    }

    makeDraggable(panel) {
        let header = panel.querySelector('.panel-header, h3');
        if (!header) return;

        header.style.cursor = 'move';

        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        const startDrag = (e) => {
            // Ignore if clicking buttons/inputs within header
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;

            isDragging = true;

            // Get mouse/touch position
            const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

            startX = clientX;
            startY = clientY;

            const rect = panel.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            // Remove fixed positioning constraints if needed
            panel.style.bottom = 'auto';
            panel.style.right = 'auto';
            panel.style.transform = 'none'; // Remove transform if any

            // Set initial absolute position
            panel.style.position = 'fixed';
            panel.style.left = `${initialLeft}px`;
            panel.style.top = `${initialTop}px`;
            panel.style.zIndex = '1000'; // Bring to front

            document.addEventListener('mousemove', onDrag);
            document.addEventListener('touchmove', onDrag, { passive: false });
            document.addEventListener('mouseup', stopDrag);
            document.addEventListener('touchend', stopDrag);
        };

        const onDrag = (e) => {
            if (!isDragging) return;
            e.preventDefault();

            const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

            const dx = clientX - startX;
            const dy = clientY - startY;

            panel.style.left = `${initialLeft + dx}px`;
            panel.style.top = `${initialTop + dy}px`;
        };

        const stopDrag = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('touchmove', onDrag);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchend', stopDrag);
        };

        header.addEventListener('mousedown', startDrag);
        header.addEventListener('touchstart', startDrag, { passive: false });
    }

    makeCollapsible(panel) {
        // Check if already has toggle logic (some do via main.js/paneltoggle.js)
        // We will enhance it to support "tiny circle" mode

        let toggleBtn = panel.querySelector('.panel-toggle');
        let content = panel.querySelector('.panel-content, .video-settings, #bookmarks-list');

        if (!toggleBtn && !content) return;

        // Create toggle button if missing (e.g. video panel)
        if (!toggleBtn) {
            const header = panel.querySelector('h3');
            if (header) {
                toggleBtn = document.createElement('button');
                toggleBtn.className = 'panel-toggle ml-auto text-gray-500 hover:text-gray-700';
                toggleBtn.innerHTML = '▼';
                header.parentNode.insertBefore(toggleBtn, header.nextSibling);
                // Ensure header is flex
                header.parentNode.style.display = 'flex';
                header.parentNode.style.justifyContent = 'space-between';
                header.parentNode.style.alignItems = 'center';
            }
        }

        if (toggleBtn) {
            // Remove old listeners by cloning (simple way) or just add new one that handles visual state
            // We'll add a new listener that handles the "tiny" state

            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent drag start

                const isCollapsed = panel.classList.toggle('panel-collapsed');

                if (isCollapsed) {
                    // Tiny mode
                    if (content) content.style.display = 'none';
                    panel.style.width = 'auto';
                    panel.style.height = 'auto';
                    panel.style.overflow = 'hidden';
                    toggleBtn.innerHTML = '▲';

                    // Hide other controls in header except toggle
                    Array.from(panel.children).forEach(child => {
                        if (child !== panel.querySelector('.panel-header') && child !== header) {
                            child.style.display = 'none';
                        }
                    });
                } else {
                    // Restore
                    if (content) content.style.display = 'block';
                    panel.style.width = ''; // Reset to CSS default
                    panel.style.height = '';
                    toggleBtn.innerHTML = '▼';

                    // Show other controls
                    Array.from(panel.children).forEach(child => {
                        child.style.display = '';
                    });
                }
            });
        }
    }
}

window.PanelManager = PanelManager;
