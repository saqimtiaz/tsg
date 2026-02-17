/* ================= STATE ================= */
import { CANVAS_BG_COLOR } from './config.js';

export const state = {
	image: {
		img: null,
		filename: null,
		scale: 1,
		offsetX: 0,
		offsetY: 0
	},
	textBoxes: [],
	canvasBackgroundColor: CANVAS_BG_COLOR,
	activeTextBoxId: null,
	textBoxZOrder: [] // Track z-order by box IDs, last = highest
};

/* ================= STATE NOTIFICATIONS ================= */
const stateListeners = new Set();

/**
 * Subscribe to state changes
 * @param {Function} listener - Callback function called when state changes
 * @returns {Function} Unsubscribe function
 */
export function subscribeToState(listener) {
    stateListeners.add(listener);
    return () => stateListeners.delete(listener);
}

/**
 * Notify all listeners that state has changed
 */
function notifyStateChange() {
    stateListeners.forEach(fn => fn(state));
}

/* ================= STATE UPDATE HELPERS ================= */

/**
 * Add a text box and notify listeners
 * @param {Object} box - Text box object
 */
export function addTextBox(box) {
    state.textBoxes.push(box);
    // Add to z-order (will be at top initially)
    if (!state.textBoxZOrder.includes(box.id)) {
        state.textBoxZOrder.push(box.id);
    }
    notifyStateChange();
}

/**
 * Update a text box and notify listeners
 * @param {string} id - Text box ID
 * @param {Object} updates - Properties to update
 */
export function updateTextBox(id, updates) {
    const box = state.textBoxes.find(b => b.id === id);
    if (box) {
        Object.assign(box, updates);
        notifyStateChange();
    }
}

/**
 * Remove a text box and notify listeners
 * @param {string} id - Text box ID
 */
export function removeTextBox(id) {
    const index = state.textBoxes.findIndex(b => b.id === id);
    if (index !== -1) {
        state.textBoxes.splice(index, 1);
        // Remove from z-order
        const zIndex = state.textBoxZOrder.indexOf(id);
        if (zIndex !== -1) {
            state.textBoxZOrder.splice(zIndex, 1);
        }
        notifyStateChange();
    }
}

/**
 * Bring a text box to front (highest z-index)
 * @param {string} id - Text box ID
 */
export function bringTextBoxToFront(id) {
    const zIndex = state.textBoxZOrder.indexOf(id);
    if (zIndex !== -1) {
        // Remove from current position
        state.textBoxZOrder.splice(zIndex, 1);
    }
    // Add to end (highest z-index)
    state.textBoxZOrder.push(id);
    notifyStateChange();
}

/**
 * Manually notify state change (for cases where state is mutated directly)
 */
export function notifyChange() {
    notifyStateChange();
}

/* ================= IMAGE STATE HELPERS ================= */

/**
 * Update image properties and notify listeners
 * @param {Object} updates - Properties to update (img, filename, scale, offsetX, offsetY)
 */
export function updateImage(updates) {
    Object.assign(state.image, updates);
    notifyStateChange();
}

/**
 * Set the image and reset scale/position
 * @param {HTMLImageElement} img - Image element
 * @param {string} filename - Image filename
 * @param {number} canvasWidth - Canvas width for initial positioning
 * @param {number} canvasHeight - Canvas height for initial positioning
 */
export function setImage(img, filename, canvasWidth, canvasHeight) {
    const scale = Math.max(canvasWidth / img.width, canvasHeight / img.height);
    const offsetX = (canvasWidth - img.width * scale) / 2;
    const offsetY = (canvasHeight - img.height * scale) / 2;
    
    Object.assign(state.image, { img, filename, scale, offsetX, offsetY });
    notifyStateChange();
}

/**
 * Reset image to initial position and scale
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 */
export function resetImage(canvasWidth, canvasHeight) {
    const { img } = state.image;
    if (!img) return;
    
    // Use same calculation as setImage
    const scale = Math.max(canvasWidth / img.width, canvasHeight / img.height);
    const offsetX = (canvasWidth - img.width * scale) / 2;
    const offsetY = (canvasHeight - img.height * scale) / 2;
    
    Object.assign(state.image, { scale, offsetX, offsetY });
    notifyStateChange();
}

/**
 * Update canvas background color and notify listeners
 * @param {string} color - Hex color string
 */
export function setCanvasBackgroundColor(color) {
    state.canvasBackgroundColor = color;
    notifyStateChange();
}
