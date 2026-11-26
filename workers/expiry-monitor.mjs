export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      const response = await fetch("https://devpagesdomain.pages.dev/api/internal/expire", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "DEVPAGES-Expiry-Monitor/1.0" }
      });
      if (!response.ok) throw new Error("DEVPAGES expiry endpoint returned " + response.status);
      const result = await response.json();
      console.log("DEVPAGES expiry monitor:", JSON.stringify(result));
    })());
  },
  async fetch() {
    return new Response("DEVPAGES expiry monitor is active.", {
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" }
    });
  }
};
