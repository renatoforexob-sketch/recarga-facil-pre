import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);

// Lightweight .env loader: no extra npm package is required.
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
} catch {}

const API_URL = process.env.BLACKCAT_API_URL || 'https://api.blackcatoficial.com/api/sales/create-sale';
const STATUS_BASE_URL = process.env.BLACKCAT_STATUS_URL || 'https://api.blackcatpay.com.br/api/sales';

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(data);
}
function requireKey(res) {
  if (!process.env.BLACKCAT_API_KEY) { json(res,500,{success:false,message:'BLACKCAT_API_KEY não configurada no servidor.'}); return false; }
  return true;
}
function readBody(req) {
  return new Promise((resolve,reject)=>{
    let raw='';
    req.on('data', c => { raw += c; if(raw.length > 1e6) req.destroy(); });
    req.on('end',()=>{ try { resolve(raw ? JSON.parse(raw) : {}); } catch(e){ reject(e); } });
    req.on('error',reject);
  });
}

async function pix(req,res) {
  if (req.method !== 'POST') return json(res,405,{success:false,message:'Método não permitido'});
  if (!requireKey(res)) return;
  let input; try { input=await readBody(req); } catch { return json(res,400,{success:false,message:'JSON inválido.'}); }
  const amount=Number(input.amount);
  if(!Number.isFinite(amount)||amount<0.01||amount>1000) return json(res,400,{success:false,message:'amount deve ser um número entre 0,01 e 1.000.'});
  const metadata=input.metadata&&typeof input.metadata==='object'?input.metadata:{};
  const payload={amount:Math.round(amount*100),currency:'BRL',paymentMethod:'pix',items:[{title:input.product_name||'Recarga de Celular - Recarga Fácil',quantity:1,tangible:false}],customer:{name:process.env.BLACKCAT_CLIENT_NAME||'Recarga Fácil',email:process.env.BLACKCAT_CLIENT_EMAIL||'contato@recargatodahora.online',phone:String(metadata.telefone||'11999999999'),document:{number:process.env.BLACKCAT_CLIENT_DOCUMENT||'',type:'cpf'}},pix:{expiresInDays:1},metadata,...(process.env.BLACKCAT_POSTBACK_URL?{postbackUrl:process.env.BLACKCAT_POSTBACK_URL}:{}),externalRef:`RTH-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomUUID().slice(0,8)}`};
  try {
    const r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json','X-API-Key':process.env.BLACKCAT_API_KEY},body:JSON.stringify(payload)});
    const text=await r.text(); let data={}; try{data=JSON.parse(text)}catch{}
    if(!r.ok||!data?.data?.paymentData) return json(res,r.status||502,{success:false,message:data?.message||data?.error||'A API de pagamento não retornou um Pix válido.'});
    return json(res,200,{success:true,data:{paymentData:{copyPaste:data.data.paymentData.copyPaste||'',qrCodeBase64:data.data.paymentData.qrCodeBase64||null,qrCode:data.data.paymentData.qrCode||''},transactionId:data.data.transactionId||null,status:data.data.status||'PENDING',amount:data.data.amount||Math.round(amount*100),amountDisplay:amount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),invoiceUrl:data.data.invoiceUrl||null}});
  } catch(e){ console.error(e); return json(res,502,{success:false,message:'Não foi possível conectar ao gateway de pagamento.'}); }
}
async function status(req,res,url) {
  if(req.method!=='GET') return json(res,405,{success:false,message:'Método não permitido'});
  if(!requireKey(res)) return;
  const transaction=String(url.searchParams.get('transaction')||'').replace(/[^a-zA-Z0-9_-]/g,'');
  if(!transaction) return json(res,400,{success:false,message:'transaction é obrigatória.'});
  try { const r=await fetch(`${STATUS_BASE_URL}/${encodeURIComponent(transaction)}/status`,{headers:{'X-API-Key':process.env.BLACKCAT_API_KEY,'Content-Type':'application/json'}}); const text=await r.text(); let data; try{data=JSON.parse(text)}catch{data={success:false,message:text}}; return json(res,r.status,data); }
  catch(e){console.error(e);return json(res,502,{success:false,message:'Não foi possível consultar o status do pagamento.'});}
}

const dist=path.join(__dirname,'dist');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp'};
function serve(req,res,url){
  let pathname=decodeURIComponent(url.pathname);
  if(pathname.startsWith('/api/')) return json(res,404,{success:false,message:'Endpoint não encontrado.'});
  let file=path.join(dist,pathname==='/'?'index.html':pathname.replace(/^\//,''));
  if(!file.startsWith(dist)) return json(res,403,{success:false,message:'Acesso negado.'});
  if(fs.existsSync(file)&&fs.statSync(file).isFile()) { const ext=path.extname(file); res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream'}); return fs.createReadStream(file).pipe(res); }
  const index=path.join(dist,'index.html');
  if(fs.existsSync(index)){res.writeHead(200,{'Content-Type':mime['.html']});return fs.createReadStream(index).pipe(res);}
  json(res,503,{success:false,message:'Build do React não encontrado. Execute npm run build.'});
}

const server=http.createServer((req,res)=>{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`); if(url.pathname==='/api/pix')return pix(req,res); if(url.pathname==='/api/status')return status(req,res,url); return serve(req,res,url);});
server.listen(PORT,'0.0.0.0',()=>console.log(`Recarga Fácil Node/React rodando na porta ${PORT}`));
