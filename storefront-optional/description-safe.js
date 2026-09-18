/* Shared, deterministic business rules. No network or credentials. */
const KlyvoDomain = (() => {
  const str = v => String(v ?? '').trim();
  const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const bool = v => v === true || /^(true|oui|1)$/i.test(str(v));
  const unique = a => [...new Set(a)];
  function sku(category,name,id,used=[]) {
    const prefix = x => str(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').slice(0,3).toUpperCase() || 'PRD';
    const n = str(id).match(/(\d+)$/);const base=[prefix(category),prefix(name),(n?n[1]:'001').slice(-3).padStart(3,'0')].join('-');
    let s=base,i=2;while(used.includes(s))s=base+'-'+i++;return s;
  }
  function images(value) {
    const list=Array.isArray(value)?value:String(value||'').split('|');
    return unique(list.map(str).filter(Boolean).map(u=>{if(!/^https:\/\/[^\s<>"'|]+$/i.test(u)||u.length>1000)throw Error('URL image HTTPS invalide (maximum 1000 caractères).');return u;}));
  }
  function unwrap(v){let s=str(v);if(s.startsWith('`')&&s.endsWith('`')&&s.length>=2)s=s.slice(1,-1);return s;}
  function html(value) {
    // Conservative serializer: no attributes, URLs, CSS, SVG or embedded content survive.
    const allowed=new Set('p div span h2 h3 h4 strong b em i u s ul ol li br hr table thead tbody tfoot tr th td blockquote'.split(' '));
    return unwrap(value).split(/(<[^>]*>)/g).map(part=>{
      if(!part.startsWith('<'))return part.replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const m=part.match(/^<\s*(\/?)\s*([a-z][a-z0-9]*)\b[^>]*>$/i);
      return m&&allowed.has(m[2].toLowerCase())?'<'+m[1]+m[2].toLowerCase()+'>':esc(part);
    }).join('');
  }
  function num(v,label,integer=false){if(v===''||v==null||typeof v==='boolean')throw Error(label+' requis.');let n=Number(v);if(!Number.isFinite(n)||n<0||(integer&&!Number.isInteger(n)))throw Error(label+' invalide.');return n;}
  function validateProduct(input){
    const p={...input};p.name=str(p.name);p.category=str(p.category);
    if(p.name.length<2||p.name.length>200||!p.category||p.category.length>100)throw Error('Nom et catégorie requis (200 / 100 caractères max.).');
    p.price=num(p.price,'Prix');p.discountPrice=p.discountPrice===''||p.discountPrice==null?0:num(p.discountPrice,'Promotion');
    if(p.discountPrice>p.price)throw Error('La promotion dépasse le prix normal.');
    p.stock=num(p.stock??0,'Stock',true);p.image=images([p.image])[0]||'';if(!p.image)throw Error('Image principale requise.');
    p.images=images(p.images||[]);if(p.images.join('|').length>45000)throw Error('Trop de liens : maximum 45000 caractères.');
    p.description=String(p.description||'');if(p.description.length>45000)throw Error('Description trop longue.');
    p.active=p.active!==false;p.featured=bool(p.featured);
    const keys=new Set();p.variants=(p.variants||[]).map(v=>{const r={...v,color:str(v.color),size:str(v.size),price:num(v.price??0,'Prix variante'),stock:num(v.stock,'Stock variante',true),active:v.active!==false};if(!r.color&&!r.size)throw Error('Couleur ou taille requise pour une variante.');if(r.color.length>80||r.size.length>80)throw Error('Option trop longue.');const k=JSON.stringify([r.color.toLowerCase(),r.size.toLowerCase()]);if(keys.has(k))throw Error('Combinaison de variante dupliquée.');keys.add(k);return r;});
    if(p.variants.length>200)throw Error('Maximum 200 variantes par produit.');return p;
  }
  function day(value){if(!value)return '';const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Tunis',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
  function customerKey(o){let p=str(o.phone).replace(/\D/g,'');if(p.startsWith('00'))p=p.slice(2);if(/^\d{8}$/.test(p))p='216'+p;return p?'tel:'+p:(str(o.email)?'mail:'+str(o.email).toLowerCase():'unknown:'+o.id);}
  function analytics(data,start,end){
    const warnings=[];const groups=new Map();for(const o of data.orders||[]){if(!o.id){warnings.push('Commande sans ID ignorée.');continue;}if(!groups.has(o.id))groups.set(o.id,[]);groups.get(o.id).push(o);}
    let orders=[];for(const [id,list] of groups){if(list.length>1){warnings.push('ID commande dupliqué exclu : '+id);continue;}orders.push(list[0]);}
    const reqs=new Map();for(const o of orders){if(o.requestId){if(!reqs.has(o.requestId))reqs.set(o.requestId,[]);reqs.get(o.requestId).push(o.id);}}
    const excluded=new Set();for(const ids of reqs.values())if(ids.length>1){ids.forEach(id=>excluded.add(id));warnings.push('Request ID partagé : commandes exclues.');}
    orders=orders.filter(o=>!excluded.has(o.id));
    const valid=orders.filter(o=>{if(!day(o.date)){warnings.push('Date invalide : '+o.id);return false;}return true;});
    const inPeriod=o=>day(o.date)>=start&&day(o.date)<=end;
    const statuses=Object.create(null);valid.filter(inPeriod).forEach(o=>{statuses[o.status||'Inconnu']=(statuses[o.status||'Inconnu']||0)+1;});
    const confirmed=valid.filter(o=>o.status==='Confirmée');const past=new Set(confirmed.filter(o=>day(o.date)<start).map(customerKey));
    const selected=confirmed.filter(inPeriod).filter(o=>{const ok=['subtotal','delivery','total'].every(k=>o[k]!==''&&o[k]!=null&&Number.isFinite(Number(o[k]))&&Number(o[k])>=0);if(!ok)warnings.push('Montants invalides : '+o.id);return ok;});
    const orderMap=new Map(selected.map(o=>[o.id,o]));const buyers=new Map(),curve=new Map();let subtotal=0,delivery=0,total=0;
    for(const o of selected){subtotal+=Number(o.subtotal);delivery+=Number(o.delivery);total+=Number(o.total);const k=customerKey(o);if(!buyers.has(k))buyers.set(k,{key:k,name:o.name||'Client',phone:o.phone||'',email:o.email||'',count:0,total:0,returning:past.has(k)});const b=buyers.get(k);b.count++;b.total+=Number(o.subtotal);const d=day(o.date);if(!curve.has(d))curve.set(d,{date:d,value:0,count:0,units:0});curve.get(d).value+=Number(o.subtotal);curve.get(d).count++;}
    const ranking=new Map((data.products||[]).map(p=>[p.id,{id:p.id,name:p.name,category:p.category||'Non classé',createdAt:p.createdAt,active:p.active,units:0,value:0}]));
    let units=0;const itemIds=new Map();for(const i of data.items||[])if(i.id)itemIds.set(i.id,(itemIds.get(i.id)||0)+1);
    for(const i of data.items||[]){if(!orderMap.has(i.orderId))continue;if(i.id&&itemIds.get(i.id)>1){warnings.push('Ligne dupliquée exclue : '+i.id);continue;}if(!i.productId||!Number.isInteger(Number(i.quantity))||Number(i.quantity)<1||i.total==null||i.total===''||!Number.isFinite(Number(i.total))||Number(i.total)<0){warnings.push('Ligne invalide : '+i.orderId);continue;}if(!ranking.has(i.productId))ranking.set(i.productId,{id:i.productId,name:i.name||i.productId,category:'Historique / non classé',units:0,value:0});const r=ranking.get(i.productId);r.units+=Number(i.quantity);r.value+=Number(i.total);units+=Number(i.quantity);curve.get(day(orderMap.get(i.orderId).date)).units+=Number(i.quantity);}
    const categories=Object.create(null);for(const r of ranking.values()){if(!categories[r.category])categories[r.category]={name:r.category,units:0,value:0};categories[r.category].units+=r.units;categories[r.category].value+=r.value;}
    const bs=[...buyers.values()].map(b=>({...b,share:subtotal?b.total/subtotal*100:0}));
    // Fill gaps so no-sales days do not disappear from the curve.
    if(/^\d{4}-\d{2}-\d{2}$/.test(start)&&/^\d{4}-\d{2}-\d{2}$/.test(end)){let d=new Date(start+'T12:00:00Z'),last=new Date(end+'T12:00:00Z'),n=0;while(d<=last&&n++<3660){const key=d.toISOString().slice(0,10);if(!curve.has(key))curve.set(key,{date:key,value:0,count:0,units:0});d.setUTCDate(d.getUTCDate()+1);}}
    return {count:selected.length,units,subtotal,delivery,total,buyers:bs.sort((a,b)=>b.total-a.total),average:selected.length?subtotal/selected.length:0,ordersPerBuyer:bs.length?selected.length/bs.length:0,repeatRate:bs.length?bs.filter(b=>b.count>=2).length/bs.length*100:0,returningRate:bs.length?bs.filter(b=>b.returning).length/bs.length*100:0,curve:[...curve.values()].sort((a,b)=>a.date.localeCompare(b.date)),ranking:[...ranking.values()].sort((a,b)=>b.units-a.units),categories:Object.values(categories).sort((a,b)=>b.value-a.value),statuses,warnings:unique(warnings)};
  }
  return {str,esc,bool,sku,images,html,unwrap,validateProduct,day,customerKey,analytics};
})();
export const sanitizeProductDescription = KlyvoDomain.html;
