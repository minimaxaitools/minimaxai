/**
 * Main application file for Prompt Generator Pro
 * Initializes and coordinates all modules
 */

import utils from './utils.js';
import database from './database.js';
import ui from './ui.js';
import sectionManager from './sections.js';
import promptManager from './prompts.js';

class PromptGeneratorApp {
    constructor() {
        this.version = '2.0.0';
        this.isInitialized = false;
        this.modules = {
            utils,
            database,
            ui,
            sectionManager,
            promptManager
        };
        
        this.init();
    }

    async init() {
        try {
            console.log(`Initializing Prompt Generator Pro v${this.version}`);
            
            // Show loading state
            this.showInitialLoading();
            
            // Initialize modules in order
            await this.initializeModules();
            
            // Setup global event listeners
            this.setupGlobalEventListeners();
            
            // Setup service worker for PWA functionality
            this.setupServiceWorker();
            
            // Setup error handling
            this.setupErrorHandling();
            
            // Setup performance monitoring
            this.setupPerformanceMonitoring();
            
            // Hide loading state
            this.hideInitialLoading();
            
            this.isInitialized = true;
            console.log('Prompt Generator Pro initialized successfully');
            
            // Show welcome message for first-time users
            this.checkFirstTimeUser();
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.handleInitializationError(error);
        }
    }

    showInitialLoading() {
        const loadingHTML = `
            <div id="app-loading" class="app-loading">
                <div class="loading-content">
                    <div class="brand-icon">
                        <svg width="48" height="48" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="32" height="32" rx="8" fill="currentColor"/>
                            <path d="M8 12h16M8 16h12M8 20h8" stroke="white" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </div>
                    <h2>Prompt Generator Pro</h2>
                    <div class="spinner"></div>
                    <p>Loading your workspace...</p>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('afterbegin', loadingHTML);
        
        // Add loading styles
        const style = document.createElement('style');
        style.textContent = `
            .app-loading {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: var(--background);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            }
            .app-loading .loading-content {
                text-align: center;
                max-width: 300px;
            }
            .app-loading .brand-icon {
                color: var(--primary);
                margin: 0 auto var(--space-4);
                width: 48px;
                height: 48px;
            }
            .app-loading h2 {
                margin-bottom: var(--space-4);
                color: var(--text-primary);
            }
            .app-loading .spinner {
                margin: var(--space-4) auto;
            }
            .app-loading p {
                color: var(--text-secondary);
                font-size: var(--font-size-sm);
            }
        `;
        document.head.appendChild(style);
    }

    hideInitialLoading() {
        const loading = document.getElementById('app-loading');
        if (loading) {
            loading.style.opacity = '0';
            loading.style.transition = 'opacity 0.3s ease-out';
            setTimeout(() => {
                loading.remove();
            }, 300);
        }
    }

    async initializeModules() {
        // Database is already initialized in promptManager
        // UI is already initialized
        // SectionManager is already initialized
        // PromptManager handles its own initialization
        
        // Wait for all async initializations to complete
        await Promise.all([
            database.init(),
            // Add other async initializations here
        ]);
    }

    setupGlobalEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
        
        // Window events
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
        
        // Visibility change (for performance optimization)
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
        
        // Touch events for mobile
        if (utils.isTouchDevice()) {
            this.setupTouchEvents();
        }
    }

    handleKeyboardShortcuts(e) {
        // Only handle shortcuts when not typing in inputs
        if (e.target.matches('input, textarea, select')) {
            return;
        }
        
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const ctrlKey = isMac ? e.metaKey : e.ctrlKey;
        
        if (ctrlKey) {
            switch (e.key.toLowerCase()) {
                case 's':
                    e.preventDefault();
                    promptManager.saveCurrentPrompt();
                    break;
                case 'n':
                    e.preventDefault();
                    sectionManager.addSection();
                    break;
                case 'c':
                    if (e.shiftKey) {
                        e.preventDefault();
                        promptManager.copyCurrentPrompt();
                    }
                    break;
                case 'e':
                    e.preventDefault();
                    promptManager.exportPrompts();
                    break;
                case 'f':
                    e.preventDefault();
                    const searchInput = document.getElementById('search-input');
                    if (searchInput) {
                        ui.switchSection('library');
                        setTimeout(() => searchInput.focus(), 100);
                    }
                    break;
            }
        }
        
        // Navigation shortcuts
        if (e.altKey) {
            switch (e.key) {
                case '1':
                    e.preventDefault();
                    ui.switchSection('editor');
                    break;
                case '2':
                    e.preventDefault();
                    ui.switchSection('library');
                    break;
                case '3':
                    e.preventDefault();
                    ui.switchSection('settings');
                    break;
            }
        }
    }

    handleBeforeUnload(e) {
        // Check if there are unsaved changes
        if (!sectionManager.isEmpty() && !promptManager.getCurrentPromptId()) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            return e.returnValue;
        }
    }

    handleOnline() {
        ui.showToast('Connection restored', 'success');
        console.log('Application is online');
    }

    handleOffline() {
        ui.showToast('Working offline', 'info');
        console.log('Application is offline');
    }

    handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden - pause non-essential operations
            console.log('Application hidden');
        } else {
            // Page is visible - resume operations
            console.log('Application visible');
        }
    }

    setupTouchEvents() {
        // Add touch-specific enhancements
        let touchStartY = 0;
        let touchEndY = 0;
        
        document.addEventListener('touchstart', (e) => {
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            touchEndY = e.changedTouches[0].screenY;
            this.handleSwipeGesture();
        }, { passive: true });
        
        const handleSwipeGesture = () => {
            const swipeThreshold = 50;
            const diff = touchStartY - touchEndY;
            
            if (Math.abs(diff) > swipeThreshold) {
                if (diff > 0) {
                    // Swipe up
                    console.log('Swipe up detected');
                } else {
                    // Swipe down
                    console.log('Swipe down detected');
                }
            }
        };
        
        this.handleSwipeGesture = handleSwipeGesture;
    }

    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('Service Worker registered:', registration);
                })
                .catch((error) => {
                    console.log('Service Worker registration failed:', error);
                });
        }
    }

    setupErrorHandling() {
        // Global error handler
        window.addEventListener('error', (e) => {
            console.error('Global error:', e.error);
            this.handleError(e.error, 'Global Error');
        });
        
        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled promise rejection:', e.reason);
            this.handleError(e.reason, 'Promise Rejection');
        });
    }

    setupPerformanceMonitoring() {
        // Monitor performance metrics
        if ('performance' in window) {
            window.addEventListener('load', () => {
                setTimeout(() => {
                    const perfData = performance.getEntriesByType('navigation')[0];
                    console.log('Performance metrics:', {
                        loadTime: perfData.loadEventEnd - perfData.loadEventStart,
                        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
                        totalTime: perfData.loadEventEnd - perfData.fetchStart
                    });
                }, 0);
            });
        }
    }

    handleError(error, context = 'Application Error') {
        console.error(`${context}:`, error);
        
        // Don't show error toasts for every error to avoid spam
        if (!this.lastErrorTime || Date.now() - this.lastErrorTime > 5000) {
            ui.showToast('An unexpected error occurred', 'error');
            this.lastErrorTime = Date.now();
        }
        
        // In production, you might want to send errors to a logging service
        // this.sendErrorToLoggingService(error, context);
    }

    handleInitializationError(error) {
        this.hideInitialLoading();
        
        const errorHTML = `
            <div class="error-state">
                <div class="error-content">
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="32" cy="32" r="28" stroke="currentColor" stroke-width="4" fill="none"/>
                        <path d="M32 16v16M32 40h.01" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
                    </svg>
                    <h2>Failed to Load</h2>
                    <p>There was a problem initializing the application. Please refresh the page to try again.</p>
                    <button onclick="window.location.reload()" class="btn btn-primary">Refresh Page</button>
                </div>
            </div>
        `;
        
        document.body.innerHTML = errorHTML;
        
        // Add error styles
        const style = document.createElement('style');
        style.textContent = `
            .error-state {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: var(--background);
                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 2rem;
            }
            .error-content {
                max-width: 400px;
            }
            .error-content svg {
                color: var(--error);
                margin-bottom: 1rem;
            }
            .error-content h2 {
                margin-bottom: 1rem;
                color: var(--text-primary);
            }
            .error-content p {
                margin-bottom: 2rem;
                color: var(--text-secondary);
            }
        `;
        document.head.appendChild(style);
    }

    checkFirstTimeUser() {
        const isFirstTime = !utils.storage.get('hasVisited');
        
        if (isFirstTime) {
            utils.storage.set('hasVisited', true);
            
            setTimeout(() => {
                ui.showToast('Welcome to Prompt Generator Pro! Start by creating your first prompt.', 'info', 8000);
            }, 1000);
        }
    }

    // Section change handler for UI
    onSectionChange(sectionName) {
        // Perform section-specific actions
        switch (sectionName) {
            case 'library':
                // Refresh library if needed
                if (!promptManager.isCurrentlyLoading()) {
                    promptManager.loadPromptLibrary();
                }
                break;
            case 'settings':
                // Load settings
                this.loadSettings();
                break;
        }
    }

    loadSettings() {
        // Load and apply saved settings
        const themeSelect = document.getElementById('theme-select');
        const exportFormat = document.getElementById('export-format');
        
        if (themeSelect) {
            themeSelect.value = utils.storage.get('theme', 'light');
            themeSelect.addEventListener('change', (e) => {
                ui.setTheme(e.target.value);
            });
        }
        
        if (exportFormat) {
            exportFormat.value = utils.storage.get('exportFormat', 'json');
            exportFormat.addEventListener('change', (e) => {
                utils.storage.set('exportFormat', e.target.value);
            });
        }
    }

    // Public API methods
    getVersion() {
        return this.version;
    }

    isReady() {
        return this.isInitialized;
    }

    getModules() {
        return this.modules;
    }

    // Development helpers
    debug() {
        return {
            version: this.version,
            initialized: this.isInitialized,
            modules: Object.keys(this.modules),
            stats: {
                sections: sectionManager.getSectionCount(),
                prompts: promptManager.getSearchResults().length,
                currentPrompt: promptManager.getCurrentPromptId()
            }
        };
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PromptGeneratorApp();
});

// Export for module usage
export default PromptGeneratorApp;

