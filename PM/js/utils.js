/**
 * Utility functions for Prompt Generator Pro
 */

// Debounce function for performance optimization
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function for scroll events
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Generate unique ID
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Format date for display
export function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(date));
}

// Sanitize HTML to prevent XSS
export function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

// Copy text to clipboard with fallback
export async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback for older browsers or non-secure contexts
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
}

// Download data as file with APK-friendly fallback
export function downloadData(data, filename, type = 'application/json') {
    try {
        // Check if we're in an APK environment (limited file system access)
        const isAPK = window.location.protocol === 'file:' || 
                     navigator.userAgent.includes('wv') || 
                     window.Android !== undefined;
        
        if (isAPK) {
            // For APK: Use Web Share API or copy to clipboard as fallback
            return shareOrCopyData(data, filename, type);
        } else {
            // For web browsers: Use traditional download
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
}

// Share or copy data for APK environments
async function shareOrCopyData(data, filename, type) {
    try {
        // Try Web Share API first (if available)
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
        
        // Fallback: Copy to clipboard and show instructions
        const success = await copyToClipboard(data);
        if (success) {
            showToast('Data copied to clipboard! You can paste it into a text file.', 'success');
            return true;
        } else {
            throw new Error('Clipboard access failed');
        }
    } catch (error) {
        console.error('Share/copy failed:', error);
        // Final fallback: Show data in a modal for manual copying
        showDataModal(data, filename);
        return false;
    }
}

// Show data in modal for manual copying
function showDataModal(data, filename) {
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
                <button class="btn btn-primary" onclick="copyToClipboard(\`${data.replace(/`/g, '\\`')}\`).then(() => showToast('Copied to clipboard!', 'success'))">
                    Copy to Clipboard
                </button>
                <button class="btn btn-outline" onclick="this.closest('.modal').remove()">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Validate email format
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Validate URL format
export function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Format file size
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get file extension
export function getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

// Check if device is mobile
export function isMobile() {
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Check if device supports touch
export function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
}

// Get device type
export function getDeviceType() {
    if (isMobile()) {
        return window.innerWidth <= 480 ? 'mobile' : 'tablet';
    }
    return 'desktop';
}

// Local storage helpers with error handling
export const storage = {
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return defaultValue;
        }
    },
    
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Error writing to localStorage:', error);
            return false;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error removing from localStorage:', error);
            return false;
        }
    },
    
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Error clearing localStorage:', error);
            return false;
        }
    }
};

// Performance monitoring
export function measurePerformance(name, fn) {
    return async function(...args) {
        const start = performance.now();
        try {
            const result = await fn.apply(this, args);
            const end = performance.now();
            console.log(`${name} took ${end - start} milliseconds`);
            return result;
        } catch (error) {
            const end = performance.now();
            console.error(`${name} failed after ${end - start} milliseconds:`, error);
            throw error;
        }
    };
}

// Error handling wrapper
export function withErrorHandling(fn, errorHandler) {
    return async function(...args) {
        try {
            return await fn.apply(this, args);
        } catch (error) {
            if (errorHandler) {
                errorHandler(error);
            } else {
                console.error('Unhandled error:', error);
                showToast('An error occurred. Please try again.', 'error');
            }
            throw error;
        }
    };
}

// Animation helpers
export function fadeIn(element, duration = 300) {
    element.style.opacity = '0';
    element.style.display = 'block';
    
    const start = performance.now();
    
    function animate(currentTime) {
        const elapsed = currentTime - start;
        const progress = Math.min(elapsed / duration, 1);
        
        element.style.opacity = progress.toString();
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
}

export function fadeOut(element, duration = 300) {
    const start = performance.now();
    const startOpacity = parseFloat(getComputedStyle(element).opacity);
    
    function animate(currentTime) {
        const elapsed = currentTime - start;
        const progress = Math.min(elapsed / duration, 1);
        
        element.style.opacity = (startOpacity * (1 - progress)).toString();
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            element.style.display = 'none';
        }
    }
    
    requestAnimationFrame(animate);
}

// Make functions available globally for inline event handlers
window.copyToClipboard = copyToClipboard;
window.showToast = function(message, type) {
    // This will be implemented in ui.js
    console.log(`Toast: ${message} (${type})`);
};

// Export all utilities as default object for easier importing
export default {
    debounce,
    throttle,
    generateId,
    formatDate,
    sanitizeHTML,
    copyToClipboard,
    downloadData,
    isValidEmail,
    isValidURL,
    formatFileSize,
    getFileExtension,
    isMobile,
    isTouchDevice,
    getDeviceType,
    storage,
    measurePerformance,
    withErrorHandling,
    fadeIn,
    fadeOut
};

