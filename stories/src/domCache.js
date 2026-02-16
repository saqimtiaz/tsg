// filepath: c:\Users\saq\webdav\tsg\stories\domCache.js
// DOM element caching for performance

/* ================= DOM CACHE CLASS ================= */
class DOMCache {
    constructor() {
        this.cache = new Map();
    }
    
    /**
     * Get element by ID (cached)
     * @param {string} id - Element ID
     * @returns {HTMLElement|null}
     */
    get(id) {
        if (!this.cache.has(id)) {
            const element = document.getElementById(id);
            if (element) {
                this.cache.set(id, element);
            }
            return element;
        }
        return this.cache.get(id);
    }
    
    /**
     * Get elements by selector (not cached - returns live NodeList)
     * @param {string} selector - CSS selector
     * @returns {NodeList}
     */
    getAll(selector) {
        return document.querySelectorAll(selector);
    }
    
    /**
     * Check if element exists
     * @param {string} id - Element ID
     * @returns {boolean}
     */
    has(id) {
        return this.get(id) !== null;
    }
    
    /**
     * Manually set cached element (useful for dynamic elements)
     * @param {string} id - Element ID
     * @param {HTMLElement} element - DOM element
     */
    set(id, element) {
        if (element) {
            this.cache.set(id, element);
        }
    }
    
    /**
     * Remove element from cache
     * @param {string} id - Element ID
     */
    remove(id) {
        this.cache.delete(id);
    }
    
    /**
     * Clear entire cache
     */
    clear() {
        this.cache.clear();
    }
    
    /**
     * Get cache size
     * @returns {number}
     */
    get size() {
        return this.cache.size;
    }
}

/* ================= SINGLETON INSTANCE ================= */
export const dom = new DOMCache();

/* ================= UTILITY FUNCTIONS ================= */

/**
 * Get multiple elements by IDs
 * @param {string[]} ids - Array of element IDs
 * @returns {Object} Object with id keys and element values
 */
export function getElements(...ids) {
    return ids.reduce((acc, id) => {
        acc[id] = dom.get(id);
        return acc;
    }, {});
}