var BookmarkManager = {
    bookmarks: [],
    currentTourIndex: -1,
    isPlaying: false,
    tourInterval: null,
    onTourEnd: null,
    searchQuery: '', // Added for search

    initialize: function() {
        const toggle = document.querySelector('.panel-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => {
                const panel = document.getElementById('bookmarks-panel');
                if (panel) {
                    panel.classList.toggle('collapsed');
                }
            });
        }
        this.initializeSearch();
        this.initializeSortable();
        this.loadBookmarks();
        this.renderBookmarks();
    },

    // New: Search initialization
// New: Search initialization
    initializeSearch: function() {
        const panel = document.getElementById('bookmarks-panel');

        // First check if search container already exists
        if (panel.querySelector('.search-container')) {
            return; // Exit if search container already exists
        }

        const searchContainer = document.createElement('div');
        searchContainer.className = 'search-container';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'bookmark-search';
        searchInput.placeholder = 'Search bookmarks... (* for wildcard)';

        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.renderBookmarks();
        });

        searchContainer.appendChild(searchInput);

        // Insert before bookmarks-list
        const bookmarksList = panel.querySelector('#bookmarks-list');
        if (bookmarksList) {
            panel.insertBefore(searchContainer, bookmarksList);
        } else {
            panel.appendChild(searchContainer);
        }
    },

    // New: Sortable initialization
    initializeSortable: function() {
        const bookmarksList = document.getElementById('bookmarks-list');
        if (!bookmarksList) return;

        new Sortable(bookmarksList, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'bookmark-ghost',
            onEnd: (evt) => {
                if (!this.searchQuery) {
                    const item = this.bookmarks.splice(evt.oldIndex, 1)[0];
                    this.bookmarks.splice(evt.newIndex, 0, item);
                    this.saveBookmarks();
                    this.renderBookmarks();
                }
            }
        });
    },

    renderBookmarks: function() {
        const container = document.getElementById('bookmarks-list');
        if (!container) return;

        container.innerHTML = '';

        // Filter bookmarks if search query exists
        const bookmarksToRender = this.searchQuery ?
            this.filterBookmarks(this.bookmarks, this.searchQuery) :
            this.bookmarks;

        bookmarksToRender.forEach((bookmark, index) => {
            const originalIndex = this.bookmarks.indexOf(bookmark);
            const posX = new Decimal(bookmark.pos.x);
            const posY = new Decimal(bookmark.pos.y);

            const element = document.createElement('div');
            element.className = 'bookmark-item';
            element.setAttribute('data-bookmark-id', bookmark.id);
            element.setAttribute('data-original-index', originalIndex);
            element.innerHTML = `
                <div class="bookmark-header">
                    <div class="drag-handle">≡</div>
                    <span class="bookmark-index">${originalIndex + 1}</span>
                    <span class="bookmark-name">${bookmark.name}</span>
                    <div class="bookmark-controls">
                        <button class="bookmark-edit">✏️</button>
                        <button class="bookmark-delete">🗑️</button>
                    </div>
                </div>
                <div class="bookmark-info">
                    <div class="bookmark-details">
                        <div>${bookmark.timestamp}</div>
                        <div>X: ${posX.toFixed(2)}, Y: ${posY.toFixed(2)}</div>
                        <div class="bookmark-description" contenteditable="true">${bookmark.description || 'Add description...'}</div>
                    </div>
                </div>
            `;

            this.setupBookmarkElementListeners(element, bookmark);
            container.appendChild(element);
        });

        this.updateTourProgress();
    },

    // New: Search filter function
    // Enhanced search filter function
    filterBookmarks: function(bookmarks, query) {
        const searchTerms = query.toLowerCase().split(/\s+/);

        return bookmarks.filter(bookmark => {
            const bookmarkName = bookmark.name.toLowerCase();
            const bookmarkDesc = (bookmark.description || '').toLowerCase();

            return searchTerms.every(term => {
                const wildcardPattern = term.replace(/\*/g, '.*');
                const regex = new RegExp(wildcardPattern);
                return regex.test(bookmarkName) || regex.test(bookmarkDesc);
            });
        });
    },

    setupBookmarkElementListeners: function(element, bookmark) {
        element.querySelector('.bookmark-edit').onclick = (e) => {
            e.stopPropagation();
            this.editBookmark(bookmark.id);
        };

        element.querySelector('.bookmark-delete').onclick = (e) => {
            e.stopPropagation();
            this.deleteBookmark(bookmark.id);
        };

        element.querySelector('.bookmark-description').addEventListener('blur', (e) => {
            bookmark.description = e.target.textContent;
            this.saveBookmarks();
        });

        element.onclick = () => this.goToBookmark(bookmark.id);
    },

    // Your existing addBookmark function (unchanged)
    addBookmark: function() {
        if (!window.data || !window.data.cam) return;

        const bookmark = {
            id: 'bm_' + Date.now(),
            name: `Bookmark ${this.bookmarks.length + 1}`,
            pos: {
                x: data.cam.pos.x.toString(),
                y: data.cam.pos.y.toString()
            },
            range: data.cam.range.toString(),
            timestamp: new Date().toLocaleTimeString(),
            description: ''
        };

        this.bookmarks.push(bookmark);
        this.saveBookmarks();
        this.renderBookmarks();
    },

    // Enhanced goToBookmark with distance-based duration
    goToBookmark: function(id, skipIntermediate = false) {
        const bookmark = this.bookmarks.find(b => b.id === id);
        if (!bookmark || !window.data || !window.data.cam) return;

        try {
            const targetPos = new Vec2(
                new Decimal(bookmark.pos.x),
                new Decimal(bookmark.pos.y)
            );
            const targetRange = new Decimal(bookmark.range);
            const currentIndex = this.bookmarks.findIndex(b => b.id === id);
            const startIndex = this.bookmarks.findIndex(b =>
                b.pos.x === data.cam.pos.x.toString() &&
                b.pos.y === data.cam.pos.y.toString()
            );

            if (startIndex !== -1 && !skipIntermediate && Math.abs(currentIndex - startIndex) > 1) {
                // Calculate intermediate points
                const step = startIndex < currentIndex ? 1 : -1;
                const points = [];

                for (let i = startIndex + step; i !== currentIndex; i += step) {
                    points.push(this.bookmarks[i]);
                }
                points.push(bookmark);

                // Animate through points
                this.animateThroughPoints(points);
            } else {
                // Direct animation for adjacent or non-bookmark positions
                const distance = data.cam.pos.sub(targetPos).mag();
                const baseDuration = 1000;
                const duration = Math.min(
                    Math.max(
                        baseDuration * (1 + distance.div(data.cam.range).toNumber() * 0.5),
                        baseDuration
                    ),
                    3000
                );

                this.animateToPosition(targetPos, targetRange, duration);
            }
        } catch (error) {
            console.error('Error going to bookmark:', error);
        }
    },


// Start of Various camera animation supported

// Available types include: default, linear, smoothStep, smootherStep, elasticOut, elasticIn, bounceOut, steadicam, handheld, drone, dollyZoom, crane, earthquake, orbital, bezier.

    animateToPosition: function(targetPos, targetRange, duration = 600, callback = null, animationType = 'default') {
        if (!window.data || !window.data.cam) return;

        const startPos = new Vec2(
            data.cam.pos.x,
            data.cam.pos.y
        );
        const startRange = data.cam.range;
        const startTime = Date.now();

        const interpolationTypes = {
            default: (progress) => new Decimal(1 - Math.pow(1 - progress, 3)),
            linear: (progress) => new Decimal(progress),
            smoothStep: (progress) => new Decimal(progress * progress * (3 - 2 * progress)),
            smootherStep: (progress) => new Decimal(progress * progress * progress * (progress * (progress * 6 - 15) + 10)),
            elasticOut: (progress) => {
                const p = progress === 0 ? 0 : Math.pow(2, -10 * progress) * Math.sin((progress * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
                return new Decimal(p);
            },
            elasticIn: (progress) => {
                const p = progress === 0 ? 0 : Math.pow(2, 10 * progress - 10) * Math.sin((progress * 10 - 10.75) * ((2 * Math.PI) / 3));
                return new Decimal(p);
            },
            bounceOut: (progress) => {
                const n1 = 7.5625, d1 = 2.75;
                let p = progress < 1/d1 ? n1 * progress * progress :
                    progress < 2/d1 ? n1 * (progress -= 1.5/d1) * progress + 0.75 :
                        progress < 2.5/d1 ? n1 * (progress -= 2.25/d1) * progress + 0.9375 :
                            n1 * (progress -= 2.625/d1) * progress + 0.984375;
                return new Decimal(p);
            },
            steadicam: (progress) => {
                const smooth = progress * progress * (3 - 2 * progress);
                const microAdjustment = Math.sin(progress * 20) * 0.001;
                return new Decimal(smooth + microAdjustment);
            },
            handheld: (progress) => {
                const baseProgress = 1 - Math.pow(1 - progress, 3);
                const shake = (
                    Math.sin(progress * 15) * 0.003 +
                    Math.sin(progress * 25) * 0.002 +
                    Math.sin(progress * 35) * 0.001
                );
                return new Decimal(baseProgress + shake);
            },
            drone: (progress) => {
                const smooth = progress * progress * (3 - 2 * progress);
                const drift = Math.sin(progress * 4) * 0.02 * (1 - progress);
                return new Decimal(smooth + drift);
            },
            dollyZoom: (progress) => {
                const p = progress * progress * (3 - 2 * progress);
                const zoomEffect = Math.sin(progress * Math.PI) * 0.1;
                return new Decimal(p + zoomEffect);
            },
            crane: (progress) => {
                const p = progress * progress * (3 - 2 * progress);
                const arc = Math.sin(progress * Math.PI) * 0.2;
                return new Decimal(p + arc);
            },
            earthquake: (progress) => {
                const baseProgress = 1 - Math.pow(1 - progress, 3);
                const intensity = (1 - progress) * 0.15;
                const shake = (
                    Math.sin(progress * 50) * intensity +
                    Math.sin(progress * 30) * intensity * 0.7 +
                    Math.sin(progress * 70) * intensity * 0.3
                );
                return new Decimal(baseProgress + shake);
            },
            orbital: (progress) => {
                const p = Math.sin(progress * Math.PI * 0.5);
                const orbit = Math.sin(progress * Math.PI * 2) * 0.1 * (1 - progress);
                return new Decimal(p + orbit);
            },
            bezier: (progress) => {
                const t = progress;
                return new Decimal(
                    3 * t * Math.pow(1 - t, 2) * 0.8 +
                    3 * Math.pow(t, 2) * (1 - t) * 1.2 +
                    Math.pow(t, 3)
                );
            }
        };

        const animate = () => {
            const currentTime = Date.now();
            const progress = Math.min((currentTime - startTime) / duration, 1);

            const animationTypeKey = animationType.toLowerCase();
            const easeProgress = (interpolationTypes[animationTypeKey] || interpolationTypes.default)(progress);

            let newX = startPos.x.add(targetPos.x.sub(startPos.x).mul(easeProgress));
            let newY = startPos.y.add(targetPos.y.sub(startPos.y).mul(easeProgress));
            let newRange = startRange.add(targetRange.sub(startRange).mul(easeProgress));

            // Special handling for specific animation types
            switch(animationTypeKey) {
                case 'handheld':
                    newX = newX.add(new Decimal(Math.sin(progress * 10) * 0.02));
                    newY = newY.add(new Decimal(Math.cos(progress * 10) * 0.02));
                    break;
                case 'earthquake':
                    newX = newX.add(new Decimal(Math.sin(progress * 50) * 0.1));
                    newY = newY.add(new Decimal(Math.cos(progress * 50) * 0.1));
                    break;
                case 'orbital':
                    const orbitRadius = targetPos.x.sub(startPos.x).mul(0.1);
                    newX = newX.add(orbitRadius.mul(Math.sin(progress * Math.PI * 2)));
                    newY = newY.add(orbitRadius.mul(Math.cos(progress * Math.PI * 2)));
                    break;
            }

            // Apply the new camera position and range
            data.cam.pos = new Vec2(newX, newY);
            data.cam.targetPos = new Vec2(newX, newY);
            data.cam.range = newRange;
            data.cam.targetRange = newRange;

            // If progress hasn't reached 1, continue animating
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else if (callback) {
                callback();
            }
        };

        animate();
    },

    animateThroughPoints: function(points, animationType = 'default') {
        if (points.length === 0) return;

        const animate = (index) => {
            if (index >= points.length) return;

            const point = points[index];
            const targetPos = new Vec2(
                new Decimal(point.pos.x),
                new Decimal(point.pos.y)
            );
            const targetRange = new Decimal(point.range);

            const isLastPoint = index === points.length - 1;
            const baseDuration = isLastPoint ? 600 : 300;

            let duration = baseDuration;
            const complexAnimations = ['handheld', 'earthquake', 'dollyZoom', 'orbital'];
            if (complexAnimations.includes(animationType.toLowerCase())) {
                duration *= 1.5;
            }

            this.animateToPosition(targetPos, targetRange, duration, () => {
                if (index < points.length - 1) {
                    animate(index + 1);
                }
            }, animationType);
        };

        animate(0);
    },

// End of Various camera animation supported



    // [Keep all your existing tour system methods unchanged]
    // Tour system from first version
    playTour: function() {
        if (this.bookmarks.length === 0) return;

        this.currentTourIndex = 0;
        this.isPlaying = true;
        const controls = document.getElementById('tour-controls');
        if (controls) controls.style.display = 'flex';

        this.updateTourProgress();
        this.goToBookmark(this.bookmarks[0].id);

        clearInterval(this.tourInterval);
        this.tourInterval = setInterval(() => {
            if (this.isPlaying) {
                if (this.currentTourIndex >= this.bookmarks.length - 1) {
                    this.stopTour();
                } else {
                    this.nextBookmark();
                }
            }
        }, 3000);
    },

    stopTour: function() {
        this.isPlaying = false;
        this.currentTourIndex = -1;
        clearInterval(this.tourInterval);
        const controls = document.getElementById('tour-controls');
        if (controls) controls.style.display = 'none';

        const playPauseBtn = document.querySelector('.play-pause-btn');
        if (playPauseBtn) playPauseBtn.textContent = '▶';

        if (this.onTourEnd) this.onTourEnd();
    },

    togglePlayPause: function() {
        this.isPlaying = !this.isPlaying;
        const playPauseBtn = document.querySelector('.play-pause-btn');
        if (playPauseBtn) {
            playPauseBtn.textContent = this.isPlaying ? '⏸' : '▶';
        }
    },

    nextBookmark: function() {
        if (this.currentTourIndex < this.bookmarks.length - 1) {
            this.currentTourIndex++;
            this.goToBookmark(this.bookmarks[this.currentTourIndex].id);
            this.updateTourProgress();
        } else {
            this.stopTour();
        }
    },

    previousBookmark: function() {
        if (this.currentTourIndex > 0) {
            this.currentTourIndex--;
            this.goToBookmark(this.bookmarks[this.currentTourIndex].id);
            this.updateTourProgress();
        }
    },

    editBookmark: function(id) {
        const bookmark = this.bookmarks.find(b => b.id === id);
        if (!bookmark) return;

        const newName = prompt('Enter new name:', bookmark.name);
        if (newName !== null) {
            bookmark.name = newName;
            this.saveBookmarks();
            this.renderBookmarks();
        }
    },

    deleteBookmark: function(id) {
        if (confirm('Delete this bookmark?')) {
            this.bookmarks = this.bookmarks.filter(b => b.id !== id);
            this.saveBookmarks();
            this.renderBookmarks();
        }
    },

    clearBookmarks: function() {
        if (confirm('Are you sure you want to clear all bookmarks?')) {
            this.bookmarks = [];
            this.saveBookmarks();
            this.renderBookmarks();
        }
    },

    updateTourProgress: function() {
        const current = document.querySelector('.current-slide');
        const total = document.querySelector('.total-slides');
        if (current && total) {
            current.textContent = this.currentTourIndex + 1;
            total.textContent = this.bookmarks.length;
        }
    },

    saveBookmarks: function() {
        try {
            localStorage.setItem('infiniteCanvas_bookmarks', JSON.stringify(this.bookmarks));
        } catch (error) {
            console.error('Error saving bookmarks:', error);
        }
    },

    loadBookmarks: function() {
        try {
            const saved = localStorage.getItem('infiniteCanvas_bookmarks');
            if (saved) {
                this.bookmarks = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Error loading bookmarks:', error);
            this.bookmarks = [];
        }
    }
};

// Initialize BookmarkManager when the document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        BookmarkManager.initialize();
    });
} else {
    BookmarkManager.initialize();
}
