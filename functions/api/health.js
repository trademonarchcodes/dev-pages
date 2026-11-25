export async function onRequest() {
  return Response.json({
    ok: true,
    service: "DEV PAGES",
    status: "foundation",
    message: "DEV PAGES API foundation is online. Customer services are not activated yet."
  }, {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
