import { state } from '../state.js';
import { EXPORT_CONFIG } from '../config.js';
import { formatTimestamp } from '../utils/utils.js';
import { toast } from '../ui/toast.js';

// filepath: c:\Users\saq\webdav\tsg\stories\export.js
// Export and sharing functionality

/* ================= HELPERS ================= */

// Generate filename with timestamp
function generateFilename() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const date = String(now.getDate()).padStart(2, '0');
	const hours = String(now.getHours()).padStart(2, '0');
	const minutes = String(now.getMinutes()).padStart(2, '0');
	
	return `tsg-stories-${year}${month}${date}${hours}${minutes}.png`;
}

// IndexedDB for directory handle persistence
const DB_NAME = "tsg-export-fs";
const DB_VERSION = 1;
const STORE_NAME = "handles";

function openDB() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);

		req.onupgradeneeded = e => {
			const db = e.target.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
		};

		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function saveDirectoryHandle(dirHandle) {
	try {
		const db = await openDB();
		const tx = db.transaction(STORE_NAME, "readwrite");
		tx.objectStore(STORE_NAME).put(dirHandle, "lastDir");
		return new Promise((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	} catch (err) {
		console.warn('Could not save directory handle', err);
	}
}

async function loadDirectoryHandle() {
	try {
		const db = await openDB();
		const tx = db.transaction(STORE_NAME, "readonly");
		const handle = await new Promise((resolve, reject) => {
			const req = tx.objectStore(STORE_NAME).get("lastDir");
			req.onsuccess = () => resolve(req.result || null);
			req.onerror = () => reject(req.error);
		});

		if (!handle) return null;

		// Just cache the handle, DON'T validate permission yet
		// Permission will be validated/requested when user clicks Save (has user activation)
		lastDirectoryHandle = handle;
		return handle;
	} catch (err) {
		console.warn('Could not load directory handle', err);
		return null;
	}
}

// Persistent directory handle
let lastDirectoryHandle = null;

async function pickDirectory() {
	try {
		const dir = await window.showDirectoryPicker({
			mode: "readwrite",
			startIn: lastDirectoryHandle || "pictures"
		});

		await saveDirectoryHandle(dir);
		lastDirectoryHandle = dir;
		return dir;
	} catch (err) {
		if (err.name !== 'AbortError') {
			console.warn('Directory picker failed', err);
		}
		return null;
	}
}

async function ensureWritePermission(dirHandle) {
	try {
		const perm = await dirHandle.queryPermission({ mode: "readwrite" });
		if (perm === "granted") return true;

		const req = await dirHandle.requestPermission({ mode: "readwrite" });
		return req === "granted";
	} catch (err) {
		console.warn('Permission check failed', err);
		return false;
	}
}

async function saveWithDirectoryPicker(blob, filename) {
    console.log('Trying directory picker approach...', blob.size, 'bytes');
    
    try {
        // Get directory (with permission prompt)
        let dir = lastDirectoryHandle;
        
        if (!dir) {
            console.log('Picking directory...');
            dir = await window.showDirectoryPicker({
                mode: "readwrite",
                startIn: "pictures"
            });
            await saveDirectoryHandle(dir);
            lastDirectoryHandle = dir;
        }
        
        console.log('Got directory:', dir.name);
        
        // Ensure directory permission
        const hasDirPerm = await ensureWritePermission(dir);
        if (!hasDirPerm) {
            console.log('Directory permission denied, clearing cache');
            lastDirectoryHandle = null;
            throw new Error('Directory permission denied');
        }
        
        console.log('Getting file handle for:', filename);
        const fileHandle = await dir.getFileHandle(filename, { create: true });
        
        // ⭐ NEW: Check permission on the FILE handle, not just directory
        console.log('Checking file handle permission...');
        const filePermQuery = await fileHandle.queryPermission({ mode: "readwrite" });
        console.log('File permission state:', filePermQuery);
        
        if (filePermQuery !== 'granted') {
            console.log('Requesting file handle permission...');
            const filePermRequest = await fileHandle.requestPermission({ mode: "readwrite" });
            console.log('File permission result:', filePermRequest);
            
            if (filePermRequest !== 'granted') {
                throw new Error('File permission denied');
            }
        }
        
        // ⭐ NEW: Try createWritable with "siloed" mode to avoid locks
        console.log('Creating writable stream with siloed mode...');
        const writable = await fileHandle.createWritable({ 
            keepExistingData: false,
            mode: "siloed"  // Bypass lock issues
        });
        
        console.log('Writing blob...', blob.size, 'bytes');
        await writable.write(blob);
        
        console.log('Closing writable...');
        await writable.close();
        
        console.log('Save successful!');
        toast.success(`Saved to ${dir.name}/`, 2500);
        return true;
    } catch (err) {
        console.error('Directory picker save failed:', err);
        console.error('Error name:', err.name);
        console.error('Error message:', err.message);
        throw err;
    }
}

async function saveWithFileSystem(blob, filename) {
    // Try directory picker first (remembers location)
    try {
        const success = await saveWithDirectoryPicker(blob, filename);
        if (success) return true;
    } catch (err) {
        console.warn('Directory picker failed, trying file picker...', err);
        
        // Clear cached handle if it's failing
        lastDirectoryHandle = null;
    }
    
    // Fallback to file picker (works everywhere)
    console.log('Using file picker...');
    try {
        const fileHandle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
                description: 'PNG Image',
                accept: { 'image/png': ['.png'] }
            }],
            startIn: 'pictures'
        });
        
        console.log('Got file handle:', fileHandle.name);
        
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        console.log('File picker save successful!');
        toast.success(`Saved as ${fileHandle.name}`, 2500);
        return true;
    } catch (err) {
        if (err.name === 'AbortError') {
            return false; // User cancelled
        }
        throw err;
    }
}

// Create export canvas with image and text layers
function createExportCanvas(baseCanvas, CANVAS_WIDTH, CANVAS_HEIGHT) {
	const exportCanvas = document.createElement('canvas');
	exportCanvas.width = CANVAS_WIDTH;
	exportCanvas.height = CANVAS_HEIGHT;
	const exportCtx = exportCanvas.getContext('2d', {
		alpha: false, // No transparency needed
		desynchronized: false,
		colorSpace: 'srgb', // Standard color space
		willReadFrequently: false
	});
	
	// Ensure high quality for export
	exportCtx.imageSmoothingEnabled = true;
	exportCtx.imageSmoothingQuality = "high";

	// Draw base image
	exportCtx.drawImage(baseCanvas, 0, 0);
	
	// Draw fabric/text canvas on top at native resolution
	const fabricCanvas = window.__fabricCanvas;
	if (fabricCanvas) {
		// Temporarily reset zoom to 1:1 for export
		const currentZoom = fabricCanvas.getZoom();
		fabricCanvas.setZoom(1);
		
		// Use toCanvasElement to get a properly rendered canvas at native resolution
		const fabricExportCanvas = fabricCanvas.toCanvasElement(1, {
			left: 0,
			top: 0,
			width: CANVAS_WIDTH,
			height: CANVAS_HEIGHT
		});
		
		exportCtx.drawImage(fabricExportCanvas, 0, 0);
		
		// Restore original zoom
		fabricCanvas.setZoom(currentZoom);
		fabricCanvas.renderAll();
	}
	
	return exportCanvas;
}

/* ================= EXPORT ================= */

// Export directory handle loader for app initialization
export { loadDirectoryHandle };

export async function exportImage(baseCanvas, CANVAS_WIDTH, CANVAS_HEIGHT) {
	const exportCanvas = createExportCanvas(baseCanvas, CANVAS_WIDTH, CANVAS_HEIGHT);
	const dataURL = exportCanvas.toDataURL('image/png', 1.0); // Maximum quality PNG
	const blob = await (await fetch(dataURL)).blob();
	const filename = generateFilename();

	const supportsFS = 'showDirectoryPicker' in window;
	
	if (supportsFS) {
		try {
			// Try to save using directory picker (preserves last used directory)
			const success = await saveWithFileSystem(blob, filename);
			if (success) return; // Successfully saved
			
			// If saveWithFileSystem failed or user cancelled, fall through to download
		} catch (err) {
			console.warn('File System Access API failed', err);
		}
	}
	
	// Fallback: download
	downloadBlob(blob, filename);
}

/* ================= SHARE ================= */

export async function canShareImage() {
	if (!navigator.canShare || !navigator.share) return false;

	const testBlob = new Blob(["x"], { type: "image/png" });
	const testFile = new File([testBlob], "test.png", { type: "image/png" });

	return navigator.canShare({ files: [testFile] });
}

export async function shareImage(baseCanvas, CANVAS_WIDTH, CANVAS_HEIGHT) {
	const exportCanvas = createExportCanvas(baseCanvas, CANVAS_WIDTH, CANVAS_HEIGHT);
	const blob = await new Promise(res => exportCanvas.toBlob(res, "image/png", 1.0)); // Max quality
	const filename = generateFilename();
	const file = new File([blob], filename, { type: "image/png" });

	try {
		await navigator.share({
			files: [file],
			title: "TSG Story",
			text: "Exported story"
		});
		
		//toast.success('Shared successfully!', 2000);
	} catch(err) {
		// User cancelled or system error
		console.warn("Share cancelled", err);
	}
}
