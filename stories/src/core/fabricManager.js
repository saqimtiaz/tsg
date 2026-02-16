// filepath: c:\Users\saq\webdav\tsg\stories\fabricManager.js
// Fabric.js canvas manager

import { FABRIC_CONFIG, TEXTBOX_DEFAULTS } from './../config.js';

export class FabricManager {
    constructor(canvasElement) {
        this.canvas = null;
        this.canvasElement = canvasElement;
    }
    
    /**
     * Initialize the Fabric canvas
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @returns {fabric.Canvas} The initialized canvas
     */
    initialize(width, height) {
        if (this.canvas) return this.canvas;
        
        const { Canvas } = window.fabric;
        
        this.canvas = new Canvas(this.canvasElement, {
            enableRetinaScaling: FABRIC_CONFIG.ENABLE_RETINA_SCALING,
            devicePixelRatio: FABRIC_CONFIG.DEVICE_PIXEL_RATIO,
            preserveObjectStacking: FABRIC_CONFIG.PRESERVE_OBJECT_STACKING,
            selection: FABRIC_CONFIG.SELECTION
        });
        
        this.canvas.setDimensions({ width, height });
        this.setupDefaultCursors();
        
        // Make globally accessible for legacy code
        globalThis.__fabricCanvas = this.canvas;
        
        return this.canvas;
    }
    
    /**
     * Set up default cursor styles
     */
    setupDefaultCursors() {
        if (!this.canvas) return;
        
        this.canvas.defaultCursor = FABRIC_CONFIG.DEFAULT_CURSOR;
        this.canvas.hoverCursor = FABRIC_CONFIG.HOVER_CURSOR;
    }
    
    /**
     * Set the zoom level and update canvas
     * @param {number} scale - Zoom scale
     */
    setZoom(scale) {
        if (!this.canvas) return;
        
        try {
            this.canvas.setZoom(scale);
            this.canvas.calcOffset();
            this.canvas.renderAll();
        } catch (e) {
            console.warn('Failed to set zoom:', e);
        }
    }
    
    /**
     * Get the currently active textbox
     * @returns {fabric.Textbox|null}
     */
    getActiveTextbox() {
        if (!this.canvas) return null;
        
        const active = this.canvas.getActiveObject();
        return active?.type === 'textbox' ? active : null;
    }
    
    /**
     * Get all objects with a specific box ID
     * @param {string} boxId - The box ID to search for
     * @returns {fabric.Object[]}
     */
    getObjectsByBoxId(boxId) {
        if (!this.canvas) return [];
        
        return this.canvas.getObjects().filter(obj => obj.__boxId === boxId);
    }
    
    /**
     * Remove all objects with a specific box ID
     * @param {string} boxId - The box ID to remove
     */
    removeObjectsByBoxId(boxId) {
        if (!this.canvas) return;
        
        const objects = this.getObjectsByBoxId(boxId);
        objects.forEach(obj => this.canvas.remove(obj));
        this.canvas.renderAll();
    }
    
    /**
     * Clear the current selection
     */
    clearSelection() {
        if (!this.canvas) return;
        
        this.canvas.discardActiveObject();
        this.canvas.renderAll();
    }
    
    /**
     * Clear all objects from canvas
     */
    clear() {
        if (!this.canvas) return;
        
        this.canvas.clear();
    }
    
    /**
     * Render the canvas
     */
    renderAll() {
        if (!this.canvas) return;
        
        this.canvas.renderAll();
    }
    
    /**
     * Get all canvas objects
     * @returns {fabric.Object[]}
     */
    getObjects() {
        if (!this.canvas) return [];
        
        return this.canvas.getObjects();
    }
    
    /**
     * Add an object to the canvas
     * @param {fabric.Object} obj - The object to add
     */
    add(obj) {
        if (!this.canvas) return;
        
        this.canvas.add(obj);
    }
    
    /**
     * Remove an object from the canvas
     * @param {fabric.Object} obj - The object to remove
     */
    remove(obj) {
        if (!this.canvas) return;
        
        this.canvas.remove(obj);
    }
    
    /**
     * Set canvas dimensions
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     */
    setDimensions(width, height) {
        if (!this.canvas) return;
        
        this.canvas.setDimensions({ width, height });
    }
    
    /**
     * Calculate canvas offset (for pointer events)
     */
    calcOffset() {
        if (!this.canvas) return;
        
        try {
            this.canvas.calcOffset();
        } catch (e) {
            console.warn('Failed to calculate offset:', e);
        }
    }
    
    /**
     * Add event listener to canvas
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    on(event, handler) {
        if (!this.canvas) return;
        
        this.canvas.on(event, handler);
    }
    
    /**
     * Check if canvas is initialized
     * @returns {boolean}
     */
    isInitialized() {
        return this.canvas !== null;
    }
    
    /**
     * Get the underlying Fabric canvas
     * @returns {fabric.Canvas|null}
     */
    getCanvas() {
        return this.canvas;
    }
}