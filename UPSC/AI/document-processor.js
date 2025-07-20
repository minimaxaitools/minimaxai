/**
 * Document Processing Engine
 * Handles file reading, PDF processing, and text extraction
 */

class DocumentProcessor {
    constructor() {
        this.supportedTypes = {
            'text/plain': this.processTextFile.bind(this),
            'application/pdf': this.processPdfFile.bind(this)
        };

        // Configure PDF.js worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        }

    }

    async processFile(file) {
        const processor = this.supportedTypes[file.type];
        if (!processor) {
            throw new Error(`Unsupported file type: ${file.type}`);
        }

        try {
            return await processor(file);
        } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
            throw error;
        }
    }

    async processTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error(`Failed to read text file: ${e.target.error}`));
            reader.readAsText(file);
        });
    }

    async processPdfFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    let fullText = '';

                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();

                        const pageText = textContent.items
                            .map(item => item.str)
                            .join(' ');

                        fullText += `\n\n--- Page ${i} ---\n${pageText}`;
                    }

                    resolve(this.cleanExtractedText(fullText));
                } catch (error) {
                    reject(new Error(`Failed to process PDF: ${error.message}`));
                }
            };

            reader.onerror = () => reject(new Error('Failed to read PDF file'));
            reader.readAsArrayBuffer(file);
        });
    }

    cleanExtractedText(text) {
        // Clean and normalize extracted text
        return text
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/\n\s*\n/g, '\n\n') // Clean up line breaks
            .replace(/[^\w\s\.\,\!\?\;\:\-\(\)\"\']/g, '') // Remove unusual characters
            .trim();
    }
}
