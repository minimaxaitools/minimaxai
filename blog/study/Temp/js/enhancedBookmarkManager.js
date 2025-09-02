// enhancedBookmarkManager.js
const EnhancedBookmarkManager = {
    bookmarks: [],
    groups: {},
    currentFilter: '',

    initialize() {
        this.setupEventListeners();
        this.loadBookmarks();
        this.renderBookmarks();
        this.initializeSortable();
    },

    setupEventListeners() {
        document.getElementById('bookmark-search').addEventListener('input', (e) => {
            this.currentFilter = e.target.value.toLowerCase();
            this.renderBookmarks();
        });

        document.getElementById('clear-bookmarks').addEventListener('click', () => {
            if (confirm('Clear all bookmarks?')) {
                this.bookmarks = [];
                this.saveBookmarks();
                this.renderBookmarks();
            }
        });
    },

    initializeSortable() {
        new Sortable(document.getElementById('enhanced-bookmarks-list'), {
            animation: 150,
            onEnd: (evt) => {
                this.reorderBookmarks(evt.oldIndex, evt.newIndex);
            }
        });
    },

    reorderBookmarks(oldIndex, newIndex) {
        const bookmark = this.bookmarks.splice(oldIndex, 1)[0];
        this.bookmarks.splice(newIndex, 0, bookmark);
        this.saveBookmarks();
        this.renderBookmarks();
    },

    addBookmark(bookmark) {
        bookmark.id = 'bm_' + Date.now();
        bookmark.groupId = bookmark.groupId || 'ungrouped';
        this.bookmarks.push(bookmark);
        this.saveBookmarks();
        this.renderBookmarks();
    },

    renderBookmarks() {
        const container = document.getElementById('enhanced-bookmarks-list');
        container.innerHTML = '';

        const filteredBookmarks = this.bookmarks.filter(bm =>
            bm.name.toLowerCase().includes(this.currentFilter)
        );

        filteredBookmarks.forEach((bookmark, index) => {
            const element = this.createBookmarkElement(bookmark, index + 1);
            container.appendChild(element);
        });
    },

    createBookmarkElement(bookmark, index) {
        const element = document.createElement('div');
        element.className = 'bookmark-item';
        element.dataset.id = bookmark.id;

        element.innerHTML = `
            <div class="bookmark-number">${index}</div>
            <div class="bookmark-content">
                <div class="bookmark-name">${bookmark.name}</div>
                <div class="bookmark-controls">
                    <input type="number" class="bookmark-position" value="${index}" min="1" max="${this.bookmarks.length}">
                    <button class="edit-bookmark">✏️</button>
                    <button class="delete-bookmark">🗑️</button>
                </div>
            </div>
        `;

        this.setupBookmarkElementListeners(element, bookmark);
        return element;
    },

// Continue in enhancedBookmarkManager.js
    setupBookmarkElementListeners(element, bookmark) {
        const positionInput = element.querySelector('.bookmark-position');
        positionInput.addEventListener('change', (e) => {
            const newPosition = parseInt(e.target.value) - 1;
            this.reorderBookmarks(this.bookmarks.indexOf(bookmark), newPosition);
        });

        element.querySelector('.edit-bookmark').addEventListener('click', () => {
            this.editBookmark(bookmark);
        });

        element.querySelector('.delete-bookmark').addEventListener('click', () => {
            this.deleteBookmark(bookmark);
        });
    },

    editBookmark(bookmark) {
        const newName = prompt('Enter new name:', bookmark.name);
        if (newName !== null) {
            bookmark.name = newName;
            this.saveBookmarks();
            this.renderBookmarks();
        }
    },

    deleteBookmark(bookmark) {
        if (confirm('Delete this bookmark?')) {
            this.bookmarks = this.bookmarks.filter(b => b.id !== bookmark.id);
            this.saveBookmarks();
            this.renderBookmarks();
        }
    },

    saveBookmarks() {
        localStorage.setItem('enhancedBookmarks', JSON.stringify({
            bookmarks: this.bookmarks,
            groups: this.groups
        }));
    },

    loadBookmarks() {
        const saved = localStorage.getItem('enhancedBookmarks');
        if (saved) {
            const data = JSON.parse(saved);
            this.bookmarks = data.bookmarks || [];
            this.groups = data.groups || {};
        }
    }
};