import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

cleanupOutdatedCaches();

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', event => {
	self.skipWaiting();
});

self.addEventListener('activate', event => {
	event.waitUntil(self.clients.claim());
});

// Utility: store file in IndexedDB safely
function openSharedDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open('tsgstories-shared', 2); // bump version

		request.onupgradeneeded = e => {
			const db = e.target.result;
			if (!db.objectStoreNames.contains('files')) {
				db.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
			}
		};

		request.onsuccess = e => resolve(e.target.result);
		request.onerror = e => reject(e.target.error);
	});
}

async function storeSharedFile(file) {
	const buffer = await file.arrayBuffer();
	const db = await openSharedDB();

	await new Promise((resolve, reject) => {
		const tx = db.transaction('files', 'readwrite');
		const store = tx.objectStore('files');

		store.add({
			name: file.name,
			type: file.type,
			buffer
		});

		tx.oncomplete = () => resolve();
		tx.onerror = e => reject(e.target.error);
	});
}



// Intercept share POSTs
self.addEventListener('fetch', event => {
	const url = new URL(event.request.url);
	if (
		event.request.method === 'POST' &&
		url.pathname.endsWith('/tsg/stories/index.html')
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
				return Response.redirect('/tsg/stories/', 303);
			} catch (err) {
				console.error('SW: Error handling share POST', err);
				return Response.redirect('/tsg/stories/', 303);
			}
		})());
	}
});
