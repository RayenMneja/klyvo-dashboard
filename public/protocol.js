/* Validate the admin contract before any data reaches the editor. */
var KlyvoProtocol = (() => {
  function snapshot(data) {
    const fail = field => { throw Error('Réponse snapshot administration incompatible ('+field+'). Vérifiez GAS_URL, le routage adminGateway dans doPost et la version publiée de Admin.gs.'); };
    if (!data || typeof data !== 'object') fail('data');
    for (const key of ['products','orders','items']) if (!Array.isArray(data[key]) || data[key].some(x=>!x || typeof x!=='object' || Array.isArray(x))) fail(key);
    if (typeof data.revision !== 'string' || !data.revision || typeof data.readOnly !== 'boolean') fail('revision/readOnly');
    if (!Number.isFinite(Date.parse(data.updatedAt))) fail('updatedAt');
    for (const key of ['scriptTimezone','sheetTimezone']) if (typeof data[key]!=='string') fail(key);
    for (const p of data.products) {
      if (typeof p.id!=='string' || !Array.isArray(p.variants) || !Array.isArray(p.images) || !Array.isArray(p.colors) || !Array.isArray(p.sizes)) fail('produit');
      if (p.variants.some(v=>!v || typeof v!=='object' || typeof v.color!=='string' || typeof v.size!=='string')) fail('variantes');
    }
    for (const key of ['warnings','writeBlockReasons']) if (data[key]!=null && (!Array.isArray(data[key]) || data[key].some(x=>typeof x!=='string'))) fail(key);
    return {...data,warnings:data.warnings??[],writeBlockReasons:data.writeBlockReasons??(data.readOnly?['Lecture seule : consultez les formules et le journal dans Apps Script.']:[])};
  }
  return {snapshot};
})();
if (typeof globalThis!=='undefined') globalThis.KlyvoProtocol=KlyvoProtocol;
