/**
 * Standalone Prompt Generator Pro Application
 * All functionality in one file for maximum compatibility
 */

(function () {
    'use strict';

    // Utility functions
    const utils = {
        debounce: function (func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        generateId: function () {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        },

        formatDate: function (date) {
            return new Intl.DateTimeFormat('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(new Date(date));
        },

        copyToClipboard: async function (text) {
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(text);
                    return true;
                } else {
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-999999px';
                    textArea.style.top = '-999999px';
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();

                    try {
                        const successful = document.execCommand('copy');
                        document.body.removeChild(textArea);
                        return successful;
                    } catch (err) {
                        document.body.removeChild(textArea);
                        throw err;
                    }
                }
            } catch (err) {
                console.error('Failed to copy text: ', err);
                return false;
            }
        },

        downloadData: function (data, filename, type = 'application/json') {
            try {
                const isAPK = window.location.protocol === 'file:' ||
                    navigator.userAgent.includes('wv') ||
                    window.Android !== undefined;

                if (isAPK) {
                    return utils.shareOrCopyData(data, filename, type);
                } else {
                    const blob = new Blob([data], { type });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    return Promise.resolve(true);
                }
            } catch (error) {
                console.error('Download failed:', error);
                return Promise.resolve(false);
            }
        },

        shareOrCopyData: async function (data, filename, type) {
            try {
                if (navigator.share && type === 'application/json') {
                    const blob = new Blob([data], { type });
                    const file = new File([blob], filename, { type });

                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: 'Prompt Generator Pro Export',
                            text: 'Exported prompts from Prompt Generator Pro'
                        });
                        return true;
                    }
                }

                const success = await utils.copyToClipboard(data);
                if (success) {
                    ui.showToast('Data copied to clipboard! You can paste it into a text file.', 'success');
                    return true;
                } else {
                    throw new Error('Clipboard access failed');
                }
            } catch (error) {
                console.error('Share/copy failed:', error);
                utils.showDataModal(data, filename);
                return false;
            }
        },

        showDataModal: function (data, filename) {
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.innerHTML = `
                <div class="modal-backdrop"></div>
                <div class="modal-content" style="max-width: 80vw; max-height: 80vh;">
                    <div class="modal-header">
                        <h3 class="modal-title">Export Data - ${filename}</h3>
                        <button class="modal-close" onclick="this.closest('.modal').remove()">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                    <div class="modal-body">
                        <p class="modal-message">Copy the data below and save it to a file:</p>
                        <textarea readonly style="width: 100%; height: 300px; font-family: monospace; font-size: 12px; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">${data}</textarea>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="utils.copyToClipboard(\`${data.replace(/`/g, '\\`')}\`).then(() => ui.showToast('Copied to clipboard!', 'success'))">
                            Copy to Clipboard
                        </button>
                        <button class="btn btn-outline" onclick="this.closest('.modal').remove()">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        },

        isMobile: function () {
            return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }
    };

    // UI Manager
    const ui = {
        currentSection: 'editor',
        sidebarOpen: false,
        toastCounter: 0,

        init: function () {
            this.setupEventListeners();
            this.setupFloatingButtons();
            this.updateSidebarState();
            // Initialize contextual UI for the default section
            this.updateContextualUI(this.currentSection);
        },

        setupEventListeners: function () {
            // Direct event listeners for nav links (faster, no delegation lag)
            const navLinks = document.querySelectorAll('.nav-link');
            navLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const section = link.dataset.section;
                    if (section) {
                        this.switchSection(section);
                    }
                });
            });

            const mobileToggle = document.getElementById('mobile-menu-toggle');
            if (mobileToggle) {
                mobileToggle.addEventListener('click', () => this.toggleMobileSidebar());
            }

            const mobileOverlay = document.getElementById('mobile-overlay');
            if (mobileOverlay) {
                mobileOverlay.addEventListener('click', () => this.closeMobileSidebar());
            }

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    if (this.sidebarOpen && utils.isMobile()) {
                        this.closeMobileSidebar();
                    }
                }
            });
        },

        updateSidebarState: function () {
            const sidebar = document.getElementById('sidebar');
            const isMobileView = utils.isMobile();

            if (isMobileView) {
                sidebar.classList.remove('open');
                this.sidebarOpen = false;
            } else {
                sidebar.classList.add('open');
                this.sidebarOpen = true;
            }
        },

        toggleMobileSidebar: function () {
            if (!utils.isMobile()) return;

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
        },

        closeMobileSidebar: function () {
            if (!utils.isMobile()) return;

            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('mobile-overlay');

            this.sidebarOpen = false;
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        },

        switchSection: function (sectionName) {
            if (sectionName === this.currentSection) return;

            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
                link.removeAttribute('aria-current');
            });

            const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
            if (activeLink) {
                activeLink.classList.add('active');
                activeLink.setAttribute('aria-current', 'page');
            }

            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });

            const targetSection = document.getElementById(`${sectionName}-section`);
            if (targetSection) {
                targetSection.classList.add('active');
            }

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

            // Update contextual UI based on section
            this.updateContextualUI(sectionName);

            if (utils.isMobile()) {
                this.closeMobileSidebar();
            }
        },

        updateContextualUI: function (sectionName) {
            // Show/hide section navigator button (only in editor)
            const fabSections = document.getElementById('fab-sections');
            if (fabSections) {
                fabSections.style.display = sectionName === 'editor' ? 'flex' : 'none';
            }

            // Show/hide add section button (only in editor)
            const fabAddSection = document.getElementById('fab-add-section');
            if (fabAddSection) {
                fabAddSection.style.display = sectionName === 'editor' ? 'flex' : 'none';
            }

            // Show/hide section navigator (only in editor)
            const sectionNav = document.getElementById('section-navigator');
            if (sectionNav) {
                if (sectionName === 'editor') {
                    this.updateSectionNavigator();
                } else {
                    sectionNav.setAttribute('aria-hidden', 'true');
                }
            }

            // Show/hide scroll controls (only in library)
            const scrollControls = document.getElementById('scroll-controls');
            if (scrollControls) {
                if (sectionName === 'library') {
                    scrollControls.setAttribute('aria-hidden', 'false');
                    this.setupScrollDetection();
                } else {
                    scrollControls.setAttribute('aria-hidden', 'true');
                }
            }
        },

        updateSectionNavigator: function () {
            const navList = document.getElementById('section-nav-list');
            if (!navList) return;

            const sections = sectionManager.getAllSections();

            if (sections.length === 0) {
                navList.innerHTML = '<div class="section-nav-empty">No sections yet</div>';
                return;
            }

            navList.innerHTML = sections.map((section, index) => {
                const title = section.title.trim() || `Section ${index + 1}`;
                return `
                    <button class="section-nav-item" data-section-index="${index}">
                        <span class="section-nav-number">${index + 1}</span>
                        <span class="section-nav-title">${this.escapeHtml(title)}</span>
                    </button>
                `;
            }).join('');

            // Add click handlers
            navList.querySelectorAll('.section-nav-item').forEach(item => {
                item.addEventListener('click', () => {
                    const index = parseInt(item.dataset.sectionIndex);
                    this.scrollToSection(index);
                });
            });
        },

        scrollToSection: function (index) {
            const container = document.getElementById('sections-container');
            if (!container) return;

            const sections = container.querySelectorAll('.prompt-section');
            if (sections[index]) {
                sections[index].scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });

                // Visual feedback
                sections[index].style.boxShadow = '0 0 0 3px var(--primary-light)';
                setTimeout(() => {
                    sections[index].style.boxShadow = '';
                }, 1500);

                this.closeSectionNav();
                this.showToast(`Jumped to section ${index + 1}`, 'success', 1500);
            }
        },

        toggleSectionNav: function () {
            const sectionNav = document.getElementById('section-navigator');
            if (!sectionNav) return;

            const isHidden = sectionNav.getAttribute('aria-hidden') === 'true';
            if (isHidden) {
                this.updateSectionNavigator();
            }
            sectionNav.setAttribute('aria-hidden', !isHidden);
        },

        closeSectionNav: function () {
            const sectionNav = document.getElementById('section-navigator');
            if (sectionNav) {
                sectionNav.setAttribute('aria-hidden', 'true');
            }
        },

        setupScrollDetection: function () {
            const contentWrapper = document.querySelector('.content-wrapper');
            if (!contentWrapper) return;

            // Remove existing listener if any
            if (this.scrollListener) {
                contentWrapper.removeEventListener('scroll', this.scrollListener);
            }

            this.scrollListener = utils.debounce(() => {
                const scrollTop = contentWrapper.scrollTop;
                const scrollHeight = contentWrapper.scrollHeight;
                const clientHeight = contentWrapper.clientHeight;

                const scrollToTop = document.getElementById('scroll-to-top');
                const scrollToBottom = document.getElementById('scroll-to-bottom');

                // Show/hide top button
                if (scrollToTop) {
                    if (scrollTop > 200) {
                        scrollToTop.style.opacity = '1';
                        scrollToTop.style.pointerEvents = 'auto';
                    } else {
                        scrollToTop.style.opacity = '0.3';
                        scrollToTop.style.pointerEvents = 'none';
                    }
                }

                // Show/hide bottom button
                if (scrollToBottom) {
                    if (scrollTop + clientHeight < scrollHeight - 200) {
                        scrollToBottom.style.opacity = '1';
                        scrollToBottom.style.pointerEvents = 'auto';
                    } else {
                        scrollToBottom.style.opacity = '0.3';
                        scrollToBottom.style.pointerEvents = 'none';
                    }
                }
            }, 100);

            contentWrapper.addEventListener('scroll', this.scrollListener);
        },

        scrollToTop: function () {
            const contentWrapper = document.querySelector('.content-wrapper');
            if (contentWrapper) {
                contentWrapper.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            }
        },

        scrollToBottom: function () {
            const contentWrapper = document.querySelector('.content-wrapper');
            if (contentWrapper) {
                contentWrapper.scrollTo({
                    top: contentWrapper.scrollHeight,
                    behavior: 'smooth'
                });
            }
        },

        escapeHtml: function (text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        showToast: function (message, type = 'success', duration = 5000) {
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
                </svg>`
            };

            toast.innerHTML = `
                ${icons[type] || icons.success}
                <div class="toast-content">
                    <div class="toast-message">${message}</div>
                </div>
                <button class="toast-close" aria-label="Close notification" onclick="this.parentElement.remove()">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            `;

            container.appendChild(toast);

            if (duration > 0) {
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.remove();
                    }
                }, duration);
            }

            return toastId;
        },

        // Floating Action Button handlers
        setupFloatingButtons: function () {
            const fabCopy = document.getElementById('fab-copy');
            const fabNav = document.getElementById('fab-nav');
            const quickNavMenu = document.getElementById('quick-nav-menu');
            const closeQuickNav = document.getElementById('close-quick-nav');

            // Quick copy button
            if (fabCopy) {
                fabCopy.addEventListener('click', async () => {
                    try {
                        const validation = sectionManager.validate();
                        if (!validation.isValid) {
                            this.showToast(validation.errors[0], 'warning');
                            return;
                        }

                        const promptText = sectionManager.generatePromptText();
                        if (!promptText.trim()) {
                            this.showToast('No content to copy', 'warning');
                            return;
                        }

                        const success = await utils.copyToClipboard(promptText);
                        if (success) {
                            this.showToast('✓ Prompt copied instantly!', 'success', 2000);
                            // Visual feedback
                            fabCopy.style.transform = 'scale(1.2)';
                            setTimeout(() => {
                                fabCopy.style.transform = '';
                            }, 200);
                        } else {
                            this.showToast('Failed to copy prompt', 'error');
                        }
                    } catch (error) {
                        console.error('Quick copy error:', error);
                        this.showToast('Failed to copy prompt', 'error');
                    }
                });
            }

            // Quick navigation button
            if (fabNav) {
                fabNav.addEventListener('click', () => {
                    this.toggleQuickNav();
                });
            }

            // Section navigator button (Editor only)
            const fabSections = document.getElementById('fab-sections');
            if (fabSections) {
                fabSections.addEventListener('click', () => {
                    this.toggleSectionNav();
                });
            }

            // Add Section button (Editor only)
            const fabAddSection = document.getElementById('fab-add-section');
            if (fabAddSection) {
                fabAddSection.addEventListener('click', () => {
                    const sectionId = sectionManager.addSection();
                    // Scroll to the new section
                    setTimeout(() => {
                        const section = sectionManager.sections.get(sectionId);
                        if (section) {
                            section.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            section.element.querySelector('.section-content-textarea').focus();
                        }
                    }, 100);
                    this.showToast('New section added', 'success', 1500);
                });
            }

            // Close quick nav
            if (closeQuickNav) {
                closeQuickNav.addEventListener('click', () => {
                    this.closeQuickNav();
                });
            }

            // Quick nav items
            if (quickNavMenu) {
                const navItems = quickNavMenu.querySelectorAll('.quick-nav-item');
                navItems.forEach(item => {
                    item.addEventListener('click', () => {
                        const section = item.dataset.navSection;
                        if (section) {
                            this.switchSection(section);
                            this.closeQuickNav();
                            this.showToast(`Switched to ${item.textContent.trim()}`, 'success', 1500);
                        }
                    });
                });

                // Close on outside click
                document.addEventListener('click', (e) => {
                    if (!quickNavMenu.contains(e.target) &&
                        !fabNav.contains(e.target) &&
                        quickNavMenu.getAttribute('aria-hidden') === 'false') {
                        this.closeQuickNav();
                    }
                });
            }

            // Section Navigator (Editor)
            const closeSectionNav = document.getElementById('close-section-nav');
            const sectionNavigator = document.getElementById('section-navigator');

            if (closeSectionNav) {
                closeSectionNav.addEventListener('click', () => {
                    this.closeSectionNav();
                });
            }

            // Close section nav on outside click
            if (sectionNavigator) {
                document.addEventListener('click', (e) => {
                    if (!sectionNavigator.contains(e.target) &&
                        sectionNavigator.getAttribute('aria-hidden') === 'false') {
                        // Check if click is not on a section (to allow scrolling)
                        if (!e.target.closest('.prompt-section')) {
                            this.closeSectionNav();
                        }
                    }
                });
            }

            // Scroll Controls (Library)
            const scrollToTopBtn = document.getElementById('scroll-to-top');
            const scrollToBottomBtn = document.getElementById('scroll-to-bottom');

            if (scrollToTopBtn) {
                scrollToTopBtn.addEventListener('click', () => {
                    this.scrollToTop();
                });
            }

            if (scrollToBottomBtn) {
                scrollToBottomBtn.addEventListener('click', () => {
                    this.scrollToBottom();
                });
            }
        },

        toggleQuickNav: function () {
            const quickNavMenu = document.getElementById('quick-nav-menu');
            if (!quickNavMenu) return;

            const isHidden = quickNavMenu.getAttribute('aria-hidden') === 'true';
            quickNavMenu.setAttribute('aria-hidden', !isHidden);
        },

        closeQuickNav: function () {
            const quickNavMenu = document.getElementById('quick-nav-menu');
            if (quickNavMenu) {
                quickNavMenu.setAttribute('aria-hidden', 'true');
            }
        },

        showModal: function (title, message, options = {}) {
            return new Promise((resolve) => {
                const modal = document.getElementById('modal');
                const modalTitle = document.getElementById('modal-title');
                const modalMessage = document.getElementById('modal-message');
                const modalInput = document.getElementById('modal-input');
                const confirmBtn = document.getElementById('modal-confirm');
                const cancelBtn = document.getElementById('modal-cancel');

                modalTitle.textContent = title;
                modalMessage.textContent = message;

                if (options.showInput) {
                    modalInput.style.display = 'block';
                    modalInput.value = options.inputValue || '';
                    modalInput.placeholder = options.inputPlaceholder || 'Enter value...';
                    modalInput.focus();
                } else {
                    modalInput.style.display = 'none';
                }

                confirmBtn.textContent = options.confirmText || 'Confirm';
                cancelBtn.textContent = options.cancelText || 'Cancel';

                modal.classList.add('active');
                modal.setAttribute('aria-hidden', 'false');
                document.body.style.overflow = 'hidden';

                const cleanup = () => {
                    modal.classList.remove('active');
                    modal.setAttribute('aria-hidden', 'true');
                    document.body.style.overflow = '';
                    confirmBtn.removeEventListener('click', confirmHandler);
                    cancelBtn.removeEventListener('click', cancelHandler);
                };

                const confirmHandler = () => {
                    const inputValue = options.showInput ? modalInput.value : true;
                    cleanup();
                    resolve(inputValue);
                };

                const cancelHandler = () => {
                    cleanup();
                    resolve(null);
                };

                confirmBtn.addEventListener('click', confirmHandler);
                cancelBtn.addEventListener('click', cancelHandler);
            });
        }
    };

    // Section Manager
    const sectionManager = {
        sections: new Map(),
        sectionOrder: [],
        container: null,
        template: null,

        init: function () {
            this.container = document.getElementById('sections-container');
            this.template = document.getElementById('section-template');

            if (!this.container || !this.template) {
                console.error('Required elements not found for SectionManager');
                return;
            }

            this.setupEventListeners();
            this.createInitialSection();
        },

        setupEventListeners: function () {
            const addButton = document.getElementById('add-section');
            if (addButton) {
                addButton.addEventListener('click', () => this.addSection());
            }

            this.container.addEventListener('click', this.handleContainerClick.bind(this));
            this.container.addEventListener('input', this.handleContainerInput.bind(this));
            this.container.addEventListener('change', this.handleContainerChange.bind(this));
        },

        createInitialSection: function () {
            if (this.sections.size === 0) {
                this.addSection();
            }
        },

        addSection: function (data = {}) {
            const sectionId = utils.generateId();
            const sectionElement = this.createSectionElement(sectionId, data);

            this.container.appendChild(sectionElement);
            this.sectionOrder.push(sectionId);

            this.sections.set(sectionId, {
                id: sectionId,
                element: sectionElement,
                title: data.title || '',
                content: data.content || '',
                wrap: data.wrap || false
            });

            const textarea = sectionElement.querySelector('.section-content-textarea');
            if (textarea && !data.content) {
                setTimeout(() => textarea.focus(), 100);
            }

            return sectionId;
        },

        createSectionElement: function (sectionId, data = {}) {
            const clone = this.template.content.cloneNode(true);
            const sectionElement = clone.querySelector('.prompt-section');

            sectionElement.dataset.sectionId = sectionId;

            const titleInput = sectionElement.querySelector('.section-title-input');
            const contentTextarea = sectionElement.querySelector('.section-content-textarea');
            const wrapCheckbox = sectionElement.querySelector('.section-wrap-checkbox');

            titleInput.value = data.title || '';
            contentTextarea.value = data.content || '';
            wrapCheckbox.checked = data.wrap || false;

            this.updateCharacterCount(contentTextarea);
            this.setupSectionEventListeners(sectionElement);

            return sectionElement;
        },

        setupSectionEventListeners: function (sectionElement) {
            const textarea = sectionElement.querySelector('.section-content-textarea');

            const debouncedCharCount = utils.debounce(() => {
                this.updateCharacterCount(textarea);
            }, 300);

            textarea.addEventListener('input', debouncedCharCount);
            textarea.addEventListener('input', () => {
                this.autoResizeTextarea(textarea);
            });

            this.autoResizeTextarea(textarea);
        },

        getAllSections: function () {
            return this.sectionOrder.map(id => {
                const section = this.sections.get(id);
                return {
                    id: section.id,
                    title: section.title,
                    content: section.content,
                    wrap: section.wrap
                };
            });
        },

        moveSectionUp: function (sectionId) {
            const index = this.sectionOrder.indexOf(sectionId);
            if (index <= 0) return; // Already at top

            const prevSectionId = this.sectionOrder[index - 1];

            // Swap in order array
            this.sectionOrder[index] = prevSectionId;
            this.sectionOrder[index - 1] = sectionId;

            // Swap in DOM
            const section = this.sections.get(sectionId);
            const prevSection = this.sections.get(prevSectionId);

            this.container.insertBefore(section.element, prevSection.element);

            // Scroll into view
            section.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },

        moveSectionDown: function (sectionId) {
            const index = this.sectionOrder.indexOf(sectionId);
            if (index === -1 || index >= this.sectionOrder.length - 1) return; // Already at bottom

            const nextSectionId = this.sectionOrder[index + 1];

            // Swap in order array
            this.sectionOrder[index] = nextSectionId;
            this.sectionOrder[index + 1] = sectionId;

            // Swap in DOM
            const section = this.sections.get(sectionId);
            const nextSection = this.sections.get(nextSectionId);

            this.container.insertBefore(nextSection.element, section.element);

            // Scroll into view
            section.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },

        handleContainerClick: function (e) {
            const sectionElement = e.target.closest('.prompt-section');
            if (!sectionElement) return;

            const sectionId = sectionElement.dataset.sectionId;
            const action = e.target.dataset.action;

            switch (action) {
                case 'remove':
                    this.removeSection(sectionId);
                    break;
                case 'move-up':
                    this.moveSectionUp(sectionId);
                    break;
                case 'move-down':
                    this.moveSectionDown(sectionId);
                    break;
            }
        },

        handleContainerInput: function (e) {
            const sectionElement = e.target.closest('.prompt-section');
            if (!sectionElement) return;

            const sectionId = sectionElement.dataset.sectionId;
            const section = this.sections.get(sectionId);
            if (!section) return;

            if (e.target.classList.contains('section-content-textarea')) {
                section.content = e.target.value;
            } else if (e.target.classList.contains('section-title-input')) {
                section.title = e.target.value;
            }
        },

        handleContainerChange: function (e) {
            const sectionElement = e.target.closest('.prompt-section');
            if (!sectionElement) return;

            const sectionId = sectionElement.dataset.sectionId;
            const section = this.sections.get(sectionId);
            if (!section) return;

            if (e.target.classList.contains('section-wrap-checkbox')) {
                section.wrap = e.target.checked;
            }
        },

        removeSection: function (sectionId) {
            if (this.sections.size <= 1) {
                ui.showToast('Cannot remove the last section', 'warning');
                return;
            }

            const section = this.sections.get(sectionId);
            if (!section) return;

            section.element.remove();
            this.sections.delete(sectionId);
            const index = this.sectionOrder.indexOf(sectionId);
            if (index > -1) {
                this.sectionOrder.splice(index, 1);
            }
        },

        moveSectionUp: function (sectionId) {
            const currentIndex = this.sectionOrder.indexOf(sectionId);
            if (currentIndex <= 0) return;

            this.swapSections(currentIndex, currentIndex - 1);
        },

        moveSectionDown: function (sectionId) {
            const currentIndex = this.sectionOrder.indexOf(sectionId);
            if (currentIndex >= this.sectionOrder.length - 1) return;

            this.swapSections(currentIndex, currentIndex + 1);
        },

        swapSections: function (index1, index2) {
            const id1 = this.sectionOrder[index1];
            const id2 = this.sectionOrder[index2];

            const section1 = this.sections.get(id1);
            const section2 = this.sections.get(id2);

            if (!section1 || !section2) return;

            const nextSibling = section2.element.nextSibling;
            const parent = section2.element.parentNode;

            section1.element.parentNode.insertBefore(section2.element, section1.element);
            parent.insertBefore(section1.element, nextSibling);

            [this.sectionOrder[index1], this.sectionOrder[index2]] = [this.sectionOrder[index2], this.sectionOrder[index1]];
        },

        updateCharacterCount: function (textarea) {
            const sectionElement = textarea.closest('.prompt-section');
            const countElement = sectionElement.querySelector('.character-count');

            if (countElement) {
                const count = textarea.value.length;
                const words = textarea.value.trim().split(/\s+/).filter(word => word.length > 0).length;
                countElement.textContent = `${count} characters, ${words} words`;
            }
        },

        autoResizeTextarea: function (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = Math.max(120, textarea.scrollHeight) + 'px';
        },

        getAllSections: function () {
            return this.sectionOrder.map(id => {
                const section = this.sections.get(id);
                return {
                    title: section.title,
                    content: section.content,
                    wrap: section.wrap
                };
            });
        },

        loadSections: function (sectionsData) {
            this.clearAllSections();

            if (!Array.isArray(sectionsData) || sectionsData.length === 0) {
                this.createInitialSection();
                return;
            }

            sectionsData.forEach(sectionData => {
                this.addSection(sectionData);
            });
        },

        clearAllSections: function () {
            this.sections.clear();
            this.sectionOrder = [];
            this.container.innerHTML = '';
        },

        isEmpty: function () {
            return this.sectionOrder.every(id => {
                const section = this.sections.get(id);
                return !section.content.trim();
            });
        },

        generatePromptText: function () {
            let promptText = '';

            this.sectionOrder.forEach(id => {
                const section = this.sections.get(id);
                if (!section.content.trim()) return;

                if (section.title.trim()) {
                    promptText += `### ${section.title.trim()}\n`;
                }

                if (section.wrap) {
                    promptText += `\`\`\`\n${section.content.trim()}\n\`\`\`\n\n`;
                } else {
                    promptText += `${section.content.trim()}\n\n`;
                }
            });

            return promptText.trim();
        },

        validate: function () {
            const errors = [];

            if (this.sections.size === 0) {
                errors.push('At least one section is required');
            }

            const hasContent = this.sectionOrder.some(id => {
                const section = this.sections.get(id);
                return section.content.trim().length > 0;
            });

            if (!hasContent) {
                errors.push('At least one section must have content');
            }

            return {
                isValid: errors.length === 0,
                errors
            };
        }
    };

    // Database Manager (simplified for standalone version)
    const database = {
        dbName: 'PromptGeneratorProDB',
        version: 4,
        storeName: 'prompts',
        db: null,

        async init() {
            try {
                this.db = await idb.openDB(this.dbName, this.version, {
                    upgrade: (db) => {
                        if (!db.objectStoreNames.contains(this.storeName)) {
                            const store = db.createObjectStore(this.storeName, {
                                keyPath: 'id',
                                autoIncrement: true
                            });
                            store.createIndex('name', 'name', { unique: false });
                            store.createIndex('created', 'created', { unique: false });
                        }
                    }
                });
                return this.db;
            } catch (error) {
                console.error('Failed to initialize database:', error);
                throw error;
            }
        },

        async addPrompt(promptData) {
            const now = new Date().toISOString();
            const prompt = {
                ...promptData,
                created: now,
                updated: now
            };
            return await this.db.add(this.storeName, prompt);
        },

        async getAllPrompts() {
            return await this.db.getAll(this.storeName);
        },

        async getPrompt(id) {
            return await this.db.get(this.storeName, id);
        },

        async deletePrompt(id) {
            return await this.db.delete(this.storeName, id);
        },

        async clearAllPrompts() {
            return await this.db.clear(this.storeName);
        },

        async exportPrompts() {
            const prompts = await this.getAllPrompts();
            return JSON.stringify({
                version: '1.0.0',
                exportDate: new Date().toISOString(),
                promptCount: prompts.length,
                prompts
            }, null, 2);
        },

        async importPrompts(jsonData, options = {}) {
            try {
                const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
                const prompts = Array.isArray(data) ? data : data.prompts || [];

                if (!Array.isArray(prompts)) {
                    throw new Error('Invalid import data format');
                }

                const results = {
                    imported: 0,
                    skipped: 0,
                    errors: []
                };

                for (const promptData of prompts) {
                    try {
                        // Validate prompt data
                        if (!promptData.name || !promptData.sections) {
                            results.errors.push(`Invalid prompt data: missing name or sections`);
                            results.skipped++;
                            continue;
                        }

                        // Check if prompt already exists (by name)
                        const existing = await this.getPromptByName(promptData.name);
                        if (existing && !options.overwrite) {
                            results.skipped++;
                            continue;
                        }

                        // Prepare prompt data
                        const cleanPromptData = {
                            name: promptData.name,
                            sections: Array.isArray(promptData.sections) ? promptData.sections : [],
                            created: promptData.created || new Date().toISOString(),
                            modified: new Date().toISOString()
                        };

                        // Add or update prompt
                        if (existing && options.overwrite) {
                            await this.updatePrompt(existing.id, cleanPromptData);
                        } else {
                            await this.addPrompt(cleanPromptData);
                        }

                        results.imported++;

                    } catch (error) {
                        results.errors.push(`Failed to import prompt "${promptData.name}": ${error.message}`);
                        results.skipped++;
                    }
                }

                return results;

            } catch (error) {
                throw new Error(`Import failed: ${error.message}`);
            }
        },

        async getPromptByName(name) {
            const prompts = await this.getAllPrompts();
            return prompts.find(prompt => prompt.name === name);
        }
    };

    // Prompt Manager
    const promptManager = {
        currentPromptId: null,
        searchResults: [],

        async init() {
            try {
                await database.init();
                this.setupEventListeners();
                await this.loadPromptLibrary();
            } catch (error) {
                console.error('Failed to initialize PromptManager:', error);
                ui.showToast('Failed to initialize database', 'error');
            }
        },

        setupEventListeners: function () {
            const copyBtn = document.getElementById('copy-prompt');
            const saveBtn = document.getElementById('save-prompt');
            const clearBtn = document.getElementById('clear-editor');
            const exportBtn = document.getElementById('export-prompts');
            const importInput = document.getElementById('import-file');
            const flushBtn = document.getElementById('flush-db');

            if (copyBtn) copyBtn.addEventListener('click', () => this.copyCurrentPrompt());
            if (saveBtn) saveBtn.addEventListener('click', () => this.saveCurrentPrompt());
            if (clearBtn) clearBtn.addEventListener('click', () => this.clearEditor());
            if (exportBtn) exportBtn.addEventListener('click', () => this.exportPrompts());
            if (importInput) importInput.addEventListener('change', (e) => this.importPrompts(e));
            if (flushBtn) flushBtn.addEventListener('click', () => this.confirmClearDatabase());

            const resultsContainer = document.getElementById('prompt-results');
            if (resultsContainer) {
                resultsContainer.addEventListener('click', (e) => this.handlePromptAction(e));
            }
        },

        async copyCurrentPrompt() {
            try {
                const validation = sectionManager.validate();
                if (!validation.isValid) {
                    ui.showToast(validation.errors[0], 'warning');
                    return;
                }

                const promptText = sectionManager.generatePromptText();
                if (!promptText.trim()) {
                    ui.showToast('No content to copy', 'warning');
                    return;
                }

                const success = await utils.copyToClipboard(promptText);
                if (success) {
                    ui.showToast('Prompt copied to clipboard!', 'success');
                } else {
                    ui.showToast('Failed to copy prompt', 'error');
                }
            } catch (error) {
                console.error('Copy prompt error:', error);
                ui.showToast('Failed to copy prompt', 'error');
            }
        },

        async saveCurrentPrompt() {
            try {
                const validation = sectionManager.validate();
                if (!validation.isValid) {
                    ui.showToast(validation.errors[0], 'warning');
                    return;
                }

                const promptName = await ui.showModal(
                    'Save Prompt',
                    'Enter a name for your prompt:',
                    {
                        showInput: true,
                        inputPlaceholder: 'Prompt name...'
                    }
                );

                if (!promptName?.trim()) {
                    return;
                }

                const sections = sectionManager.getAllSections();
                const promptData = {
                    name: promptName.trim(),
                    sections
                };

                const newId = await database.addPrompt(promptData);
                this.currentPromptId = newId;
                ui.showToast('Prompt saved successfully!', 'success');

                await this.loadPromptLibrary();

            } catch (error) {
                console.error('Save prompt error:', error);
                ui.showToast('Failed to save prompt', 'error');
            }
        },

        async clearEditor() {
            if (!sectionManager.isEmpty()) {
                const confirmed = await ui.showModal(
                    'Clear Editor',
                    'Are you sure you want to clear the editor? All unsaved changes will be lost.'
                );

                if (!confirmed) return;
            }

            sectionManager.clearAllSections();
            sectionManager.createInitialSection();
            this.currentPromptId = null;
            ui.showToast('Editor cleared', 'success');
        },

        async loadPromptLibrary() {
            try {
                this.searchResults = await database.getAllPrompts();
                this.displaySearchResults();
            } catch (error) {
                console.error('Load library error:', error);
                ui.showToast('Failed to load prompt library', 'error');
            }
        },

        displaySearchResults: function () {
            const container = document.getElementById('prompt-results');
            if (!container) return;

            if (this.searchResults.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <h3>No prompts found</h3>
                        <p>Create your first prompt to get started</p>
                    </div>
                `;
                return;
            }

            const promptCards = this.searchResults.map(prompt => this.createPromptCard(prompt)).join('');
            container.innerHTML = promptCards;
        },

        createPromptCard: function (prompt) {
            const sectionCount = prompt.sections ? prompt.sections.length : 0;
            const preview = this.generatePreview(prompt.sections);

            return `
                <div class="prompt-card" data-prompt-id="${prompt.id}">
                    <div class="prompt-card-header">
                        <div class="prompt-card-info">
                            <h3 class="prompt-card-title">${this.escapeHtml(prompt.name)}</h3>
                            <div class="prompt-card-meta">
                                <span>${sectionCount} sections</span> •
                                <span>Created ${utils.formatDate(prompt.created)}</span>
                            </div>
                        </div>
                        <div class="prompt-card-actions">
                            <button class="btn btn-sm btn-primary" data-action="copy" data-prompt-id="${prompt.id}" title="Copy to clipboard">
                                Copy
                            </button>
                            <button class="btn btn-sm btn-secondary" data-action="edit" data-prompt-id="${prompt.id}" title="Edit prompt">
                                Edit
                            </button>
                            <button class="btn btn-sm btn-danger" data-action="delete" data-prompt-id="${prompt.id}" title="Delete prompt">
                                Delete
                            </button>
                        </div>
                    </div>
                    ${preview ? `<div class="prompt-card-preview">${this.escapeHtml(preview)}</div>` : ''}
                </div>
            `;
        },

        generatePreview: function (sections) {
            if (!sections || sections.length === 0) return '';

            const firstSection = sections.find(s => s.content?.trim());
            if (!firstSection) return '';

            const content = firstSection.content.trim();
            return content.length > 150 ? content.substring(0, 150) + '...' : content;
        },

        escapeHtml: function (text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        async handlePromptAction(e) {
            const action = e.target.dataset.action;
            const promptId = parseInt(e.target.dataset.promptId);

            if (!action || !promptId) return;

            e.preventDefault();
            e.stopPropagation();

            switch (action) {
                case 'copy':
                    await this.copyStoredPrompt(promptId);
                    break;
                case 'edit':
                    await this.loadPrompt(promptId);
                    break;
                case 'delete':
                    await this.deletePrompt(promptId);
                    break;
            }
        },

        async copyStoredPrompt(promptId) {
            try {
                const prompt = await database.getPrompt(promptId);
                if (!prompt) {
                    ui.showToast('Prompt not found', 'error');
                    return;
                }

                let promptText = '';
                prompt.sections.forEach(section => {
                    if (section.title?.trim()) {
                        promptText += `### ${section.title.trim()}\n`;
                    }

                    if (section.wrap) {
                        promptText += `\`\`\`\n${section.content.trim()}\n\`\`\`\n\n`;
                    } else {
                        promptText += `${section.content.trim()}\n\n`;
                    }
                });

                const success = await utils.copyToClipboard(promptText.trim());
                if (success) {
                    ui.showToast('Prompt copied to clipboard!', 'success');
                } else {
                    ui.showToast('Failed to copy prompt', 'error');
                }

            } catch (error) {
                console.error('Copy stored prompt error:', error);
                ui.showToast('Failed to copy prompt', 'error');
            }
        },

        async loadPrompt(promptId) {
            try {
                const prompt = await database.getPrompt(promptId);
                if (!prompt) {
                    ui.showToast('Prompt not found', 'error');
                    return;
                }

                sectionManager.loadSections(prompt.sections);
                this.currentPromptId = promptId;

                ui.switchSection('editor');
                ui.showToast('Prompt loaded for editing', 'success');

            } catch (error) {
                console.error('Load prompt error:', error);
                ui.showToast('Failed to load prompt', 'error');
            }
        },

        async deletePrompt(promptId) {
            try {
                const prompt = await database.getPrompt(promptId);
                if (!prompt) {
                    ui.showToast('Prompt not found', 'error');
                    return;
                }

                const confirmed = await ui.showModal(
                    'Delete Prompt',
                    `Are you sure you want to delete "${prompt.name}"? This action cannot be undone.`
                );

                if (!confirmed) return;

                await database.deletePrompt(promptId);

                if (this.currentPromptId === promptId) {
                    this.currentPromptId = null;
                    sectionManager.clearAllSections();
                    sectionManager.createInitialSection();
                }

                await this.loadPromptLibrary();
                ui.showToast('Prompt deleted successfully', 'success');

            } catch (error) {
                console.error('Delete prompt error:', error);
                ui.showToast('Failed to delete prompt', 'error');
            }
        },

        async exportPrompts() {
            try {
                const exportData = await database.exportPrompts();
                const filename = `prompts_${new Date().toISOString().split('T')[0]}.json`;

                const success = await utils.downloadData(exportData, filename, 'application/json');

                if (success) {
                    ui.showToast('Prompts exported successfully!', 'success');
                } else {
                    ui.showToast('Export completed (check clipboard or share menu)', 'info');
                }

            } catch (error) {
                console.error('Export error:', error);
                ui.showToast('Export failed', 'error');
            }
        },

        async importPrompts(event) {
            const file = event.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const results = await database.importPrompts(text);

                if (results.imported > 0) {
                    await this.loadPromptLibrary();

                    ui.showToast(
                        `Successfully imported ${results.imported} prompts${results.skipped > 0 ? ` (${results.skipped} skipped)` : ''}`,
                        'success'
                    );

                    if (results.errors.length > 0) {
                        console.warn('Import errors:', results.errors);
                    }
                } else {
                    ui.showToast('No prompts were imported', 'warning');
                }

            } catch (error) {
                console.error('Import error:', error);
                ui.showToast('Import failed: Invalid file format', 'error');
            } finally {
                // Reset file input
                event.target.value = '';
            }
        },

        async confirmClearDatabase() {
            const confirmed = await ui.showModal(
                'Clear All Prompts',
                'Are you sure you want to clear all saved prompts? This action cannot be undone.'
            );

            if (!confirmed) return;

            try {
                await database.clearAllPrompts();

                this.currentPromptId = null;
                sectionManager.clearAllSections();
                sectionManager.createInitialSection();

                await this.loadPromptLibrary();
                ui.showToast('All prompts cleared successfully', 'success');

            } catch (error) {
                console.error('Clear database error:', error);
                ui.showToast('Failed to clear database', 'error');
            }
        }
    };

    // Main Application
    const app = {
        version: '2.0.0',
        isInitialized: false,

        async init() {
            try {
                console.log(`Initializing Prompt Generator Pro v${this.version}`);

                // Initialize modules
                ui.init();
                sectionManager.init();
                await promptManager.init();

                // Setup global event listeners
                this.setupGlobalEventListeners();

                this.isInitialized = true;
                console.log('Prompt Generator Pro initialized successfully');

                // Show welcome message for first-time users
                const hasVisited = localStorage.getItem('hasVisited');
                if (!hasVisited) {
                    localStorage.setItem('hasVisited', 'true');
                    setTimeout(() => {
                        ui.showToast('Welcome to Prompt Generator Pro! Start by creating your first prompt.', 'success', 8000);
                    }, 1000);
                }

            } catch (error) {
                console.error('Failed to initialize application:', error);
                ui.showToast('Failed to initialize application', 'error');
            }
        },

        setupGlobalEventListeners() {
            // Window resize handler
            window.addEventListener('resize', utils.debounce(() => {
                ui.updateSidebarState();
            }, 250));

            // Modal backdrop clicks
            document.addEventListener('click', (e) => {
                if (e.target.matches('.modal-backdrop') || e.target.matches('#modal-close')) {
                    const modal = document.getElementById('modal');
                    modal.classList.remove('active');
                    modal.setAttribute('aria-hidden', 'true');
                    document.body.style.overflow = '';
                }
            });
        }
    };

    // Make utilities available globally
    window.utils = utils;
    window.ui = ui;
    window.database = database;
    window.sectionManager = sectionManager;
    window.promptManager = promptManager;
    window.app = app;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => app.init());
    } else {
        app.init();
    }

})();

