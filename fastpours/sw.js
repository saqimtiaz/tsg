self.addEventListener('install', event => {
	self.skipWaiting();
});

self.addEventListener('activate', event => {
	event.waitUntil(self.clients.claim());
});

// Intercept share POSTs
self.addEventListener('fetch', event => {
	// sw.js
	if (event.request.method === 'POST' && event.request.url.includes('/tsg/fastpours/index.html')) {
		event.respondWith((async () => {
			const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
			allClients.forEach(client => {
				client.postMessage({ type: 'sw-log', message: 'Received share POST' });
			});
			console.log('SW: Received a share POST', event.request.url);
			
			try {
				const formData = await event.request.formData();
				const files = formData.getAll('photo');

				const serializedFiles = await Promise.all(files.map(async f => {
					const arrayBuffer = await f.arrayBuffer();
					return {
						name: f.name,
						type: f.type,
						buffer: arrayBuffer
					};
				}));

				allClients.forEach(client => {
					client.postMessage({ type: 'shared-files', files: serializedFiles }, serializedFiles.map(f => f.buffer));
				});

				// Redirect to main app page
				return Response.redirect('/tsg/fastpours/', 303);

			} catch (err) {
				console.error('SW: Error handling share POST', err);
				return Response.redirect('/tsg/fastpours/', 303);
			}
		})());
	}
});
