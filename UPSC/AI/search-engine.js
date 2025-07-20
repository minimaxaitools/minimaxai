/**
 * Advanced Search Engine with Multiple Search Methods
 * Handles vectorization, similarity calculations, and result processing
 */

class SearchEngine {
    constructor() {
        this.model = null;
        this.tokenizer = null;
        this.isLoaded = false;
        this.searchMethods = {
            semantic: this.semanticSearch.bind(this),
            keyword: this.keywordSearch.bind(this),
            topic: this.topicSearch.bind(this),
            contextual: this.contextualSearch.bind(this),
            research: this.researchSearch.bind(this)
        };
    }

    async loadModel() {
        try {
            // Load Transformers.js model for embeddings
            const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0/dist/transformers.min.js');

            this.model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            this.isLoaded = true;

            console.log('Search engine model loaded successfully');
        } catch (error) {
            console.error('Failed to load search model:', error);
            throw error;
        }
    }

    async vectorizeDocument(document) {
        if (!this.isLoaded) {
            throw new Error('Model not loaded');
        }

        // Split document into chunks
        const chunks = this.splitIntoChunks(document.content, 500);

        const vectorizedChunks = [];
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            try {
                // Generate embedding for chunk with validation
                const embedding = await this.generateEmbedding(chunk.text);

                // ADD THIS VALIDATION BLOCK
                if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
                    console.warn(`Invalid embedding for chunk ${i}, skipping`);
                    continue;
                }

                vectorizedChunks.push({
                    id: `${document.name}_chunk_${i}`,
                    text: chunk.text,
                    embedding: embedding,
                    position: chunk.position,
                    metadata: {
                        source: document.name,
                        chunkIndex: i,
                        startPos: chunk.startPos,
                        endPos: chunk.endPos,
                        embeddingLength: embedding.length, // ADD THIS LINE
                        ...this.extractMetadata(chunk.text)
                    }
                });
            } catch (error) {
                console.warn(`Failed to vectorize chunk ${i} from ${document.name}:`, error);
            }
        }

        return {
            name: document.name,
            type: document.type,
            size: document.size,
            chunks: vectorizedChunks,
            processedAt: new Date().toISOString(),
            totalChunks: vectorizedChunks.length
        };
    }


    splitIntoChunks(text, chunkSize = 500, overlap = 50) {
        const chunks = [];
        const sentences = this.splitIntoSentences(text);
        let currentChunk = '';
        let currentPosition = 0;
        let startPos = 0;

        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];

            if (currentChunk.length + sentence.length > chunkSize && currentChunk) {
                // Save current chunk
                chunks.push({
                    text: currentChunk.trim(),
                    position: currentPosition,
                    startPos: startPos,
                    endPos: startPos + currentChunk.length,
                    sentences: this.splitIntoSentences(currentChunk)
                });

                // Start new chunk with overlap
                const overlapText = this.getLastNCharacters(currentChunk, overlap);
                currentChunk = overlapText + sentence;
                startPos = startPos + currentChunk.length - overlapText.length;
                currentPosition++;
            } else {
                if (!currentChunk) startPos = text.indexOf(sentence);
                currentChunk += (currentChunk ? ' ' : '') + sentence;
            }
        }

        // Add final chunk
        if (currentChunk) {
            chunks.push({
                text: currentChunk.trim(),
                position: currentPosition,
                startPos: startPos,
                endPos: startPos + currentChunk.length,
                sentences: this.splitIntoSentences(currentChunk)
            });
        }

        return chunks;
    }

    splitIntoSentences(text) {
        // Improved sentence splitting
        return text.match(/[^\.!?]+[\.!?]+/g) || [text];
    }

    getLastNCharacters(text, n) {
        const words = text.split(' ');
        let result = '';
        for (let i = words.length - 1; i >= 0 && result.length < n; i--) {
            result = words[i] + ' ' + result;
        }
        return result.trim();
    }

    async generateEmbedding(text) {
        if (!this.model) throw new Error('Model not loaded');

        try {
            // Clean and validate text input
            const cleanText = text.trim();
            if (!cleanText) {
                console.warn('Empty text provided for embedding');
                return new Array(384).fill(0); // Return zero vector for MiniLM model
            }

            const result = await this.model(cleanText);

            // Ensure consistent output format
            let embedding;
            if (result && result.data) {
                embedding = Array.from(result.data);
            } else if (Array.isArray(result)) {
                embedding = result;
            } else {
                throw new Error('Unexpected embedding format');
            }

            // Validate embedding
            if (!Array.isArray(embedding) || embedding.length === 0) {
                console.warn('Invalid embedding generated, using zero vector');
                return new Array(384).fill(0);
            }

            // Check for NaN values
            const cleanEmbedding = embedding.map(val => isNaN(val) ? 0 : val);

            return cleanEmbedding;
        } catch (error) {
            console.error('Embedding generation failed:', error);
            // Return a zero vector as fallback
            return new Array(384).fill(0);
        }
    }


    extractMetadata(text) {
        // Extract basic metadata from text
        const metadata = {
            wordCount: text.split(/\s+/).length,
            charCount: text.length,
            hasNumbers: /\d/.test(text),
            hasQuestions: /\?/.test(text),
            sentiment: this.analyzeSentiment(text)
        };

        // Extract potential topics/keywords
        const keywords = this.extractKeywords(text);
        if (keywords.length > 0) {
            metadata.keywords = keywords;
        }

        return metadata;
    }

    extractKeywords(text) {
        // Simple keyword extraction
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 3);

        const frequency = {};
        words.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });

        return Object.entries(frequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([word]) => word);
    }

    analyzeSentiment(text) {
        // Simple sentiment analysis
        const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic'];
        const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'disappointing'];

        const words = text.toLowerCase().split(/\s+/);
        let score = 0;

        words.forEach(word => {
            if (positiveWords.includes(word)) score++;
            if (negativeWords.includes(word)) score--;
        });

        return score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
    }

    async search(query, datasets, method, options = {}) {
        if (!this.searchMethods[method]) {
            throw new Error(`Unknown search method: ${method}`);
        }

        const results = await this.searchMethods[method](query, datasets, options);

        // Post-process results
        let processedResults = results;

        if (options.deduplicate) {
            processedResults = this.deduplicateResults(processedResults);
        }

        if (options.showContext) {
            processedResults = await this.addContext(processedResults, datasets, options);
        }

        return processedResults.sort((a, b) => b.score - a.score);
    }



    // UPDATED: Enhanced semantic search with better error handling and validation
    async semanticSearch(query, datasets, options) {
        try {
            const queryEmbedding = await this.generateEmbedding(query);
            const results = [];

            // ADDED: Better validation for query embedding
            if (!queryEmbedding || queryEmbedding.length === 0) {
                console.error('Failed to generate query embedding');
                return [];
            }

            console.log(`Query embedding length: ${queryEmbedding.length}`);

            for (const dataset of datasets) {
                if (!dataset || !dataset.chunks) {
                    console.warn('Invalid dataset structure, skipping');
                    continue;
                }

                for (const chunk of dataset.chunks) {
                    try {
                        // ENHANCED: Better chunk validation
                        if (!chunk.embedding || !Array.isArray(chunk.embedding)) {
                            console.warn(`Invalid chunk embedding in ${dataset.name}, chunk ${chunk.id}`);
                            continue;
                        }

                        // ADDED: Check embedding dimensions match
                        if (chunk.embedding.length !== queryEmbedding.length) {
                            console.warn(`Embedding dimension mismatch: query=${queryEmbedding.length}, chunk=${chunk.embedding.length}`);
                            // Pad or truncate to match dimensions
                            const normalizedEmbedding = this.normalizeEmbeddingDimensions(chunk.embedding, queryEmbedding.length);
                            chunk.embedding = normalizedEmbedding;
                        }

                        const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);

                        // ADDED: Validate similarity score
                        if (isNaN(similarity) || similarity < 0) {
                            console.warn(`Invalid similarity score: ${similarity}`);
                            continue;
                        }

                        const threshold = options.threshold || 0.3;
                        if (similarity > threshold) {
                            results.push({
                                content: chunk.text,
                                score: similarity,
                                source: dataset.name,
                                metadata: chunk.metadata,
                                chunkId: chunk.id,
                                method: 'semantic',
                                // ADDED: Debug information
                                debugInfo: {
                                    queryEmbeddingLength: queryEmbedding.length,
                                    chunkEmbeddingLength: chunk.embedding.length,
                                    originalSimilarity: similarity
                                }
                            });
                        }
                    } catch (error) {
                        console.error(`Error processing chunk ${chunk.id}:`, error);
                        continue;
                    }
                }
            }

            // ADDED: Sort results by score (highest first)
            return results.sort((a, b) => b.score - a.score);
        } catch (error) {
            console.error('Semantic search failed:', error);
            return [];
        }
    }

    // NEW: Add this method after semanticSearch method around line 280
    normalizeEmbeddingDimensions(embedding, targetLength) {
        if (!embedding || !Array.isArray(embedding)) {
            return new Array(targetLength).fill(0);
        }

        if (embedding.length === targetLength) {
            return embedding;
        }

        if (embedding.length > targetLength) {
            // Truncate
            return embedding.slice(0, targetLength);
        } else {
            // Pad with zeros
            const padded = [...embedding];
            while (padded.length < targetLength) {
                padded.push(0);
            }
            return padded;
        }
    }



    // Keyword Search Implementation
    async keywordSearch(query, datasets, options) {
        const keywords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        const results = [];

        for (const dataset of datasets) {
            for (const chunk of dataset.chunks) {
                let matchCount = 0;
                let totalKeywords = keywords.length;
                const text = chunk.text.toLowerCase();

                keywords.forEach(keyword => {
                    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                    const matches = text.match(regex) || [];
                    matchCount += matches.length;
                });

                if (matchCount > 0) {
                    const score = matchCount / (totalKeywords * 2); // Normalize score
                    results.push({
                        content: chunk.text,
                        score: Math.min(score, 1.0),
                        source: dataset.name,
                        metadata: chunk.metadata,
                        chunkId: chunk.id,
                        matchCount: matchCount,
                        method: 'keyword'
                    });
                }
            }
        }

        return results;
    }


    // UPDATED: Enhanced topic search with better keyword matching
    async topicSearch(query, datasets, options) {
        const results = [];
        const queryLower = query.toLowerCase();
        const topicKeywords = queryLower.split(/\s+/).filter(word => word.length > 2);

        // ADDED: Enhanced topic indicators
        const topicIndicators = [
            'chapter', 'section', 'part', 'unit', 'lesson', 'topic', 'subject',
            'introduction', 'conclusion', 'summary', 'overview', 'background',
            'method', 'approach', 'theory', 'concept', 'principle', 'definition'
        ];

        for (const dataset of datasets) {
            if (!dataset || !dataset.chunks) continue;

            for (const chunk of dataset.chunks) {
                if (!chunk.text) continue;

                let topicScore = 0;
                const text = chunk.text.toLowerCase();

                // ENHANCED: Check for structural indicators
                const structuralMatches = topicIndicators.filter(indicator =>
                    text.includes(indicator)
                ).length;
                topicScore += structuralMatches * 0.2;

                // ENHANCED: Direct keyword matching with context
                let keywordMatches = 0;
                topicKeywords.forEach(keyword => {
                    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                    const matches = text.match(regex) || [];
                    keywordMatches += matches.length;

                    // ADDED: Bonus for keywords in headers/titles
                    if (text.match(new RegExp(`(chapter|section|title).*${keyword}`, 'gi'))) {
                        topicScore += 0.3;
                    }
                });

                topicScore += (keywordMatches / topicKeywords.length) * 0.6;

                // ADDED: Check metadata keywords
                if (chunk.metadata && chunk.metadata.keywords) {
                    const commonKeywords = chunk.metadata.keywords.filter(keyword =>
                        topicKeywords.some(topic =>
                            keyword.includes(topic) || topic.includes(keyword)
                        )
                    );
                    topicScore += (commonKeywords.length / chunk.metadata.keywords.length) * 0.4;
                }

                // ADDED: Position-based scoring (earlier content often more relevant)
                if (chunk.metadata && chunk.metadata.chunkIndex < 3) {
                    topicScore *= 1.1;
                }

                const threshold = options.threshold || 0.2;
                if (topicScore > threshold) {
                    results.push({
                        content: chunk.text,
                        score: Math.min(topicScore, 1.0),
                        source: dataset.name,
                        metadata: chunk.metadata,
                        chunkId: chunk.id,
                        topic: this.identifyTopic(chunk.text),
                        method: 'topic',
                        matchedKeywords: topicKeywords.filter(keyword =>
                            text.includes(keyword)
                        )
                    });
                }
            }
        }

        return results.sort((a, b) => b.score - a.score);
    }



    // UPDATED: Enhanced contextual search combining multiple approaches
    async contextualSearch(query, datasets, options) {
        try {
            // Get both semantic and keyword results
            const semanticResults = await this.semanticSearch(query, datasets, {
                ...options,
                threshold: (options.threshold || 0.3) * 0.8
            });

            const keywordResults = await this.keywordSearch(query, datasets, {
                ...options,
                threshold: (options.threshold || 0.3) * 0.6
            });

            // ENHANCED: Combine results with better weighting
            const combinedMap = new Map();

            // Process semantic results
            semanticResults.forEach(result => {
                const key = `${result.source}_${result.chunkId}`;
                combinedMap.set(key, {
                    ...result,
                    semanticScore: result.score,
                    keywordScore: 0,
                    combinedScore: result.score * 0.7
                });
            });

            // Process keyword results
            keywordResults.forEach(result => {
                const key = `${result.source}_${result.chunkId}`;
                if (combinedMap.has(key)) {
                    const existing = combinedMap.get(key);
                    existing.keywordScore = result.score;
                    existing.combinedScore = (existing.semanticScore * 0.6) + (result.score * 0.4);
                    existing.matchCount = result.matchCount;
                } else {
                    combinedMap.set(key, {
                        ...result,
                        semanticScore: 0,
                        keywordScore: result.score,
                        combinedScore: result.score * 0.5
                    });
                }
            });

            // ADDED: Context-aware scoring enhancements
            const contextualResults = Array.from(combinedMap.values()).map(result => {
                let contextualScore = result.combinedScore;

                // ENHANCED: Question-answer context
                if (query.includes('?') || query.toLowerCase().startsWith('what') ||
                    query.toLowerCase().startsWith('how') || query.toLowerCase().startsWith('why')) {
                    if (result.content.toLowerCase().match(/(answer|solution|because|due to|result)/)) {
                        contextualScore *= 1.3;
                    }
                }

                // ENHANCED: Definition context
                if (query.toLowerCase().includes('define') || query.toLowerCase().includes('what is')) {
                    if (result.content.toLowerCase().match(/(is defined|means|refers to|definition)/)) {
                        contextualScore *= 1.4;
                    }
                }

                // ADDED: Procedural context
                if (query.toLowerCase().match(/(how to|steps|process|procedure)/)) {
                    if (result.content.toLowerCase().match(/(first|then|next|finally|step)/)) {
                        contextualScore *= 1.2;
                    }
                }

                // ADDED: Comparative context
                if (query.toLowerCase().match(/(compare|difference|versus|vs)/)) {
                    if (result.content.toLowerCase().match(/(unlike|however|whereas|compared to)/)) {
                        contextualScore *= 1.25;
                    }
                }

                return {
                    ...result,
                    score: Math.min(contextualScore, 1.0),
                    method: 'contextual'
                };
            });

            return this.deduplicateResults(contextualResults);
        } catch (error) {
            console.error("Error in contextualSearch:", error);
            throw error;
        }
    }



    // Research Search Implementation
    async researchSearch(query, datasets, options) {
        const results = [];
        const queryEmbedding = await this.generateEmbedding(query);

        // ENHANCED: Better validation for query embedding
        if (!queryEmbedding || queryEmbedding.length === 0) {
            console.error('Failed to generate query embedding for research search');
            return [];
        }

        // Research-oriented search focuses on academic and technical content
        for (const dataset of datasets) {
            if (!dataset || !dataset.chunks) {
                console.warn('Invalid dataset structure in research search, skipping');
                continue;
            }

            for (const chunk of dataset.chunks) {
                try {
                    // ADDED: Better validation for chunk embedding
                    if (!chunk.embedding || !Array.isArray(chunk.embedding)) {
                        console.warn(`Invalid chunk embedding in research search: ${dataset.name}, chunk ${chunk.id}`);
                        continue;
                    }

                    // ADDED: Check embedding dimensions match
                    if (chunk.embedding.length !== queryEmbedding.length) {
                        console.warn(`Research search embedding dimension mismatch: query=${queryEmbedding.length}, chunk=${chunk.embedding.length}`);
                        const normalizedEmbedding = this.normalizeEmbeddingDimensions(chunk.embedding, queryEmbedding.length);
                        chunk.embedding = normalizedEmbedding;
                    }

                    const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
                    let researchScore = similarity;

                    // ENHANCED: Boost academic indicators
                    const academicIndicators = [
                        'research', 'study', 'analysis', 'methodology', 'findings',
                        'conclusion', 'abstract', 'hypothesis', 'experiment',
                        'data', 'results', 'discussion', 'literature', 'review',
                        'empirical', 'statistical', 'correlation', 'significant'
                    ];

                    const text = chunk.text.toLowerCase();
                    const academicCount = academicIndicators.reduce((count, indicator) => {
                        const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
                        const matches = text.match(regex) || [];
                        return count + matches.length;
                    }, 0);

                    if (academicCount > 0) {
                        researchScore *= (1 + academicCount * 0.1);
                    }

                    // ENHANCED: Boost for citations and references
                    const citationPatterns = [
                        /\([0-9]{4}\)/g,     // (2023)
                        /et al\./gi,          // et al.
                        /fig\.\s*\d+/gi,     // fig. 1
                        /table\s*\d+/gi,     // table 1
                        /reference[s]?/gi,    // reference/references
                        /\[[\d,\s-]+\]/g,    // [1,2,3] or [1-5]
                        /doi:/gi,            // DOI references
                        /isbn:/gi            // ISBN references
                    ];

                    let citationBoost = 1.0;
                    citationPatterns.forEach(pattern => {
                        const matches = text.match(pattern) || [];
                        if (matches.length > 0) {
                            citationBoost += matches.length * 0.05;
                        }
                    });

                    researchScore *= Math.min(citationBoost, 1.5); // Cap the boost

                    // ADDED: Boost for technical terminology
                    const technicalTerms = [
                        'algorithm', 'framework', 'model', 'theory', 'principle',
                        'approach', 'technique', 'method', 'procedure', 'protocol'
                    ];

                    const technicalCount = technicalTerms.reduce((count, term) => {
                        return count + (text.split(term).length - 1);
                    }, 0);

                    if (technicalCount > 0) {
                        researchScore *= (1 + technicalCount * 0.05);
                    }

                    const threshold = options.threshold || 0.4;
                    if (researchScore > threshold) {
                        results.push({
                            content: chunk.text,
                            score: Math.min(researchScore, 1.0),
                            source: dataset.name,
                            metadata: chunk.metadata,
                            chunkId: chunk.id,
                            academicScore: academicCount,
                            citationCount: Object.values(citationPatterns).reduce((total, pattern) => {
                                return total + (text.match(pattern) || []).length;
                            }, 0),
                            technicalScore: technicalCount,
                            method: 'research'
                        });
                    }

                } catch (error) {
                    console.error(`Error processing research chunk ${chunk.id}:`, error);
                    continue;
                }
            }
        }

        return results.sort((a, b) => b.score - a.score);
    }

    identifyTopic(text) {
        // ENHANCED: More comprehensive topic identification
        const topics = {
            'technology': [
                'computer', 'software', 'algorithm', 'data', 'programming',
                'artificial', 'intelligence', 'machine', 'learning', 'neural',
                'network', 'database', 'system', 'application', 'development'
            ],
            'science': [
                'research', 'experiment', 'hypothesis', 'theory', 'analysis',
                'scientific', 'method', 'observation', 'evidence', 'study',
                'investigation', 'discovery', 'phenomenon', 'laboratory'
            ],
            'business': [
                'market', 'strategy', 'revenue', 'customer', 'profit',
                'management', 'organization', 'company', 'business', 'finance',
                'investment', 'economic', 'commercial', 'enterprise'
            ],
            'education': [
                'learning', 'student', 'teaching', 'knowledge', 'skill',
                'education', 'academic', 'curriculum', 'instruction', 'training',
                'pedagogy', 'classroom', 'assessment', 'evaluation'
            ],
            'medical': [
                'health', 'medical', 'patient', 'treatment', 'diagnosis',
                'disease', 'therapy', 'clinical', 'hospital', 'medicine',
                'pharmaceutical', 'healthcare', 'symptoms', 'prevention'
            ],
            'legal': [
                'law', 'legal', 'court', 'justice', 'regulation', 'compliance',
                'contract', 'agreement', 'litigation', 'statute', 'constitutional'
            ]
        };

        const textLower = text.toLowerCase();
        let bestTopic = 'general';
        let bestScore = 0;

        Object.entries(topics).forEach(([topic, keywords]) => {
            const score = keywords.reduce((count, keyword) => {
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                const matches = textLower.match(regex) || [];
                return count + matches.length;
            }, 0);

            if (score > bestScore) {
                bestScore = score;
                bestTopic = topic;
            }
        });

        return bestTopic;
    }

    cosineSimilarity(vecA, vecB) {
        // ENHANCED: More robust similarity calculation with better error handling
        if (!vecA || !vecB) {
            console.warn('One or both vectors are null/undefined');
            return 0;
        }

        // Convert to arrays if they aren't already
        const arrayA = Array.isArray(vecA) ? vecA : Array.from(vecA);
        const arrayB = Array.isArray(vecB) ? vecB : Array.from(vecB);

        // Check for empty arrays
        if (arrayA.length === 0 || arrayB.length === 0) {
            console.warn('One or both vectors are empty');
            return 0;
        }

        // Handle length mismatch
        if (arrayA.length !== arrayB.length) {
            console.warn(`Vector length mismatch: ${arrayA.length} vs ${arrayB.length}`);

            // Normalize dimensions
            const maxLength = Math.max(arrayA.length, arrayB.length);
            const paddedA = [...arrayA];
            const paddedB = [...arrayB];

            while (paddedA.length < maxLength) paddedA.push(0);
            while (paddedB.length < maxLength) paddedB.push(0);

            return this.calculateCosineSimilarity(paddedA, paddedB);
        }

        return this.calculateCosineSimilarity(arrayA, arrayB);
    }

    // ENHANCED: More robust similarity calculation
    calculateCosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            // Handle NaN and infinite values
            const a = (isNaN(vecA[i]) || !isFinite(vecA[i])) ? 0 : vecA[i];
            const b = (isNaN(vecB[i]) || !isFinite(vecB[i])) ? 0 : vecB[i];

            dotProduct += a * b;
            normA += a * a;
            normB += b * b;
        }

        // Prevent division by zero
        if (normA === 0 || normB === 0) {
            return 0;
        }

        const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

        // Ensure result is valid
        if (isNaN(similarity) || !isFinite(similarity)) {
            console.warn('Invalid similarity calculated, returning 0');
            return 0;
        }

        // Clamp between 0 and 1
        return Math.max(0, Math.min(1, similarity));
    }

    // ENHANCED: Better deduplication with fuzzy matching
    deduplicateResults(results) {
        if (!results || results.length === 0) return [];

        const deduplicated = [];
        const seenHashes = new Set();

        for (const result of results) {
            // Create multiple hash variants for better deduplication
            const content = result.content || '';

            // Primary hash (first 200 chars)
            const primaryHash = this.simpleHash(content.substring(0, 200).toLowerCase().trim());

            // Secondary hash (middle 200 chars)
            const middleStart = Math.max(0, Math.floor(content.length / 2) - 100);
            const secondaryHash = this.simpleHash(content.substring(middleStart, middleStart + 200).toLowerCase().trim());

            // Sentence-based hash (first sentence)
            const firstSentence = content.split(/[.!?]/)[0];
            const sentenceHash = this.simpleHash(firstSentence.toLowerCase().trim());

            const combinedHash = `${primaryHash}_${secondaryHash}_${sentenceHash}`;

            if (!seenHashes.has(combinedHash)) {
                seenHashes.add(combinedHash);
                deduplicated.push(result);
            } else {
                console.debug('Duplicate content detected and removed');
            }
        }

        return deduplicated;
    }

    // ENHANCED: Better hash function
    simpleHash(str) {
        if (!str || str.length === 0) return 0;

        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    // ENHANCED: Better context addition with error handling
    async addContext(results, datasets, options) {
        if (!results || results.length === 0) return [];
        if (!options.showContext) return results;

        const enhanced = [];

        for (const result of results) {
            try {
                const enhanced_result = { ...result };

                // Find the source chunk and surrounding context
                const sourceDataset = datasets.find(d => d.name === result.source);
                if (sourceDataset && sourceDataset.chunks) {
                    const chunkIndex = sourceDataset.chunks.findIndex(c => c.id === result.chunkId);

                    if (chunkIndex !== -1) {
                        const context = {};

                        // Get prefix context with bounds checking
                        if (options.prefixSentences > 0 && chunkIndex > 0) {
                            const prefixChunks = [];
                            const startIndex = Math.max(0, chunkIndex - options.prefixSentences);

                            for (let i = startIndex; i < chunkIndex; i++) {
                                if (sourceDataset.chunks[i] && sourceDataset.chunks[i].text) {
                                    prefixChunks.push(sourceDataset.chunks[i].text);
                                }
                            }

                            if (prefixChunks.length > 0) {
                                context.prefix = this.limitWords(prefixChunks.join(' '), options.wordLimit || 50);
                            }
                        }

                        // Get suffix context with bounds checking
                        if (options.suffixSentences > 0 && chunkIndex < sourceDataset.chunks.length - 1) {
                            const suffixChunks = [];
                            const endIndex = Math.min(sourceDataset.chunks.length, chunkIndex + 1 + options.suffixSentences);

                            for (let i = chunkIndex + 1; i < endIndex; i++) {
                                if (sourceDataset.chunks[i] && sourceDataset.chunks[i].text) {
                                    suffixChunks.push(sourceDataset.chunks[i].text);
                                }
                            }

                            if (suffixChunks.length > 0) {
                                context.suffix = this.limitWords(suffixChunks.join(' '), options.wordLimit || 50);
                            }
                        }

                        if (Object.keys(context).length > 0) {
                            enhanced_result.context = context;
                        }
                    }
                }

                enhanced.push(enhanced_result);

            } catch (error) {
                console.error('Error adding context to result:', error);
                // Add result without context if context addition fails
                enhanced.push(result);
            }
        }

        return enhanced;
    }

    // ENHANCED: Better word limiting with sentence preservation
    limitWords(text, wordLimit) {
        if (!text || typeof text !== 'string') return '';

        const words = text.split(/\s+/);
        if (words.length <= wordLimit) return text;

        // Try to preserve sentence boundaries
        let result = words.slice(0, wordLimit).join(' ');

        // If we cut mid-sentence, try to end at a sentence boundary
        const lastSentenceEnd = result.lastIndexOf('.');
        const lastQuestionEnd = result.lastIndexOf('?');
        const lastExclamationEnd = result.lastIndexOf('!');

        const lastSentenceBoundary = Math.max(lastSentenceEnd, lastQuestionEnd, lastExclamationEnd);

        // If there's a sentence boundary in the last 20% of the text, use that
        if (lastSentenceBoundary > result.length * 0.8) {
            result = result.substring(0, lastSentenceBoundary + 1);
        } else {
            result += '...';
        }

        return result.trim();
    }
}



