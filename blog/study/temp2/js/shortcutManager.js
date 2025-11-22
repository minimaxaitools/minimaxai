var ShortcutManager = {
    shortcuts: {},
    enabled: true,

    initialize: function() {
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        this.registerDefaultShortcuts();
    },

    registerDefaultShortcuts: function() {
        // Add bookmark shortcut with debounce
        let bookmarkTimeout = null;
        this.registerShortcut('b', () => {
            if (!this.isInputFocused() && window.BookmarkManager) {
                // Clear any existing timeout
                if (bookmarkTimeout) {
                    clearTimeout(bookmarkTimeout);
                }
                // Set new timeout
                bookmarkTimeout = setTimeout(() => {
                    BookmarkManager.addBookmark();
                    bookmarkTimeout = null;
                }, 100); // 100ms debounce
            }
        }, 'Add Bookmark');

        // Add other shortcuts
        // In ShortcutManager.registerDefaultShortcuts, modify the 'v' shortcut:
        this.registerShortcut('v', async () => {
            if (!this.isInputFocused() && window.VideoExporter) {
                await VideoExporter.toggleVideoRecording();  // Direct call to toggleVideoRecording
            }
        }, 'Toggle Video Recording');
    },

    // Rest of ShortcutManager implementation...

    registerShortcut(key, callback, description) {
        this.shortcuts[key] = {
            callback,
            description,
            enabled: true
        };
    },

    handleKeyPress(event) {
        if (!this.enabled) return;

        const key = event.key.toLowerCase();
        const shortcut = this.shortcuts[key];

        if (shortcut && shortcut.enabled) {
            event.preventDefault();
            shortcut.callback();
        }
    },

    isInputFocused() {
        const activeElement = document.activeElement;
        return activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable;
    },

    toggleShortcut(key, enabled) {
        if (this.shortcuts[key]) {
            this.shortcuts[key].enabled = enabled;
        }
    },

    // Helper method to show available shortcuts
    showShortcuts() {
        console.table(
            Object.entries(this.shortcuts).map(([key, value]) => ({
                Key: key,
                Description: value.description,
                Enabled: value.enabled
            }))
        );
    }

};

// Initialize ShortcutManager when the document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        ShortcutManager.initialize();
    });
} else {
    ShortcutManager.initialize();
}