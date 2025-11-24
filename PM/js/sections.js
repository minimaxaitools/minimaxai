/**
 * Sections module for Prompt Generator Pro
 * Handles dynamic creation and management of prompt sections
 */

import { generateId, debounce } from './utils.js';
import ui from './ui.js';

class SectionManager {
    constructor() {
        this.sections = new Map();
        this.sectionOrder = [];
        this.container = null;
        this.template = null;
        this.draggedElement = null;
        this.dragOverElement = null;
        
        this.init();
    }

    init() {
        this.container = document.getElementById('sections-container');
        this.template = document.getElementById('section-template');
        
        if (!this.container || !this.template) {
            console.error('Required elements not found for SectionManager');
            return;
        }
        
        this.setupEventListeners();
        this.createInitialSection();
    }

    setupEventListeners() {
        // Add section button
        const addButton = document.getElementById('add-section');
        if (addButton) {
            addButton.addEventListener('click', () => this.addSection());
        }

        // Container event delegation
        this.container.addEventListener('click', this.handleContainerClick.bind(this));
        this.container.addEventListener('input', this.handleContainerInput.bind(this));
        this.container.addEventListener('change', this.handleContainerChange.bind(this));
        
        // Drag and drop events
        this.container.addEventListener('dragstart', this.handleDragStart.bind(this));
        this.container.addEventListener('dragover', this.handleDragOver.bind(this));
        this.container.addEventListener('drop', this.handleDrop.bind(this));
        this.container.addEventListener('dragend', this.handleDragEnd.bind(this));
    }

    createInitialSection() {
        if (this.sections.size === 0) {
            this.addSection();
        }
    }

    addSection(data = {}, position = -1) {
        const sectionId = generateId();
        const sectionElement = this.createSectionElement(sectionId, data);
        
        // Add to container at specified position
        if (position >= 0 && position < this.container.children.length) {
            const referenceElement = this.container.children[position];
            this.container.insertBefore(sectionElement, referenceElement);
            this.sectionOrder.splice(position, 0, sectionId);
        } else {
            this.container.appendChild(sectionElement);
            this.sectionOrder.push(sectionId);
        }
        
        // Store section data
        this.sections.set(sectionId, {
            id: sectionId,
            element: sectionElement,
            title: data.title || '',
            content: data.content || '',
            wrap: data.wrap || false
        });
        
        // Focus on the new section's content area
        const textarea = sectionElement.querySelector('.section-content-textarea');
        if (textarea && !data.content) {
            setTimeout(() => textarea.focus(), 100);
        }
        
        this.updateSectionNumbers();
        this.announceChange('Section added');
        
        return sectionId;
    }

    createSectionElement(sectionId, data = {}) {
        const clone = this.template.content.cloneNode(true);
        const sectionElement = clone.querySelector('.prompt-section');
        
        // Set unique identifier
        sectionElement.dataset.sectionId = sectionId;
        sectionElement.setAttribute('draggable', 'true');
        
        // Populate with data
        const titleInput = sectionElement.querySelector('.section-title-input');
        const contentTextarea = sectionElement.querySelector('.section-content-textarea');
        const wrapCheckbox = sectionElement.querySelector('.section-wrap-checkbox');
        
        titleInput.value = data.title || '';
        contentTextarea.value = data.content || '';
        wrapCheckbox.checked = data.wrap || false;
        
        // Set up character counting
        this.updateCharacterCount(contentTextarea);
        
        // Add section-specific event listeners
        this.setupSectionEventListeners(sectionElement);
        
        return sectionElement;
    }

    setupSectionEventListeners(sectionElement) {
        const textarea = sectionElement.querySelector('.section-content-textarea');
        const titleInput = sectionElement.querySelector('.section-title-input');
        
        // Debounced character count update
        const debouncedCharCount = debounce(() => {
            this.updateCharacterCount(textarea);
        }, 300);
        
        textarea.addEventListener('input', debouncedCharCount);
        
        // Auto-resize textarea
        textarea.addEventListener('input', () => {
            this.autoResizeTextarea(textarea);
        });
        
        // Title input handling
        titleInput.addEventListener('input', () => {
            const sectionId = sectionElement.dataset.sectionId;
            const section = this.sections.get(sectionId);
            if (section) {
                section.title = titleInput.value;
            }
        });
        
        // Initial textarea resize
        this.autoResizeTextarea(textarea);
    }

    handleContainerClick(e) {
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
    }

    handleContainerInput(e) {
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
    }

    handleContainerChange(e) {
        const sectionElement = e.target.closest('.prompt-section');
        if (!sectionElement) return;
        
        const sectionId = sectionElement.dataset.sectionId;
        const section = this.sections.get(sectionId);
        if (!section) return;
        
        if (e.target.classList.contains('section-wrap-checkbox')) {
            section.wrap = e.target.checked;
        }
    }

    removeSection(sectionId) {
        if (this.sections.size <= 1) {
            ui.showToast('Cannot remove the last section', 'warning');
            return;
        }
        
        const section = this.sections.get(sectionId);
        if (!section) return;
        
        // Remove from DOM
        section.element.remove();
        
        // Remove from data structures
        this.sections.delete(sectionId);
        const index = this.sectionOrder.indexOf(sectionId);
        if (index > -1) {
            this.sectionOrder.splice(index, 1);
        }
        
        this.updateSectionNumbers();
        this.announceChange('Section removed');
    }

    moveSectionUp(sectionId) {
        const currentIndex = this.sectionOrder.indexOf(sectionId);
        if (currentIndex <= 0) return;
        
        this.swapSections(currentIndex, currentIndex - 1);
    }

    moveSectionDown(sectionId) {
        const currentIndex = this.sectionOrder.indexOf(sectionId);
        if (currentIndex >= this.sectionOrder.length - 1) return;
        
        this.swapSections(currentIndex, currentIndex + 1);
    }

    swapSections(index1, index2) {
        const id1 = this.sectionOrder[index1];
        const id2 = this.sectionOrder[index2];
        
        const section1 = this.sections.get(id1);
        const section2 = this.sections.get(id2);
        
        if (!section1 || !section2) return;
        
        // Swap in DOM
        const nextSibling = section2.element.nextSibling;
        const parent = section2.element.parentNode;
        
        section1.element.parentNode.insertBefore(section2.element, section1.element);
        parent.insertBefore(section1.element, nextSibling);
        
        // Swap in order array
        [this.sectionOrder[index1], this.sectionOrder[index2]] = [this.sectionOrder[index2], this.sectionOrder[index1]];
        
        this.updateSectionNumbers();
        this.announceChange('Sections reordered');
    }

    // Drag and Drop functionality
    handleDragStart(e) {
        const sectionElement = e.target.closest('.prompt-section');
        if (!sectionElement) return;
        
        this.draggedElement = sectionElement;
        sectionElement.classList.add('dragging');
        
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', sectionElement.outerHTML);
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const sectionElement = e.target.closest('.prompt-section');
        if (!sectionElement || sectionElement === this.draggedElement) return;
        
        // Remove previous drag-over indicators
        this.container.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
        
        sectionElement.classList.add('drag-over');
        this.dragOverElement = sectionElement;
    }

    handleDrop(e) {
        e.preventDefault();
        
        if (!this.draggedElement || !this.dragOverElement) return;
        
        const draggedId = this.draggedElement.dataset.sectionId;
        const targetId = this.dragOverElement.dataset.sectionId;
        
        const draggedIndex = this.sectionOrder.indexOf(draggedId);
        const targetIndex = this.sectionOrder.indexOf(targetId);
        
        if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
            // Reorder sections
            this.reorderSection(draggedIndex, targetIndex);
        }
    }

    handleDragEnd(e) {
        // Clean up drag state
        if (this.draggedElement) {
            this.draggedElement.classList.remove('dragging');
            this.draggedElement = null;
        }
        
        this.container.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
        
        this.dragOverElement = null;
    }

    reorderSection(fromIndex, toIndex) {
        const sectionId = this.sectionOrder[fromIndex];
        const section = this.sections.get(sectionId);
        
        if (!section) return;
        
        // Remove from current position
        this.sectionOrder.splice(fromIndex, 1);
        
        // Insert at new position
        this.sectionOrder.splice(toIndex, 0, sectionId);
        
        // Update DOM
        const targetElement = this.sections.get(this.sectionOrder[toIndex + 1])?.element;
        if (targetElement) {
            this.container.insertBefore(section.element, targetElement);
        } else {
            this.container.appendChild(section.element);
        }
        
        this.updateSectionNumbers();
        this.announceChange('Section moved');
    }

    updateCharacterCount(textarea) {
        const sectionElement = textarea.closest('.prompt-section');
        const countElement = sectionElement.querySelector('.character-count');
        
        if (countElement) {
            const count = textarea.value.length;
            const words = textarea.value.trim().split(/\s+/).filter(word => word.length > 0).length;
            countElement.textContent = `${count} characters, ${words} words`;
        }
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(120, textarea.scrollHeight) + 'px';
    }

    updateSectionNumbers() {
        // Update visual indicators if needed
        this.container.querySelectorAll('.prompt-section').forEach((element, index) => {
            element.style.order = index;
        });
    }

    announceChange(message) {
        ui.announceToScreenReader(message);
    }

    // Public API methods
    getAllSections() {
        return this.sectionOrder.map(id => {
            const section = this.sections.get(id);
            return {
                title: section.title,
                content: section.content,
                wrap: section.wrap
            };
        });
    }

    loadSections(sectionsData) {
        this.clearAllSections();
        
        if (!Array.isArray(sectionsData) || sectionsData.length === 0) {
            this.createInitialSection();
            return;
        }
        
        sectionsData.forEach(sectionData => {
            this.addSection(sectionData);
        });
    }

    clearAllSections() {
        this.sections.clear();
        this.sectionOrder = [];
        this.container.innerHTML = '';
    }

    getSectionCount() {
        return this.sections.size;
    }

    isEmpty() {
        return this.sectionOrder.every(id => {
            const section = this.sections.get(id);
            return !section.content.trim();
        });
    }

    generatePromptText() {
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
    }

    // Validation
    validate() {
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

    // Statistics
    getStatistics() {
        let totalCharacters = 0;
        let totalWords = 0;
        let sectionsWithContent = 0;
        
        this.sectionOrder.forEach(id => {
            const section = this.sections.get(id);
            const content = section.content.trim();
            
            if (content) {
                sectionsWithContent++;
                totalCharacters += content.length;
                totalWords += content.split(/\s+/).filter(word => word.length > 0).length;
            }
        });
        
        return {
            totalSections: this.sections.size,
            sectionsWithContent,
            totalCharacters,
            totalWords,
            averageWordsPerSection: sectionsWithContent > 0 ? Math.round(totalWords / sectionsWithContent) : 0
        };
    }
}

// Create and export singleton instance
const sectionManager = new SectionManager();

export default sectionManager;

