/**
 * Database module for Prompt Generator Pro
 * Enhanced IndexedDB wrapper with better error handling and performance
 */

class PromptDatabase {
    constructor() {
        this.dbName = 'PromptGeneratorProDB';
        this.version = 4;
        this.storeName = 'prompts';
        this.db = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized && this.db) {
            return this.db;
        }

        try {
            this.db = await idb.openDB(this.dbName, this.version, {
                upgrade: (db, oldVersion, newVersion, transaction) => {
                    console.log(`Upgrading database from version ${oldVersion} to ${newVersion}`);
                    
                    // Create object store if it doesn't exist
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        const store = db.createObjectStore(this.storeName, {
                            keyPath: 'id',
                            autoIncrement: true
                        });
                        
                        // Create indexes for efficient searching
                        store.createIndex('name', 'name', { unique: false });
                        store.createIndex('created', 'created', { unique: false });
                        store.createIndex('updated', 'updated', { unique: false });
                        store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
                    }
                    
                    // Handle version-specific upgrades
                    if (oldVersion < 2) {
                        // Add tags field to existing records
                        const store = transaction.objectStore(this.storeName);
                        store.openCursor().then(function addTags(cursor) {
                            if (cursor) {
                                const data = cursor.value;
                                if (!data.tags) {
                                    data.tags = [];
                                    cursor.update(data);
                                }
                                cursor.continue().then(addTags);
                            }
                        });
                    }
                    
                    if (oldVersion < 3) {
                        // Add metadata field
                        const store = transaction.objectStore(this.storeName);
                        store.openCursor().then(function addMetadata(cursor) {
                            if (cursor) {
                                const data = cursor.value;
                                if (!data.metadata) {
                                    data.metadata = {
                                        wordCount: 0,
                                        characterCount: 0,
                                        sectionCount: data.sections ? data.sections.length : 0
                                    };
                                    cursor.update(data);
                                }
                                cursor.continue().then(addMetadata);
                            }
                        });
                    }
                    
                    if (oldVersion < 4) {
                        // Add version field for future compatibility
                        const store = transaction.objectStore(this.storeName);
                        store.openCursor().then(function addVersion(cursor) {
                            if (cursor) {
                                const data = cursor.value;
                                if (!data.version) {
                                    data.version = '1.0.0';
                                    cursor.update(data);
                                }
                                cursor.continue().then(addVersion);
                            }
                        });
                    }
                },
                blocked: () => {
                    console.warn('Database upgrade blocked. Please close other tabs.');
                },
                blocking: () => {
                    console.warn('Database is blocking a newer version. Consider refreshing.');
                }
            });

            this.isInitialized = true;
            console.log('Database initialized successfully');
            return this.db;
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw new Error(`Database initialization failed: ${error.message}`);
        }
    }

    async ensureInitialized() {
        if (!this.isInitialized || !this.db) {
            await this.init();
        }
    }

    // Calculate metadata for a prompt
    calculateMetadata(sections) {
        let wordCount = 0;
        let characterCount = 0;
        
        sections.forEach(section => {
            const content = section.content || '';
            characterCount += content.length;
            wordCount += content.split(/\s+/).filter(word => word.length > 0).length;
        });
        
        return {
            wordCount,
            characterCount,
            sectionCount: sections.length
        };
    }

    // Add a new prompt
    async addPrompt(promptData) {
        await this.ensureInitialized();
        
        try {
            const now = new Date().toISOString();
            const metadata = this.calculateMetadata(promptData.sections || []);
            
            const prompt = {
                ...promptData,
                created: now,
                updated: now,
                version: '1.0.0',
                tags: promptData.tags || [],
                metadata,
                id: undefined // Let IndexedDB auto-generate
            };

            const result = await this.db.add(this.storeName, prompt);
            console.log('Prompt added with ID:', result);
            return result;
        } catch (error) {
            console.error('Failed to add prompt:', error);
            throw new Error(`Failed to save prompt: ${error.message}`);
        }
    }

    // Update an existing prompt
    async updatePrompt(id, promptData) {
        await this.ensureInitialized();
        
        try {
            const existing = await this.getPrompt(id);
            if (!existing) {
                throw new Error('Prompt not found');
            }

            const metadata = this.calculateMetadata(promptData.sections || []);
            
            const updatedPrompt = {
                ...existing,
                ...promptData,
                id,
                updated: new Date().toISOString(),
                metadata
            };

            await this.db.put(this.storeName, updatedPrompt);
            console.log('Prompt updated:', id);
            return updatedPrompt;
        } catch (error) {
            console.error('Failed to update prompt:', error);
            throw new Error(`Failed to update prompt: ${error.message}`);
        }
    }

    // Get a single prompt by ID
    async getPrompt(id) {
        await this.ensureInitialized();
        
        try {
            const prompt = await this.db.get(this.storeName, id);
            return prompt || null;
        } catch (error) {
            console.error('Failed to get prompt:', error);
            throw new Error(`Failed to retrieve prompt: ${error.message}`);
        }
    }

    // Get all prompts with optional sorting
    async getAllPrompts(sortBy = 'updated', sortOrder = 'desc') {
        await this.ensureInitialized();
        
        try {
            const tx = this.db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            
            let prompts;
            if (sortBy === 'name' || sortBy === 'created' || sortBy === 'updated') {
                const index = store.index(sortBy);
                prompts = await index.getAll();
            } else {
                prompts = await store.getAll();
            }
            
            // Sort the results
            prompts.sort((a, b) => {
                let aVal = a[sortBy];
                let bVal = b[sortBy];
                
                if (sortBy === 'name') {
                    aVal = aVal.toLowerCase();
                    bVal = bVal.toLowerCase();
                }
                
                if (sortOrder === 'desc') {
                    return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
                } else {
                    return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                }
            });
            
            return prompts;
        } catch (error) {
            console.error('Failed to get all prompts:', error);
            throw new Error(`Failed to retrieve prompts: ${error.message}`);
        }
    }

    // Search prompts with advanced filtering
    async searchPrompts(query, searchType = 'all', filters = {}) {
        await this.ensureInitialized();
        
        try {
            const allPrompts = await this.getAllPrompts();
            const searchQuery = query.toLowerCase().trim();
            
            if (!searchQuery && Object.keys(filters).length === 0) {
                return allPrompts;
            }
            
            return allPrompts.filter(prompt => {
                // Text search
                let matchesSearch = false;
                
                if (!searchQuery) {
                    matchesSearch = true;
                } else {
                    switch (searchType) {
                        case 'name':
                            matchesSearch = prompt.name.toLowerCase().includes(searchQuery);
                            break;
                        case 'title':
                            matchesSearch = prompt.sections.some(section => 
                                section.title && section.title.toLowerCase().includes(searchQuery)
                            );
                            break;
                        case 'content':
                            matchesSearch = prompt.sections.some(section => 
                                section.content && section.content.toLowerCase().includes(searchQuery)
                            );
                            break;
                        case 'tags':
                            matchesSearch = prompt.tags && prompt.tags.some(tag => 
                                tag.toLowerCase().includes(searchQuery)
                            );
                            break;
                        default: // 'all'
                            matchesSearch = 
                                prompt.name.toLowerCase().includes(searchQuery) ||
                                prompt.sections.some(section => 
                                    (section.title && section.title.toLowerCase().includes(searchQuery)) ||
                                    (section.content && section.content.toLowerCase().includes(searchQuery))
                                ) ||
                                (prompt.tags && prompt.tags.some(tag => 
                                    tag.toLowerCase().includes(searchQuery)
                                ));
                    }
                }
                
                // Apply filters
                let matchesFilters = true;
                
                if (filters.dateFrom) {
                    matchesFilters = matchesFilters && new Date(prompt.created) >= new Date(filters.dateFrom);
                }
                
                if (filters.dateTo) {
                    matchesFilters = matchesFilters && new Date(prompt.created) <= new Date(filters.dateTo);
                }
                
                if (filters.minSections) {
                    matchesFilters = matchesFilters && prompt.sections.length >= filters.minSections;
                }
                
                if (filters.maxSections) {
                    matchesFilters = matchesFilters && prompt.sections.length <= filters.maxSections;
                }
                
                if (filters.tags && filters.tags.length > 0) {
                    matchesFilters = matchesFilters && filters.tags.some(tag => 
                        prompt.tags && prompt.tags.includes(tag)
                    );
                }
                
                return matchesSearch && matchesFilters;
            });
        } catch (error) {
            console.error('Failed to search prompts:', error);
            throw new Error(`Search failed: ${error.message}`);
        }
    }

    // Delete a prompt
    async deletePrompt(id) {
        await this.ensureInitialized();
        
        try {
            await this.db.delete(this.storeName, id);
            console.log('Prompt deleted:', id);
            return true;
        } catch (error) {
            console.error('Failed to delete prompt:', error);
            throw new Error(`Failed to delete prompt: ${error.message}`);
        }
    }

    // Clear all prompts
    async clearAllPrompts() {
        await this.ensureInitialized();
        
        try {
            await this.db.clear(this.storeName);
            console.log('All prompts cleared');
            return true;
        } catch (error) {
            console.error('Failed to clear prompts:', error);
            throw new Error(`Failed to clear database: ${error.message}`);
        }
    }

    // Export all prompts
    async exportPrompts() {
        await this.ensureInitialized();
        
        try {
            const prompts = await this.getAllPrompts();
            const exportData = {
                version: '1.0.0',
                exportDate: new Date().toISOString(),
                promptCount: prompts.length,
                prompts
            };
            
            return JSON.stringify(exportData, null, 2);
        } catch (error) {
            console.error('Failed to export prompts:', error);
            throw new Error(`Export failed: ${error.message}`);
        }
    }

    // Import prompts from JSON data
    async importPrompts(jsonData, options = {}) {
        await this.ensureInitialized();
        
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
                        results.skipped++;
                        continue;
                    }
                    
                    // Remove ID to avoid conflicts (unless preserveIds is true)
                    if (!options.preserveIds) {
                        delete promptData.id;
                    }
                    
                    await this.addPrompt(promptData);
                    results.imported++;
                } catch (error) {
                    results.errors.push(`Failed to import "${promptData.name || 'Unknown'}": ${error.message}`);
                }
            }
            
            console.log('Import completed:', results);
            return results;
        } catch (error) {
            console.error('Failed to import prompts:', error);
            throw new Error(`Import failed: ${error.message}`);
        }
    }

    // Get database statistics
    async getStats() {
        await this.ensureInitialized();
        
        try {
            const prompts = await this.getAllPrompts();
            
            const stats = {
                totalPrompts: prompts.length,
                totalSections: 0,
                totalWords: 0,
                totalCharacters: 0,
                averageSectionsPerPrompt: 0,
                oldestPrompt: null,
                newestPrompt: null,
                mostUsedTags: {}
            };
            
            if (prompts.length === 0) {
                return stats;
            }
            
            let oldestDate = new Date();
            let newestDate = new Date(0);
            
            prompts.forEach(prompt => {
                const created = new Date(prompt.created);
                if (created < oldestDate) {
                    oldestDate = created;
                    stats.oldestPrompt = prompt;
                }
                if (created > newestDate) {
                    newestDate = created;
                    stats.newestPrompt = prompt;
                }
                
                stats.totalSections += prompt.sections.length;
                
                if (prompt.metadata) {
                    stats.totalWords += prompt.metadata.wordCount || 0;
                    stats.totalCharacters += prompt.metadata.characterCount || 0;
                }
                
                if (prompt.tags) {
                    prompt.tags.forEach(tag => {
                        stats.mostUsedTags[tag] = (stats.mostUsedTags[tag] || 0) + 1;
                    });
                }
            });
            
            stats.averageSectionsPerPrompt = stats.totalSections / prompts.length;
            
            return stats;
        } catch (error) {
            console.error('Failed to get stats:', error);
            throw new Error(`Failed to get statistics: ${error.message}`);
        }
    }

    // Backup database to JSON
    async createBackup() {
        try {
            const exportData = await this.exportPrompts();
            const stats = await this.getStats();
            
            const backup = {
                version: '1.0.0',
                backupDate: new Date().toISOString(),
                stats,
                data: JSON.parse(exportData)
            };
            
            return JSON.stringify(backup, null, 2);
        } catch (error) {
            console.error('Failed to create backup:', error);
            throw new Error(`Backup failed: ${error.message}`);
        }
    }
}

// Create and export singleton instance
const database = new PromptDatabase();

export default database;

