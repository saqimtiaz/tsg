import { state, removeTextBox, notifyChange } from "../state.js";
import { PRESET_VALUES, COLORS } from "../config.js";
import { rgbToHex } from "../utils/utils.js";
import { AppEvents, dispatchAppEvent, onAppEvent } from "../events.js";
import { dom } from "../domCache.js";

let currentTextObject = null;
let fabricCanvas = null;

/* ================= UTILITIES ================= */
function ensureFabricCanvas() {
    if (!fabricCanvas) {
        fabricCanvas = window.__fabricCanvas;
    }
    return fabricCanvas;
}

function getActiveTextbox() {
    const canvas = ensureFabricCanvas();
    if (!canvas) return null;
    
    const active = canvas.getActiveObject();
    return active?.type === 'textbox' ? active : null;
}

/* ================= STATE SYNC ================= */
function syncObjectsToState() {
    const canvas = ensureFabricCanvas();
    if (!canvas) return;
    
    canvas.getObjects().forEach(obj => {
        if (!obj.__boxId) return;
        
        const box = state.textBoxes.find(b => b.id === obj.__boxId);
        if (!box) return;
        
        // Sync textbox properties
        if (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text') {
            const pad = Number(box.padding || 0);
            const offsetX = Number(box.offsetX || 0);
            
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
        // Sync rect properties
        else if (obj.type === 'rect') {
            box.backgroundOpacity = obj.opacity;
            box.background = obj.fill;
        }
    });
    
    // Notify state listeners (triggers autosave)
    notifyChange();
}

/* ================= PROPERTY SETTERS ================= */
function setTextboxProperty(property, value, customHandler = null) {
    if (!currentTextObject) return;
    
    if (customHandler) {
        customHandler(value);
    } else {
        currentTextObject.set(property, value);
    }
    
    // Trigger render and sync for font-related properties that affect layout
    // These need immediate render to resize the background rect
    if (['fontSize', 'fontFamily', 'fontWeight'].includes(property)) {
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('textbox-property-changed', { 
                detail: { property, value }
            }));
            ensureFabricCanvas()?.renderAll();
        }, 0);
    }
    
    // Sync all changes to state (this reads from Fabric objects and updates state)
    syncObjectsToState();
    updateActiveStates();
    ensureFabricCanvas()?.renderAll();
}

/* ================= PANEL MANAGEMENT ================= */
class ControlPanel {
    constructor(buttonId, panelId) {
        this.button = document.getElementById(buttonId);
        this.panel = document.getElementById(panelId);
        
        if (this.button && this.panel) {
            this.setupToggle();
        }
    }
    
    setupToggle() {
        this.button.addEventListener('click', () => this.toggle());
    }
    
    toggle() {
        const wasActive = this.button.classList.contains('active');
        closeAllPanels();
        
        if (!wasActive) {
            this.button.classList.add('active');
            this.panel.classList.add('active');
        }
    }
    
    close() {
        this.button?.classList.remove('active');
        this.panel?.classList.remove('active');
    }
}

// Initialize all control panels
const panels = {
    font: new ControlPanel('fontButton', 'fontPanel'),
    fontSize: new ControlPanel('fontSizeButton', 'fontSizePanel'),
    fontWeight: new ControlPanel('fontWeightButton', 'fontWeightPanel'),
    textColor: new ControlPanel('textColorButton', 'textColorPanel'),
    bgColor: new ControlPanel('bgColorButton', 'bgColorPanel'),
    bgOpacity: new ControlPanel('bgOpacityButton', 'bgOpacityPanel'),
    lineHeight: new ControlPanel('lineHeightButton', 'lineHeightPanel'),
    charSpacing: new ControlPanel('charSpacingButton', 'charSpacingPanel'),
    textAlign: new ControlPanel('textAlignButton', 'textAlignPanel'),
    padding: new ControlPanel('paddingButton', 'paddingPanel'),
    offset: new ControlPanel('offsetButton', 'offsetPanel')
};

function closeAllPanels() {
    Object.values(panels).forEach(panel => panel.close());
}

/* ================= CUSTOM HANDLERS ================= */

/**
 * Centralized handler for complex property updates
 * Guarantees syncObjectsToState() and notifyChange() are called
 */
function updateComplexProperty(property, value, updater) {
    if (!currentTextObject) return;
    
    const box = state.textBoxes.find(b => b.id === currentTextObject.__boxId);
    if (!box) return;
    
    // Call custom updater logic
    updater(currentTextObject, box, value);
    
    // Always sync to state and render
    syncObjectsToState();
    updateActiveStates();
    ensureFabricCanvas()?.renderAll();
}

function handlePaddingChange(value) {
    updateComplexProperty('padding', value, (textbox, box, val) => {
        const oldPad = Number(box.padding || 0);
        const newPad = Number(val);
        const delta = newPad - oldPad;
        
        box.padding = newPad;
        
        textbox.set({
            left: textbox.left + delta,
            top: textbox.top + delta,
            width: Math.max(10, textbox.width - delta * 2)
        });
        textbox.setCoords();
        
        const rect = ensureFabricCanvas()?.getObjects().find(
            obj => obj.type === 'rect' && obj.__boxId === box.id
        );
        if (rect) {
            rect.set({
                left: textbox.left - newPad,
                top: textbox.top - newPad,
                width: textbox.width + newPad * 2,
                height: textbox.height + newPad * 2
            });
        }
    });
}

function handleOffsetChange(value) {
    updateComplexProperty('offsetX', value, (textbox, box, val) => {
        const oldOffset = Number(box.offsetX || 0);
        const newOffset = Number(val);
        const delta = newOffset - oldOffset;
        
        box.offsetX = newOffset;
        textbox.set({ left: textbox.left + delta });
        textbox.setCoords();
    });
}

function handleBgColorChange(color) {
    updateComplexProperty('bgColor', color, (textbox, box, val) => {
        box.background = val;
        
        const rect = ensureFabricCanvas()?.getObjects().find(
            obj => obj.type === 'rect' && obj.__boxId === box.id
        );
        if (rect) {
            rect.set('fill', val);
        }
    });
}

function handleBgOpacityChange(value) {
    updateComplexProperty('bgOpacity', value, (textbox, box, val) => {
        box.backgroundOpacity = val;
        
        const rect = ensureFabricCanvas()?.getObjects().find(
            obj => obj.type === 'rect' && obj.__boxId === box.id
        );
        if (rect) {
            rect.set('opacity', val);
        }
    });
}

/* ================= BUTTON CONFIGURATION ================= */
const buttonConfigs = [
    { selector: '#fontSizePanel button', property: 'fontSize', getValue: el => parseInt(el.dataset.fontsize || el.textContent) },
    { selector: '#fontWeightPanel button', property: 'fontWeight', getValue: el => parseInt(el.dataset.weight) },
    { selector: '#lineHeightPanel button', property: 'lineHeight', getValue: el => parseFloat(el.dataset.lineheight || el.textContent) },
    { selector: '#charSpacingPanel button', property: 'charSpacing', getValue: el => parseInt(el.dataset.charspacing || el.textContent) },
    { selector: '#textAlignPanel button', property: 'textAlign', getValue: el => el.dataset.align },
    { selector: '#paddingPanel button', property: 'padding', getValue: el => parseInt(el.dataset.padding || el.textContent), customHandler: handlePaddingChange },
    { selector: '#offsetPanel button', property: 'offsetX', getValue: el => parseInt(el.dataset.offset || el.textContent), customHandler: handleOffsetChange }
];

/* ================= ACTIVE STATE UPDATES ================= */
function updateActiveStates() {
    if (!currentTextObject) return;
    
    const box = state.textBoxes.find(b => b.id === currentTextObject.__boxId);
    if (!box) return;
    
    // Update font size buttons with dynamic size support
    updateFontSizeButtons();
    
    document.querySelectorAll('#fontWeightPanel button').forEach(btn => {
        const weight = parseInt(btn.dataset.weight);
        btn.classList.toggle('selected', weight === currentTextObject.fontWeight);
    });
    
    document.querySelectorAll('#lineHeightPanel button').forEach(btn => {
        const lineHeight = parseFloat(btn.dataset.lineheight || btn.textContent);
        btn.classList.toggle('selected', Math.abs(lineHeight - (currentTextObject.lineHeight || 1.5)) < 0.01);
    });
    
    document.querySelectorAll('#charSpacingPanel button').forEach(btn => {
        const spacing = parseInt(btn.dataset.charspacing || btn.textContent);
        btn.classList.toggle('selected', spacing === (currentTextObject.charSpacing || 0));
    });
    
    document.querySelectorAll('#textAlignPanel button').forEach(btn => {
        const align = btn.dataset.align;
        btn.classList.toggle('selected', align === (currentTextObject.textAlign || 'left'));
    });
    
    document.querySelectorAll('#paddingPanel button').forEach(btn => {
        const padding = parseInt(btn.dataset.padding || btn.textContent);
        btn.classList.toggle('selected', padding === (box.padding || 0));
    });
    
    document.querySelectorAll('#offsetPanel button').forEach(btn => {
        const offset = parseInt(btn.dataset.offset || btn.textContent);
        btn.classList.toggle('selected', offset === (box.offsetX || 0));
    });
    
    document.querySelectorAll('#bgOpacityPanel button').forEach(btn => {
        const opacity = parseFloat(btn.dataset.bgopacity || btn.textContent);
        btn.classList.toggle('selected', Math.abs(opacity - (box.backgroundOpacity ?? 1)) < 0.01);
    });
    
    document.querySelectorAll('#fontPanel button').forEach(btn => {
        const font = btn.dataset.font;
        btn.classList.toggle('selected', font === currentTextObject.fontFamily);
    });
}

function updateFontSizeButtons() {
    if (!currentTextObject) return;
    
    const currentSize = Math.round(currentTextObject.fontSize);
    const fontSizePanel = document.getElementById('fontSizePanel');
    if (!fontSizePanel) return;
    
    // Preset sizes from config
    const presetSizes = PRESET_VALUES.FONT_SIZES;
    
    // Remove any existing dynamic button
    const existingDynamic = fontSizePanel.querySelector('.dynamic-size');
    if (existingDynamic) {
        existingDynamic.remove();
    }
    
    // Check if current size matches any preset
    const hasPreset = presetSizes.includes(currentSize);
    
    // If current size doesn't match presets, add a dynamic button
    if (!hasPreset) {
        const dynamicBtn = document.createElement('button');
        dynamicBtn.className = 'dynamic-size selected';
        dynamicBtn.dataset.fontsize = currentSize.toString();
        dynamicBtn.textContent = currentSize.toString();
        dynamicBtn.addEventListener('click', () => {
            setTextboxProperty('fontSize', currentSize);
        });
        
        // Insert in sorted position
        const buttons = Array.from(fontSizePanel.querySelectorAll('button'));
        let inserted = false;
        for (let i = 0; i < buttons.length; i++) {
            const btnSize = parseInt(buttons[i].dataset.fontsize || buttons[i].textContent);
            if (currentSize < btnSize) {
                fontSizePanel.insertBefore(dynamicBtn, buttons[i]);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            fontSizePanel.appendChild(dynamicBtn);
        }
    }
    
    // Update selected state on all buttons
    document.querySelectorAll('#fontSizePanel button').forEach(btn => {
        const size = parseInt(btn.dataset.fontsize || btn.textContent);
        btn.classList.toggle('selected', size === currentSize);
    });
}

/* ================= HELPER FUNCTIONS ================= */
function deleteCurrentTextBox() {
    if (!currentTextObject) return;
    
    const canvas = ensureFabricCanvas();
    if (!canvas) return;
    
    const boxId = currentTextObject.__boxId;
    
    // Remove from Fabric canvas
    const objectsToRemove = canvas.getObjects().filter(obj => obj.__boxId === boxId);
    objectsToRemove.forEach(obj => canvas.remove(obj));
    
    canvas.discardActiveObject();
    canvas.renderAll();
    
    // Remove from state (this will trigger autosave via state notification)
    removeTextBox(boxId);
    
    currentTextObject = null;
    hideTextControls();
}

/* ================= EVENT SETUP ================= */
async function setupButtonHandlers() {
    buttonConfigs.forEach(config => {
        document.querySelectorAll(config.selector).forEach(btn => {
            btn.addEventListener('click', () => {
                const value = config.getValue(btn);
                setTextboxProperty(config.property, value, config.customHandler);
            });
        });
    });
    
    document.querySelectorAll('#fontPanel button').forEach(btn => {
        btn.addEventListener('click', () => {
            const font = btn.dataset.font;
            if (font) setTextboxProperty('fontFamily', font);
        });
    });
    
    document.querySelectorAll('#textColorPanel .swatches button').forEach(btn => {
        btn.addEventListener('click', () => {
            const color = window.getComputedStyle(btn).getPropertyValue('--c');
            if (color) {
                setTextboxProperty('fill', color);
            }
        });
    });
    
    const textColorPicker = document.getElementById('textColor');
    if (textColorPicker) {
        textColorPicker.addEventListener('input', (e) => {
            setTextboxProperty('fill', e.target.value);
        });
    }
    
    // Background color panel - add color picker
    setupBgColorPanel();
    
    document.querySelectorAll('#bgOpacityPanel button').forEach(btn => {
        btn.addEventListener('click', () => {
            const opacity = parseFloat(btn.dataset.bgopacity || btn.textContent);
            handleBgOpacityChange(opacity);
        });
    });
    
    const deleteBtn = document.getElementById('deleteTextBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', deleteCurrentTextBox);
    }
    
    // Populate font panel from fonts.js
    await populateFontPanel();
}

function setupBgColorPanel() {
    const bgColorPanel = document.getElementById('bgColorPanel');
    if (!bgColorPanel) return;
    
    // Create color picker if it doesn't exist
    let bgColorPicker = bgColorPanel.querySelector('input[type="color"]');
    if (!bgColorPicker) {
        bgColorPicker = document.createElement('input');
        bgColorPicker.type = 'color';
        bgColorPicker.id = 'bgColor';
        const pickerBtn = document.createElement('button');
        pickerBtn.className = 'picker-btn';
        pickerBtn.textContent = 'Custom…';
        pickerBtn.appendChild(bgColorPicker);
        
        const swatches = document.createElement('div');
        swatches.className = 'swatches';
        
        // Add color swatches
        const colors = ['#000000', '#ffffff', '#1a1a1a', '#333333', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#af52de'];
        colors.forEach(color => {
            const btn = document.createElement('button');
            btn.style.setProperty('--c', color);
            btn.addEventListener('click', () => {
                handleBgColorChange(color);
            });
            swatches.appendChild(btn);
        });
        
        bgColorPanel.appendChild(swatches);
        bgColorPanel.appendChild(pickerBtn);
    }
    
    bgColorPicker.addEventListener('input', (e) => {
        handleBgColorChange(e.target.value);
    });
}

async function populateFontPanel() {
    const fontPanel = document.getElementById('fontPanel');
    if (!fontPanel) return;
    
    // Import and use fonts from fonts.js module
    try {
        const module = await import('../data/fonts.js');
        const fonts = module.FONTS || [];
        
        if (fonts.length > 0) {
            fontPanel.innerHTML = '';
            fonts.forEach(font => {
                const btn = document.createElement('button');
                btn.dataset.font = font.family;
                btn.textContent = font.name;
                btn.style.fontFamily = font.family;
                btn.addEventListener('click', () => {
                    setTextboxProperty('fontFamily', font.family);
                });
                fontPanel.appendChild(btn);
            });
            
            // Load custom fonts
            if (module.loadCustomFonts) {
                await module.loadCustomFonts();
            }
        }
    } catch (err) {
        console.warn('Could not load fonts:', err);
        // Fallback to basic fonts
        const fallbackFonts = [
            { name: 'Merriweather', family: 'Merriweather' },
            { name: 'Arial', family: 'Arial' },
            { name: 'Georgia', family: 'Georgia' },
            { name: 'Helvetica', family: 'Helvetica' }
        ];
        fontPanel.innerHTML = '';
        fallbackFonts.forEach(font => {
            const btn = document.createElement('button');
            btn.dataset.font = font.family;
            btn.textContent = font.name;
            btn.style.fontFamily = font.family;
            btn.addEventListener('click', () => {
                setTextboxProperty('fontFamily', font.family);
            });
            fontPanel.appendChild(btn);
        });
    }
}

/* ================= PUBLIC API ================= */
export function showTextControls(textObj) {
    currentTextObject = textObj;
    ensureFabricCanvas();
    
    const toolbar = document.getElementById('textControls');
    if (toolbar) {
        toolbar.style.display = 'block';
        toolbar.classList.add('active');
    }
    
    updateActiveStates();
}

export function hideTextControls() {
    const toolbar = document.getElementById('textControls');
    if (toolbar) {
        toolbar.style.display = 'none';
        toolbar.classList.remove('active');
    }
    
    closeAllPanels();
    currentTextObject = null;
}

export function toggleTextControls() {
    const toolbar = document.getElementById('textControls');
    if (!toolbar) return;
    
    const isVisible = toolbar.style.display !== 'none' && toolbar.classList.contains('active');
    
    if (!isVisible) {
        // Show controls if there's a selected textbox
        const textObj = getActiveTextbox();
        if (textObj) {
            showTextControls(textObj);
        }
    } else {
        // Hide controls
        hideTextControls();
    }
}

/* ================= INITIALIZATION ================= */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupButtonHandlers);
} else {
    setupButtonHandlers();
}

// Listen for fontsize changes using centralized events
onAppEvent(AppEvents.FONTSIZE_CHANGED, () => updateActiveStates());