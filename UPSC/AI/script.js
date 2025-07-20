/**
 * AI-Powered Document Search & Analysis Platform
 * Main Application Controller
 */

class DocumentSearchApp {
    constructor() {
        this.datasets = new Map();
        this.searchEngine = null;
        this.documentProcessor = null;
        this.exportManager = null;
        this.adsenseManager = null;
        this.isModelLoaded = false;
        this.currentResults = [];
        this.init();
    }

    async init() {
        console.log('Initializing Document Search App...');

        // Initialize components
        this.searchEngine = new SearchEngine();
        this.documentProcessor = new DocumentProcessor();
        this.exportManager = new ExportManager();
        this.adsenseManager = new AdsenseManager();

        // Setup event listeners
        this.setupEventListeners();

        // Initialize AdSense
        this.adsenseManager.init();

        // Load model in background
        this.loadModel();

        console.log('App initialized successfully');
    }

    setupEventListeners() {
        // File upload handlers
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });

        document.getElementById('vectorDataInput').addEventListener('change', (e) => {
            this.handleVectorDataUpload(e.target.files[0]);

        });

        // Processing buttons
        document.getElementById('processBtn').addEventListener('click', () => {
            this.processDocuments();
        });

        document.getElementById('downloadVectorBtn').addEventListener('click', () => {
            this.downloadVectorizedData();
        });

        // Search functionality
        document.getElementById('searchBtn').addEventListener('click', () => {
            this.performSearch();
        });

        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        // Search method change
        document.getElementById('searchMethod').addEventListener('change', (e) => {
            this.handleSearchMethodChange(e.target.value);
        });

        // Context options toggle
        document.getElementById('showContext').addEventListener('change', (e) => {
            document.getElementById('contextOptions').style.display =
                e.target.checked ? 'block' : 'none';
        });

        // AI features
        document.getElementById('enableAI').addEventListener('change', (e) => {
            const aiMode = document.getElementById('aiMode');
            const generateBtn = document.getElementById('generateAI');
            aiMode.disabled = !e.target.checked;
            generateBtn.disabled = !e.target.checked;
        });

        document.getElementById('generateAI').addEventListener('click', () => {
            this.generateAIInsights();
        });

        // Export handlers
        document.getElementById('exportTxt').addEventListener('click', () => {
            this.exportManager.exportAsTxt(this.currentResults);
            this.adsenseManager.refreshAds(); // Refresh ads on user interaction
        });

        document.getElementById('exportPdf').addEventListener('click', () => {
            this.exportManager.exportAsPdf(this.currentResults);
            this.adsenseManager.refreshAds();
        });

        document.getElementById('exportJson').addEventListener('click', () => {
            this.exportManager.exportAsJson(this.currentResults);
            this.adsenseManager.refreshAds();
        });
    }

    async loadModel() {
        try {
            const modal = new bootstrap.Modal(document.getElementById('loadingModal'));
            modal.show();

            const startTime = Date.now();
            this.updateLoadingProgress('Downloading model...', 0);

            // Simulate progressive loading with realistic timing
            const progressInterval = setInterval(() => {
                const elapsed = (Date.now() - startTime) / 1000;
                let progress = Math.min((elapsed / 30) * 100, 90); // 30 seconds estimated

                let message = 'Downloading model...';
                if (progress > 30) message = 'Initializing embeddings...';
                if (progress > 60) message = 'Setting up search engine...';
                if (progress > 80) message = 'Finalizing setup...';

                this.updateLoadingProgress(message, progress);
            }, 500);

            // Load the actual model
            await this.searchEngine.loadModel();

            clearInterval(progressInterval);
            this.updateLoadingProgress('Ready!', 100);

            setTimeout(() => {
                modal.hide();
                this.isModelLoaded = true;
                this.updateModelStatus('Model loaded - Ready to search');
                console.log('Model loaded successfully');
            }, 1000);

        } catch (error) {
            console.error('Failed to load model:', error);
            this.updateModelStatus('Error loading model');
            document.querySelector('#loadingModal .modal-body').innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-exclamation-triangle text-warning fa-3x mb-3"></i>
                    <h6>Failed to Load Model</h6>
                    <p class="text-muted">Please refresh the page to try again</p>
                </div>
            `;
        }
    }

    updateLoadingProgress(message, progress) {
        document.getElementById('loadingMessage').textContent = message;
        const timeRemaining = Math.max(0, (30 - (progress / 100 * 30))).toFixed(0);
        document.getElementById('loadingTime').textContent =
            progress < 100 ? `Estimated time remaining: ${timeRemaining}s` : '';
    }

    updateModelStatus(status) {
        document.getElementById('modelStatus').textContent = status;
    }

    async handleFileUpload(files) {
        if (!files || files.length === 0) return;

        console.log(`Processing ${files.length} files...`);
        const fileList = Array.from(files);

        // Show progress
        this.showProgress();
        this.updateProgress(0, 'Preparing files...');

        try {
            const documents = [];
            for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i];
                this.updateProgress(
                    (i / fileList.length) * 50,
                    `Reading ${file.name}...`
                );

                const content = await this.documentProcessor.processFile(file);
                if (content) {
                    documents.push({
                        name: file.name,
                        content: content,
                        type: file.type,
                        size: file.size
                    });
                }
            }

            // Store for processing
            this.pendingDocuments = documents;
            this.updateProgress(50, `Loaded ${documents.length} documents`);

            // Enable process button
            document.getElementById('processBtn').disabled = false;

            setTimeout(() => this.hideProgress(), 2000);

        } catch (error) {
            console.error('File upload error:', error);
            this.updateProgress(0, 'Error processing files');
            setTimeout(() => this.hideProgress(), 3000);
        }
    }

    async processDocuments() {
        if (!this.isModelLoaded) {
            alert('Please wait for the model to load before processing documents.');
            return;
        }

        if (!this.pendingDocuments || this.pendingDocuments.length === 0) {
            alert('Please upload documents first.');
            return;
        }

        this.showProgress();
        this.updateProgress(0, 'Starting vectorization...');

        try {
            const totalDocs = this.pendingDocuments.length;
            const vectorizedData = {
                datasets: [],
                metadata: {
                    processedAt: new Date().toISOString(),
                    totalDocuments: totalDocs,
                    version: '1.0'
                }
            };

            for (let i = 0; i < this.pendingDocuments.length; i++) {
                const doc = this.pendingDocuments[i];
                const progress = ((i + 1) / totalDocs) * 100;

                this.updateProgress(
                    progress,
                    `Vectorizing ${doc.name}... (${i + 1}/${totalDocs})`
                );

                // Process document into chunks and vectors
                const processedDoc = await this.searchEngine.vectorizeDocument(doc);
                vectorizedData.datasets.push(processedDoc);

                // Add to active datasets
                this.datasets.set(doc.name, processedDoc);
            }

            // Update UI
            this.updateDatasetList();
            document.getElementById('downloadVectorBtn').disabled = false;

            this.updateProgress(100, 'Vectorization complete!');

            // Store vectorized data for download
            this.vectorizedData = vectorizedData;

            setTimeout(() => this.hideProgress(), 2000);

        } catch (error) {
            console.error('Processing error:', error);
            this.updateProgress(0, 'Error during processing');
            setTimeout(() => this.hideProgress(), 3000);
        }
    }

    async handleVectorDataUpload(file) {
        if (!file) return;

        try {
            const content = await file.text();
            const data = JSON.parse(content);

            // Enhanced validation
            if (data.datasets && Array.isArray(data.datasets)) {
                let validDatasets = 0;

                data.datasets.forEach(dataset => {
                    // ADD VALIDATION FOR EMBEDDINGS
                    let validChunks = 0;

                    if (dataset.chunks && Array.isArray(dataset.chunks)) {
                        dataset.chunks.forEach((chunk, index) => {
                            if (chunk.embedding && Array.isArray(chunk.embedding) && chunk.embedding.length > 0) {
                                validChunks++;
                            } else {
                                console.warn(`Invalid embedding in dataset ${dataset.name}, chunk ${index}`);
                            }
                        });
                    }

                    if (validChunks > 0) {
                        this.datasets.set(dataset.name, dataset);
                        validDatasets++;
                        console.log(`Loaded dataset ${dataset.name} with ${validChunks} valid chunks`);
                    }
                });

                this.updateDatasetList();
                console.log(`Successfully loaded ${validDatasets} vectorized datasets`);
            } else {
                throw new Error('Invalid vectorized data format');
            }

        } catch (error) {
            console.error('Vectorized data upload error:', error);
            alert('Error loading vectorized data. Please check the file format and ensure embeddings are valid.');
        }
    }


    downloadVectorizedData() {
        if (!this.vectorizedData) {
            alert('No vectorized data available for download.');
            return;
        }

        const blob = new Blob([JSON.stringify(this.vectorizedData, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vectorized_data_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Refresh ads on user interaction
        this.adsenseManager.refreshAds();
    }

    updateDatasetList() {
        const container = document.getElementById('datasetList');

        if (this.datasets.size === 0) {
            container.innerHTML = '<div class="text-muted">No datasets loaded</div>';
            return;
        }

        let html = '';
        this.datasets.forEach((dataset, name) => {
            const id = `dataset-${name.replace(/[^a-zA-Z0-9]/g, '-')}`;
            html += `
                <div class="dataset-item">
                    <div class="form-check">
                        <input class="form-check-input dataset-checkbox" type="checkbox" 
                               id="${id}" checked data-dataset="${name}">
                        <label class="form-check-label" for="${id}">
                            <div class="dataset-name">${name}</div>
                            <div class="dataset-meta">
                                ${dataset.chunks?.length || 0} chunks • 
                                ${(dataset.size / 1024).toFixed(1)} KB
                            </div>
                        </label>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    async performSearch() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) {
            alert('Please enter a search query.');
            return;
        }

        if (!this.isModelLoaded) {
            alert('Please wait for the model to load.');
            return;
        }

        const activeDatasets = this.getActiveDatasets();
        if (activeDatasets.length === 0) {
            alert('Please select at least one dataset to search.');
            return;
        }

        // Show loading state
        const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary mb-3"></div>
                <p>Searching through your documents...</p>
            </div>
        `;

        try {
            const searchMethod = document.getElementById('searchMethod').value;
            const options = this.getSearchOptions();

            // ADD VALIDATION
            console.log(`Performing ${searchMethod} search for: "${query}"`);
            console.log(`Active datasets: ${activeDatasets.length}`);

            const results = await this.searchEngine.search(
                query,
                activeDatasets,
                searchMethod,
                options
            );

            this.currentResults = results;
            this.displayResults(results, query, searchMethod);

            // Refresh ads after search
            this.adsenseManager.refreshAds();

        } catch (error) {
            console.error('Search error:', error);

            // ADD MORE DETAILED ERROR HANDLING
            let errorMessage = 'An error occurred during search. ';
            if (error.message.includes('Vectors must have same length')) {
                errorMessage += 'There seems to be an issue with the document embeddings. Please try reprocessing your documents.';
            } else if (error.message.includes('Model not loaded')) {
                errorMessage += 'Please wait for the model to finish loading.';
            } else {
                errorMessage += 'Please try again or contact support if the problem persists.';
            }

            resultsContainer.innerHTML = `
        <div class="text-center py-5 text-danger">
            <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
            <p>${errorMessage}</p>
            <small class="text-muted">Error details: ${error.message}</small>
        </div>
    `;
        }

    }

    getActiveDatasets() {
        const checkboxes = document.querySelectorAll('.dataset-checkbox:checked');
        return Array.from(checkboxes).map(cb => {
            const datasetName = cb.dataset.dataset;
            return this.datasets.get(datasetName);
        }).filter(Boolean);
    }

    getSearchOptions() {
        return {
            deduplicate: document.getElementById('deduplicateResults').checked,
            showContext: document.getElementById('showContext').checked,
            prefixSentences: parseInt(document.getElementById('prefixSentences').value) || 1,
            suffixSentences: parseInt(document.getElementById('suffixSentences').value) || 1,
            wordLimit: parseInt(document.getElementById('wordLimit').value) || 50
        };
    }

    displayResults(results, query, method) {
        const container = document.getElementById('searchResults');

        if (!results || results.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="fas fa-search fa-3x mb-3"></i>
                    <p>No results found for "${query}"</p>
                    <small>Try adjusting your search terms or method</small>
                </div>
            `;
            return;
        }

        let html = `
            <div class="mb-3 d-flex justify-content-between align-items-center">
                <span class="text-muted">Found ${results.length} results</span>
                <span class="search-method-indicator method-${method}">${method}</span>
            </div>
        `;

        results.forEach((result, index) => {
            html += this.renderSearchResult(result, query, index);
        });

        container.innerHTML = html;
        container.scrollTop = 0;
    }

    renderSearchResult(result, query, index) {
        const score = (result.score * 100).toFixed(1);
        const highlightedContent = this.highlightKeywords(result.content, query);

        let contextHtml = '';
        if (result.context && result.context.prefix) {
            contextHtml += `
                <div class="context-section">
                    <div class="context-label">Context (Before)</div>
                    ${result.context.prefix}
                </div>
            `;
        }

        if (result.context && result.context.suffix) {
            contextHtml += `
                <div class="context-section">
                    <div class="context-label">Context (After)</div>
                    ${result.context.suffix}
                </div>
            `;
        }

        return `
            <div class="search-result-item fade-in" style="animation-delay: ${index * 0.1}s">
                <div class="search-result-header">
                    <div>
                        <strong>${result.source}</strong>
                        ${result.chapter ? `<span class="text-muted">• ${result.chapter}</span>` : ''}
                    </div>
                    <div class="similarity-score">${score}% match</div>
                </div>
                <div class="search-result-content">
                    ${highlightedContent}
                </div>
                ${contextHtml}
                ${result.metadata ? `
                    <div class="mt-2">
                        <small class="text-muted">
                            Page ${result.metadata.page || 'N/A'} • 
                            Position ${result.metadata.position || 'N/A'}
                        </small>
                    </div>
                ` : ''}
            </div>
        `;
    }

    highlightKeywords(content, query) {
        const keywords = query.toLowerCase().split(/\s+/);
        let highlighted = content;

        keywords.forEach(keyword => {
            if (keyword.length > 2) { // Only highlight meaningful words
                const regex = new RegExp(`(${keyword})`, 'gi');
                highlighted = highlighted.replace(regex, '<span class="highlighted">$1</span>');
            }
        });

        return highlighted;
    }

    handleSearchMethodChange(method) {
        // Update UI based on search method
        const methodDescriptions = {
            semantic: 'Find documents with similar meaning and context',
            keyword: 'Search for exact keyword matches',
            topic: 'Search within specific topics or chapters',
            contextual: 'Context-aware search with conversation memory',
            research: 'Advanced academic and research-oriented search'
        };

        // Update search input placeholder
        const searchInput = document.getElementById('searchInput');
        searchInput.placeholder = methodDescriptions[method] || 'Enter your search query...';
    }

    async generateAIInsights() {
        if (this.currentResults.length === 0) {
            alert('Please perform a search first to generate AI insights.');
            return;
        }

        const aiMode = document.getElementById('aiMode').value;
        const resultsContainer = document.getElementById('aiResults');
        const contentContainer = document.getElementById('aiContent');

        resultsContainer.style.display = 'block';
        contentContainer.innerHTML = `
            <div class="text-center py-3">
                <div class="spinner-border spinner-border-sm text-primary mb-2"></div>
                <div>Generating insights...</div>
            </div>
        `;

        try {
            // Simulate AI processing (replace with actual AI service call)
            await new Promise(resolve => setTimeout(resolve, 2000));

            const insights = this.generateMockInsights(aiMode, this.currentResults);
            contentContainer.innerHTML = insights;

            // Refresh ads after AI generation
            this.adsenseManager.refreshAds();

        } catch (error) {
            console.error('AI generation error:', error);
            contentContainer.innerHTML = `
                <div class="text-danger">
                    <i class="fas fa-exclamation-triangle mb-2"></i>
                    <p>Error generating AI insights. Please try again.</p>
                </div>
            `;
        }
    }

    generateMockInsights(mode, results) {
        // Mock AI-generated content (replace with actual AI service)
        const templates = {
            summary: `<h6>Summary</h6>
                     <p>Based on your search results, the main themes include...</p>
                     <ul>
                        <li>Key concept analysis</li>
                        <li>Important relationships identified</li>
                        <li>Relevant conclusions drawn</li>
                     </ul>`,
            qa: `<h6>Generated Q&A</h6>
                 <div class="mb-3">
                    <strong>Q: What are the main points?</strong><br>
                    A: The search results highlight several key concepts...
                 </div>`,
            explanation: `<h6>Concept Explanation</h6>
                         <p>The concepts found in your search relate to...</p>
                         <p>This is significant because...</p>`,
            insights: `<h6>Research Insights</h6>
                      <p>Key research implications:</p>
                      <ul>
                        <li>Methodological considerations</li>
                        <li>Future research directions</li>
                        <li>Practical applications</li>
                      </ul>`
        };

        return templates[mode] || templates.summary;
    }

    showProgress() {
        document.getElementById('progressCard').style.display = 'block';
    }

    hideProgress() {
        document.getElementById('progressCard').style.display = 'none';
    }

    updateProgress(percent, text) {
        document.getElementById('progressBar').style.width = `${percent}%`;
        document.getElementById('progressText').textContent = text;

        if (percent > 0) {
            const timeElapsed = (Date.now() - (this.progressStartTime || Date.now())) / 1000;
            const estimatedTotal = (timeElapsed / percent) * 100;
            const timeRemaining = Math.max(0, estimatedTotal - timeElapsed);

            document.getElementById('timeEstimate').textContent =
                timeRemaining > 0 ? `Estimated ${timeRemaining.toFixed(0)}s remaining` : '';
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DocumentSearchApp();
});

// Global error handling
window.addEventListener('unhandledrejection', event => {
    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault();
});
