/**
 * Google AdSense Manager
 * Handles dynamic ad loading and refresh functionality
 */

class AdsenseManager {
    constructor() {
        // Developer Configuration Section
        this.config = {
            // Replace with your actual AdSense publisher ID
            publisherId: 'ca-pub-XXXXXXXXXXXXXXXXX',

            // Ad slot configurations
            adSlots: {
                'ad-space-1': {
                    slotId: '1111111111',
                    format: 'auto',
                    fullWidthResponsive: true
                },
                'ad-space-2': {
                    slotId: '2222222222',
                    format: 'rectangle',
                    fullWidthResponsive: false
                },
                'ad-space-3': {
                    slotId: '3333333333',
                    format: 'auto',
                    fullWidthResponsive: true
                }
            },

            // Refresh settings
            refreshEnabled: true,
            minRefreshInterval: 30000, // 30 seconds minimum between refreshes
            maxRefreshesPerSession: 50 // Maximum refreshes per user session
        };

        this.refreshCount = 0;
        this.lastRefreshTime = 0;
        this.initializedSlots = new Set();
    }

    init() {
        // Only initialize if configuration is properly set
        if (this.config.publisherId === 'ca-pub-XXXXXXXXXXXXXXXXX') {
            console.warn('AdSense: Please configure your publisher ID in adsense-manager.js');
            return;
        }

        try {
            // Load AdSense script if not already loaded
            this.loadAdsenseScript();

            // Initialize ad slots
            this.initializeAdSlots();

            // Setup refresh mechanism
            this.setupRefreshMechanism();

            console.log('AdSense Manager initialized');
        } catch (error) {
            console.error('AdSense initialization error:', error);
        }
    }

    loadAdsenseScript() {
        // Check if AdSense script is already loaded
        if (window.adsbygoogle) return;

        const script = document.createElement('script');
        script.async = true;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${this.config.publisherId}`;
        script.crossOrigin = 'anonymous';

        // Handle script load errors
        script.onerror = () => {
            console.warn('Failed to load AdSense script');
        };

        document.head.appendChild(script);
    }

    initializeAdSlots() {
        Object.keys(this.config.adSlots).forEach(adSpaceId => {
            const adSpace = document.getElementById(adSpaceId);
            if (adSpace) {
                this.createAdSlot(adSpaceId, this.config.adSlots[adSpaceId]);
            }
        });
    }

    createAdSlot(adSpaceId, slotConfig) {
        const adSpace = document.getElementById(adSpaceId);
        if (!adSpace) return;

        // Clear existing content
        adSpace.innerHTML = '';

        // Create ad element
        const adElement = document.createElement('ins');
        adElement.className = 'adsbygoogle';
        adElement.style.display = 'block';
        adElement.setAttribute('data-ad-client', this.config.publisherId);
        adElement.setAttribute('data-ad-slot', slotConfig.slotId);
        adElement.setAttribute('data-ad-format', slotConfig.format);

        if (slotConfig.fullWidthResponsive) {
            adElement.setAttribute('data-full-width-responsive', 'true');
        }

        adSpace.appendChild(adElement);

        // Push to AdSense
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            this.initializedSlots.add(adSpaceId);
            adSpace.classList.add('loaded');
        } catch (error) {
            console.warn(`Failed to initialize ad slot ${adSpaceId}:`, error);
        }
    }

    setupRefreshMechanism() {
        if (!this.config.refreshEnabled) return;

        // Refresh ads on specific user interactions
        const refreshTriggers = [
            'searchBtn',
            'processBtn',
            'generateAI',
            'exportTxt',
            'exportPdf',
            'exportJson'
        ];

        refreshTriggers.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', () => {
                    // Small delay to avoid interfering with main functionality
                    setTimeout(() => this.refreshAds(), 500);
                });
            }
        });

        // Also refresh when dataset selection changes
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('dataset-checkbox')) {
                setTimeout(() => this.refreshAds(), 500);
            }
        });
    }

    refreshAds() {
        // Check refresh limits
        if (!this.canRefresh()) {
            return;
        }

        try {
            // Refresh each ad slot
            this.initializedSlots.forEach(adSpaceId => {
                this.refreshAdSlot(adSpaceId);
            });

            this.refreshCount++;
            this.lastRefreshTime = Date.now();

            console.log(`Ads refreshed (${this.refreshCount}/${this.config.maxRefreshesPerSession})`);
        } catch (error) {
            console.warn('Ad refresh error:', error);
        }
    }

    canRefresh() {
        const now = Date.now();

        // Check maximum refreshes per session
        if (this.refreshCount >= this.config.maxRefreshesPerSession) {
            return false;
        }

        // Check minimum time interval
        if (now - this.lastRefreshTime < this.config.minRefreshInterval) {
            return false;
        }

        return true;
    }

    refreshAdSlot(adSpaceId) {
        const slotConfig = this.config.adSlots[adSpaceId];
        if (!slotConfig) return;

        // Recreate the ad slot
        this.createAdSlot(adSpaceId, slotConfig);
    }

    // Method to programmatically refresh ads (called by main app)
    triggerRefresh() {
        if (this.canRefresh()) {
            setTimeout(() => this.refreshAds(), 100);
        }
    }

    // Get statistics for debugging
    getStats() {
        return {
            refreshCount: this.refreshCount,
            maxRefreshes: this.config.maxRefreshesPerSession,
            lastRefreshTime: this.lastRefreshTime,
            initializedSlots: Array.from(this.initializedSlots),
            canRefresh: this.canRefresh()
        };
    }
}
