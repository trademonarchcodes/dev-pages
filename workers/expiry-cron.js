export default {
  async scheduled(controller, env, ctx) {
    const response = await fetch("https://devpagesdomain.pages.dev/api/internal/expire", {
      method: "POST",
      headers: { Authorization: "Bearer " + env.DEVPAGES_EXPIRY_CRON_SECRET, "Content-Type": "application/json" },
      body: "{}"
    });
    if (!response.ok) throw new Error("DEVPAGES expiry processor returned HTTP " + response.status + ": " + await response.text());
  },
  async fetch() {
    return new Response("DEVPAGES expiry scheduler is running.", { headers: { "content-type": "text/plain" } });
  }
};