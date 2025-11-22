// Initialize Decimal.js with high precision settings
(function(global) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = global.Decimal = require('decimal.js');
    } else if (typeof define === 'function' && define.amd) {
        define(function() { return global.Decimal; });
    } else {
        if (typeof global.Decimal === 'undefined') {
            throw new Error('decimal.js must be loaded before this script');
        }
    }

    // Configure Decimal settings for high precision
    global.Decimal.set({
        precision: 150,        // Keep precision for extreme zoom levels
        rounding: 4,           // ROUND_HALF_UP for rounding
        minE: -Infinity,      // Remove minimum exponent limit (for infinite zoom)
        maxE: Infinity,       // Remove maximum exponent limit (for infinite zoom)
        crypto: false,         // No need for crypto random
        modulo: 0,             // Remove modulo limit to prevent wrapping (infinite zoom)
        toExpNeg: -Infinity,   // Display exponential notation for very small numbers
        toExpPos: Infinity     // Display exponential notation for very large numbers
    });

})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);