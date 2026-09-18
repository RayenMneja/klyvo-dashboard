import {parseGatewayResponse} from './gateway.mjs';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHmac} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const demo=process.env.DEMO_MODE==='true';const port=Number(process.env.PORT||3000);
const origin=process.env.PUBLIC_ORIGIN||`http://localhost:${port}`;
if(new URL(origin).origin!==origin)throw Error('PUBLIC_ORIGIN doit être une origine sans chemin ni slash final, exemple http://localhost:3000.');
const clientId=process.env.GOOGLE_CLIENT_ID||'';const gas=process.env.GAS_URL||'';const secret=process.env.ADMIN_GATEWAY_SECRET||'';
if(!demo&&(!clientId||!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(gas)||secret.length<32))throw Error('Set GOOGLE_CLIENT_ID, GAS_URL and ADMIN_GATEWAY_SECRET (32+ chars), or run npm run dev for local demo.');
let oauth;if(!demo){const {OAuth2Client}=await import('google-auth-library');oauth=new OAuth2Client(clientId);}
const buckets=new Map();
function send(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Cross-Origin-Opener-Policy','same-origin-allow-popups');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' https://accounts.google.com/gsi/; style-src 'self' 'unsafe-inline' https://accounts.google.com; img-src 'self' https: data:; connect-src 'self' https://accounts.google.com; frame-src 'self' https://accounts.google.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  try{
    const url=new URL(req.url,origin);
    if(url.pathname==='/config'){return send(res,200,{demo,clientId,origin,version:"1.1.0"});}
    if(url.pathname==='/api'){
      if(req.method!=='POST')return send(res,405,{success:false,message:'Méthode non autorisée.'});
      if(req.headers.origin!==origin)return send(res,403,{success:false,message:'Origine refusée.'});
      if(demo)return send(res,403,{success:false,message:'Mode démo : aucune connexion à Google Sheets.'});
      if(!/^application\/json\b/i.test(req.headers['content-type']||''))return send(res,415,{success:false,message:'JSON requis.'});
      const key=req.socket.remoteAddress||'unknown',now=Date.now();let b=buckets.get(key);if(!b||b.until<now)b={count:0,until:now+60000};b.count++;buckets.set(key,b);if(b.count>120)return send(res,429,{success:false,message:'Trop de requêtes. Réessayez dans une minute.'});
      if(buckets.size>10000)for(const [k,v] of buckets)if(v.until<now)buckets.delete(k);
      let text='',size=0;for await(const chunk of req){size+=chunk.length;if(size>200000)return send(res,413,{success:false,message:'Requête trop volumineuse.'});text+=chunk.toString();}
      let body;try{body=JSON.parse(text);}catch{return send(res,400,{success:false,message:'Corps JSON invalide.'});}if(!body||!['snapshot','saveProduct','deleteProduct'].includes(body.action))return send(res,400,{success:false,message:'Action invalide.'});
      const bearer=req.headers.authorization||'';if(!bearer.startsWith('Bearer ')||bearer.length>12000)return send(res,401,{success:false,message:'Connectez-vous avec Google.'});
      let user;try{const ticket=await oauth.verifyIdToken({idToken:bearer.slice(7),audience:clientId});user=ticket.getPayload();}catch{return send(res,401,{success:false,message:'Session Google expirée. Reconnectez-vous.'});}
      if(!user?.sub||!user.email_verified||(!user.email?.endsWith('@gmail.com')&&!user.hd))return send(res,403,{success:false,message:'Utilisez un compte Gmail ou Google Workspace vérifié.'});
      const iat=Math.floor(Date.now()/1000);const message=JSON.stringify({email:user.email.toLowerCase(),sub:user.sub,iat,exp:iat+90,body});
      const signature=createHmac('sha256',secret).update(message).digest('hex');
      const response=await fetch(gas,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'adminGateway',message,signature}),redirect:'follow',signal:AbortSignal.timeout(90000)});
      let result;try{result=await parseGatewayResponse(response,body.action);}catch(error){return send(res,502,{success:false,code:'GAS_RESPONSE',message:error.message});}return send(res,200,result);
    }
    if(!['GET','HEAD'].includes(req.method))return send(res,405,{success:false});
    const rel=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\//,'');const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep))return send(res,403,{success:false});
    const ext=path.extname(file);if(!mime[ext])return send(res,404,{success:false});const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[ext]});res.end(req.method==='HEAD'?undefined:bytes);
  }catch(error){if(error.code==='ENOENT')return send(res,404,{success:false,message:'Page introuvable.'});send(res,502,{success:false,message:'Connexion interrompue. Le résultat de la sauvegarde peut être incertain. Réessayez la même opération sans modifier le formulaire.'});}
});
server.listen(port,process.env.HOST||(demo?'127.0.0.1':'0.0.0.0'),()=>console.log(`Klyvo Admin: ${origin} (${demo?'LOCAL DEMO — no Sheets access':'Google authentication required'})`));
