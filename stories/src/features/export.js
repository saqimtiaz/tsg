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

// Save/load last used directory handle
async function getLastDirectory() {
	try {
		const handle = await indexedDB.open('tsg-export-dir', 1);
		return new Promise((resolve, reject) => {
			handle.onsuccess = () => {
				const db = handle.result;
				if (!db.objectStoreNames.contains('directory')) {
					resolve(null);
					return;
				}
				const tx = db.transaction('directory', 'readonly');
				const store = tx.objectStore('directory');
				const request = store.get('lastDir');
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => resolve(null);
			};
			handle.onupgradeneeded = (e) => {
				const db = e.target.result;
				if (!db.objectStoreNames.contains('directory')) {
					db.createObjectStore('directory');
				}
			};
		});
	} catch (err) {
		console.warn('Could not access directory storage', err);
		return null;
	}
}

async function saveLastDirectory(dirHandle) {
	try {
		const handle = await indexedDB.open('tsg-export-dir', 1);
		return new Promise((resolve) => {
			handle.onsuccess = () => {
				const db = handle.result;
				const tx = db.transaction('directory', 'readwrite');
				const store = tx.objectStore('directory');
				store.put(dirHandle, 'lastDir');
				tx.oncomplete = () => resolve();
			};
			handle.onupgradeneeded = (e) => {
				const db = e.target.result;
				if (!db.objectStoreNames.contains('directory')) {
					db.createObjectStore('directory');
				}
			};
		});
	} catch (err) {
		console.warn('Could not save directory', err);
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

export async function exportImage(baseCanvas, CANVAS_WIDTH, CANVAS_HEIGHT) {
	const exportCanvas = createExportCanvas(baseCanvas, CANVAS_WIDTH, CANVAS_HEIGHT);
	const dataURL = exportCanvas.toDataURL('image/png', 1.0); // Maximum quality PNG
	const blob = await (await fetch(dataURL)).blob();
	const filename = generateFilename();

	const supportsFS = 'showSaveFilePicker' in window;
	if (supportsFS) {
		try {
			// Try to use last directory if available
			let dirHandle = await getLastDirectory();
			
			// Verify we still have permission to the directory
			if (dirHandle) {
				const permission = await dirHandle.queryPermission({ mode: 'readwrite' });
				if (permission !== 'granted') {
					const requestPermission = await dirHandle.requestPermission({ mode: 'readwrite' });
					if (requestPermission !== 'granted') {
						dirHandle = null;
					}
				}
			}
			
			// If no valid directory, prompt user to select one
			if (!dirHandle) {
				dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
				await saveLastDirectory(dirHandle);
			}
			
			const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
			const writable = await fileHandle.createWritable();
			await writable.write(blob);
			await writable.close();
			toast.success(`Saved to ${dirHandle.name}`);
		} catch (err) {
			// User cancelled or error - fall back to download
			if (err.name !== 'AbortError') {
				console.warn('File System Access API failed, falling back to download', err);
			}
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = filename;
			link.click();
			toast.error('Could not save to file system.', 2500);
			toast.success('Image downloaded to Downloads/', 2500);
		}
	} else {
		// Fallback for browsers without File System Access API
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = filename;
		link.click();
		// Show success toast with download location
		toast.success('Image saved to Downloads/', 2500);
	}
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
