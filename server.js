import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express(); const port=Number(process.env.PORT||3000);
const appUrl=(process.env.APP_URL||`http://localhost:${port}`).replace(/\/$/,'');
const supabasePublicKey=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||'';
const supabaseSecretKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const hasPublic=Boolean(process.env.SUPABASE_URL&&supabasePublicKey);
const hasAdmin=Boolean(hasPublic&&supabaseSecretKey);
const stripeConfigured=Boolean(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_PRO_PRICE_ID);
const stripe=stripeConfigured?new Stripe(process.env.STRIPE_SECRET_KEY):null;
const authClient=hasPublic?createClient(process.env.SUPABASE_URL,supabasePublicKey,{auth:{persistSession:false,autoRefreshToken:false}}):null;
const admin=hasAdmin?createClient(process.env.SUPABASE_URL,supabaseSecretKey,{auth:{persistSession:false,autoRefreshToken:false}}):null;

app.set('trust proxy',1);
app.disable('x-powered-by');
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Frame-Options','DENY');
  next();
});
const authAttempts=new Map();
function authRateLimit(req,res,next){
  const key=req.ip||req.socket.remoteAddress||'unknown',now=Date.now(),windowMs=10*60*1000,max=25;
  const x=authAttempts.get(key)||{count:0,start:now};
  if(now-x.start>windowMs){x.count=0;x.start=now}
  x.count++;authAttempts.set(key,x);
  if(x.count>max)return res.status(429).json({error:'Too many account attempts. Try again in a few minutes.'});
  next();
}

async function userFromRequest(req){ if(!admin)return null; const a=req.headers.authorization||''; const token=a.startsWith('Bearer ')?a.slice(7):''; if(!token)return null; const {data,error}=await admin.auth.getUser(token); return error?null:data?.user||null; }
async function subscriptionForUser(id){ if(!admin)return null; const {data}=await admin.from('subscriptions').select('*').eq('user_id',id).maybeSingle(); return data||null; }
async function upsertSubscriptionFromStripe(sub){ if(!admin||!sub)return; let userId=sub.metadata?.user_id||null; if(!userId){const {data}=await admin.from('subscriptions').select('user_id').eq('stripe_customer_id',String(sub.customer)).maybeSingle();userId=data?.user_id||null;} if(!userId)return; await admin.from('subscriptions').upsert({user_id:userId,stripe_customer_id:String(sub.customer),stripe_subscription_id:sub.id,status:sub.status,price_id:sub.items?.data?.[0]?.price?.id||null,current_period_end:sub.current_period_end?new Date(sub.current_period_end*1000).toISOString():null,updated_at:new Date().toISOString()},{onConflict:'user_id'}); }

app.post('/api/stripe-webhook',express.raw({type:'application/json'}),async(req,res)=>{ if(!stripe||!process.env.STRIPE_WEBHOOK_SECRET||!admin)return res.status(503).send('Billing is not configured.'); let event; try{event=stripe.webhooks.constructEvent(req.body,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET)}catch(e){return res.status(400).send(`Webhook Error: ${e.message}`)} try{if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type))await upsertSubscriptionFromStripe(event.data.object); if(event.type==='checkout.session.completed'&&event.data.object.subscription){let sub=await stripe.subscriptions.retrieve(event.data.object.subscription);if(!sub.metadata?.user_id&&event.data.object.metadata?.user_id)sub=await stripe.subscriptions.update(sub.id,{metadata:{...sub.metadata,user_id:event.data.object.metadata.user_id}});await upsertSubscriptionFromStripe(sub)}res.json({received:true})}catch(e){console.error(e);res.status(500).send('Webhook processing failed.')}});

app.use(express.json({limit:'1mb'}));
app.get('/api/public-config',(req,res)=>res.json({authConfigured:hasPublic&&hasAdmin,cloudConfigured:hasAdmin,billingConfigured:stripeConfigured&&Boolean(process.env.STRIPE_WEBHOOK_SECRET)&&hasAdmin}));
app.get('/api/health',(req,res)=>res.json({ok:true,authConfigured:hasPublic&&hasAdmin,cloudConfigured:hasAdmin,billingConfigured:stripeConfigured}));

app.post('/api/auth/signup',authRateLimit,async(req,res)=>{ if(!authClient)return res.status(503).json({error:'Account service is not configured.'}); const email=String(req.body?.email||'').trim(),password=String(req.body?.password||''); if(!email||password.length<6)return res.status(400).json({error:'Use a valid email and a password with at least 6 characters.'}); try{const {data,error}=await authClient.auth.signUp({email,password}); if(error)return res.status(400).json({error:error.message}); res.json({session:data.session||null,user:data.user?{id:data.user.id,email:data.user.email}:null,confirmationRequired:!data.session})}catch(e){console.error('signup',e);res.status(502).json({error:'Could not reach the account service. Check the Supabase URL and publishable key in the hosting environment.'})} });
app.post('/api/auth/signin',authRateLimit,async(req,res)=>{ if(!authClient)return res.status(503).json({error:'Account service is not configured.'}); try{const {data,error}=await authClient.auth.signInWithPassword({email:String(req.body?.email||'').trim(),password:String(req.body?.password||'')}); if(error)return res.status(400).json({error:error.message}); res.json({session:data.session})}catch(e){console.error('signin',e);res.status(502).json({error:'Could not reach the account service. Check the Supabase configuration in the hosting environment.'})} });
app.post('/api/auth/refresh',async(req,res)=>{ if(!authClient)return res.status(503).json({error:'Account service is not configured.'}); const {data,error}=await authClient.auth.refreshSession({refresh_token:String(req.body?.refresh_token||'')}); if(error)return res.status(401).json({error:error.message}); res.json({session:data.session}) });

app.get('/api/account',async(req,res)=>{const user=await userFromRequest(req);if(!user)return res.status(401).json({error:'Unauthorized'});const sub=await subscriptionForUser(user.id),active=Boolean(sub&&['active','trialing'].includes(sub.status));res.json({user:{id:user.id,email:user.email},plan:active?'pro':'free',active})});
app.get('/api/brands',async(req,res)=>{const user=await userFromRequest(req);if(!user)return res.status(401).json({error:'Unauthorized'});const {data,error}=await admin.from('brands').select('*').eq('owner_id',user.id).order('created_at');if(error)return res.status(400).json({error:error.message});res.json({brands:data||[]})});
app.post('/api/brands',async(req,res)=>{const user=await userFromRequest(req);if(!user)return res.status(401).json({error:'Unauthorized'});const name=String(req.body?.name||'').trim().slice(0,120);if(!name)return res.status(400).json({error:'Brand name is required.'});const {data,error}=await admin.from('brands').insert({owner_id:user.id,name,currency:'USD'}).select().single();if(error)return res.status(400).json({error:error.message});res.json({brand:data})});
app.get('/api/skus',async(req,res)=>{const user=await userFromRequest(req);if(!user)return res.status(401).json({error:'Unauthorized'});const {data,error}=await admin.from('skus').select('*').eq('owner_id',user.id).order('created_at');if(error)return res.status(400).json({error:error.message});res.json({skus:data||[]})});
app.post('/api/skus',async(req,res)=>{const user=await userFromRequest(req);if(!user)return res.status(401).json({error:'Unauthorized'});const brandId=String(req.body?.brand_id||''),sku=String(req.body?.sku||'').trim().slice(0,80),name=String(req.body?.name||'').trim().slice(0,160);const {data:brand}=await admin.from('brands').select('id').eq('id',brandId).eq('owner_id',user.id).maybeSingle();if(!brand)return res.status(403).json({error:'Brand not found.'});if(!sku||!name)return res.status(400).json({error:'SKU and product name are required.'});const payload={owner_id:user.id,brand_id:brandId,sku,name,retail_price:Math.max(0,Number(req.body?.retail_price)||0),landed_cost:Math.max(0,Number(req.body?.landed_cost)||0),on_hand:Math.max(0,Math.trunc(Number(req.body?.on_hand)||0))};const {data,error}=await admin.from('skus').insert(payload).select().single();if(error)return res.status(400).json({error:error.message});res.json({sku:data})});
app.post('/api/import-summaries',async(req,res)=>{const user=await userFromRequest(req);if(!user)return res.status(401).json({error:'Unauthorized'});const payload={owner_id:user.id,brand_id:req.body?.brand_id||null,file_kind:String(req.body?.file_kind||'unknown'),start_date:req.body?.start_date||null,end_date:req.body?.end_date||null,summary:req.body?.summary||{}};const {error}=await admin.from('import_summaries').insert(payload);if(error)return res.status(400).json({error:error.message});res.json({ok:true})});
app.get('/api/entitlement',async(req,res)=>{const user=await userFromRequest(req);if(!user)return res.status(401).json({error:'Unauthorized'});const sub=await subscriptionForUser(user.id),active=Boolean(sub&&['active','trialing'].includes(sub.status));res.json({plan:active?'pro':'free',active,subscription:sub?{status:sub.status,currentPeriodEnd:sub.current_period_end}:null})});

app.post('/api/create-checkout-session',async(req,res)=>{if(!stripe||!admin)return res.status(503).json({error:'Billing is not configured yet.'});const user=await userFromRequest(req);if(!user)return res.status(401).json({error:'Sign in first.'});try{const existing=await subscriptionForUser(user.id);let customerId=existing?.stripe_customer_id||null;if(!customerId){const c=await stripe.customers.create({email:user.email,metadata:{user_id:user.id}});customerId=c.id;await admin.from('subscriptions').upsert({user_id:user.id,stripe_customer_id:customerId,status:'inactive',updated_at:new Date().toISOString()},{onConflict:'user_id'})}const s=await stripe.checkout.sessions.create({mode:'subscription',customer:customerId,line_items:[{price:process.env.STRIPE_PRO_PRICE_ID,quantity:1}],success_url:`${appUrl}/?billing=success`,cancel_url:`${appUrl}/?billing=cancel`,metadata:{user_id:user.id},subscription_data:{metadata:{user_id:user.id}},allow_promotion_codes:true});res.json({url:s.url})}catch(e){console.error(e);res.status(500).json({error:'Could not start checkout.'})}});
app.post('/api/create-portal-session',async(req,res)=>{if(!stripe||!admin)return res.status(503).json({error:'Billing is not configured yet.'});const user=await userFromRequest(req);if(!user)return res.status(401).json({error:'Sign in first.'});const existing=await subscriptionForUser(user.id);if(!existing?.stripe_customer_id)return res.status(400).json({error:'No billing profile found.'});try{const s=await stripe.billingPortal.sessions.create({customer:existing.stripe_customer_id,return_url:appUrl});res.json({url:s.url})}catch(e){res.status(500).json({error:'Could not open billing portal.'})}});

app.use(express.static(path.join(__dirname,'public'),{extensions:['html']}));
app.use((req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(port,()=>console.log(`Motion Supply Brand OS running on ${appUrl}`));
