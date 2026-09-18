import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {gasFixture} from './gas-fixture.mjs';
function ui(){
 const nodes=Object.fromEntries(['#login','#shell','#login-status','#origin-help','#demo-login','#logout','#order-dialog .close','#last-update','#toast','#breadcrumb','#notice','#notice-details','#notice-summary','#write-block','#view'].map(k=>[k,{hidden:false,textContent:'',classList:{toggle(){}},innerHTML:''}]));
 const ctx={console,Intl,Date,URL,structuredClone,AbortSignal,Response,setTimeout,clearTimeout,location:{origin:'http://localhost:3000'},window:{addEventListener(){}},document:{querySelector:s=>nodes[s]||null,querySelectorAll:()=>[],head:{appendChild(){}}},fetch:async()=>Response.json({demo:true,origin:'http://localhost:3000'}),confirm:()=>true};vm.createContext(ctx);
 for(const file of ['domain.js','protocol.js','demo.js','app.js'])vm.runInContext(fs.readFileSync('public/'+file,'utf8'),ctx);
 return {ctx,nodes,run:code=>vm.runInContext(code,ctx)};
}
test('complete demo snapshot renders dashboard without runtime exceptions',async()=>{const u=ui();await new Promise(r=>setImmediate(r));await u.run('load()');assert.match(u.nodes['#view'].innerHTML,/Vue d’ensemble/);assert.match(u.nodes['#last-update'].textContent,/Tunis/);});
test('malformed snapshot does not overwrite the last valid UI state',async()=>{const u=ui();await new Promise(r=>setImmediate(r));await u.run('load()');u.run('globalThis.previous=state.data;api=async()=>({products:[]});');await assert.rejects(u.run('load()'),/snapshot administration/);assert.equal(u.run('state.data===previous'),true);});
test('readonly reason remains visible when more than eight warnings exist',async()=>{const u=ui();await new Promise(r=>setImmediate(r));await u.run('load()');u.run("state.data.readOnly=true;state.data.writeBlockReasons=['Formules : Products!A2'];state.data.warnings=Array.from({length:20},(_,i)=>'Warning '+i);render();");assert.equal(u.nodes['#write-block'].hidden,false);assert.match(u.nodes['#write-block'].textContent,/Products!A2/);assert.match(u.nodes['#notice'].textContent,/Warning 19/);u.run("state.editor=newProduct();state.page='editor';");assert.match(u.run('editorView()'),/id="save-product" disabled/);assert.match(u.run('editorView()'),/Products!A2/);});
test('backend readonly snapshot is accepted without pretending admin setup is complete',()=>{const f=gasFixture();const u=ui();u.ctx.payload=f.call({action:'snapshot'}).data;const d=u.run('KlyvoProtocol.snapshot(payload)');assert.equal(d.readOnly,true);assert.match(d.writeBlockReasons.join(' '),/setupKlyvoAdmin/);});
test('uncertain save retains original request and blocks editing until resolved',async()=>{
 const u=ui();await new Promise(r=>setImmediate(r));await u.run('load()');
 u.nodes['#form-error']={textContent:''};u.nodes['#save-product']={disabled:false,textContent:''};
 u.run("state.editor=newProduct();state.originalDescription='';state.editorRevision=state.data.revision;state.page='editor';state.dirty=true;state.request={uncertain:true,body:{action:'saveProduct',requestId:'adm-original123456789',product:{name:'Original'}}};globalThis.sent=[];api=async body=>{sent.push(body);const err=Error('Réseau');err.uncertain=true;throw err;};");
 await u.run('saveProduct({preventDefault(){}})');assert.equal(u.run('sent.length'),1);assert.equal(u.run('sent[0].requestId'),'adm-original123456789');assert.equal(u.run('state.request.uncertain'),true);assert.match(u.nodes['#save-product'].textContent,/Vérifier/);
});
