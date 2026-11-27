import { json } from "../../_lib/billing.js";

export async function onRequestGet() {
  return new Response(JSON.stringify({admin_email:"devlyonofficial@gmail.com",registration_restricted:true}), {
    headers: {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}
  });
}
