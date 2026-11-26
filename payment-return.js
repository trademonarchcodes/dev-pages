import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.102.0/+esm";
const supabase=createClient("https://xkkczzhjffocfywjlukr.supabase.co","sb_publishable_rOIFM2e5DRVSIN-dhFfqkQ_YOIqlGZN",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const message=document.getElementById("payment-message"),link=document.getElementById("back-link");
try {
 const reference=new URLSearchParams(location.search).get("reference");
 if(!reference)throw new Error("No payment reference was supplied.");
 const {data}=await supabase.auth.getSession();
 if(!data.session?.access_token)throw new Error("Sign in to DEVPAGES to confirm this payment.");
 const response=await fetch("/api/paystack/verify",{method:"POST",headers:{Authorization:"Bearer "+data.session.access_token,"Content-Type":"application/json"},body:JSON.stringify({reference})});
 const result=await response.json();
 if(!response.ok||!result.success)throw new Error(result.error||"Payment could not be verified.");
 message.textContent="Payment confirmed. Your 30-day domain subscription has been updated. Website provisioning may take a short moment.";
} catch(error) { message.textContent=error.message||"Payment verification could not be completed. Your payment has not been assumed successful."; }
link.hidden=false;