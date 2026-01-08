// sw.js
self.addEventListener('install', event => {
	self.skipWaiting();
});

self.addEventListener('activate', event => {
	event.waitUntil(self.clients.claim());
});

// Utility: store file in IndexedDB safely
async function storeSharedFile(file) {
	// Read the file into an ArrayBuffer first
	const buffer = await new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = e => reject(e);
		reader.readAsArrayBuffer(file);
	});

	// Open IndexedDB and store
	const db = await new Promise((resolve, reject) => {
		const request = indexedDB.open('fastpours-shared', 1);
		request.onupgradeneeded = e => {
			const db = e.target.result;
			if (!db.objectStoreNames.contains('files')) {
				db.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
			}
		};
		request.onsuccess = e => resolve(e.target.result);
		request.onerror = e => reject(e.target.error);
	});

	await new Promise((resolve, reject) => {
		const tx = db.transaction('files', 'readwrite');
		const store = tx.objectStore('files');
		store.add({
			name: file.name,
			type: file.type,
			buffer: buffer
		}).onsuccess = () => resolve();
		tx.onerror = e => reject(e.target.error);
	});
}

// Intercept share POSTs
self.addEventListener('fetch', event => {
	const url = new URL(event.request.url);
	if (
		event.request.method === 'POST' &&
		url.pathname.endsWith('/tsg/fastpours/index.html')
	) {
		event.respondWith((async () => {
			console.log('SW: Received a share POST', event.request.url);
			try {
				const formData = await event.request.formData();
				const files = formData.getAll('photo'); // matches manifest

				for (const f of files) {
					await storeSharedFile(f);
				}

				// Redirect to main app page
				return Response.redirect('/tsg/fastpours/', 303);
			} catch (err) {
				console.error('SW: Error handling share POST', err);
				return Response.redirect('/tsg/fastpours/', 303);
			}
		})());
	}
});
