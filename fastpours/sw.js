// sw.js
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || !url.pathname.endsWith("/index.html")) {
    // ignore other requests
    return;
  }

  event.respondWith((async () => {
    const formData = await event.request.formData();
    const files = formData.getAll("photo"); // match your manifest 'name'

    // Send files to the PWA window if it exists
    const allClients = await clients.matchAll({ type: "window" });
    if (allClients.length > 0) {
      const client = allClients[0];
      files.forEach(file => {
        client.postMessage({ type: "shared-file", file });
      });
    }

    // Redirect back to your app
    return Response.redirect("/tsg/fastpours/index.html", 303);
  })());
});
