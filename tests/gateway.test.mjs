import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGatewayResponse} from '../server/gateway.mjs';
import {gasFixture} from './gas-fixture.mjs';
test('gateway refuses storefront data and HTML instead of accepting a successful wrong endpoint',async()=>{
 await assert.rejects(parseGatewayResponse(Response.json({success:true,data:{products:[]}}),'snapshot'),/snapshot administration/);
 await assert.rejects(parseGatewayResponse(new Response('<html>Sign in</html>'),'snapshot'),/page au lieu de JSON/);
 await assert.rejects(parseGatewayResponse(new Response('',{status:404}),'snapshot'),/HTTP 404/);
});
test('gateway accepts complete admin snapshot and preserves business failure codes',async()=>{
 const f=gasFixture();f.ctx.setupKlyvoAdmin();const data=f.call({action:'snapshot'});
 const result=await parseGatewayResponse(Response.json(data),'snapshot');assert.equal(result.data.readOnly,false);
 const denied=await parseGatewayResponse(Response.json({success:false,code:'ADMIN_NOT_ALLOWED',message:'Denied'}),'snapshot');assert.equal(denied.code,'ADMIN_NOT_ALLOWED');
});
test('doPost routes signed snapshot to admin while doGet remains public catalogue',()=>{
 const f=gasFixture();f.ctx.setupKlyvoAdmin();const cryptoPromise=import('node:crypto');return cryptoPromise.then(({createHmac})=>{
 const message=JSON.stringify({email:'owner@gmail.com',sub:'1',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+60,body:{action:'snapshot'}});
 const envelope={action:'adminGateway',message,signature:createHmac('sha256',f.props.ADMIN_GATEWAY_SECRET).update(message).digest('hex')};
 const r=JSON.parse(f.ctx.doPost({postData:{contents:JSON.stringify(envelope)}}).text);assert.equal(r.success,true);assert.ok(Array.isArray(r.data.warnings));
 const catalogue=JSON.parse(f.ctx.doGet({parameter:{action:'products'}}).text);assert.equal(catalogue.success,true);assert.ok(Array.isArray(catalogue.data.products));assert.equal(catalogue.data.orders,undefined);
 });
});
