// paneltoggle.js
{
    function handlePanelToggle(e) {
        const panel = e.target.closest('.ui-panel');
        if (!panel) return; // Guard clause if panel not found

        const content = panel.querySelector('.panel-content, #layers-list, #bookmarks-list');
        const toggle = panel.querySelector('.panel-toggle');

        if (!content || !toggle) return; // Guard clause if elements not found

        // Toggle visibility
        if (content.style.display === 'none' || content.style.display === '') {
            content.style.display = 'block';
            toggle.textContent = '×';
        } else {
            content.style.display = 'none';
            toggle.textContent = '≡';
        }
    }

    // Wait for DOM to be ready
    function initializePanelToggles() {
        const toggles = document.querySelectorAll('.panel-toggle');
        toggles.forEach(toggle => {
            toggle.addEventListener('click', handlePanelToggle);
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePanelToggles);
    } else {
        initializePanelToggles();
    }
}