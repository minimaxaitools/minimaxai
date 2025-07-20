/**
 * Export Manager
 * Handles exporting search results in multiple formats
 */

class ExportManager {
    constructor() {
        this.formats = {
            txt: this.exportAsTxt.bind(this),
            pdf: this.exportAsPdf.bind(this),
            json: this.exportAsJson.bind(this)
        };
    }

    exportAsTxt(results) {
        if (!results || results.length === 0) {
            alert('No results to export');
            return;
        }

        let content = `Search Results Export\n`;
        content += `Generated: ${new Date().toLocaleString()}\n`;
        content += `Total Results: ${results.length}\n\n`;
        content += '='.repeat(50) + '\n\n';

        results.forEach((result, index) => {
            content += `Result ${index + 1}\n`;
            content += `-`.repeat(20) + '\n';
            content += `Source: ${result.source}\n`;
            content += `Score: ${(result.score * 100).toFixed(1)}%\n`;
            content += `Method: ${result.method}\n\n`;
            content += `Content:\n${result.content}\n\n`;

            if (result.context) {
                if (result.context.prefix) {
                    content += `Context (Before):\n${result.context.prefix}\n\n`;
                }
                if (result.context.suffix) {
                    content += `Context (After):\n${result.context.suffix}\n\n`;
                }
            }

            content += '='.repeat(50) + '\n\n';
        });

        this.downloadFile(content, 'search-results.txt', 'text/plain');
    }

    // COMPLETELY UPDATED: Modern PDF export with professional styling
    exportAsPdf(results) {
        if (!results || results.length === 0) {
            alert('No results to export');
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');

            // Professional theme configuration
            const theme = {
                colors: {
                    primary: [30, 64, 175],     // Blue
                    secondary: [59, 130, 246],  // Light blue
                    accent: [16, 185, 129],     // Green
                    neutral: {
                        900: [17, 24, 39],      // Almost black
                        700: [55, 65, 81],      // Dark gray
                        600: [75, 85, 99],      // Medium gray
                        300: [209, 213, 219],   // Light gray
                        100: [243, 244, 246]    // Very light gray
                    },
                    white: [255, 255, 255]
                },
                fonts: {
                    title: 20,
                    heading: 16,
                    subheading: 12,
                    body: 10,
                    small: 8
                },
                spacing: {
                    page: 20,
                    section: 15,
                    element: 8
                }
            };

            let currentY = theme.spacing.page;
            let pageNumber = 1;
            const pageHeight = doc.internal.pageSize.height;
            const pageWidth = doc.internal.pageSize.width;
            const maxWidth = pageWidth - (theme.spacing.page * 2);

            // Utility functions
            const utils = {
                cleanText: (text) => {
                    if (!text) return '';
                    return text.toString()
                        .replace(/[^\x00-\x7F]/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
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

                    doc.setFillColor(...theme.colors.neutral[100]);
                    doc.rect(0, 0, pageWidth, 15, 'F');

                    doc.setFontSize(theme.fonts.small);
                    doc.setTextColor(...theme.colors.neutral[600]);
                    doc.text('AI Document Search Results', theme.spacing.page, 10);
                    doc.text(`Page ${pageNumber}`, pageWidth - 30, 10);

                    doc.setDrawColor(...theme.colors.neutral[300]);
                    doc.setLineWidth(0.5);
                    doc.line(theme.spacing.page, 12, pageWidth - theme.spacing.page, 12);

                    currentY = 25;
                },

                addStyledText: (text, x, y, options = {}) => {
                    const {
                        fontSize = theme.fonts.body,
                        color = theme.colors.neutral[900],
                        maxWidth = maxWidth - 20,
                        lineHeight = 5,
                        bold = false
                    } = options;

                    const cleanedText = utils.cleanText(text);
                    if (!cleanedText) return 0;

                    doc.setFontSize(fontSize);
                    doc.setTextColor(...color);
                    doc.setFont(undefined, bold ? 'bold' : 'normal');

                    const lines = doc.splitTextToSize(cleanedText, maxWidth);
                    const totalHeight = lines.length * lineHeight;

                    utils.checkNewPage(totalHeight);
                    doc.text(lines, x, currentY);

                    doc.setFont(undefined, 'normal');
                    return totalHeight;
                },

                createProgressBar: (percentage, x, y, width = 40, height = 3) => {
                    // Background
                    doc.setFillColor(...theme.colors.neutral[300]);
                    doc.rect(x, y, width, height, 'F');

                    // Progress
                    const progressWidth = Math.max(0, Math.min(100, percentage)) / 100 * width;
                    let progressColor = theme.colors.accent;

                    if (percentage >= 80) progressColor = theme.colors.accent;
                    else if (percentage >= 60) progressColor = theme.colors.secondary;
                    else if (percentage < 40) progressColor = [239, 68, 68]; // Red

                    doc.setFillColor(...progressColor);
                    doc.rect(x, y, progressWidth, height, 'F');

                    // Border
                    doc.setDrawColor(...theme.colors.neutral[600]);
                    doc.setLineWidth(0.3);
                    doc.rect(x, y, width, height, 'S');
                }
            };

            // Create header
            doc.setFillColor(...theme.colors.primary);
            doc.rect(0, 0, pageWidth, 40, 'F');

            doc.setFontSize(theme.fonts.title);
            doc.setTextColor(...theme.colors.white);
            doc.setFont(undefined, 'bold');
            doc.text('AI Document Search Results', theme.spacing.page, 20);

            doc.setFontSize(theme.fonts.small);
            doc.text(`Generated: ${new Date().toLocaleString()}`, theme.spacing.page, 30);
            doc.text(`Total Results: ${results.length}`, theme.spacing.page, 35);

            currentY = 50;

            // Create summary section
            doc.setFontSize(theme.fonts.heading);
            doc.setTextColor(...theme.colors.neutral[900]);
            doc.setFont(undefined, 'bold');
            doc.text('Search Summary', theme.spacing.page, currentY);
            currentY += 10;

            // Summary stats
            const avgScore = results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length;
            const maxScore = Math.max(...results.map(r => r.score || 0));

            doc.setFontSize(theme.fonts.body);
            doc.setFont(undefined, 'normal');
            doc.text(`Average Relevance: ${(avgScore * 100).toFixed(1)}%`, theme.spacing.page, currentY);
            doc.text(`Best Match: ${(maxScore * 100).toFixed(1)}%`, theme.spacing.page + 60, currentY);
            currentY += 15;

            // Results section
            doc.setFontSize(theme.fonts.heading);
            doc.setFont(undefined, 'bold');
            doc.text('Detailed Results', theme.spacing.page, currentY);
            currentY += 15;

            // Process each result
            results.forEach((result, index) => {
                const estimatedHeight = 60 + (result.content ? Math.ceil(result.content.length / 100) * 5 : 0);
                utils.checkNewPage(estimatedHeight);

                // Result container background
                doc.setFillColor(...theme.colors.neutral[100]);
                doc.rect(theme.spacing.page, currentY - 5, maxWidth, estimatedHeight - 10, 'F');

                // Result number
                doc.setFillColor(...theme.colors.primary);
                doc.circle(theme.spacing.page + 6, currentY + 3, 4, 'F');

                doc.setFontSize(theme.fonts.small);
                doc.setTextColor(...theme.colors.white);
                doc.setFont(undefined, 'bold');
                doc.text((index + 1).toString(), theme.spacing.page + 6, currentY + 5, { align: 'center' });

                // Result header
                doc.setFontSize(theme.fonts.subheading);
                doc.setTextColor(...theme.colors.neutral[900]);
                doc.setFont(undefined, 'bold');
                doc.text(`Result ${index + 1}`, theme.spacing.page + 15, currentY + 5);

                // Source and score
                currentY += 12;
                doc.setFontSize(theme.fonts.small);
                doc.setTextColor(...theme.colors.neutral[700]);
                doc.setFont(undefined, 'normal');
                doc.text(`Source: ${utils.cleanText(result.source || 'Unknown')}`, theme.spacing.page + 5, currentY);

                // Progress bar for score
                const scorePercent = (result.score || 0) * 100;
                doc.text('Relevance:', theme.spacing.page + 5, currentY + 8);
                utils.createProgressBar(scorePercent, theme.spacing.page + 30, currentY + 5, 30, 3);
                doc.setFont(undefined, 'bold');
                doc.text(`${scorePercent.toFixed(1)}%`, theme.spacing.page + 65, currentY + 8);

                currentY += 15;

                // Content
                if (result.content) {
                    doc.setFontSize(theme.fonts.small);
                    doc.setTextColor(...theme.colors.neutral[600]);
                    doc.setFont(undefined, 'bold');
                    doc.text('Content:', theme.spacing.page + 5, currentY);
                    currentY += 5;

                    const textHeight = utils.addStyledText(result.content, theme.spacing.page + 5, currentY, {
                        fontSize: theme.fonts.body,
                        color: theme.colors.neutral[900],
                        maxWidth: maxWidth - 10,
                        lineHeight: 4
                    });
                    currentY += textHeight + 5;
                }

                // Context sections
                if (result.context) {
                    if (result.context.prefix) {
                        doc.setFontSize(theme.fonts.small);
                        doc.setTextColor(...theme.colors.neutral[600]);
                        doc.setFont(undefined, 'bold');
                        doc.text('Context (Before):', theme.spacing.page + 5, currentY);
                        currentY += 5;

                        const contextHeight = utils.addStyledText(result.context.prefix, theme.spacing.page + 5, currentY, {
                            fontSize: theme.fonts.small,
                            color: theme.colors.neutral[700],
                            maxWidth: maxWidth - 10,
                            lineHeight: 4
                        });
                        currentY += contextHeight + 5;
                    }

                    if (result.context.suffix) {
                        doc.setFontSize(theme.fonts.small);
                        doc.setTextColor(...theme.colors.neutral[600]);
                        doc.setFont(undefined, 'bold');
                        doc.text('Context (After):', theme.spacing.page + 5, currentY);
                        currentY += 5;

                        const contextHeight = utils.addStyledText(result.context.suffix, theme.spacing.page + 5, currentY, {
                            fontSize: theme.fonts.small,
                            color: theme.colors.neutral[700],
                            maxWidth: maxWidth - 10,
                            lineHeight: 4
                        });
                        currentY += contextHeight + 5;
                    }
                }

                currentY += theme.spacing.section;

                // Add divider (except for last result)
                if (index < results.length - 1) {
                    doc.setDrawColor(...theme.colors.neutral[300]);
                    doc.setLineWidth(0.5);
                    doc.line(theme.spacing.page + 10, currentY, pageWidth - theme.spacing.page - 10, currentY);
                    currentY += 10;
                }
            });

            // Footer
            const footerY = pageHeight - 15;
            doc.setFillColor(...theme.colors.neutral[100]);
            doc.rect(0, footerY - 5, pageWidth, 20, 'F');

            doc.setFontSize(theme.fonts.small);
            doc.setTextColor(...theme.colors.neutral[600]);
            doc.text('AI Document Search Platform', theme.spacing.page, footerY);
            doc.text(`${new Date().toLocaleDateString()}`, theme.spacing.page, footerY + 5);
            doc.text(`Total Results: ${results.length}`, pageWidth - 50, footerY);
            doc.text(`Pages: ${pageNumber}`, pageWidth - 50, footerY + 5);

            // Save
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            doc.save(`AI_Search_Results_${timestamp}.pdf`);

            console.log('PDF exported successfully');

        } catch (error) {
            console.error('PDF export error:', error);
            alert('Error exporting to PDF. Please try again.');
        }
    }


    exportAsJson(results) {
        if (!results || results.length === 0) {
            alert('No results to export');
            return;
        }

        const exportData = {
            timestamp: new Date().toISOString(),
            totalResults: results.length,
            exportVersion: '1.0',
            results: results.map(result => ({
                source: result.source,
                content: result.content,
                score: result.score,
                method: result.method,
                metadata: result.metadata,
                context: result.context
            }))
        };

        const content = JSON.stringify(exportData, null, 2);
        this.downloadFile(content, 'search-results.json', 'application/json');
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
