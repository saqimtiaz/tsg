// filepath: c:\Users\saq\webdav\tsg\stories\src\core\autosave.js
import { state } from '../state.js';
import { saveProject } from '../data/db.js';
import { INTERACTION_CONFIG, EXPORT_CONFIG } from '../config.js';
import { toast } from '../ui/toast.js';

/* ================= AUTOSAVE MANAGER ================= */
export class AutosaveManager {
	constructor(delay) {
		this.delay = delay;
		this.timer = null;
	}
	
	schedule() {
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => this.save(), this.delay);
	}
	
	save() {
		const { img, filename, scale, offsetX, offsetY } = state.image;
		if (!img) return;
		
		const imageData = this.captureImageData(img);
		
		console.log('Autosaving with text boxes:', state.textBoxes);
		saveProject({
			image: imageData,
			imageFilename: filename,
			imageScale: scale,
			imageOffsetX: offsetX,
			imageOffsetY: offsetY,
			textBoxes: JSON.parse(JSON.stringify(state.textBoxes)),
			canvasBackgroundColor: state.canvasBackgroundColor
		}).then(() => {
			console.log('Autosave complete');
		}).catch(err => {
			console.warn('Autosave failed', err);
			toast.error('Failed to save project', 2000);
		});
	}
	
	captureImageData(img) {
		const tempCanvas = document.createElement('canvas');
		tempCanvas.width = img.width;
		tempCanvas.height = img.height;
		const tempCtx = tempCanvas.getContext('2d', {
			alpha: false,
			colorSpace: 'srgb'
		});
		tempCtx.imageSmoothingEnabled = false;
		tempCtx.drawImage(img, 0, 0);
		return tempCanvas.toDataURL(EXPORT_CONFIG.STORAGE_FORMAT, EXPORT_CONFIG.STORAGE_QUALITY);
	}
}

export const autosaveManager = new AutosaveManager(INTERACTION_CONFIG.AUTOSAVE_DELAY);