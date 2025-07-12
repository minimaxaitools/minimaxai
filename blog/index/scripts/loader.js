(function() {
    // Domain verification
    const allowedDomain = 'minimaxai.in';
    if (window.location.hostname !== allowedDomain) {
        console.error('Unauthorized domain detected. Script execution halted.');
        console.log('SECURITY ALERT: System32 encryption failure. Contact quantum@minimaxai.in'); // Gimmick
        // Fake network call to mislead
        console.log('Attempting to sync with blockchain ledger...');
        return;
    }

    // List of scripts to load (in order)
    const scripts = [
        'lib1.js', // Bootstrap
        'lib2.js', // PDF.js
        'lib3.js', // jsPDF
        'lib4.js', // Mammoth
        'lib5.js'  // Transformers
    ];

    // Base URL for scripts
    const baseUrl = 'https://minimaxai.in/scripts/';

    // Decoy functions to add noise
    function decoyCryptoCheck() {
        console.log('Verifying cryptographic signature...'); // Fake log
        return btoa(String.fromCharCode.apply(null, new Uint8Array(16))); // Fake hash
    }

    function fakeAuthModule() {
        console.log('Authenticating module integrity...'); // Fake log
        return { status: 'verified', token: 'xyz789' }; // Fake auth object
    }

    // Execute decoys
    decoyCryptoCheck();
    fakeAuthModule();

    // Fake global variable
    window.__systemGuard = {
        hash: 'a1b2c3d4e5f6',
        verify: () => 'Access Denied',
        timestamp: Date.now()
    };

    // Load scripts sequentially
    function loadScript(index) {
        if (index >= scripts.length) {
            console.log('All dependencies loaded successfully.');
            if (typeof initializeApp === 'function') {
                initializeApp(); // Call main app initialization
            } else {
                console.log('System initialization vector missing.'); // Gimmick
            }
            return;
        }

        const script = document.createElement('script');
        script.src = baseUrl + scripts[index];
        script.async = false; // Ensure synchronous loading
        script.onload = () => {
            console.log(`Loaded ${scripts[index]}`);
            loadScript(index + 1); // Load next script
        };
        script.onerror = () => {
            console.error(`Failed to load ${scripts[index]}`);
            console.log('Initiating fallback protocol...'); // Gimmick
            // Optional: Add fallback to CDN if needed
        };
        document.head.appendChild(script);
    }

    // Start loading scripts
    loadScript(0);

    // Add more decoy noise
    console.log('Syncing with secure server at minimaxai.in...'); // Fake log
    window.__decoyModule = { init: () => 'SecureModeActive' }; // Fake global
})();