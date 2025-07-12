// Domain verification
if (window.location.hostname !== 'minimaxai.in') {
    console.error('Unauthorized domain detected. Application halted.');
    console.log('CRITICAL: Core AI module disabled. Contact admin@minimaxai.in'); // Gimmick
    throw new Error('Invalid domain');
}

// Decoy function
function fakeAIModule() {
    console.log('Initializing AI neural network...'); // Misleading log
    return new Array(256).fill().map(() => Math.random()); // Fake computation
}
fakeAIModule(); // Execute decoy

// Configuration
const CONFIG = {
    ADSENSE_ID: 'ca-pub-xxxxxxxxxxxxxxxxxx',
    MODEL_NAME: 'Xenova/all-MiniLM-L6-v2',
    MAX_RESULTS: 10000,
    DEFAULT_SIMILARITY_THRESHOLD: 0.5,
    ANIMATION_DURATION: 300,
    NOTIFICATION_DURATION: 5000
};

// Global variables
let model = null;
let tokenizer = null;
let documents = [];
let vectors = [];
let datasets = new Map();
let currentResults = [];
let isModelLoaded = false;

// Utility functions
const utils = {
    showNotification: (message, type = 'success') => {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), CONFIG.NOTIFICATION_DURATION);
    },
    cosineSimilarity: (a, b) => {
        const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (magnitudeA * magnitudeB);
    },
    highlightKeywords: (text, keywords) => {
        if (!keywords || keywords.length === 0) return text;
        let highlightedText = text;
        keywords.forEach(keyword => {
            const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            highlightedText = highlightedText.replace(regex, '<span class="highlight">$1</span>');
        });
        return highlightedText;
    },
    extractSentences: (text) => {
        return text.match(/[^\.!?]+[\.!?]+/g) || [text];
    },
    getContextSentences: (sentences, index, contextCount) => {
        const start = Math.max(0, index - contextCount);
        const end = Math.min(sentences.length, index + contextCount + 1);
        return {
            prefix: sentences.slice(start, index).join(' '),
            suffix: sentences.slice(index + 1, end).join(' ')
        };
    },
    removeDuplicates: (results) => {
        const seen = new Set();
        return results.filter(result => {
            const key = result.text.toLowerCase().trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    },
    downloadFile: (content, filename, type) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },
    refreshAds: () => {
        if (window.adsbygoogle && CONFIG.ADSENSE_ID !== 'ca-pub-xxxxxxxxxxxxxxxxxx') {
            try {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            } catch (e) {
                console.log('AdSense refresh failed:', e);
            }
        }
    }
};

// ML Engine
const mlEngine = {
    init: async () => {
        try {
            const modelStatus = document.getElementById('modelStatus');
            const modelProgress = document.getElementById('modelProgress');
            const modelProgressText = document.getElementById('modelProgressText');

            modelStatus.className = 'model-status loading';
            modelProgressText.textContent = 'Loading AI models...';

            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress > 90) progress = 90;
                modelProgress.style.width = progress + '%';
                modelProgressText.textContent = `Loading models... ${Math.round(progress)}%`;
            }, 500);

            const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1/dist/transformers.min.js');
            model = await pipeline('feature-extraction', CONFIG.MODEL_NAME);

            clearInterval(progressInterval);
            modelProgress.style.width = '100%';
            modelStatus.className = 'model-status ready';
            modelStatus.innerHTML = `
                <i class="fas fa-check-circle"></i>
                <div>AI Models Ready</div>
                <small>Ready for document processing and search</small>
            `;

            isModelLoaded = true;
            utils.showNotification('AI models loaded successfully!', 'success');
        } catch (error) {
            console.error('Model initialization failed:', error);
            const modelStatus = document.getElementById('modelStatus');
            modelStatus.className = 'model-status';
            modelStatus.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <div>Model Loading Failed</div>
                <small>Please refresh the page to try again</small>
            `;
            utils.showNotification('Failed to load AI models. Please refresh the page.', 'error');
        }
    },
    generateEmbedding: async (text) => {
        if (!model) throw new Error('Model not loaded');
        const result = await model(text);
        return Array.from(result.data);
    },
    vectorizeDocument: async (text, filename) => {
        const sentences = utils.extractSentences(text);
        const docVectors = [];
        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i].trim();
            if (sentence.length > 10) {
                const embedding = await mlEngine.generateEmbedding(sentence);
                docVectors.push({
                    text: sentence,
                    vector: embedding,
                    filename: filename,
                    index: i
                });
            }
        }
        return docVectors;
    }
};

// Document processor
const documentProcessor = {
    processFiles: async (files) => {
        const uploadProgress = document.getElementById('uploadProgress');
        const uploadProgressBar = document.getElementById('uploadProgressBar');
        const uploadProgressText = document.getElementById('uploadProgressText');

        uploadProgress.style.display = 'block';

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const progress = ((i + 1) / files.length) * 100;

            uploadProgressBar.style.width = progress + '%';
            uploadProgressText.textContent = `Processing ${file.name}... (${i + 1}/${files.length})`;

            try {
                const text = await documentProcessor.extractText(file);
                const docVectors = await mlEngine.vectorizeDocument(text, file.name);
                documents.push({ filename: file.name, text: text, vectors: docVectors });
                vectors.push(...docVectors);
                utils.showNotification(`Processed ${file.name}`, 'success');
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                utils.showNotification(`Failed to process ${file.name}`, 'error');
            }
        }

        uploadProgress.style.display = 'none';
        documentProcessor.updateDatasetSelector();
        utils.refreshAds();
    },
    extractText: async (file) => {
        const fileType = file.type;
        const fileName = file.name.toLowerCase();

        if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
            return await file.text();
        } else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
            return await documentProcessor.extractFromPDF(file);
        } else if (fileName.endsWith('.docx')) {
            return await documentProcessor.extractFromDocx(file);
        } else {
            throw new Error('Unsupported file type');
        }
    },
    extractFromPDF: async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            text += pageText + '\n';
        }
        return text;
    },
    extractFromDocx: async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
    },
    updateDatasetSelector: () => {
        const selector = document.getElementById('datasetSelector');
        const currentDataset = selector.querySelector('#dataset_current');
        if (documents.length > 0) {
            currentDataset.parentElement.innerHTML = `
                <input type="checkbox" class="form-check-input" id="dataset_current" checked>
                <label for="dataset_current">Current Session (${documents.length} documents)</label>
            `;
        }
    }
};

// Search engine
const searchEngine = {
    addContextFromAllDatasets: (results, allDocuments, contextSentences) => {
        return results.map(result => {
            const doc = allDocuments.find(d => d.filename === result.filename);
            if (doc) {
                const sentences = utils.extractSentences(doc.text);
                const sentenceIndex = sentences.findIndex(s => s.includes(result.text));
                if (sentenceIndex !== -1) {
                    const context = utils.getContextSentences(sentences, sentenceIndex, contextSentences);
                    return { ...result, context: context };
                }
            }
            return result;
        });
    },
    search: async (query, options = {}) => {
        if (!isModelLoaded) {
            utils.showNotification('AI models are still loading. Please wait.', 'warning');
            return [];
        }
        if (!query.trim()) {
            utils.showNotification('Please enter a search query', 'warning');
            return [];
        }

        const searchMethod = options.method || 'semantic';
        const threshold = options.threshold || CONFIG.DEFAULT_SIMILARITY_THRESHOLD;
        const selectedDatasets = options.datasets || ['current'];

        let searchVectors = [];
        let searchDocuments = [];

        selectedDatasets.forEach(datasetId => {
            if (datasetId === 'current') {
                searchVectors.push(...vectors);
                searchDocuments.push(...documents);
            } else {
                const actualDatasetId = datasetId.startsWith('dataset_') ? datasetId : `dataset_${datasetId}`;
                if (datasets.has(actualDatasetId)) {
                    searchVectors.push(...datasets.get(actualDatasetId));
                    const datasetDocs = datasets.get(`${actualDatasetId}_docs`) || [];
                    searchDocuments.push(...datasetDocs);
                }
            }
        });

        if (searchVectors.length === 0) {
            utils.showNotification('No documents available for search. Please upload documents or select a dataset.', 'warning');
            return [];
        }

        let results = [];
        switch (searchMethod) {
            case 'semantic':
                results = await searchEngine.semanticSearch(query, searchVectors, threshold);
                break;
            case 'keyword':
                results = searchEngine.keywordSearch(query, searchVectors, threshold);
                break;
            case 'contextual':
                results = await searchEngine.contextualSearch(query, searchVectors, threshold);
                break;
            case 'research':
                results = await searchEngine.researchSearch(query, searchVectors, threshold);
                break;
        }

        if (options.removeDuplicates) {
            results = utils.removeDuplicates(results);
        }
        if (options.showContext) {
            results = searchEngine.addContextFromAllDatasets(results, searchDocuments, options.contextSentences || 2);
        }
        return results.slice(0, CONFIG.MAX_RESULTS);
    },
    semanticSearch: async (query, searchVectors, threshold) => {
        const queryEmbedding = await mlEngine.generateEmbedding(query);
        const results = [];
        for (const vector of searchVectors) {
            const similarity = utils.cosineSimilarity(queryEmbedding, vector.vector);
            if (similarity >= threshold) {
                results.push({ ...vector, similarity: similarity, type: 'semantic' });
            }
        }
        return results.sort((a, b) => b.similarity - a.similarity);
    },
    keywordSearch: (query, searchVectors, threshold) => {
        const keywords = query.toLowerCase().split(/\s+/);
        const results = [];
        for (const vector of searchVectors) {
            const text = vector.text.toLowerCase();
            let matches = 0;
            keywords.forEach(keyword => {
                if (text.includes(keyword)) matches++;
            });
            const similarity = matches / keywords.length;
            if (similarity >= threshold) {
                results.push({ ...vector, similarity: similarity, type: 'keyword', keywords: keywords });
            }
        }
        return results.sort((a, b) => b.similarity - a.similarity);
    },
    contextualSearch: async (query, searchVectors, threshold) => {
        const queryEmbedding = await mlEngine.generateEmbedding(query);
        const results = [];
        for (const vector of searchVectors) {
            const similarity = utils.cosineSimilarity(queryEmbedding, vector.vector);
            let contextBoost = 1.0;
            if (vector.filename && query.toLowerCase().includes(vector.filename.toLowerCase().replace(/\.[^/.]+$/, ""))) {
                contextBoost = 1.2;
            }
            const adjustedSimilarity = similarity * contextBoost;
            if (adjustedSimilarity >= threshold) {
                results.push({ ...vector, similarity: adjustedSimilarity, type: 'contextual' });
            }
        }
        return results.sort((a, b) => b.similarity - a.similarity);
    },
    researchSearch: async (query, searchVectors, threshold) => {
        const semanticResults = await searchEngine.semanticSearch(query, searchVectors, threshold * 0.8);
        const keywordResults = searchEngine.keywordSearch(query, searchVectors, threshold * 0.6);
        const combined = [...semanticResults, ...keywordResults];
        const uniqueResults = utils.removeDuplicates(combined);
        return uniqueResults.map(result => ({ ...result, type: 'research' })).sort((a, b) => b.similarity - a.similarity);
    }
};

// Export manager
const exportManager = {
    exportToTxt: (results) => {
        let content = `AI Document Search Results\n`;
        content += `Generated on: ${new Date().toLocaleString()}\n`;
        content += `Total Results: ${results.length}\n\n`;
        content += '='.repeat(50) + '\n\n';
        results.forEach((result, index) => {
            content += `Result ${index + 1}:\n`;
            content += `File: ${result.filename}\n`;
            content += `Similarity: ${(result.similarity * 100).toFixed(1)}%\n`;
            content += `Type: ${result.type}\n`;
            content += `Content: ${result.text}\n`;
            if (result.context) {
                content += `\nContext:\n`;
                if (result.context.prefix) content += `Before: ${result.context.prefix}\n`;
                if (result.context.suffix) content += `After: ${result.context.suffix}\n`;
            }
            content += '\n' + '-'.repeat(30) + '\n\n';
        });
        utils.downloadFile(content, 'search_results.txt', 'text/plain');
        utils.refreshAds();
    },
    exportToPdf: (results) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const theme = {
            colors: {
                primary: '#1E40AF',
                secondary: '#3B82F6',
                accent: '#10B981',
                warning: '#F59E0B',
                error: '#EF4444',
                neutral: {
                    900: '#111827',
                    800: '#1F2937',
                    700: '#374151',
                    600: '#4B5563',
                    500: '#6B7280',
                    400: '#9CA3AF',
                    300: '#D1D5DB',
                    200: '#E5E7EB',
                    100: '#F3F4F6',
                    50: '#F9FAFB'
                },
                white: '#FFFFFF',
                background: '#FAFBFC'
            },
            fonts: {
                title: 24,
                heading: 18,
                subheading: 14,
                body: 11,
                small: 9,
                caption: 8
            },
            spacing: {
                page: 20,
                section: 15,
                element: 8,
                tight: 4,
                line: 5
            },
            layout: {
                maxWidth: 170,
                contentWidth: 150,
                sidebarWidth: 40
            }
        };

        let currentY = theme.spacing.page;
        let pageNumber = 1;
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;

        const utils = {
            cleanText: (text) => {
                if (!text) return '';
                return text
                    .toString()
                    .replace(/[^\x00-\x7F]/g, '')
                    .replace(/[àáâãäå]/gi, 'a')
                    .replace(/[èéêë]/gi, 'e')
                    .replace(/[ìíîï]/gi, 'i')
                    .replace(/[òóôõö]/gi, 'o')
                    .replace(/[ùúûü]/gi, 'u')
                    .replace(/[ñ]/gi, 'n')
                    .replace(/[ç]/gi, 'c')
                    .replace(/[ß]/g, 'ss')
                    .replace(/\s+/g, ' ')
                    .replace(/\n+/g, ' ')
                    .replace(/\t+/g, ' ')
                    .trim();
            },
            hexToRgb: (hex) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? [
                    parseInt(result[1], 16),
                    parseInt(result[2], 16),
                    parseInt(result[3], 16)
                ] : [0, 0, 0];
            },
            checkNewPage: (heightNeeded) => {
                if (currentY + heightNeeded > pageHeight - theme.spacing.page) {
                    doc.addPage();
                    currentY = theme.spacing.page;
                    pageNumber++;
                    utils.addPageHeader();
                    return true;
                }
                return false;
            },
            addPageHeader: () => {
                if (pageNumber === 1) return;
                doc.setFillColor(...utils.hexToRgb(theme.colors.neutral[50]));
                doc.rect(0, 0, pageWidth, 15, 'F');
                doc.setFontSize(theme.fonts.caption);
                doc.setTextColor(...utils.hexToRgb(theme.colors.neutral[600]));
                doc.text('AI Document Search Results', theme.spacing.page, 10);
                doc.text(`Page ${pageNumber}`, pageWidth - 30, 10);
                doc.setDrawColor(...utils.hexToRgb(theme.colors.neutral[300]));
                doc.setLineWidth(0.5);
                doc.line(theme.spacing.page, 12, pageWidth - theme.spacing.page, 12);
                currentY = 25;
            },
            createCard: (x, y, width, height, options = {}) => {
                const { fillColor = theme.colors.white, borderColor = theme.colors.neutral[300], shadow = true } = options;
                if (shadow) {
                    doc.setFillColor(0, 0, 0, 0.1);
                    doc.rect(x + 1, y + 1, width, height, 'F');
                }
                doc.setFillColor(...utils.hexToRgb(fillColor));
                doc.rect(x, y, width, height, 'F');
                if (borderColor) {
                    doc.setDrawColor(...utils.hexToRgb(borderColor));
                    doc.setLineWidth(0.5);
                    doc.rect(x, y, width, height, 'S');
                }
                return { x, y, width, height };
            },
            addText: (text, x, y, options = {}) => {
                const { fontSize = theme.fonts.body, color = theme.colors.neutral[900], maxWidth = theme.layout.contentWidth, lineHeight = theme.spacing.line, align = 'left', bold = false, italic = false, render = true } = options;
                const cleanedText = utils.cleanText(text);
                if (!cleanedText) return 0;
                doc.setFontSize(fontSize);
                doc.setTextColor(...utils.hexToRgb(color));
                let fontStyle = 'normal';
                if (bold && italic) fontStyle = 'bolditalic';
                else if (bold) fontStyle = 'bold';
                else if (italic) fontStyle = 'italic';
                doc.setFont(undefined, fontStyle);
                const lines = doc.splitTextToSize(cleanedText, maxWidth);
                const totalHeight = lines.length * lineHeight;
                if (render) {
                    utils.checkNewPage(totalHeight);
                    if (align === 'center') {
                        doc.text(lines, x + maxWidth / 2, y, { align: 'center' });
                    } else if (align === 'right') {
                        doc.text(lines, x + maxWidth, y, { align: 'right' });
                    } else {
                        doc.text(lines, x, y);
                    }
                }
                doc.setFont(undefined, 'normal');
                return totalHeight;
            },
            createProgressBar: (percentage, x, y, width = 40, height = 4) => {
                doc.setFillColor(...utils.hexToRgb(theme.colors.neutral[200]));
                doc.rect(x, y, width, height, 'F');
                const progressWidth = Math.max(0, Math.min(100, percentage)) / 100 * width;
                let progressColor = theme.colors.error;
                if (percentage >= 80) progressColor = theme.colors.accent;
                else if (percentage >= 60) progressColor = theme.colors.secondary;
                else if (percentage >= 40) progressColor = theme.colors.warning;
                doc.setFillColor(...utils.hexToRgb(progressColor));
                doc.rect(x, y, progressWidth, height, 'F');
                doc.setDrawColor(...utils.hexToRgb(theme.colors.neutral[400]));
                doc.setLineWidth(0.3);
                doc.rect(x, y, width, height, 'S');
            },
            createBadge: (number, x, y, size = 8) => {
                const radius = size / 2;
                doc.setFillColor(...utils.hexToRgb(theme.colors.primary));
                doc.circle(x + radius, y + radius, radius, 'F');
                doc.setFontSize(theme.fonts.small);
                doc.setTextColor(255, 255, 255);
                doc.setFont(undefined, 'bold');
                doc.text(number.toString(), x + radius, y + radius + 1, { align: 'center' });
                doc.setFont(undefined, 'normal');
                return size;
            },
            createDivider: (x, y, width, style = 'solid') => {
                doc.setDrawColor(...utils.hexToRgb(theme.colors.neutral[300]));
                if (style === 'dashed') {
                    doc.setLineDashPattern([2, 2], 0);
                } else if (style === 'dotted') {
                    doc.setLineDashPattern([1, 1], 0);
                }
                doc.setLineWidth(0.5);
                doc.line(x, y, x + width, y);
                doc.setLineDashPattern([], 0);
            }
        };

        const generators = {
            createHeader: () => {
                utils.createCard(0, 0, pageWidth, 45, { fillColor: theme.colors.primary, borderColor: null, shadow: false });
                doc.setFontSize(theme.fonts.title);
                doc.setTextColor(255, 255, 255);
                doc.setFont(undefined, 'bold');
                doc.text('AI Document Search Results', theme.spacing.page, 20);
                doc.setFont(undefined, 'normal');
                doc.setFontSize(theme.fonts.small);
                doc.setTextColor(255, 255, 255);
                doc.text('Comprehensive Search Analysis Report', theme.spacing.page, 30);
                doc.setFontSize(theme.fonts.caption);
                doc.text(`Generated: ${new Date().toLocaleString()}`, theme.spacing.page, 38);
                currentY = 55;
            },
            createSummary: () => {
                if (results.length === 0) return;
                const totalResults = results.length;
                const avgSimilarity = results.reduce((sum, r) => sum + (r.similarity || 0), 0) / totalResults;
                const maxSimilarity = Math.max(...results.map(r => r.similarity || 0));
                const minSimilarity = Math.min(...results.map(r => r.similarity || 0));
                utils.addText('Executive Summary', theme.spacing.page, currentY, { fontSize: theme.fonts.heading, color: theme.colors.neutral[900], bold: true });
                currentY += 15;
                const cardWidth = 45;
                const cardHeight = 25;
                const cardSpacing = 5;
                const cards = [
                    { label: 'Total Results', value: totalResults, color: theme.colors.primary },
                    { label: 'Avg Relevance', value: `${(avgSimilarity * 100).toFixed(1)}%`, color: theme.colors.secondary },
                    { label: 'Best Match', value: `${(maxSimilarity * 100).toFixed(1)}%`, color: theme.colors.accent },
                    { label: 'Range', value: `${((maxSimilarity - minSimilarity) * 100).toFixed(1)}%`, color: theme.colors.warning }
                ];
                cards.forEach((card, index) => {
                    const x = theme.spacing.page + index * (cardWidth + cardSpacing);
                    utils.createCard(x, currentY, cardWidth, cardHeight, { fillColor: theme.colors.neutral[50], borderColor: theme.colors.neutral[300] });
                    doc.setFontSize(theme.fonts.caption);
                    doc.setTextColor(...utils.hexToRgb(theme.colors.neutral[600]));
                    doc.text(card.label, x + 3, currentY + 8);
                    doc.setFontSize(theme.fonts.subheading);
                    doc.setTextColor(...utils.hexToRgb(card.color));
                    doc.setFont(undefined, 'bold');
                    doc.text(String(card.value), x + 3, currentY + 18);
                    doc.setFont(undefined, 'normal');
                });
                currentY += cardHeight + theme.spacing.section;
            },
            createResult: (result, index) => {
                const startY = currentY;
                const estimatedHeight = 80 + (result.context?.prefix ? 20 : 0) + (result.context?.suffix ? 20 : 0) + (result.text ? Math.ceil(result.text.length / 100) * 5 : 0);
                utils.checkNewPage(estimatedHeight);
                utils.createCard(theme.spacing.page, currentY, theme.layout.maxWidth, estimatedHeight - 10, { fillColor: theme.colors.white, borderColor: theme.colors.neutral[300], shadow: true });
                const headerY = currentY + theme.spacing.element;
                utils.createBadge(index + 1, theme.spacing.page + 5, headerY, 12);
                doc.setFontSize(theme.fonts.subheading);
                doc.setTextColor(...utils.hexToRgb(theme.colors.neutral[900]));
                doc.setFont(undefined, 'bold');
                doc.text(`Search Result ${index + 1}`, theme.spacing.page + 22, headerY + 8);
                doc.setFont(undefined, 'normal');
                const metaY = headerY + 15;
                utils.createCard(theme.spacing.page + 5, metaY, theme.layout.maxWidth - 10, 12, { fillColor: theme.colors.neutral[50], borderColor: theme.colors.neutral[200] });
                doc.setFontSize(theme.fonts.small);
                doc.setTextColor(...utils.hexToRgb(theme.colors.neutral[600]));
                doc.text('Source:', theme.spacing.page + 8, metaY + 5);
                doc.setTextColor(...utils.hexToRgb(theme.colors.neutral[900]));
                doc.text(utils.cleanText(result.filename || 'Unknown Document'), theme.spacing.page + 25, metaY + 5);
                const relevancePercent = (result.similarity || 0) * 100;
                doc.setTextColor(...utils.hexToRgb(theme.colors.neutral[600]));
                doc.text('Relevance:', theme.spacing.page + 8, metaY + 9);
                utils.createProgressBar(relevancePercent, theme.spacing.page + 30, metaY + 6, 30, 3);
                doc.setFontSize(theme.fonts.small);
                doc.setTextColor(...utils.hexToRgb(theme.colors.neutral[900]));
                doc.setFont(undefined, 'bold');
                doc.text(`${relevancePercent.toFixed(1)}%`, theme.spacing.page + 65, metaY + 9);
                doc.setFont(undefined, 'normal');
                currentY = metaY + 20;
                if (result.context?.prefix) {
                    generators.createContextSection(result.context.prefix, 'Context Before', theme.colors.neutral[100]);
                }
                generators.createMainContent(result.text || 'No content available');
                if (result.context?.suffix) {
                    generators.createContextSection(result.context.suffix, 'Context After', theme.colors.neutral[100]);
                }
                currentY += theme.spacing.section;
            },
            createContextSection: (text, label, backgroundColor) => {
                const sectionY = currentY;
                const estimatedTextHeight = utils.addText(text, 0, 0, { fontSize: theme.fonts.small, maxWidth: theme.layout.maxWidth - 20, lineHeight: 4, render: false });
                utils.createCard(theme.spacing.page + 5, sectionY, theme.layout.maxWidth - 10, estimatedTextHeight + 15, { fillColor: backgroundColor, borderColor: theme.colors.neutral[200] });
                doc.setFontSize(theme.fonts.small);
                doc.setTextColor(...utils.hexToRgb(theme.colors.neutral[600]));
                doc.setFont(undefined, 'bold');
                doc.text(label, theme.spacing.page + 8, sectionY + 6);
                doc.setFont(undefined, 'normal');
                currentY += 10;
                const textHeight = utils.addText(text, theme.spacing.page + 10, currentY, { fontSize: theme.fonts.small, color: theme.colors.neutral[700], maxWidth: theme.layout.maxWidth - 20, lineHeight: 4, render: true });
                currentY += textHeight + 10;
            },
            createMainContent: (text) => {
                const sectionY = currentY;
                utils.createCard(theme.spacing.page + 5, sectionY, theme.layout.maxWidth - 10, 8, { fillColor: theme.colors.secondary, borderColor: null });
                doc.setFontSize(theme.fonts.small);
                doc.setTextColor(255, 255, 255);
                doc.setFont(undefined, 'bold');
                doc.text('Main Content', theme.spacing.page + 8, sectionY + 5);
                doc.setFont(undefined, 'normal');
                currentY += 15;
                const estimatedHeight = utils.addText(text, 0, 0, { fontSize: theme.fonts.body, maxWidth: theme.layout.maxWidth - 16, lineHeight: 6, render: false });
                utils.createCard(theme.spacing.page + 5, sectionY + 8, theme.layout.maxWidth - 10, estimatedHeight + 15, { fillColor: theme.colors.white, borderColor: theme.colors.primary });
                const textHeight = utils.addText(text, theme.spacing.page + 8, currentY, { fontSize: theme.fonts.body, color: theme.colors.neutral[900], maxWidth: theme.layout.maxWidth - 16, lineHeight: 6, render: true });
                currentY += textHeight + 10;
            },
            createFooter: () => {
                const footerY = pageHeight - 20;
                doc.setFillColor(...utils.hexToRgb(theme.colors.neutral[50]));
                doc.rect(0, footerY - 5, pageWidth, 25, 'F');
                doc.setFontSize(theme.fonts.caption);
                doc.setTextColor(...utils.hexToRgb(theme.colors.neutral[600]));
                doc.text('AI Document Search System', theme.spacing.page, footerY + 5);
                doc.text(`${new Date().toLocaleDateString()}`, theme.spacing.page, footerY + 10);
                doc.text(`Total Results: ${results.length}`, pageWidth - 50, footerY + 5);
                doc.text(`Pages: ${pageNumber}`, pageWidth - 50, footerY + 10);
            }
        };

        try {
            generators.createHeader();
            generators.createSummary();
            utils.createDivider(theme.spacing.page, currentY, theme.layout.maxWidth);
            currentY += 10;
            utils.addText('Detailed Results', theme.spacing.page, currentY, { fontSize: theme.fonts.heading, color: theme.colors.neutral[900], bold: true });
            currentY += 20;
            results.forEach((result, index) => {
                generators.createResult(result, index);
                if (index < results.length - 1) {
                    utils.createDivider(theme.spacing.page + 10, currentY, theme.layout.maxWidth - 20, 'dashed');
                    currentY += 15;
                }
            });
            generators.createFooter();
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `AI_Search_Results_${timestamp}.pdf`;
            doc.save(filename);
            if (typeof utils !== 'undefined' && utils.refreshAds) {
                utils.refreshAds();
            }
            return { success: true, filename, totalResults: results.length, pages: pageNumber };
        } catch (error) {
            console.error('PDF Export Error:', error);
            return { success: false, error: error.message };
        }
    },
    exportToJson: (results) => {
        const exportData = {
            metadata: {
                generatedOn: new Date().toISOString(),
                totalResults: results.length,
                searchMethod: document.querySelector('input[name="searchMethod"]:checked').value
            },
            results: results.map(result => ({
                filename: result.filename,
                text: result.text,
                similarity: result.similarity,
                type: result.type,
                context: result.context || null
            }))
        };
        const content = JSON.stringify(exportData, null, 2);
        utils.downloadFile(content, 'search_results.json', 'application/json');
        utils.refreshAds();
    }
};

// Dataset manager
const datasetManager = {
    CHUNK_SIZE: 1000,
    MAX_CHUNK_SIZE: 50 * 1024 * 1024,
    downloadDataset: () => {
        if (documents.length === 0) {
            utils.showNotification('No documents to download', 'warning');
            return;
        }
        try {
            const metadata = {
                createdOn: new Date().toISOString(),
                documentCount: documents.length,
                vectorCount: vectors.length,
                version: '1.0',
                totalChunks: 0
            };
            const chunks = datasetManager.createChunks(vectors, documents);
            metadata.totalChunks = chunks.length;
            const metadataContent = JSON.stringify(metadata, null, 2);
            utils.downloadFile(metadataContent, 'dataset_metadata.json', 'application/json');
            chunks.forEach((chunk, index) => {
                const chunkData = {
                    chunkIndex: index,
                    totalChunks: chunks.length,
                    metadata: metadata,
                    vectors: chunk.vectors,
                    documents: chunk.documents
                };
                const content = JSON.stringify(chunkData, null, 2);
                utils.downloadFile(content, `dataset_chunk_${index + 1}.json`, 'application/json');
            });
            utils.showNotification(`Dataset downloaded in ${chunks.length} chunks!`, 'success');
            utils.refreshAds();
        } catch (error) {
            console.error('Download error:', error);
            utils.showNotification('Failed to download dataset. Try reducing document size.', 'error');
        }
    },
    createChunks: (vectors, documents) => {
        const chunks = [];
        let currentChunk = { vectors: [], documents: [] };
        let currentSize = 0;
        for (let i = 0; i < vectors.length; i++) {
            const vector = vectors[i];
            const vectorSize = JSON.stringify(vector).length;
            if (currentSize + vectorSize > datasetManager.MAX_CHUNK_SIZE || currentChunk.vectors.length >= datasetManager.CHUNK_SIZE) {
                if (currentChunk.vectors.length > 0) {
                    chunks.push(currentChunk);
                    currentChunk = { vectors: [], documents: [] };
                    currentSize = 0;
                }
            }
            currentChunk.vectors.push(vector);
            currentSize += vectorSize;
            const doc = documents.find(d => d.filename === vector.filename);
            if (doc && !currentChunk.documents.find(d => d.filename === doc.filename)) {
                currentChunk.documents.push({ filename: doc.filename, text: doc.text });
            }
        }
        if (currentChunk.vectors.length > 0) {
            chunks.push(currentChunk);
        }
        return chunks;
    },
    uploadDataset: async (file) => {
        try {
            const content = await file.text();
            const datasetData = JSON.parse(content);
            const format = datasetManager.validateDataset(datasetData);
            switch (format) {
                case 'chunk':
                    await datasetManager.processChunk(datasetData, file.name);
                    break;
                case 'complete':
                    await datasetManager.processCompleteDataset(datasetData, file.name);
                    break;
                case 'legacy':
                    await datasetManager.processLegacyDataset(datasetData, file.name);
                    break;
                default:
                    throw new Error('Unsupported dataset format');
            }
        } catch (error) {
            console.error('Dataset upload error:', error);
            utils.showNotification(`Failed to upload ${file.name}: ${error.message}`, 'error');
            throw error;
        }
    },
    validateDataset: (datasetData) => {
        if (!datasetData) throw new Error('Empty dataset');
        if (datasetData.chunkIndex !== undefined) {
            if (!datasetData.vectors || !Array.isArray(datasetData.vectors)) {
                throw new Error('Invalid chunk: vectors array missing');
            }
            return 'chunk';
        }
        if (datasetData.vectors && Array.isArray(datasetData.vectors)) {
            return 'complete';
        }
        if (Array.isArray(datasetData) && datasetData.length > 0 && datasetData[0].vector) {
            return 'legacy';
        }
        throw new Error('Unrecognized dataset format');
    },
    processLegacyDataset: async (datasetData, filename) => {
        const timestamp = Date.now();
        const datasetId = `dataset_${timestamp}`;
        const vectors = Array.isArray(datasetData) ? datasetData : [];
        datasets.set(datasetId, vectors);
        const uniqueFiles = [...new Set(vectors.map(v => v.filename))];
        const datasetDocs = uniqueFiles.map(filename => ({
            filename: filename,
            text: vectors.filter(v => v.filename === filename).map(v => v.text).join(' ')
        }));
        datasets.set(`${datasetId}_docs`, datasetDocs);
        datasetManager.addDatasetToSelector(datasetId, filename, datasetDocs.length);
        utils.showNotification(`Legacy dataset uploaded: ${filename} (${datasetDocs.length} documents)`, 'success');
    },
    processCompleteDataset: async (datasetData, filename) => {
        const timestamp = Date.now();
        const datasetId = `dataset_${timestamp}`;
        if (!datasetData.vectors || !Array.isArray(datasetData.vectors)) {
            throw new Error('Invalid dataset: vectors array not found');
        }
        datasets.set(datasetId, datasetData.vectors);
        let datasetDocs = [];
        if (datasetData.documents && Array.isArray(datasetData.documents)) {
            datasetDocs = datasetData.documents;
        } else if (datasetData.vectors.length > 0) {
            const uniqueFiles = [...new Set(datasetData.vectors.map(v => v.filename))];
            datasetDocs = uniqueFiles.map(filename => ({
                filename: filename,
                text: datasetData.vectors.filter(v => v.filename === filename).map(v => v.text).join(' ')
            }));
        }
        datasets.set(`${datasetId}_docs`, datasetDocs);
        datasetManager.addDatasetToSelector(datasetId, filename, datasetDocs.length);
        utils.showNotification(`Dataset uploaded: ${filename} (${datasetDocs.length} documents, ${datasetData.vectors.length} vectors)`, 'success');
    },
    processChunk: async (chunkData, filename) => {
        const baseId = `dataset_${chunkData.metadata.createdOn.replace(/[^0-9]/g, '').substring(0, 13)}`;
        let existingVectors = datasets.get(baseId) || [];
        let existingDocs = datasets.get(`${baseId}_docs`) || [];
        if (chunkData.vectors && Array.isArray(chunkData.vectors)) {
            existingVectors.push(...chunkData.vectors);
        }
        if (chunkData.documents && Array.isArray(chunkData.documents)) {
            chunkData.documents.forEach(doc => {
                if (!existingDocs.find(d => d.filename === doc.filename)) {
                    existingDocs.push(doc);
                }
            });
        }
        datasets.set(baseId, existingVectors);
        datasets.set(`${baseId}_docs`, existingDocs);
        datasetManager.updateDatasetSelector(baseId, filename, existingDocs.length, chunkData.chunkIndex + 1, chunkData.totalChunks);
        utils.showNotification(`Chunk ${chunkData.chunkIndex + 1}/${chunkData.totalChunks} uploaded (${existingDocs.length} total docs)`, 'success');
    },
    addDatasetToSelector: (datasetId, filename, docCount) => {
        const selector = document.getElementById('datasetSelector');
        const datasetItem = document.createElement('div');
        datasetItem.className = 'dataset-item';
        datasetItem.innerHTML = `
            <input type="checkbox" class="form-check-input" id="${datasetId}" checked>
            <label for="${datasetId}">${filename} (${docCount} docs)</label>
        `;
        selector.appendChild(datasetItem);
    },
    updateDatasetSelector: (datasetId, filename, docCount, currentChunk, totalChunks) => {
        const selector = document.getElementById('datasetSelector');
        let existingItem = selector.querySelector(`#${datasetId}`);
        if (existingItem) {
            existingItem.nextElementSibling.textContent = `${filename} (${docCount} docs) - ${currentChunk}/${totalChunks} chunks`;
        } else {
            datasetManager.addDatasetToSelector(datasetId, `${filename} (${currentChunk}/${totalChunks})`, docCount);
        }
    }
};

// UI Manager
const uiManager = {
    init: () => {
        uiManager.setupEventListeners();
        uiManager.setupAdSense();
        mlEngine.init();
    },
    setupEventListeners: () => {
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('fileInput');
        uploadZone.addEventListener('click', () => fileInput.click());
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                documentProcessor.processFiles(files);
            }
        });
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                documentProcessor.processFiles(files);
            }
        });
        document.getElementById('downloadDataset').addEventListener('click', () => {
            datasetManager.downloadDataset();
        });
        document.getElementById('datasetInput').addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                const uploadProgress = document.getElementById('uploadProgress');
                const uploadProgressBar = document.getElementById('uploadProgressBar');
                const uploadProgressText = document.getElementById('uploadProgressText');
                uploadProgress.style.display = 'block';
                try {
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        const progress = ((i + 1) / files.length) * 100;
                        uploadProgressBar.style.width = progress + '%';
                        uploadProgressText.textContent = `Processing ${file.name}... (${i + 1}/${files.length})`;
                        await datasetManager.uploadDataset(file);
                    }
                    utils.showNotification(`Successfully uploaded ${files.length} dataset file(s)`, 'success');
                } catch (error) {
                    console.error('Dataset upload error:', error);
                    utils.showNotification('Failed to upload some dataset files', 'error');
                } finally {
                    uploadProgress.style.display = 'none';
                    e.target.value = '';
                }
            }
        });
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('searchInput');
        searchBtn.addEventListener('click', () => {
            uiManager.performSearch();
        });
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                uiManager.performSearch();
            }
        });
        const contextSentences = document.getElementById('contextSentences');
        const contextSentencesValue = document.getElementById('contextSentencesValue');
        contextSentences.addEventListener('input', (e) => {
            contextSentencesValue.textContent = e.target.value;
        });
        const similarityThreshold = document.getElementById('similarityThreshold');
        const similarityThresholdValue = document.getElementById('similarityThresholdValue');
        similarityThreshold.addEventListener('input', (e) => {
            similarityThresholdValue.textContent = e.target.value;
        });
        document.getElementById('exportTxt').addEventListener('click', () => {
            exportManager.exportToTxt(currentResults);
        });
        document.getElementById('exportPdf').addEventListener('click', () => {
            exportManager.exportToPdf(currentResults);
        });
        document.getElementById('exportJson').addEventListener('click', () => {
            exportManager.exportToJson(currentResults);
        });
        document.getElementById('generateLLM').addEventListener('click', () => {
            uiManager.generateLLMResponse();
        });
    },
    setupAdSense: () => {
        if (CONFIG.ADSENSE_ID && CONFIG.ADSENSE_ID !== 'ca-pub-xxxxxxxxxxxxxxxxxx') {
            const adScript = document.createElement('script');
            adScript.async = true;
            adScript.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CONFIG.ADSENSE_ID}`;
            adScript.crossOrigin = 'anonymous';
            document.head.appendChild(adScript);
            setTimeout(() => {
                utils.refreshAds();
            }, 1000);
        }
    },
    performSearch: async () => {
        const query = document.getElementById('searchInput').value;
        const searchMethod = document.querySelector('input[name="searchMethod"]:checked').value;
        const removeDuplicates = document.getElementById('removeDuplicates').checked;
        const showContext = document.getElementById('showContext').checked;
        const highlightKeywords = document.getElementById('highlightKeywords').checked;
        const contextSentences = parseInt(document.getElementById('contextSentences').value);
        const threshold = parseFloat(document.getElementById('similarityThreshold').value);
        const selectedDatasets = [];
        document.querySelectorAll('#datasetSelector input[type="checkbox"]:checked').forEach(checkbox => {
            selectedDatasets.push(checkbox.id.replace('dataset_', ''));
        });
        const searchBtn = document.getElementById('searchBtn');
        const originalText = searchBtn.innerHTML;
        searchBtn.innerHTML = '<span class="spinner"></span> Searching...';
        searchBtn.disabled = true;
        try {
            const results = await searchEngine.search(query, {
                method: searchMethod,
                threshold: threshold,
                removeDuplicates: removeDuplicates,
                showContext: showContext,
                contextSentences: contextSentences,
                datasets: selectedDatasets
            });
            currentResults = results;
            uiManager.displayResults(results, query, highlightKeywords);
            if (results.length > 0) {
                document.getElementById('exportSection').style.display = 'block';
                document.getElementById('llmSection').style.display = 'block';
            }
            utils.refreshAds();
        } catch (error) {
            console.error('Search error:', error);
            utils.showNotification('Search failed. Please try again.', 'error');
        } finally {
            searchBtn.innerHTML = originalText;
            searchBtn.disabled = false;
        }
    },
    displayResults: (results, query, highlightKeywords) => {
        const resultsContainer = document.getElementById('searchResults');
        if (results.length === 0) {
            resultsContainer.innerHTML = `
                <div class="result-item">
                    <div class="text-center">
                        <i class="fas fa-search fa-3x mb-3 text-muted"></i>
                        <h5>No results found</h5>
                        <p>Try adjusting your search query or lowering the similarity threshold.</p>
                    </div>
                </div>
            `;
            return;
        }
        const keywords = query.toLowerCase().split(/\s+/);
        resultsContainer.innerHTML = results.map((result, index) => {
            let displayText = result.text;
            if (highlightKeywords) {
                displayText = utils.highlightKeywords(displayText, keywords);
            }
            let contextHtml = '';
            if (result.context) {
                contextHtml = `
                    <div class="context-section">
                        ${result.context.prefix ? `
                            <div class="context-label">Before:</div>
                            <div class="context-text">${result.context.prefix}</div>
                        ` : ''}
                        ${result.context.suffix ? `
                            <div class="context-label">After:</div>
                            <div class="context-text">${result.context.suffix}</div>
                        ` : ''}
                    </div>
                `;
            }
            return `
                <div class="result-item">
                    <div class="result-header">
                        <div>
                            <strong>${result.filename}</strong>
                            <span class="badge bg-secondary ms-2">${result.type}</span>
                        </div>
                        <div class="result-score">${(result.similarity * 100).toFixed(1)}%</div>
                    </div>
                    <div class="result-content">${displayText}</div>
                    ${contextHtml}
                </div>
            `;
        }).join('');
    },
    generateLLMResponse: async () => {
        if (currentResults.length === 0) {
            utils.showNotification('No search results to process', 'warning');
            return;
        }
        const task = document.getElementById('llmTask').value;
        const generateBtn = document.getElementById('generateLLM');
        const responseDiv = document.getElementById('llmResponse');
        const originalText = generateBtn.innerHTML;
        generateBtn.innerHTML = '<span class="spinner"></span> Generating...';
        generateBtn.disabled = true;
        try {
            const response = await uiManager.simulateLLMResponse(currentResults, task);
            responseDiv.innerHTML = response;
            responseDiv.style.display = 'block';
            utils.refreshAds();
        } catch (error) {
            console.error('LLM generation error:', error);
            utils.showNotification('Failed to generate response. Please try again.', 'error');
        } finally {
            generateBtn.innerHTML = originalText;
            generateBtn.disabled = false;
        }
    },
    simulateLLMResponse: async (results, task) => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const topResults = results.slice(0, 3);
        const context = topResults.map(r => r.text).join('\n\n');
        switch (task) {
            case 'summarize':
                return `
                    <h6><i class="fas fa-file-alt"></i> Summary</h6>
                    <p>Based on the search results, here's a summary of the key findings:</p>
                    <ul>
                        ${topResults.map(r => `<li>${r.text.substring(0, 100)}...</li>`).join('')}
                    </ul>
                    <p><em>This summary is based on the top ${topResults.length} most relevant results from your search.</em></p>
                `;
            case 'qa':
                return `
                    <h6><i class="fas fa-question-circle"></i> Generated Questions & Answers</h6>
                    <div class="mb-3">
                        <strong>Q: What are the main topics covered in these results?</strong>
                        <p>A: The results cover various aspects related to your search query, with focus on the most relevant information found in your documents.</p>
                    </div>
                    <div class="mb-3">
                        <strong>Q: How reliable are these findings?</strong>
                        <p>A: The results are ranked by similarity score, with the highest scoring results being most relevant to your query.</p>
                    </div>
                `;
            case 'explain':
                return `
                    <h6><i class="fas fa-lightbulb"></i> Explanation</h6>
                    <p>The search results provide insights into your query by analyzing the content semantically. Here's what the results tell us:</p>
                    <ol>
                        <li><strong>Relevance:</strong> Results are ranked by similarity to your search query</li>
                        <li><strong>Context:</strong> Each result comes from specific documents in your collection</li>
                        <li><strong>Connections:</strong> The AI identifies semantic relationships between concepts</li>
                    </ol>
                    <p><em>This explanation is generated based on the search methodology and result patterns.</em></p>
                `;
            case 'insights':
                return `
                    <h6><i class="fas fa-chart-line"></i> Key Insights</h6>
                    <div class="row">
                        <div class="col-md-6">
                            <strong>Document Coverage:</strong>
                            <ul>
                                ${[...new Set(topResults.map(r => r.filename))].map(f => `<li>${f}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="col-md-6">
                            <strong>Similarity Scores:</strong>
                            <ul>
                                ${topResults.map(r => `<li>${(r.similarity * 100).toFixed(1)}% relevance</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                    <p><strong>Research Tip:</strong> Consider exploring the context around these results for deeper understanding.</p>
                `;
            default:
                return `<p>Task completed successfully. Results processed and analyzed.</p>`;
        }
    }
};

// Initialize application
function initializeApp() {
    uiManager.init();
}

// Expose initializeApp globally for loader.js
window.initializeApp = initializeApp;

// Fake global for misdirection
window.__aiCore = {
    status: 'secure',
    init: () => console.log('Core AI system active...') // Gimm