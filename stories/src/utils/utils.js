// filepath: c:\Users\saq\webdav\tsg\stories\utils.js
// Utility functions

/* ================= ID GENERATION ================= */
export function generateId() {
    return crypto.randomUUID?.() || Math.random().toString(36).slice(2);
}

/* ================= DEBOUNCE ================= */
export function debounce(fn, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}

/* ================= MATH UTILITIES ================= */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function snapToGrid(value, gridSize = 10) {
    return Math.round(value / gridSize) * gridSize;
}

/* ================= COLOR UTILITIES ================= */
export function rgbToHex(rgb) {
    const match = rgb.match(/\d+/g);
    if (!match) return '#000000';
    
    return '#' + match.slice(0, 3)
        .map(x => parseInt(x).toString(16).padStart(2, '0'))
        .join('');
}

/* ================= DATE/TIME UTILITIES ================= */
export function formatTimestamp(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
        '_',
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds())
    ].join('');
}

/* ================= IMAGE UTILITIES ================= */
export async function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.decoding = 'sync';
        
        img.onload = () => {
            URL.revokeObjectURL(img.src);
            resolve(img);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
}

export async function pickImageFile() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
            if (input.files?.[0]) {
                try {
                    const img = await loadImageFromFile(input.files[0]);
                    resolve({ img, filename: input.files[0].name });
                } catch (err) {
                    console.error('Failed to load image:', err);
                    resolve(null);
                }
            } else {
                resolve(null);
            }
        };
        input.click();
    });
}

/* ================= FONT UTILITIES ================= */
export async function loadFont(fontFamily) {
    if (!document.fonts) return;
    
    try {
        await document.fonts.load(`16px ${fontFamily}`);
        return true;
    } catch (err) {
        console.warn(`Failed to load font: ${fontFamily}`, err);
        return false;
    }
}

export async function loadFonts(fontFamilies) {
    if (!document.fonts) return;
    
    const promises = fontFamilies.map(font => loadFont(font));
    await Promise.all(promises);
}

/* ================= DOM UTILITIES ================= */
export function createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('data-')) {
            element.dataset[key.slice(5)] = value;
        } else {
            element.setAttribute(key, value);
        }
    });
    
    children.forEach(child => {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            element.appendChild(child);
        }
    });
    
    return element;
}

/* ================= OBJECT UTILITIES ================= */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

export function isEqual(a, b, tolerance = 0.01) {
    if (typeof a === 'number' && typeof b === 'number') {
        return Math.abs(a - b) < tolerance;
    }
    return a === b;
}