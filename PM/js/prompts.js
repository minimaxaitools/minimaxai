/**
 * Prompts module for Prompt Generator Pro
 * Handles saving, loading, searching, and managing prompts
 */

import { copyToClipboard, downloadData, debounce, formatDate } from './utils.js';
import database from './database.js';
import sectionManager from './sections.js';
import ui from './ui.js';

class PromptManager {
    constructor() {
        this.currentPromptId = null;
        this.searchResults = [];
        this.currentSearchQuery = '';
        this.currentSearchType = 'all';
        this.isLoading = false;
        
        this.init();
    }

    async init() {
        try {
            await database.init();
            this.setupEventListeners();
            await this.loadPromptLibrary();
            await this.updateStatistics();
        } catch (error) {
            console.error('Failed to initialize PromptManager:', error);
            ui.showToast('Failed to initialize database', 'error');
        }
    }

    setupEventListeners() {
        // Editor actions
        const copyBtn = document.getElementById('copy-prompt');
        const saveBtn = document.getElementById('save-prompt');
        const clearBtn = document.getElementById('clear-editor');
        
        if (copyBtn) copyBtn.addEventListener('click', () => this.copyCurrentPrompt());
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveCurrentPrompt());
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearEditor());
        
        // Library actions
        const exportBtn = document.getElementById('export-prompts');
        const importInput = document.getElementById('import-file');
        const flushBtn = document.getElementById('flush-db');
        const backupBtn = document.getElementById('backup-data');
        
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportPrompts());
        if (importInput) importInput.addEventListener('change', (e) => this.importPrompts(e));
        if (flushBtn) flushBtn.addEventListener('click', () => this.confirmClearDatabase());
        if (backupBtn) backupBtn.addEventListener('click', () => this.createBackup());
        
        // Search functionality
        const searchInput = document.getElementById('search-input');
        const searchType = document.getElementById('search-type');
        
        if (searchInput) {
            const debouncedSearch = debounce(() => this.performSearch(), 300);
            searchInput.addEventListener('input', debouncedSearch);
        }
        
        if (searchType) {
            searchType.addEventListener('change', () => this.performSearch());
        }
        
        // Prompt results delegation
        const resultsContainer = document.getElementById('prompt-results');
        if (resultsContainer) {
            resultsContainer.addEventListener('click', (e) => this.handlePromptAction(e));
        }
    }

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
            
            const success = await copyToClipboard(promptText);
            if (success) {
                ui.showToast('Prompt copied to clipboard!', 'success');
            } else {
                ui.showToast('Failed to copy prompt', 'error');
            }
        } catch (error) {
            console.error('Copy prompt error:', error);
            ui.showToast('Failed to copy prompt', 'error');
        }
    }

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
                    inputPlaceholder: 'Prompt name...',
                    inputValue: this.currentPromptId ? 
                        (await database.getPrompt(this.currentPromptId))?.name || '' : ''
                }
            );
            
            if (!promptName?.trim()) {
                return;
            }
            
            const sections = sectionManager.getAllSections();
            const promptData = {
                name: promptName.trim(),
                sections,
                tags: [] // TODO: Add tag functionality
            };
            
            if (this.currentPromptId) {
                await database.updatePrompt(this.currentPromptId, promptData);
                ui.showToast('Prompt updated successfully!', 'success');
            } else {
                const newId = await database.addPrompt(promptData);
                this.currentPromptId = newId;
                ui.showToast('Prompt saved successfully!', 'success');
            }
            
            await this.loadPromptLibrary();
            await this.updateStatistics();
            
        } catch (error) {
            console.error('Save prompt error:', error);
            ui.showToast('Failed to save prompt', 'error');
        }
    }

    async clearEditor() {
        if (!sectionManager.isEmpty()) {
            const confirmed = await ui.confirmAction(
                'Are you sure you want to clear the editor? All unsaved changes will be lost.',
                'Clear Editor'
            );
            
            if (!confirmed) return;
        }
        
        sectionManager.clearAllSections();
        sectionManager.createInitialSection();
        this.currentPromptId = null;
        ui.showToast('Editor cleared', 'success');
    }

    async loadPrompt(promptId) {
        try {
            const prompt = await database.getPrompt(promptId);
            if (!prompt) {
                ui.showToast('Prompt not found', 'error');
                return;
            }
            
            sectionManager.loadSections(prompt.sections);
            this.currentPromptId = promptId;
            
            // Switch to editor section
            ui.switchSection('editor');
            
            ui.showToast('Prompt loaded for editing', 'success');
            
        } catch (error) {
            console.error('Load prompt error:', error);
            ui.showToast('Failed to load prompt', 'error');
        }
    }

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
            
            const success = await copyToClipboard(promptText.trim());
            if (success) {
                ui.showToast('Prompt copied to clipboard!', 'success');
            } else {
                ui.showToast('Failed to copy prompt', 'error');
            }
            
        } catch (error) {
            console.error('Copy stored prompt error:', error);
            ui.showToast('Failed to copy prompt', 'error');
        }
    }

    async deletePrompt(promptId) {
        try {
            const prompt = await database.getPrompt(promptId);
            if (!prompt) {
                ui.showToast('Prompt not found', 'error');
                return;
            }
            
            const confirmed = await ui.confirmAction(
                `Are you sure you want to delete "${prompt.name}"? This action cannot be undone.`,
                'Delete Prompt'
            );
            
            if (!confirmed) return;
            
            await database.deletePrompt(promptId);
            
            // Clear editor if this prompt was being edited
            if (this.currentPromptId === promptId) {
                this.currentPromptId = null;
                sectionManager.clearAllSections();
                sectionManager.createInitialSection();
            }
            
            await this.loadPromptLibrary();
            await this.updateStatistics();
            
            ui.showToast('Prompt deleted successfully', 'success');
            
        } catch (error) {
            console.error('Delete prompt error:', error);
            ui.showToast('Failed to delete prompt', 'error');
        }
    }

    async performSearch() {
        const searchInput = document.getElementById('search-input');
        const searchType = document.getElementById('search-type');
        
        if (!searchInput || !searchType) return;
        
        this.currentSearchQuery = searchInput.value.trim();
        this.currentSearchType = searchType.value;
        
        try {
            this.isLoading = true;
            ui.showLoading('#prompt-results', 'Searching...');
            
            this.searchResults = await database.searchPrompts(
                this.currentSearchQuery,
                this.currentSearchType
            );
            
            this.displaySearchResults();
            
        } catch (error) {
            console.error('Search error:', error);
            ui.showToast('Search failed', 'error');
        } finally {
            this.isLoading = false;
            ui.hideLoading('#prompt-results');
        }
    }

    async loadPromptLibrary() {
        try {
            this.isLoading = true;
            ui.showLoading('#prompt-results', 'Loading prompts...');
            
            this.searchResults = await database.getAllPrompts('updated', 'desc');
            this.displaySearchResults();
            
        } catch (error) {
            console.error('Load library error:', error);
            ui.showToast('Failed to load prompt library', 'error');
        } finally {
            this.isLoading = false;
            ui.hideLoading('#prompt-results');
        }
    }

    displaySearchResults() {
        const container = document.getElementById('prompt-results');
        if (!container) return;
        
        if (this.searchResults.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M32 8C18.745 8 8 18.745 8 32s10.745 24 24 24 24-10.745 24-24S45.255 8 32 8zm0 4c11.046 0 20 8.954 20 20s-8.954 20-20 20-20-8.954-20-20 8.954-20 20-20z" fill="currentColor" opacity="0.3"/>
                        <path d="M28 24h8v4h-8v8h-4v-8h-8v-4h8v-8h4v8z" fill="currentColor" opacity="0.5"/>
                    </svg>
                    <h3>No prompts found</h3>
                    <p>${this.currentSearchQuery ? 'Try adjusting your search terms' : 'Create your first prompt to get started'}</p>
                </div>
            `;
            return;
        }
        
        const promptCards = this.searchResults.map(prompt => this.createPromptCard(prompt)).join('');
        container.innerHTML = promptCards;
    }

    createPromptCard(prompt) {
        const stats = prompt.metadata || { sectionCount: prompt.sections.length, wordCount: 0, characterCount: 0 };
        const preview = this.generatePreview(prompt.sections);
        
        return `
            <div class="prompt-card" data-prompt-id="${prompt.id}">
                <div class="prompt-card-header">
                    <div class="prompt-card-info">
                        <h3 class="prompt-card-title">${this.escapeHtml(prompt.name)}</h3>
                        <div class="prompt-card-meta">
                            <span>${stats.sectionCount} sections</span> •
                            <span>${stats.wordCount} words</span> •
                            <span>Created ${formatDate(prompt.created)}</span>
                            ${prompt.updated !== prompt.created ? `• Updated ${formatDate(prompt.updated)}` : ''}
                        </div>
                    </div>
                    <div class="prompt-card-actions">
                        <button class="btn btn-sm btn-primary" data-action="copy" data-prompt-id="${prompt.id}" title="Copy to clipboard">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M4 2a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H4z" stroke="currentColor" stroke-width="1.5" fill="none"/>
                                <path d="M6 6h4M6 8h4M6 10h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                        </button>
                        <button class="btn btn-sm btn-secondary" data-action="edit" data-prompt-id="${prompt.id}" title="Edit prompt">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11.586 2.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM9.379 4.793L1 13.172V16h2.828l8.38-8.379-2.83-2.828z" fill="currentColor"/>
                            </svg>
                        </button>
                        <button class="btn btn-sm btn-danger" data-action="delete" data-prompt-id="${prompt.id}" title="Delete prompt">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4M7.333 7.333v4M8.667 7.333v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
                ${preview ? `<div class="prompt-card-preview">${this.escapeHtml(preview)}</div>` : ''}
            </div>
        `;
    }

    generatePreview(sections) {
        if (!sections || sections.length === 0) return '';
        
        const firstSection = sections.find(s => s.content?.trim());
        if (!firstSection) return '';
        
        const content = firstSection.content.trim();
        return content.length > 150 ? content.substring(0, 150) + '...' : content;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async handlePromptAction(e) {
        const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
        const promptId = parseInt(e.target.dataset.promptId || e.target.closest('[data-prompt-id]')?.dataset.promptId);
        
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
    }

    async exportPrompts() {
        try {
            ui.showLoading('#export-prompts', 'Exporting...');
            
            const exportData = await database.exportPrompts();
            const filename = `prompts_${new Date().toISOString().split('T')[0]}.json`;
            
            const success = await downloadData(exportData, filename, 'application/json');
            
            if (success) {
                ui.showToast('Prompts exported successfully!', 'success');
            } else {
                ui.showToast('Export completed (check clipboard or share menu)', 'info');
            }
            
        } catch (error) {
            console.error('Export error:', error);
            ui.showToast('Export failed', 'error');
        } finally {
            ui.hideLoading('#export-prompts');
        }
    }

    async importPrompts(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            ui.showLoading('#import-file', 'Importing...');
            
            const text = await file.text();
            const results = await database.importPrompts(text);
            
            if (results.imported > 0) {
                await this.loadPromptLibrary();
                await this.updateStatistics();
                
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
            ui.hideLoading('#import-file');
            // Reset file input
            event.target.value = '';
        }
    }

    async confirmClearDatabase() {
        const confirmed = await ui.confirmAction(
            'Are you sure you want to clear all saved prompts? This action cannot be undone.',
            'Clear All Prompts'
        );
        
        if (!confirmed) return;
        
        try {
            await database.clearAllPrompts();
            
            // Clear current editor if needed
            this.currentPromptId = null;
            sectionManager.clearAllSections();
            sectionManager.createInitialSection();
            
            await this.loadPromptLibrary();
            await this.updateStatistics();
            
            ui.showToast('All prompts cleared successfully', 'success');
            
        } catch (error) {
            console.error('Clear database error:', error);
            ui.showToast('Failed to clear database', 'error');
        }
    }

    async createBackup() {
        try {
            ui.showLoading('#backup-data', 'Creating backup...');
            
            const backupData = await database.createBackup();
            const filename = `prompt_backup_${new Date().toISOString().split('T')[0]}.json`;
            
            const success = await downloadData(backupData, filename, 'application/json');
            
            if (success) {
                ui.showToast('Backup created successfully!', 'success');
            } else {
                ui.showToast('Backup completed (check clipboard or share menu)', 'info');
            }
            
        } catch (error) {
            console.error('Backup error:', error);
            ui.showToast('Backup failed', 'error');
        } finally {
            ui.hideLoading('#backup-data');
        }
    }

    async updateStatistics() {
        try {
            const stats = await database.getStats();
            ui.updateStats(stats);
        } catch (error) {
            console.error('Update statistics error:', error);
        }
    }

    // Public API
    getCurrentPromptId() {
        return this.currentPromptId;
    }

    getSearchResults() {
        return this.searchResults;
    }

    isCurrentlyLoading() {
        return this.isLoading;
    }
}

// Create and export singleton instance
const promptManager = new PromptManager();

export default promptManager;

