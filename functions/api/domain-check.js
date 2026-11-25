const BOOTSTRAP_URL="https://data.iana.org/rdap/dns.json";
const DOMAIN_RE=/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
let bootstrapCache;
let bootstrapExpiry=0;
async function getBootstrap(){
 if(bootstrapCache&&Date.now()<bootstrapExpiry)return bootstrapCache;
 const response=await fetch(BOOTSTRAP_URL,{headers:{"Accept":"application/json"}});
 if(!response.ok)throw new Error("RDAP bootstrap is temporarily unavailable");
 bootstrapCache=await response.json();
 bootstrapExpiry=Date.now()+3600000;
 return bootstrapCache;
}
function findServer(domain,data){
 const labels=domain.toLowerCase().split(".");
 for(let i=0;i<labels.length-1;i++){
  const suffix=labels.slice(i).join(".");
  const entry=(data.services||[]).find(service=>Array.isArray(service[0])&&service[0].some(t=>String(t).toLowerCase()===suffix));
  if(entry&&Array.isArray(entry[1])&&entry[1].length)return entry[1][0].replace(/\/$/,"");
 }
 return null;
}
async function checkDomain(domain,bootstrap){
 const server=findServer(domain,bootstrap);
 if(!server)return {domain,status:"unsupported"};
 try{
  const response=await fetch(server+"/domain/"+encodeURIComponent(domain),{
   headers:{"Accept":"application/rdap+json, application/json"},
   cf:{cacheTtl:60,cacheEverything:true}
  });
  if(response.status===404)return {domain,status:"not_found"};
  if(response.ok)return {domain,status:"registered"};
  return {domain,status:"unknown"};
 }catch{return {domain,status:"unknown"}}
}
export async function onRequestPost({request}){
 let body;
 try{body=await request.json()}catch{return Response.json({error:"Send a valid JSON request."},{status:400})}
 const domains=Array.isArray(body?.domains)?body.domains:[];
 if(!domains.length||domains.length>8)return Response.json({error:"Check between 1 and 8 domain names at a time."},{status:400});
 const clean=[...new Set(domains.map(x=>String(x).trim().toLowerCase()))];
 if(clean.some(x=>!DOMAIN_RE.test(x)))return Response.json({error:"One or more domain names are invalid."},{status:400});
 try{
  const bootstrap=await getBootstrap();
  const results=await Promise.all(clean.map(domain=>checkDomain(domain,bootstrap)));
  return Response.json({results,disclaimer:"RDAP registration data is indicative only. Confirm availability and price with a registrar before purchase."},{
   headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
  });
 }catch{
  return Response.json({error:"The registry lookup service is temporarily unavailable. Please try again."},{status:503,headers:{"Cache-Control":"no-store"}})
 }
}