
/* ================= IMPORTS ================= */
import { state, subscribeToState, updateImage, setImage, resetImage, setCanvasBackgroundColor } from './state.js';
import { addTextBox, exitTextMode, enterTextMode, renderTextBoxes } from "./ui/textOverlay.js";
import { toggleTextControls } from "./ui/textControls.js";
import { initDB, saveProject, loadProject, clearProject, getSharedFiles } from "./data/db.js";
import { exportImage, shareImage, canShareImage } from "./features/export.js";
import { CANVAS_SIZES, INTERACTION_CONFIG, EXPORT_CONFIG, CANVAS_BG_COLOR, CANVAS_STROKE_COLOR  } from "./config.js";
import { pickImageFile, loadImageFromFile } from "./utils/utils.js";
import { AppEvents, onAppEvent } from "./events.js";
import { dom } from "./domCache.js";
import { autosaveManager } from './core/autosave.js';
import { setButtonIcon } from './ui/icons.js';
import { toast } from './ui/toast.js';

let CANVAS_WIDTH = 1080;
let CANVAS_HEIGHT = 1920;

/* ================= CANVAS SIZE MANAGEMENT ================= */
function getCanvasSize() {
	return localStorage.getItem('canvasSize') || '1080x1920';
}

function setCanvasSize(sizeKey) {
	const size = CANVAS_SIZES[sizeKey];
	if (!size) return;
	CANVAS_WIDTH = size.width;
	CANVAS_HEIGHT = size.height;
	localStorage.setItem('canvasSize', sizeKey);
}

// Initialize with saved or default size
setCanvasSize(getCanvasSize());

/* ================= STATE ================= */
const canvas = dom.get("canvas");
const ctx = canvas.getContext("2d");
const pixelWrap = dom.get("pixelWrap");
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";

// Drag/pinch state (local to interaction logic)
let isDragging = false;
let dragStart = { x: 0, y: 0, offsetX: 0, offsetY: 0, lastTap: 0 };
let pointers = new Map();
let pinchStartDistance = null;
let scaleStart = 1, offsetStartX = 0, offsetStartY = 0;
let pinchMidX = 0, pinchMidY = 0;
let pinching = false;
let holdTimer = null;
let imageLockedToInput = false;
let isEditingText = false;

/* ================= IMAGE LOCK HELPERS ================= */
function lockImage() {
	imageLockedToInput = true;
	canvas.style.pointerEvents = "none";
}

function unlockImage() {
	imageLockedToInput = false;
	canvas.style.pointerEvents = "auto";
}

function setIsEditingText(value) {
	isEditingText = value;
}

/* ================= LAYOUT CALCULATION ================= */
function calculateLayout() {
	const wrap = dom.get("canvasWrap");
	const w = wrap.clientWidth;
	const h = wrap.clientHeight;
	
	const displayScale = Math.min(w / CANVAS_WIDTH, h / CANVAS_HEIGHT) || 1;
	const scaledWidth = Math.round(CANVAS_WIDTH * displayScale);
	const scaledHeight = Math.round(CANVAS_HEIGHT * displayScale);
	const centerX = Math.round((w - scaledWidth) / 2);
	const centerY = Math.round((h - scaledHeight) / 2);
	
	return { displayScale, scaledWidth, scaledHeight, centerX, centerY };
}

function applyCanvasLayout({ displayScale, scaledWidth, scaledHeight, centerX, centerY }) {
	// Set CSS custom property
	document.documentElement.style.setProperty('--canvas-width', `${scaledWidth}px`);
	
	// Position and size pixelWrap
	if (pixelWrap) {
		Object.assign(pixelWrap.style, {
			width: `${scaledWidth}px`,
			height: `${scaledHeight}px`,
			transformOrigin: "top left",
			transform: "none",
			left: `${centerX}px`,
			top: `${centerY}px`
		});
	}
	
	// Set canvas bitmap size
	canvas.width = CANVAS_WIDTH;
	canvas.height = CANVAS_HEIGHT;
	canvas.style.width = `${scaledWidth}px`;
	canvas.style.height = `${scaledHeight}px`;
	
	// Update text canvas
	const textCanvas = dom.get('textCanvas');
	if (textCanvas) {
		textCanvas.width = CANVAS_WIDTH;
		textCanvas.height = CANVAS_HEIGHT;
		textCanvas.style.width = `${scaledWidth}px`;
		textCanvas.style.height = `${scaledHeight}px`;
	}
	
	// Update context settings
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = "high";
	
	// Update Fabric canvas
	updateFabricZoom(displayScale);
}

function updateFabricZoom(displayScale) {
	if (window.__fabricCanvas) {
		try {
			window.__fabricCanvas.setZoom(displayScale);
			window.__fabricCanvas.calcOffset();
			window.__fabricCanvas.renderAll();
		} catch (e) {
			console.warn('fabric calcOffset failed', e);
		}
	}
}

/* ================= RESIZE ================= */
function resizeCanvas() {
	if (isEditingText) {
		console.log('Skipping resize - text is being edited');
		return;
	}
	
	const layout = calculateLayout();
	applyCanvasLayout(layout);
	draw();
}

/* ================= DRAW ================= */
function drawImage() {
	const { img, scale, offsetX, offsetY } = state.image;
	if (!img) return false;
	
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = "high";
	
	const imgW = img.width * scale;
	const imgH = img.height * scale;
	
	let drawX = offsetX;
	let drawY = offsetY;
	
	// Snap to edges only if image larger than canvas
	const snapped = applyEdgeSnapping(imgW, imgH, drawX, drawY);
	drawX = snapped.x;
	drawY = snapped.y;
	
	ctx.drawImage(img, drawX, drawY, imgW, imgH);
	
	// Update offsets after snapping (if changed)
	if (drawX !== offsetX || drawY !== offsetY) {
		updateImage({ offsetX: drawX, offsetY: drawY });
	}
	
	// Show outline if any part of canvas uncovered
	if (isImageUncovered(drawX, drawY, imgW, imgH)) {
		drawCanvasOutline();
	}
	
	return true;
}

function applyEdgeSnapping(imgW, imgH, drawX, drawY) {
	let x = drawX;
	let y = drawY;
	
	if (imgW > CANVAS_WIDTH) {
		if (Math.abs(x) < INTERACTION_CONFIG.SNAP_THRESHOLD) x = 0;
		if (Math.abs(x + imgW - CANVAS_WIDTH) < INTERACTION_CONFIG.SNAP_THRESHOLD) x = CANVAS_WIDTH - imgW;
	}
	if (imgH > CANVAS_HEIGHT) {
		if (Math.abs(y) < INTERACTION_CONFIG.SNAP_THRESHOLD) y = 0;
		if (Math.abs(y + imgH - CANVAS_HEIGHT) < INTERACTION_CONFIG.SNAP_THRESHOLD) y = CANVAS_HEIGHT - imgH;
	}
	
	return { x, y };
}

function isImageUncovered(x, y, w, h) {
	const EPS = 0.5;
	return x > EPS || y > EPS || (x + w) < CANVAS_WIDTH - EPS || (y + h) < CANVAS_HEIGHT - EPS;
}

function drawCanvasOutline() {
	ctx.save();
	ctx.strokeStyle = CANVAS_STROKE_COLOR;
	ctx.setLineDash([8, 4]);
	ctx.lineWidth = 10;
	ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
	ctx.restore();
}

// Get canvas background color from state or default
function getCanvasBackgroundColor() {
	return state.canvasBackgroundColor || CANVAS_BG_COLOR;
}

function draw() {
	// Fill canvas with background color
	ctx.fillStyle = getCanvasBackgroundColor();
	ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
	drawImage();
	// Note: autosave is now triggered automatically by state notifications
}

/* ================= IMAGE HELPERS ================= */
function loadImage(file, cb) {
	const img = new Image();
	img.crossOrigin = "anonymous";
	img.decoding = "sync";
	img.onload = () => {
		URL.revokeObjectURL(img.src);
		cb(img);
	};
	img.src = URL.createObjectURL(file);
}

function pickFile(cb) {
	const input = document.createElement("input");
	input.type = "file";
	input.accept = "image/*";
	input.onchange = () => {
		if (input.files?.[0]) {
			loadImage(input.files[0], img => cb(img, input.files[0].name));
		}
	};
	input.click();
}

function handleImageLoad(img, name) {
	setImage(img, name, CANVAS_WIDTH, CANVAS_HEIGHT);
	draw();
}

function promptImage() {
	if (state.image.img) return false;
	setTimeout(() => pickFile(handleImageLoad), 0);
	return true;
}

/* ================= POINTER EVENT HANDLERS ================= */
function handlePointerDown(e) {
	if (imageLockedToInput) return;
	
	pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: false, totalDx: 0, totalDy: 0 });

	if (promptImage()) return;

	if (pointers.size === 1) {
		startDrag(e);
		startHoldTimer(e);
	} else {
		clearTimeout(holdTimer);
		isDragging = false;
		pinchStartDistance = null;
		pinching = false;
	}
}

function handlePointerMove(e) {
	if (imageLockedToInput) return;
	
	const p = pointers.get(e.pointerId);
	if (!p) return;

	updatePointerMovement(e, p);

	if (state.image.img && pointers.size === 1 && isDragging && !pinching) {
		handleDrag(e);
	}

	if (state.image.img && pointers.size === 2) {
		handlePinch();
	}
}

function handlePointerUp(e) {
	if (imageLockedToInput) return;
	
	pointers.delete(e.pointerId);
	clearTimeout(holdTimer);
	
	if (pointers.size < 2) {
		pinchStartDistance = null;
		pinching = false;
		isDragging = false;
	}

	// Double-tap to reset
	if (state.image.img && pointers.size === 0 && !pinching) {
		checkDoubleTap();
	}
}

function handlePointerCancel() {
	if (imageLockedToInput) return;
	
	pointers.clear();
	isDragging = false;
	pinchStartDistance = null;
	pinching = false;
}

function startDrag(e) {
	isDragging = true;
	dragStart.x = e.clientX;
	dragStart.y = e.clientY;
	dragStart.offsetX = state.image.offsetX;
	dragStart.offsetY = state.image.offsetY;
}

function startHoldTimer(e) {
	holdTimer = setTimeout(() => {
		const p = pointers.get(e.pointerId);
		if (p && !p.moved && Math.hypot(p.totalDx, p.totalDy) < INTERACTION_CONFIG.HOLD_MOVE_THRESHOLD) {
			isDragging = false;
			pointers.clear();
			pickFile(handleImageLoad);
		}
	}, INTERACTION_CONFIG.HOLD_DELAY);
}

function updatePointerMovement(e, p) {
	const dx = e.clientX - p.x;
	const dy = e.clientY - p.y;
	p.totalDx += dx;
	p.totalDy += dy;
	
	if (Math.hypot(dx, dy) > INTERACTION_CONFIG.HOLD_MOVE_THRESHOLD) {
		p.moved = true;
		clearTimeout(holdTimer);
	}

	p.x = e.clientX;
	p.y = e.clientY;
	pointers.set(e.pointerId, p);
}

function handleDrag(e) {
	const deltaX = e.clientX - dragStart.x;
	const deltaY = e.clientY - dragStart.y;
	const newOffsetX = dragStart.offsetX + deltaX * (CANVAS_WIDTH / canvas.clientWidth);
	const newOffsetY = dragStart.offsetY + deltaY * (CANVAS_HEIGHT / canvas.clientHeight);
	updateImage({ offsetX: newOffsetX, offsetY: newOffsetY });
	draw();
}

function handlePinch() {
	const [p1, p2] = [...pointers.values()];
	const rect = canvas.getBoundingClientRect();
	const midX = (p1.x + p2.x) / 2;
	const midY = (p1.y + p2.y) / 2;
	const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);

	if (!pinching) {
		pinching = true;
		pinchStartDistance = dist;
		scaleStart = state.image.scale;
		offsetStartX = state.image.offsetX;
		offsetStartY = state.image.offsetY;
		pinchMidX = (midX - rect.left) * (CANVAS_WIDTH / rect.width);
		pinchMidY = (midY - rect.top) * (CANVAS_HEIGHT / rect.height);
	}

	const zoom = dist / pinchStartDistance;
	const newScale = scaleStart * zoom;
	const newOffsetX = pinchMidX - (pinchMidX - offsetStartX) * zoom;
	const newOffsetY = pinchMidY - (pinchMidY - offsetStartY) * zoom;
	updateImage({ scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY });
	draw();
}

function checkDoubleTap() {
	const now = Date.now();
	if (dragStart.lastTap && now - dragStart.lastTap < INTERACTION_CONFIG.DOUBLE_TAP_DELAY) {
		resetImage(CANVAS_WIDTH, CANVAS_HEIGHT);
		draw();
	}
	dragStart.lastTap = now;
}

function handleWheel(e) {
	if (imageLockedToInput || !state.image.img) return;
	e.preventDefault();
	const zoomFactor = e.deltaY < 0 ? (1 + INTERACTION_CONFIG.WHEEL_ZOOM_STEP) : (1 - INTERACTION_CONFIG.WHEEL_ZOOM_STEP);
	updateImage({ scale: state.image.scale * zoomFactor });
	draw();
}

function handleKeyDown(e) {
	if (imageLockedToInput || !state.image.img) return;
	const step = e.shiftKey ? INTERACTION_CONFIG.KEY_NUDGE_FAST : INTERACTION_CONFIG.KEY_NUDGE;
	const updates = {};
	if (e.key === "ArrowLeft") updates.offsetX = state.image.offsetX - step;
	if (e.key === "ArrowRight") updates.offsetX = state.image.offsetX + step;
	if (e.key === "ArrowUp") updates.offsetY = state.image.offsetY - step;
	if (e.key === "ArrowDown") updates.offsetY = state.image.offsetY + step;
	if (Object.keys(updates).length > 0) {
		updateImage(updates);
		draw();
	}
}

/* ================= EVENT LISTENERS SETUP ================= */
function setupCanvasEventListeners() {
	canvas.addEventListener("pointerdown", handlePointerDown);
	canvas.addEventListener("pointermove", handlePointerMove);
	canvas.addEventListener("pointerup", handlePointerUp);
	canvas.addEventListener("pointercancel", handlePointerCancel);
	canvas.addEventListener("wheel", handleWheel, { passive: false });
}

function setupWindowEventListeners() {
	window.addEventListener("resize", resizeCanvas);
	window.addEventListener("keydown", handleKeyDown);
	
	// Use centralized event system
	onAppEvent(AppEvents.REQUEST_LOCK, lockImage);
	onAppEvent(AppEvents.REQUEST_UNLOCK, unlockImage);
	onAppEvent(AppEvents.TEXTBOX_MODIFIED, () => autosaveManager.schedule());
	
	// Subscribe to state changes for automatic autosave
	subscribeToState(() => {
		console.log('State changed, scheduling autosave');
		autosaveManager.schedule();
	});
}

/* ================= UI BUTTON HANDLERS ================= */
function setupModeButtons() {
	const textModeBtn = dom.get('textModeBtn');
	const imageModeBtn = dom.get('imageModeBtn');
	const imageModeButtons = dom.get('imageModeButtons');
	const textModeButtons = dom.get('textModeButtons');
	const addNewTextBtn = dom.get('addNewTextBtn');
	const toggleTextControlsBtn = dom.get('toggleTextControlsBtn');
	const canvasBgColorBtn = dom.get('canvasBgColorBtn');
	const canvasBgColorInput = dom.get('canvasBgColor');
	
	textModeBtn.addEventListener('click', () => {
		enterTextMode();
		textModeBtn.classList.add('active');
		textModeBtn.classList.add('hidden');
		imageModeBtn.classList.remove('active');
		imageModeBtn.classList.remove('hidden');
		
		// Show text mode buttons, hide image mode buttons
		textModeButtons?.classList.remove('hidden');
		imageModeButtons?.classList.add('hidden');
	});
	
	imageModeBtn.addEventListener('click', () => {
		exitTextMode();
		imageModeBtn.classList.add('active');
		imageModeBtn.classList.add('hidden');
		textModeBtn.classList.remove('active');
		textModeBtn.classList.remove('hidden');
		
		// Show image mode buttons, hide text mode buttons
		imageModeButtons?.classList.remove('hidden');
		textModeButtons?.classList.add('hidden');
	});
	
	addNewTextBtn?.addEventListener('click', async () => {
		await addTextBox();
	});
	
	toggleTextControlsBtn?.addEventListener('click', () => {
		const wasToggled = toggleTextControls();
		if (wasToggled) {
			toggleTextControlsBtn.classList.toggle('active');
		}
	});
	
	// Canvas background color picker
	if (canvasBgColorBtn && canvasBgColorInput) {
		canvasBgColorBtn.addEventListener('click', () => {
			canvasBgColorInput.click();
		});
		
		canvasBgColorInput.addEventListener('input', (e) => {
			setCanvasBackgroundColor(e.target.value); // Use state helper to trigger autosave
			draw(); // Redraw canvas with new background color
		});
	}
}

function setupSizeButton() {
	const sizeBtn = dom.get('sizeBtn');
	const sizeIcon = dom.get('sizeIcon');
	
	function updateSizeButton() {
		const currentSize = getCanvasSize();
		const nextSize = currentSize === '1080x1920' ? '1440x1920' : '1080x1920';
		const nextIconName = nextSize === '1080x1920' ? 'size916' : 'size34';
		
		// Use the icon system to set the button icon
		if (sizeIcon) {
			setButtonIcon(sizeIcon, nextIconName);
		}
	}
	
	updateSizeButton();
	
	sizeBtn.addEventListener('click', async () => {
		const currentSize = getCanvasSize();
		const newSize = currentSize === '1080x1920' ? '1440x1920' : '1080x1920';
		
		if (!confirm(`Switch to ${newSize.replace('x', '×')}? Your work will be preserved.`)) return;
		
		setCanvasSize(newSize);
		window.location.reload();
	});
}

function setupResetButton() {
	const resetBtn = dom.get('resetBtn');
	
	resetBtn.addEventListener('click', async () => {
		if (!confirm('Reset app and clear all work? This cannot be undone.')) return;
		
		await clearProject();
		
		// Reset state using state helpers
		Object.assign(state.image, {
			img: null,
			filename: null,
			scale: 1,
			offsetX: 0,
			offsetY: 0
		});
		state.textBoxes = [];
		state.canvasBackgroundColor = CANVAS_BG_COLOR;
		
		draw();
		
		// Clear text boxes from Fabric canvas
		if (window.__fabricCanvas) {
			window.__fabricCanvas.clear();
		}
		
		// Switch to image mode and disable text mode
		const textModeBtn = dom.get('textModeBtn');
		const imageModeBtn = dom.get('imageModeBtn');
		const imageModeButtons = dom.get('imageModeButtons');
		const textModeButtons = dom.get('textModeButtons');
		
		exitTextMode();
		imageModeBtn?.classList.add('active');
		imageModeBtn?.classList.add('hidden');
		textModeBtn?.classList.remove('active');
		textModeBtn?.classList.remove('hidden');
		
		// Show image mode buttons, hide text mode buttons
		imageModeButtons?.classList.remove('hidden');
		textModeButtons?.classList.add('hidden');
		
		// Reset color picker
		const canvasBgColorInput = dom.get('canvasBgColor');
		if (canvasBgColorInput) canvasBgColorInput.value = CANVAS_BG_COLOR;
	});
}

function setupExportButtons() {
	const shareBtn = dom.get("shareBtn");
	const exportBtn = dom.get("exportBtn");
	
	// Show share button if device supports it
	canShareImage().then(can => {
		if (can) shareBtn.classList.remove('hidden');
	});
	
	shareBtn.addEventListener("click", async () => {
		await shareImage(canvas, CANVAS_WIDTH, CANVAS_HEIGHT);
	});
	
	exportBtn.addEventListener("click", async () => {
		await exportImage(canvas, CANVAS_WIDTH, CANVAS_HEIGHT);
	});
}

/* ================= INITIALIZATION ================= */

/* ================= SHARED FILE HANDLING (Android Share Intent) ================= */
async function loadSharedImage() {
	try {
		const sharedFiles = await getSharedFiles();
		
		if (!sharedFiles || sharedFiles.length === 0) {
			console.log('No shared files found');
			return false; // No shared file, continue normal flow
		}

		console.log('Found shared file, loading...', sharedFiles[0].name);
		
		// Clear saved project when loading shared image
		// This ensures we start fresh with the shared image
		await clearProject();
		console.log('Cleared saved project to start fresh with shared image');
		
		const f = sharedFiles[0];
		const blob = new Blob([f.buffer], { type: f.type });
		
		return new Promise((resolve) => {
			loadImage(blob, img => {
				handleImageLoad(img, f.name);
				console.log('Shared image loaded successfully');
				toast.success('Shared image loaded');
				resolve(true); // Shared file loaded
			});
		});
	} catch (error) {
		console.error('Failed to load shared image:', error);
		toast.error('Failed to load shared image');
		return false;
	}
}

async function restoreProject() {
	try {
		const saved = await loadProject();
		console.log('Loaded project:', saved);
		
		if (!saved) {
			console.log('No saved project');
			return;
		}
		
		// Restore canvas background color
		if (saved.canvasBackgroundColor) {
			state.canvasBackgroundColor = saved.canvasBackgroundColor;
			const canvasBgColorInput = dom.get('canvasBgColor');
			if (canvasBgColorInput) {
				canvasBgColorInput.value = saved.canvasBackgroundColor;
			}
		}
		
		// Restore text boxes
		if (saved.textBoxes?.length > 0) {
			console.log('Restoring text boxes:', saved.textBoxes);
			state.textBoxes = saved.textBoxes;
			setTimeout(() => {
				console.log('Calling renderTextBoxes...');
				renderTextBoxes();
			}, 300);
		}
		
		// Restore image if available
		if (saved.image) {
			const img = new Image();
			
			img.onload = () => {
				console.log('Image loaded');
				
				// Restore image state
				Object.assign(state.image, {
					img,
					filename: saved.imageFilename || 'restored.jpg',
					scale: saved.imageScale || 1,
					offsetX: saved.imageOffsetX || 0,
					offsetY: saved.imageOffsetY || 0
				});
				
				draw();
				toast.success('Project restored', 2000);
			};
			
			img.onerror = () => {
				console.error('Failed to load saved image');
				toast.error('Failed to restore image');
				draw(); // Still draw with background color and text boxes
			};
			
			img.src = saved.image;
		} else {
			console.log('No image to restore');
			draw(); // Draw with background color
			if (saved.textBoxes?.length > 0 || saved.canvasBackgroundColor) {
				toast.success('Project restored', 2000);
			}
		}
	} catch (error) {
		console.error('Failed to restore project:', error);
		toast.error('Failed to restore project');
	}
}

window.addEventListener("load", async () => {
	console.log('App loading...');
	
	await initDB();
	console.log('DB initialized');
	
	// Load directory handle for export (may fail silently, that's OK)
	try {
		const { loadDirectoryHandle } = await import('./features/export.js');
		const savedDir = await loadDirectoryHandle();
		if (savedDir) {
			console.log('Loaded saved directory handle');
		}
	} catch (err) {
		console.log('Could not load directory handle at startup (expected)');
	}
	
	resizeCanvas();
	console.log('Canvas resized');
	
	setupCanvasEventListeners();
	setupWindowEventListeners();
	setupModeButtons();
	setupSizeButton();
	setupResetButton();
	setupExportButtons();
	
	// Check for shared image first (Android share intent)
	const sharedImageLoaded = await loadSharedImage();
	
	// Only restore project if no shared image was loaded
	if (!sharedImageLoaded) {
		await restoreProject();
	}
});

export { lockImage, unlockImage, resizeCanvas, setIsEditingText };
