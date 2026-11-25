export async function onRequest() {
  return Response.json({
    ok: true,
    service: "DEVPAGES",
    status: "foundation",
    message: "DEVPAGES API foundation is online. Customer services are not activated yet."
  }, {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
