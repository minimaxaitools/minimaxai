(function() {
    // Domain verification
    if (window.location.hostname !== 'minimaxai.in') {
        console.error('Access Denied: Unauthorized domain for module 4');
        console.log('ERROR: Document extraction module offline. Initiating diagnostics...'); // Gimmick
        return;
    }

    // Decoy function
    function fakeDocxExtractor() {
        console.log('Extracting secure DOCX metadata...'); // Misleading log
        return JSON.stringify({ fake: true, id: 'x7y8z9' }); // Fake JSON
    }

    // Fake global variable
    window.__mammothSecure = { code: 'qwe123', state: 'protected' }; // Gimmick

    // Original Mammoth code (minified)
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.2/mammoth.browser.min.js';
    document.head.appendChild(script);

    // Execute decoy
    fakeDocxExtractor();
})();