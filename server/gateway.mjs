import '../public/protocol.js';
export async function parseGatewayResponse(response, action) {
  if (!response.ok) throw Error(`Apps Script HTTP ${response.status}. Vérifiez GAS_URL (/exec), le déploiement actif et les droits d’accès. Aucun nouvel identifiant de sauvegarde ne doit être créé avant vérification du résultat.`);
  let result;
  try { result=await response.json(); } catch { throw Error('Apps Script renvoie une page au lieu de JSON. Vérifiez le déploiement Web App et ses autorisations.'); }
  if (!result || typeof result.success!=='boolean') throw Error('Réponse Apps Script incompatible : success manquant.');
  if (result.success) {
    if (action==='snapshot') result.data=globalThis.KlyvoProtocol.snapshot(result.data);
    else if (!result.data || typeof result.data.id!=='string' || typeof result.data.message!=='string') throw Error('Réponse de sauvegarde incompatible. Vérifiez le journal avant de recommencer.');
  }
  return result;
}
