// IndexedDB autosave for app state

const DB_NAME = 'tsg-stories';
const DB_VERSION = 1;
const STORE_NAME = 'project';

const SHARED_DB_NAME = 'tsgstories-shared';
const SHARED_DB_VERSION = 2;
const SHARED_STORE_NAME = 'files';

let db = null;
let sharedDb = null;

// Initialize database
export async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

// Save project state
export async function saveProject(state) {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const data = {
            timestamp: Date.now(),
            image: state.image, // base64 data URL
            imageFilename: state.imageFilename,
            imageScale: state.imageScale,
            imageOffsetX: state.imageOffsetX,
            imageOffsetY: state.imageOffsetY,
            textBoxes: state.textBoxes,
            canvasBackgroundColor: state.canvasBackgroundColor
        };
        
        const request = store.put(data, 'current');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Load project state
export async function loadProject() {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get('current');
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Clear saved project
export async function clearProject() {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete('current');
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Check if saved project exists
export async function hasSavedProject() {
    try {
        const project = await loadProject();
        return !!project;
    } catch {
        return false;
    }
}

/* ================= SHARED FILES (Android Share Intent) ================= */

// Initialize shared files database
async function initSharedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(SHARED_DB_NAME, SHARED_DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            sharedDb = request.result;
            resolve(sharedDb);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(SHARED_STORE_NAME)) {
                db.createObjectStore(SHARED_STORE_NAME, { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
            }
        };
    });
}

// Get shared files and delete them (one-time use)
export async function getSharedFiles() {
    try {
        if (!sharedDb) await initSharedDB();
        
        return new Promise((resolve, reject) => {
            const transaction = sharedDb.transaction([SHARED_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(SHARED_STORE_NAME);
            
            const request = store.getAll();
            request.onsuccess = () => {
                const items = request.result || [];
                // Clear after reading (one-time use)
                items.forEach(item => store.delete(item.id));
                resolve(items);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (err) {
        console.warn('Failed to access shared files DB:', err);
        return [];
    }
}

// Check if there are pending shared files
export async function hasSharedFiles() {
    try {
        const files = await getSharedFiles();
        // Put them back if we're just checking
        if (files.length > 0 && sharedDb) {
            const transaction = sharedDb.transaction([SHARED_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(SHARED_STORE_NAME);
            files.forEach(file => store.add(file));
        }
        return files.length > 0;
    } catch {
        return false;
    }
}
