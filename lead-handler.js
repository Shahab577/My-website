'use strict';
const nodemailer = require('nodemailer');

const buckets = new Map();
function limited(ip) {
  const now = Date.now(), windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS)||600000;
  const max = Number(process.env.RATE_LIMIT_MAX)||8;
  const b = buckets.get(ip) || {start:now,count:0};
  if (now-b.start > windowMs) { b.start=now; b.count=0; }
  b.count++; buckets.set(ip,b);
  return b.count > max;
}
function clean(v,max=1500){ return String(v||'').trim().slice(0,max); }
function allowedOrigin(req){
  const origin=req.headers.origin;
  if(!origin) return true;
  const list=clean(process.env.ALLOWED_ORIGINS,4000).split(',').map(x=>x.trim()).filter(Boolean);
  if(!list.length) return true;
  return list.includes(origin);
}
async function handleLead(req,res){
  if(!allowedOrigin(req)) return res.status(403).json({ok:false,error:'Origin not allowed.'});
  if(req.method==='OPTIONS') return res.status(204).end();
  if(limited(req.ip || req.socket?.remoteAddress || 'unknown')) return res.status(429).json({ok:false,error:'Too many requests. Please try again shortly.'});

  const b=req.body||{};
  const lead={
    name:clean(b.full_name || b.name,120), phone:clean(b.phone,50), email:clean(b.email,180),
    zip:clean(b.zip,15), service:clean(b.service,120), message:clean(b.message,1500)
  };
  const errors={};
  if(!lead.name) errors.name='Name is required.';
  if(lead.phone.replace(/\D/g,'').length<10) errors.phone='Valid phone is required.';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) errors.email='Valid email is required.';
  if(!/^\d{5}(-\d{4})?$/.test(lead.zip)) errors.zip='Valid ZIP is required.';
  if(!lead.service) errors.service='Service is required.';
  if(Object.keys(errors).length) return res.status(422).json({ok:false,error:'Please check the form.',fields:errors});

  const host=process.env.SMTP_HOST||'smtp.gmail.com', port=Number(process.env.SMTP_PORT)||587;
  const user=process.env.SMTP_USER, pass=process.env.SMTP_PASS;
  if(!user || !pass) return res.status(503).json({ok:false,error:'Online requests are temporarily unavailable. Please call +1-844-937-2204.'});

  const transporter=nodemailer.createTransport({host,port,secure:String(process.env.SMTP_SECURE).toLowerCase()==='true'||port===465,auth:{user,pass}});
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  try{
    await transporter.sendMail({
      from:`"${clean(process.env.LEAD_FROM_NAME||'RapidPestHelp Website',100)}" <${process.env.LEAD_FROM_EMAIL||user}>`,
      to:process.env.LEAD_TO_EMAIL||'syedshahab9721@gmail.com',
      replyTo:lead.email,
      subject:`New RapidPestHelp lead — ${lead.service} — ${lead.zip}`,
      text:`Name: ${lead.name}\nPhone: ${lead.phone}\nEmail: ${lead.email}\nZIP: ${lead.zip}\nService: ${lead.service}\nMessage: ${lead.message||'(none)'}`,
      html:`<h2>New RapidPestHelp lead</h2><p><b>Name:</b> ${esc(lead.name)}<br><b>Phone:</b> ${esc(lead.phone)}<br><b>Email:</b> ${esc(lead.email)}<br><b>ZIP:</b> ${esc(lead.zip)}<br><b>Service:</b> ${esc(lead.service)}</p><p><b>Message:</b><br>${esc(lead.message||'(none)')}</p>`
    });
    return res.status(200).json({ok:true});
  }catch(e){
    console.error('[lead]',e && e.message);
    return res.status(502).json({ok:false,error:'We could not send your request. Please call +1-844-937-2204.'});
  }
}
module.exports={handleLead};
