/**
 * UI module for Prompt Generator Pro
 * Handles all user interface interactions and responsive behavior
 */

import { debounce, throttle, isMobile, fadeIn, fadeOut } from './utils.js';

class UIManager {
    constructor() {
        this.currentSection = 'editor';
        this.sidebarOpen = false;
        this.activeModal = null;
        this.toasts = new Map();
        this.toastCounter = 0;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupResponsiveHandlers();
        this.initializeTheme();
        this.updateSidebarState();
    }

    setupEventListeners() {
        // Sidebar navigation
        document.addEventListener('click', (e) => {
            if (e.target.matches('.nav-link')) {
                this.switchSection(e.target.dataset.section);
            }
        });

        // Mobile menu toggle
        const mobileToggle = document.getElementById('mobile-menu-toggle');
        if (mobileToggle) {
            mobileToggle.addEventListener('click', () => this.toggleMobileSidebar());
        }

        // Sidebar toggle (desktop)
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        }

        // Mobile overlay
        const mobileOverlay = document.getElementById('mobile-overlay');
        if (mobileOverlay) {
            mobileOverlay.addEventListener('click', () => this.closeMobileSidebar());
        }

        // Modal handling
        document.addEventListener('click', (e) => {
            if (e.target.matches('.modal-backdrop') || e.target.matches('#modal-close')) {
                this.closeModal();
            }
        });

        // Escape key handling
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.activeModal) {
                    this.closeModal();
                } else if (this.sidebarOpen && isMobile()) {
                    this.closeMobileSidebar();
                }
            }
        });

        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Prevent form submission on Enter in search
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                }
            });
        }
    }

    setupResponsiveHandlers() {
        // Handle window resize
        const handleResize = throttle(() => {
            this.updateSidebarState();
            this.adjustModalSizes();
        }, 250);

        window.addEventListener('resize', handleResize);

        // Handle orientation change on mobile
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.updateSidebarState();
                this.adjustModalSizes();
            }, 100);
        });
    }

    updateSidebarState() {
        const sidebar = document.getElementById('sidebar');
        const isMobileView = isMobile();
        
        if (isMobileView) {
            sidebar.classList.remove('open');
            this.sidebarOpen = false;
        } else {
            sidebar.classList.add('open');
            this.sidebarOpen = true;
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        this.sidebarOpen = !this.sidebarOpen;
        
        if (this.sidebarOpen) {
            sidebar.classList.add('open');
        } else {
            sidebar.classList.remove('open');
        }
    }

    toggleMobileSidebar() {
        if (!isMobile()) return;
        
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobile-overlay');
        
        this.sidebarOpen = !this.sidebarOpen;
        
        if (this.sidebarOpen) {
            sidebar.classList.add('open');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    closeMobileSidebar() {
        if (!isMobile()) return;
        
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobile-overlay');
        
        this.sidebarOpen = false;
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    switchSection(sectionName) {
        if (sectionName === this.currentSection) return;
        
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            link.removeAttribute('aria-current');
        });
        
        const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
            activeLink.setAttribute('aria-current', 'page');
        }
        
        // Update content sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }
        
        // Update page title
        const pageTitle = document.querySelector('.page-title');
        if (pageTitle) {
            const titles = {
                editor: 'Prompt Editor',
                library: 'Prompt Library',
                settings: 'Settings'
            };
            pageTitle.textContent = titles[sectionName] || 'Prompt Generator Pro';
        }
        
        this.currentSection = sectionName;
        
        // Close mobile sidebar after navigation
        if (isMobile()) {
            this.closeMobileSidebar();
        }
        
        // Trigger section-specific initialization
        this.onSectionChange(sectionName);
    }

    onSectionChange(sectionName) {
        // Override in specific implementations
        if (window.app && window.app.onSectionChange) {
            window.app.onSectionChange(sectionName);
        }
    }

    // Modal Management
    showModal(title, message, options = {}) {
        return new Promise((resolve, reject) => {
            const modal = document.getElementById('modal');
            const modalTitle = document.getElementById('modal-title');
            const modalMessage = document.getElementById('modal-message');
            const modalInput = document.getElementById('modal-input');
            const confirmBtn = document.getElementById('modal-confirm');
            const cancelBtn = document.getElementById('modal-cancel');
            
            // Set content
            modalTitle.textContent = title;
            modalMessage.textContent = message;
            
            // Configure input
            if (options.showInput) {
                modalInput.style.display = 'block';
                modalInput.value = options.inputValue || '';
                modalInput.placeholder = options.inputPlaceholder || 'Enter value...';
                modalInput.focus();
            } else {
                modalInput.style.display = 'none';
            }
            
            // Configure buttons
            confirmBtn.textContent = options.confirmText || 'Confirm';
            cancelBtn.textContent = options.cancelText || 'Cancel';
            
            if (options.confirmClass) {
                confirmBtn.className = `btn ${options.confirmClass}`;
            } else {
                confirmBtn.className = 'btn btn-primary';
            }
            
            // Show modal
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
            this.activeModal = modal;
            
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
            
            // Event handlers
            const cleanup = () => {
                modal.classList.remove('active');
                modal.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = '';
                this.activeModal = null;
                
                confirmBtn.removeEventListener('click', confirmHandler);
                cancelBtn.removeEventListener('click', cancelHandler);
                modalInput.removeEventListener('keydown', keyHandler);
            };
            
            const confirmHandler = () => {
                const inputValue = options.showInput ? modalInput.value : null;
                cleanup();
                resolve(inputValue);
            };
            
            const cancelHandler = () => {
                cleanup();
                resolve(null);
            };
            
            const keyHandler = (e) => {
                if (e.key === 'Enter' && options.showInput) {
                    e.preventDefault();
                    confirmHandler();
                }
            };
            
            confirmBtn.addEventListener('click', confirmHandler);
            cancelBtn.addEventListener('click', cancelHandler);
            
            if (options.showInput) {
                modalInput.addEventListener('keydown', keyHandler);
            }
        });
    }

    closeModal() {
        if (this.activeModal) {
            this.activeModal.classList.remove('active');
            this.activeModal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            this.activeModal = null;
        }
    }

    adjustModalSizes() {
        // Adjust modal sizes for different screen sizes
        const modalContent = document.querySelector('.modal-content');
        if (modalContent && this.activeModal) {
            if (isMobile()) {
                modalContent.style.maxWidth = 'calc(100vw - 2rem)';
                modalContent.style.maxHeight = 'calc(100vh - 2rem)';
            } else {
                modalContent.style.maxWidth = '500px';
                modalContent.style.maxHeight = '90vh';
            }
        }
    }

    // Toast Notifications
    showToast(message, type = 'success', duration = 5000) {
        const toastId = ++this.toastCounter;
        const container = document.getElementById('toast-container');
        
        if (!container) {
            console.warn('Toast container not found');
            return;
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');
        
        const icons = {
            success: `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>`,
            error: `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
            </svg>`,
            warning: `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>`,
            info: `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
            </svg>`
        };
        
        toast.innerHTML = `
            ${icons[type] || icons.info}
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" aria-label="Close notification">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
        `;
        
        // Add close functionality
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.removeToast(toastId));
        
        // Add to container
        container.appendChild(toast);
        this.toasts.set(toastId, toast);
        
        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => this.removeToast(toastId), duration);
        }
        
        return toastId;
    }

    removeToast(toastId) {
        const toast = this.toasts.get(toastId);
        if (toast) {
            toast.style.animation = 'slideOutRight 0.3s ease-in-out forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
                this.toasts.delete(toastId);
            }, 300);
        }
    }

    clearAllToasts() {
        this.toasts.forEach((toast, id) => this.removeToast(id));
    }

    // Theme Management
    initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        // Update theme select if it exists
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = theme;
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    // Loading States
    showLoading(element, text = 'Loading...') {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        
        if (!element) return;
        
        element.classList.add('loading');
        element.setAttribute('aria-busy', 'true');
        
        const originalContent = element.innerHTML;
        element.dataset.originalContent = originalContent;
        
        element.innerHTML = `
            <div class="loading-content">
                <div class="spinner"></div>
                <span>${text}</span>
            </div>
        `;
    }

    hideLoading(element) {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        
        if (!element) return;
        
        element.classList.remove('loading');
        element.removeAttribute('aria-busy');
        
        const originalContent = element.dataset.originalContent;
        if (originalContent) {
            element.innerHTML = originalContent;
            delete element.dataset.originalContent;
        }
    }

    // Utility methods for common UI patterns
    confirmAction(message, title = 'Confirm Action') {
        return this.showModal(title, message, {
            confirmText: 'Confirm',
            confirmClass: 'btn-danger'
        });
    }

    promptInput(message, title = 'Input Required', placeholder = '') {
        return this.showModal(title, message, {
            showInput: true,
            inputPlaceholder: placeholder
        });
    }

    // Update statistics in sidebar
    updateStats(stats) {
        const totalPromptsEl = document.getElementById('total-prompts');
        if (totalPromptsEl && stats.totalPrompts !== undefined) {
            totalPromptsEl.textContent = stats.totalPrompts;
        }
    }

    // Accessibility helpers
    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    // Focus management
    trapFocus(element) {
        const focusableElements = element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        const handleTabKey = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        e.preventDefault();
                    }
                }
            }
        };
        
        element.addEventListener('keydown', handleTabKey);
        
        return () => {
            element.removeEventListener('keydown', handleTabKey);
        };
    }
}

// Create and export singleton instance
const ui = new UIManager();

// Make showToast available globally for utils.js
window.showToast = (message, type) => ui.showToast(message, type);

export default ui;

