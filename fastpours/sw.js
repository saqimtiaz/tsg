self.addEventListener("fetch", event=>{
	if(event.request.method === "POST"){
		event.respondWith(
			fetch(event.request.url, {method:"GET"})
		);
	}
});
