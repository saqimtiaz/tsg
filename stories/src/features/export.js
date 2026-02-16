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

async function saveWithFileSystem(blob, filename) {
	let dir = lastDirectoryHandle;

	// If no cached handle, ask user to pick one
	if (!dir) {
		dir = await pickDirectory();
		if (!dir) return false; // User cancelled
	}

	// Ensure we have write permission
	const hasPerm = await ensureWritePermission(dir);
	if (!hasPerm) {
		console.warn("Write permission denied, asking user to pick directory again");
		// Permission denied - ask user to pick a new directory
		dir = await pickDirectory();
		if (!dir) return false; // User cancelled
	}

	// Try to save the file
	try {
		const fileHandle = await dir.getFileHandle(filename, { create: true });
		const writable = await fileHandle.createWritable();
		await writable.write(blob);
		await writable.close();
		
		toast.success(`Saved to ${dir.name}/${filename}`, 2500);
		return true;
	} catch (err) {
		console.error('Failed to write file:', err);
		
		// If write failed, the cached handle might be stale
		// Clear it and ask user to pick new directory
		if (err.name === 'NoModificationAllowedError' || err.name === 'NotAllowedError') {
			console.warn('File write failed, clearing cached handle and asking for new directory');
			lastDirectoryHandle = null;
			
			toast.warning('Please select save location again', 2000);
			
			// Ask user to pick directory again
			dir = await pickDirectory();
			if (!dir) return false;
			
			// Retry with new directory
			try {
				const fileHandle = await dir.getFileHandle(filename, { create: true });
				const writable = await fileHandle.createWritable();
				await writable.write(blob);
				await writable.close();
				
				toast.success(`Saved to ${dir.name}/${filename}`, 2500);
				return true;
			} catch (retryErr) {
				console.error('Retry also failed:', retryErr);
				throw retryErr;
			}
		}
		
		throw err;
	}
}

function downloadBlob(blob, filename) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
	toast.success('Image downloaded to Downloads/', 2500);
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
