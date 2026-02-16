
## Improvements:
- package own fonts
    merriweather regular and bold
    (check what other fonts we usually use)
    Open sans
    Montserrat

## Future
- refactor toasts and export.js and share them between both apps
- improve upgradeability of both apps, see section below.
- Color picker UI
- only show text controls toggle when textbox selected?

---

## Check:
Manifest errors ?
    Manifest: Line: 1, column: 1, Syntax error.
Saving:
    - currently only download on mobile but might be because it needs https
Sharing:
    - check on mobile on https



----

## Updating the apps:

A non-disruptive “Update available” toast
The app detects that a new Service Worker is ready, but:

Does not reload immediately

Lets the user choose when to update

Shows a toast like:

“Update available. Refresh to apply.”

This is the safest UX for apps where users may be editing or sharing content.

function applyUpdate(reg) {
	reg.waiting.postMessage({ type: 'SKIP_WAITING' });
	window.location.reload();
}

```javascript
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Manual update control
self.addEventListener('message', event => {
	if (event.data?.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});

self.addEventListener('activate', event => {
	event.waitUntil(self.clients.claim());
});

// Utility: store file in IndexedDB safely
function openSharedDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open('tsgstories-shared', 2);

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
			try {
				const formData = await event.request.formData();
				const files = formData.getAll('photo');

				for (const f of files) {
					await storeSharedFile(f);
				}

				return Response.redirect('/tsg/stories/', 303);
			} catch (err) {
				console.error('SW: Error handling share POST', err);
				return Response.redirect('/tsg/stories/', 303);
			}
		})());
	}
});
```

app side:


```javascript
if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register('/tsg/stories/sw.js');

	navigator.serviceWorker.ready.then(reg => {
		if (reg.waiting) {
			showUpdateToast(reg);
		}

		reg.addEventListener('updatefound', () => {
			const sw = reg.installing;
			sw?.addEventListener('statechange', () => {
				if (sw.state === 'installed' && navigator.serviceWorker.controller) {
					showUpdateToast(reg);
				}
			});
		});
	});
}
function showUpdateToast(reg) {
	toast.info('Update available', 0, {
		actionText: 'Refresh',
		onAction: () => {
			reg.waiting.postMessage({ type: 'SKIP_WAITING' });
			window.location.reload();
		}
	});
}

```



Fast pours:

precacheAndRoute(self.__WB_MANIFEST);


self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', event => {
	event.waitUntil(self.clients.claim());
});
---
if ('serviceWorker' in navigator) {
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		window.location.reload();
	});
}


---

https://vite-pwa-org.netlify.app/guide/prompt-for-update.html

---

## Test text:

A blend of Malvasia, Ribolla and Friulano from older vineyards with a few days of maceration. Bright acidity, elegant with great minerality and tangerine notes from the Malvasia dominating the nose.