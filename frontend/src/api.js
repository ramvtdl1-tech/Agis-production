const API=import.meta.env.VITE_API_URL||"http://localhost:8000/api";
async function req(path,opt={}){
 const h={...(opt.body instanceof FormData?{}:{"Content-Type":"application/json"}),...(opt.headers||{})};
 const t=localStorage.getItem("agis_access");if(t)h.Authorization=`Bearer ${t}`;
 const r=await fetch(API+path,{...opt,headers:h});if(!r.ok)throw Error((await r.json().catch(()=>({detail:"Request failed"}))).detail||"Request failed");return r.json();
}
export const api={
 login:b=>req("/auth/login",{method:"POST",body:JSON.stringify(b)}),
 otp:b=>req("/auth/verify-otp",{method:"POST",body:JSON.stringify(b)}),
 register:b=>req("/auth/register",{
  method:"POST",
  body:JSON.stringify(b)
}),

registerOtp:b=>req("/auth/register/verify-otp",{
  method:"POST",
  body:JSON.stringify(b)
}),
 me:()=>req("/me"),dashboard:()=>req("/dashboard"),documents:()=>req("/documents"),
 upload:f=>{const x=new FormData();x.append("file",f);return req("/documents/upload",{method:"POST",body:x})},
 transformations:()=>req("/transformations"),transformation:id=>req("/transformations/"+id),
 createTransformation:b=>req("/transformations",{method:"POST",body:JSON.stringify(b)}),
 review:(id,b)=>req(`/transformations/${id}/review`,{method:"POST",body:JSON.stringify(b)}),
logs:()=>req("/audit-logs"),
users:()=>req("/users"),
approveUser:(userId,action)=>req(`/users/${userId}/approval`,{
  method:"POST",
  body:JSON.stringify({action})
}),
roles:()=>req("/roles"),
templates:()=>req("/templates")
};
