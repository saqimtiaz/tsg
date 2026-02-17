import { state, notifyChange, addTextBox as addTextBoxToState } from "../state.js";
import { showTextControls, hideTextControls, updateCurrentTextObject } from "./textControls.js";
import { resizeCanvas, setIsEditingText } from "../app.js";
import { TEXT_DEFAULTS, FABRIC_CONFIG, TEXTBOX_DEFAULTS, INTERACTION_CONFIG } from "../config.js";
import { generateId, loadFonts, snapToGrid } from "../utils/utils.js";
import { FabricManager } from "../core/fabricManager.js";
import { AppEvents, dispatchAppEvent } from "../events.js";
import { dom } from "../domCache.js";

let fabricManager = null;
const textCanvasEl = dom.get("textCanvas");

/* ================= SCALE NORMALIZATION ================= */
function normalizeObjectScale(obj) {
    const scaleX = obj.scaleX || 1;
    const scaleY = obj.scaleY || 1;
    
    if (scaleX === 1 && scaleY === 1) return false;
    
    // Use average scale for fontSize (handles non-uniform scaling)
    const avgScale = (scaleX + scaleY) / 2;
    const newFontSize = Math.round(obj.fontSize * avgScale);
    const newWidth = Math.round(obj.width * scaleX);
    
    obj.set({
        fontSize: newFontSize,
        width: newWidth,
        scaleX: 1,
        scaleY: 1
    });
    obj.setCoords();
    
    // Notify textControls about the new font size
    dispatchAppEvent(AppEvents.FONTSIZE_CHANGED, { fontSize: newFontSize });
    
    return true;
}

/* ================= STATE SYNC ================= */
function syncTextboxToState(obj, box) {
    const pad = Number(box.padding || 0);
    const offsetX = Number(box.offsetX || 0);
    
    normalizeObjectScale(obj);
    
    Object.assign(box, {
        x: Math.round(obj.left - pad - offsetX),
        y: Math.round(obj.top - pad),
        width: Math.round(obj.width + pad * 2),
        height: Math.round(obj.height + pad * 2),
        text: obj.text || box.text,
        fontSize: obj.fontSize,
        fontFamily: obj.fontFamily,
        fontWeight: obj.fontWeight || 400,
        color: obj.fill,
        lineHeight: obj.lineHeight || 1.5,
        textAlign: obj.textAlign || 'left',
        charSpacing: obj.charSpacing || 0
    });
}

function syncRectToState(obj, box) {
    box.backgroundOpacity = obj.opacity;
    box.background = obj.fill;
}

function syncObjectsToState() {
    if (!fabricManager?.isInitialized()) return;
    
    fabricManager.getObjects().forEach(obj => {
        if (!obj.__boxId) return;
        
        const box = state.textBoxes.find(b => b.id === obj.__boxId);
        if (!box) return;
        
        if (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text') {
            syncTextboxToState(obj, box);
        } else if (obj.type === 'rect') {
            syncRectToState(obj, box);
        }
    });
    
    // Notify state listeners (triggers autosave)
    notifyChange();
}

/* ================= EVENT HANDLERS ================= */
function handleSelection(e) {
    // Update current text object when selection changes
    const activeObj = e.selected?.[0];
    if (activeObj && (activeObj.type === 'textbox' || activeObj.type === 'i-text')) {
        updateCurrentTextObject(activeObj);
    }
}

function handleSelectionCleared() {
    // Hide controls when clicking outside textbox
    hideTextControls();
}

function forwardPointerEvent(eventType) {
    return (opt) => {
        if (opt.target) return; // Only forward if no Fabric object clicked
        
        const mainCanvas = dom.get('canvas');
        if (!mainCanvas) return;
        
        const evt = new PointerEvent(eventType, {
            bubbles: true,
            cancelable: true,
            clientX: opt.e.clientX,
            clientY: opt.e.clientY,
            pointerId: opt.e.pointerId || 1,
            pointerType: opt.e.pointerType || 'mouse'
        });
        mainCanvas.dispatchEvent(evt);
    };
}

function setupFabricEventListeners(canvas) {
    // Selection events - don't show controls automatically
    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', handleSelectionCleared);
    canvas.on('object:selected', handleSelection);
    
    // State sync events
    const syncEvents = ['object:modified', 'object:scaling', 'object:moving', 'object:changed'];
    syncEvents.forEach(event => canvas.on(event, syncObjectsToState));
    
    // Clear snap guides when mouse is released
    canvas.on('mouse:up', () => {
        if (snapGuideLines.length > 0) {
            clearSnapGuides();
            canvas.renderAll();
        }
    });
    
    // Pointer forwarding for image manipulation
    canvas.on('mouse:down', forwardPointerEvent('pointerdown'));
    canvas.on('mouse:move', forwardPointerEvent('pointermove'));
    canvas.on('mouse:up', forwardPointerEvent('pointerup'));
}

/* ================= FABRIC INITIALIZATION ================= */
function ensureFabric() {
    if (fabricManager?.isInitialized()) return;
    if (!textCanvasEl) return;
    
    // Get current canvas dimensions
    const canvasWidth = textCanvasEl.width || 1080;
    const canvasHeight = textCanvasEl.height || 1920;
    
    // Create and initialize FabricManager
    if (!fabricManager) {
        fabricManager = new FabricManager(textCanvasEl);
    }
    
    const canvas = fabricManager.initialize(canvasWidth, canvasHeight);

    // Calculate initial zoom based on CSS scaling
    const pixelWrap = dom.get('pixelWrap');
    if (pixelWrap) {
        const displayScale = parseFloat(pixelWrap.style.width) / canvasWidth;
        if (displayScale && displayScale !== 1) {
            fabricManager.setZoom(displayScale);
        }
    }
    fabricManager.calcOffset();
    
    // Enable immediate dragging without double-click
    canvas.selection = false; // Disable area selection
    canvas.skipTargetFind = false;
    
    setupFabricEventListeners(canvas);
}

/* ================= TEXTBOX CREATION ================= */
function getTextboxDefaults() {
    return {
        editable: TEXTBOX_DEFAULTS.EDITABLE,
        cursorWidth: TEXTBOX_DEFAULTS.CURSOR_WIDTH,
        selectable: TEXTBOX_DEFAULTS.SELECTABLE,
        hasControls: TEXTBOX_DEFAULTS.HAS_CONTROLS,
        hasBorders: TEXTBOX_DEFAULTS.HAS_BORDERS,
        lockUniScaling: TEXTBOX_DEFAULTS.LOCK_UNI_SCALING,
        lockScalingFlip: TEXTBOX_DEFAULTS.LOCK_SCALING_FLIP,
        objectCaching: TEXTBOX_DEFAULTS.OBJECT_CACHING,
        cornerStyle: TEXTBOX_DEFAULTS.CORNER_STYLE,
        cornerColor: TEXTBOX_DEFAULTS.CORNER_COLOR,
        borderColor: TEXTBOX_DEFAULTS.BORDER_COLOR,
        cornerSize: TEXTBOX_DEFAULTS.CORNER_SIZE,
        transparentCorners: TEXTBOX_DEFAULTS.TRANSPARENT_CORNERS,
        padding: TEXTBOX_DEFAULTS.PADDING,
        splitByGrapheme: TEXTBOX_DEFAULTS.SPLIT_BY_GRAPHEME,
        breakWords: TEXTBOX_DEFAULTS.BREAK_WORDS,
        originX: TEXTBOX_DEFAULTS.ORIGIN_X,
        originY: TEXTBOX_DEFAULTS.ORIGIN_Y,

    };
}

function applyTextboxProperties(textbox, box) {
    if (box.textAlign) textbox.set('textAlign', box.textAlign);
    if (box.lineHeight) textbox.set('lineHeight', box.lineHeight);
    else textbox.set('lineHeight', 1.5);
    if (box.charSpacing !== undefined) textbox.set('charSpacing', box.charSpacing);
    if (box.text) textbox.set('text', box.text);
    textbox.set({ scaleX: 1, scaleY: 1 });
}

function createBackgroundRect(box) {
    const { Rect } = window.fabric;
    
    return new Rect({
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        rx: box.radius || 0,
        ry: box.radius || 0,
        fill: box.background || 'transparent',
        opacity: box.backgroundOpacity != null ? box.backgroundOpacity : 1,
        selectable: false,
        evented: false,
        originX: 'left',
        originY: 'top',
        __boxId: box.id
    });
}

function createRectSyncFunction(textbox, rect, box) {
    const pad = Number(box.padding || 0);
    
    return () => {
        const currentW = textbox.getScaledWidth?.() || (textbox.width * (textbox.scaleX || 1));
        const currentH = textbox.getScaledHeight?.() || (textbox.height * (textbox.scaleY || 1));
        
        rect.set({
            left: Math.round(textbox.left - pad),
            top: Math.round(textbox.top - pad),
            width: Math.round(currentW + pad * 2),
            height: Math.round(currentH + pad * 2)
        });
        rect.setCoords();
    };
}

/* ================= SNAP GUIDES ================= */
let snapGuideLines = [];
let currentSnapState = { horizontal: false, vertical: false, alignmentCount: 0 };

function clearSnapGuides() {
    const canvas = fabricManager?.getCanvas();
    if (!canvas || snapGuideLines.length === 0) return;
    
    // Remove all snap guide lines from canvas
    snapGuideLines.forEach(line => canvas.remove(line));
    snapGuideLines = [];
    currentSnapState = { horizontal: false, vertical: false, alignmentCount: 0 };
}

function drawSnapGuide(orientation, position) {
    const canvas = fabricManager?.getCanvas();
    if (!canvas) return;
    
    const { Line } = window.fabric;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    let line;
    if (orientation === 'vertical') {
        // Vertical line at horizontal center
        line = new Line([position, 0, position, canvasHeight], {
            stroke: '#00ff00',
            strokeWidth: 4,
            strokeDashArray: [8, 8],
            selectable: false,
            evented: false,
            __isSnapGuide: true
        });
    } else {
        // Horizontal line at vertical center
        line = new Line([0, position, canvasWidth, position], {
            stroke: '#00ff00',
            strokeWidth: 4,
            strokeDashArray: [8, 8],
            selectable: false,
            evented: false,
            __isSnapGuide: true
        });
    }
    
    canvas.add(line);
    snapGuideLines.push(line);
}

function handleTextboxMove(textbox, box, syncRect) {
    const pad = Number(box.padding || 0);
    const objWidth = textbox.getScaledWidth();
    const objHeight = textbox.getScaledHeight();
    const canvas = fabricManager.getCanvas();
    const canvasWidth = canvas?.width || 1080;
    const canvasHeight = canvas?.height || 1920;
    
    // Snap to grid
    textbox.left = snapToGrid(textbox.left, INTERACTION_CONFIG.GRID_SIZE);
    textbox.top = snapToGrid(textbox.top, INTERACTION_CONFIG.GRID_SIZE);
    
    // Constrain to canvas bounds
    textbox.left = Math.max(pad, Math.min(canvasWidth - pad - objWidth, textbox.left));
    textbox.top = Math.max(pad, Math.min(canvasHeight - pad - objHeight, textbox.top));
    
    // Check for center alignment and snap
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const snapThreshold = 10; // Fixed threshold
    
    const textboxCenterX = textbox.left + objWidth / 2;
    const textboxCenterY = textbox.top + objHeight / 2;
    
    let isHorizontallyCentered = false;
    let isVerticallyCentered = false;
    let alignmentGuides = []; // Store alignment guide positions
    
    // Canvas center snap
    if (Math.abs(textboxCenterX - centerX) < snapThreshold) {
        textbox.left = centerX - objWidth / 2;
        isHorizontallyCentered = true;
    }
    
    if (Math.abs(textboxCenterY - centerY) < snapThreshold) {
        textbox.top = centerY - objHeight / 2;
        isVerticallyCentered = true;
    }
    
    // Check alignment with other textboxes
    const otherTextboxes = canvas.getObjects().filter(obj => 
        obj.type === 'textbox' && obj.__boxId !== textbox.__boxId
    );
    
    otherTextboxes.forEach(other => {
        const otherBox = state.textBoxes.find(b => b.id === other.__boxId);
        if (!otherBox) return;
        
        const otherPad = Number(otherBox.padding || 0);
        const otherOffsetX = Number(otherBox.offsetX || 0);
        const offsetX = Number(box.offsetX || 0);
        
        // Textbox positions
        const otherLeft = other.left;
        const otherTop = other.top;
        const otherCenterX = other.left + other.getScaledWidth() / 2;
        const otherCenterY = other.top + other.getScaledHeight() / 2;
        
        // Rounded rectangle (background) positions - account for offsetX
        const otherRectLeft = otherLeft - otherPad - otherOffsetX;
        const otherRectTop = otherTop - otherPad;
        const otherRectWidth = other.getScaledWidth() + otherPad * 2;
        const otherRectHeight = other.getScaledHeight() + otherPad * 2;
        const otherRectCenterX = otherRectLeft + otherRectWidth / 2 + otherOffsetX;
        const otherRectCenterY = otherRectTop + otherRectHeight / 2;
        const otherRectRight = otherRectLeft + otherRectWidth;
        const otherRectBottom = otherRectTop + otherRectHeight;
        
        // Current textbox's rectangle positions - account for offsetX
        const currentRectLeft = textbox.left - pad - offsetX;
        const currentRectTop = textbox.top - pad;
        const currentRectWidth = objWidth + pad * 2;
        const currentRectHeight = objHeight + pad * 2;
        const currentRectCenterX = currentRectLeft + currentRectWidth / 2 + offsetX;
        const currentRectCenterY = currentRectTop + currentRectHeight / 2;
        const currentRectRight = currentRectLeft + currentRectWidth;
        const currentRectBottom = currentRectTop + currentRectHeight;
        
        // Vertical alignment (same X coordinate)
        // Check textbox left edges
        if (Math.abs(textbox.left - otherLeft) < snapThreshold) {
            textbox.left = otherLeft;
            alignmentGuides.push({ type: 'vertical', position: otherLeft });
        }
        // Check textbox center X
        else if (Math.abs(textboxCenterX - otherCenterX) < snapThreshold) {
            textbox.left = otherCenterX - objWidth / 2;
            alignmentGuides.push({ type: 'vertical', position: otherCenterX });
        }
        // Check rectangle left edges
        else if (Math.abs(currentRectLeft - otherRectLeft) < snapThreshold) {
            textbox.left = otherRectLeft + pad + offsetX;
            alignmentGuides.push({ type: 'vertical', position: otherRectLeft });
        }
        // Check rectangle center X
        else if (Math.abs(currentRectCenterX - otherRectCenterX) < snapThreshold) {
            const newRectLeft = otherRectCenterX - currentRectWidth / 2 - offsetX;
            textbox.left = newRectLeft + pad + offsetX;
            alignmentGuides.push({ type: 'vertical', position: otherRectCenterX });
        }
        // Check rectangle right edges
        else if (Math.abs(currentRectRight - otherRectRight) < snapThreshold) {
            textbox.left = otherRectRight - currentRectWidth + pad + offsetX;
            alignmentGuides.push({ type: 'vertical', position: otherRectRight });
        }
        
        // Horizontal alignment (same Y coordinate)
        // Check textbox top edges
        if (Math.abs(textbox.top - otherTop) < snapThreshold) {
            textbox.top = otherTop;
            alignmentGuides.push({ type: 'horizontal', position: otherTop });
        }
        // Check textbox center Y
        else if (Math.abs(textboxCenterY - otherCenterY) < snapThreshold) {
            textbox.top = otherCenterY - objHeight / 2;
            alignmentGuides.push({ type: 'horizontal', position: otherCenterY });
        }
        // Check rectangle top edges
        else if (Math.abs(currentRectTop - otherRectTop) < snapThreshold) {
            textbox.top = otherRectTop + pad;
            alignmentGuides.push({ type: 'horizontal', position: otherRectTop });
        }
        // Check rectangle center Y
        else if (Math.abs(currentRectCenterY - otherRectCenterY) < snapThreshold) {
            textbox.top = otherRectCenterY - currentRectHeight / 2 + pad;
            alignmentGuides.push({ type: 'horizontal', position: otherRectCenterY });
        }
        // Check rectangle bottom edges
        else if (Math.abs(currentRectBottom - otherRectBottom) < snapThreshold) {
            textbox.top = otherRectBottom - currentRectHeight + pad;
            alignmentGuides.push({ type: 'horizontal', position: otherRectBottom });
        }
    });
    
    // Update guides
    const needsUpdate = (currentSnapState.horizontal !== isHorizontallyCentered) || 
                       (currentSnapState.vertical !== isVerticallyCentered) ||
                       (alignmentGuides.length > 0) ||
                       (currentSnapState.alignmentCount !== alignmentGuides.length);
    
    if (needsUpdate) {
        clearSnapGuides();
        
        // Canvas center guides
        if (isHorizontallyCentered) {
            drawSnapGuide('vertical', centerX);
        }
        if (isVerticallyCentered) {
            drawSnapGuide('horizontal', centerY);
        }
        
        // Alignment guides with other textboxes
        alignmentGuides.forEach(guide => {
            drawSnapGuide(guide.type, guide.position);
        });
        
        currentSnapState.horizontal = isHorizontallyCentered;
        currentSnapState.vertical = isVerticallyCentered;
        currentSnapState.alignmentCount = alignmentGuides.length;
    }
    
    textbox.setCoords();
    syncRect();
}

function handleTextboxScale(textbox, box, syncRect) {
    const pad = Number(box.padding || 0);
    const objWidth = textbox.getScaledWidth();
    const objHeight = textbox.getScaledHeight();
    const canvas = fabricManager.getCanvas();
    const canvasWidth = canvas?.width || 1080;
    const canvasHeight = canvas?.height || 1920;
    
    // Prevent scaling beyond canvas bounds
    if (textbox.left + objWidth > canvasWidth - pad) {
        textbox.scaleX = (canvasWidth - pad - textbox.left) / textbox.width;
    }
    if (textbox.top + objHeight > canvasHeight - pad) {
        textbox.scaleY = (canvasHeight - pad - textbox.top) / textbox.height;
    }
    
    textbox.setCoords();
    syncRect();
    fabricManager.renderAll();
}

function handleEditingEntered() {
    if (textCanvasEl) textCanvasEl.style.pointerEvents = 'auto';
    setIsEditingText(true);
}

function handleEditingExited() {
    setTimeout(() => setIsEditingText(false), 100);
    syncObjectsToState();
}

function interceptPropertyChanges(textbox, syncRect) {
    const originalSet = textbox.set.bind(textbox);
    textbox.set = function(key, value) {
        const result = originalSet(key, value);
        if (key === 'fontSize' || key === 'fontFamily' || key === 'fontWeight') {
            setTimeout(() => {
                syncRect();
                fabricManager.renderAll();
            }, 0);
        }
        return result;
    };
}

function setupTextboxEventHandlers(textbox, rect, box) {
    const syncRect = createRectSyncFunction(textbox, rect, box);
    
    textbox.on('moving', () => handleTextboxMove(textbox, box, syncRect));
    textbox.on('scaling', () => handleTextboxScale(textbox, box, syncRect));
    textbox.on('modified', () => { 
        syncRect(); 
        syncObjectsToState(); 
        fabricManager.renderAll(); 
    });
    textbox.on('changed', () => { syncRect(); syncObjectsToState(); fabricManager.renderAll(); });
    textbox.on('editing:entered', handleEditingEntered);
    textbox.on('editing:exited', handleEditingExited);
    
    interceptPropertyChanges(textbox, syncRect);
}

function createTextbox(box) {
    const { Textbox } = window.fabric;
    const pad = Number(box.padding || 0);
    const offsetX = Number(box.offsetX || 0);
    
    const textbox = new Textbox('', {
        left: box.x + pad + offsetX,
        top: box.y + pad,
        width: Math.max(10, box.width - pad * 2),
        fontFamily: box.fontFamily || 'Merriweather',
        fontSize: box.fontSize || 16,
        fontWeight: box.fontWeight || 400,
        fill: box.color || '#000',
        ...getTextboxDefaults()
    });
    
    applyTextboxProperties(textbox, box);
    
    // Disable vertical resize handles
    textbox.setControlsVisibility({ mt: false, mb: false });
    
    textbox.__boxId = box.id;
    
    return textbox;
}

function createBoxObjects(box) {
    const rect = createBackgroundRect(box);
    const textbox = createTextbox(box);
    
    setupTextboxEventHandlers(textbox, rect, box);
    
    // Force textbox to calculate its dimensions
    textbox.initDimensions();
    textbox.setCoords();
    
    // Sync rect to match textbox after initialization
    const pad = Number(box.padding || 0);
    const currentW = textbox.getScaledWidth?.() || (textbox.width * (textbox.scaleX || 1));
    const currentH = textbox.getScaledHeight?.() || (textbox.height * (textbox.scaleY || 1));
    
    rect.set({
        left: Math.round(textbox.left - pad),
        top: Math.round(textbox.top - pad),
        width: Math.round(currentW + pad * 2),
        height: Math.round(currentH + pad * 2)
    });
    
    return { rect, it: textbox };
}

/* ================= PUBLIC API ================= */
export async function addTextBox() {
    // Wait for all fonts declared in CSS to be loaded
    if (document.fonts?.ready) {
        await document.fonts.ready;
    }
    
    ensureFabric();
    
    const box = {
        id: generateId(),
        x: TEXT_DEFAULTS.X,
        y: TEXT_DEFAULTS.Y,
        width: TEXT_DEFAULTS.WIDTH,
        height: TEXT_DEFAULTS.HEIGHT,
        text: '',
        fontSize: TEXT_DEFAULTS.FONT_SIZE,
        fontFamily: TEXT_DEFAULTS.FONT_FAMILY,
        fontWeight: TEXT_DEFAULTS.FONT_WEIGHT,
        color: TEXT_DEFAULTS.COLOR,
        background: TEXT_DEFAULTS.BACKGROUND,
        backgroundOpacity: TEXT_DEFAULTS.BACKGROUND_OPACITY,
        padding: TEXT_DEFAULTS.PADDING,
        radius: TEXT_DEFAULTS.RADIUS,
        _new: true
    };
    
    // Add to state (triggers autosave via state notification)
    addTextBoxToState(box);
    await renderTextBoxes();
    
    // Focus and enter editing mode on the newly created textbox
    const canvas = fabricManager?.getCanvas();
    if (canvas) {
        const newTextbox = canvas.getObjects().find(obj => obj.__boxId === box.id && obj.type === 'textbox');
        if (newTextbox) {
            canvas.setActiveObject(newTextbox);
            newTextbox.enterEditing();
            newTextbox.selectAll();
            canvas.renderAll();
        }
    }
}

export function enterTextMode() {
    ensureFabric();
    
    if (textCanvasEl) {
        textCanvasEl.classList.remove("canvas-disabled");
        textCanvasEl.style.pointerEvents = 'auto';
    }
    
    // Enable Fabric's upper canvas pointer events
    const upperCanvas = textCanvasEl?.parentElement?.querySelector('.upper-canvas');
    if (upperCanvas) {
        upperCanvas.style.pointerEvents = 'auto';
    }
    
    dispatchAppEvent(AppEvents.REQUEST_LOCK);
}

export function exitTextMode() {
    // Exit editing on any active text
    const canvas = fabricManager?.getCanvas();
    if (canvas?.getActiveObject()?.isEditing) {
        canvas.getActiveObject().exitEditing();
    }
    
    // Deselect all objects
    if (fabricManager?.isInitialized()) {
        fabricManager.clearSelection();
    }
    
    // Always hide text controls when exiting text mode
    hideTextControls();
    
    // Disable text canvas interaction
    if (textCanvasEl) {
        textCanvasEl.style.pointerEvents = 'none';
        textCanvasEl.classList.add("canvas-disabled");
        
        const upperCanvas = textCanvasEl.parentElement?.querySelector('.upper-canvas');
        if (upperCanvas) {
            upperCanvas.style.pointerEvents = 'none';
        }
    }
    
    dispatchAppEvent(AppEvents.REQUEST_UNLOCK);
}

export function renderTextBoxes() {
    ensureFabric();
    if (!fabricManager?.isInitialized()) {
        console.warn('Fabric canvas not initialized!');
        return Promise.resolve();
    }
    
    // Load all fonts used in textboxes before rendering
    const fontsToLoad = [...new Set(state.textBoxes.map(box => box.fontFamily || 'Merriweather'))];
    const fontLoadPromises = document.fonts 
        ? fontsToLoad.map(font => document.fonts.load(`16px ${font}`).catch(() => {}))
        : [];
    
    return Promise.all(fontLoadPromises).then(() => {
        fabricManager.clear();

        console.log('Rendering text boxes:', state.textBoxes.length);
        state.textBoxes.forEach(box => {
            console.log('Creating box:', box);
            const { rect, it } = createBoxObjects(box);
            fabricManager.add(rect);
            fabricManager.add(it);

            if (box._new) {
                box._new = false;
            }

            it.setCoords();
            rect.setCoords();
        });

        // Render once to ensure proper layout
        fabricManager.renderAll();
        
        console.log('Fabric objects after render:', fabricManager.getObjects().length);
    });
}

export function enableTextControls() {}
export function disableTextControls() {}
