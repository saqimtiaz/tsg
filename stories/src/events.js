// filepath: c:\Users\saq\webdav\tsg\stories\events.js
// Centralized event definitions and helpers

/* ================= EVENT NAMES ================= */
export const AppEvents = {
    // Canvas/Textbox events
    TEXTBOX_MODIFIED: 'textbox-modified',
    FONTSIZE_CHANGED: 'fontsize-changed',
    TEXTBOX_PROPERTY_CHANGED: 'textbox-property-changed',
    
    // Image events
    REQUEST_LOCK: 'request-lock',
    REQUEST_UNLOCK: 'request-unlock',
    
    // UI events
    MODE_CHANGED: 'mode-changed'
};

/* ================= EVENT HELPERS ================= */

/**
 * Dispatch a custom event with type safety
 * @param {string} eventName - Event name from AppEvents
 * @param {*} detail - Optional event detail data
 */
export function dispatchAppEvent(eventName, detail = null) {
    const event = detail 
        ? new CustomEvent(eventName, { detail })
        : new Event(eventName);
    window.dispatchEvent(event);
}

/**
 * Add event listener with type safety
 * @param {string} eventName - Event name from AppEvents
 * @param {Function} handler - Event handler function
 * @returns {Function} Unsubscribe function
 */
export function onAppEvent(eventName, handler) {
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
}