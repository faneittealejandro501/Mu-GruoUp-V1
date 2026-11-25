// Wrap the random backup key separately so a second device can find it by login.
const utf8 = new TextEncoder();
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
const digest = async (value: string) => hex(await crypto.subtle.digest('SHA-256', utf8.encode(value)));
async function loginKeys(username: string, verifier: string) {
  const name = await digest('mu:user:v1:' + username.trim().toLowerCase());
  const material = await crypto.subtle.importKey('raw', utf8.encode(verifier), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2', salt:utf8.encode(name), iterations:600000, hash:'SHA-256'}, material, 512);
  const key = await crypto.subtle.importKey('raw', bits.slice(32), 'AES-GCM', false, ['encrypt','decrypt']);
  return {name, key, proof:hex(bits.slice(0,32))};
}
function route(endpoint: URL, name: string) {
  if (endpoint.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)) throw new Error('Se requiere HTTPS.');
  return new URL('./account-link/' + name, endpoint);
}
const options = (): RequestInit => ({cache:'no-store', redirect:'error', credentials:'omit', signal:AbortSignal.timeout(10000)});
export async function publishAccountLink(endpoint: URL, username: string, verifier: string, code: string, version: number) {
  const {name, key, proof} = await loginKeys(username, verifier);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, utf8.encode(code));
  const owner = await digest('mu:account-owner:v1:' + code);
  const res = await fetch(route(endpoint,name), {...options(), method:'PUT', headers:{Authorization:'Bearer ' + owner,'Content-Type':'application/json'},
    body:JSON.stringify({proof,iv:hex(iv.buffer),cipher:hex(cipher),version})});
  if (!res.ok) throw new Error(res.status === 409 ? 'El ID ya está vinculado a otra cuenta. Tu partida sigue en este dispositivo.' : 'No se pudo vincular la cuenta.');
}
export async function lookupAccountLink(endpoint: URL, username: string, verifier: string) {
  const {name, key, proof} = await loginKeys(username,verifier);
  const res = await fetch(route(endpoint,name), {...options(),headers:{Authorization:'Bearer ' + proof}});
  if (!res.ok) throw new Error([401,404].includes(res.status) ? 'ID o contraseña incorrectos.' : 'Servidor de cuentas no disponible.');
  const {iv,cipher} = await res.json();
  const bytes = (value:string) => Uint8Array.from(value.match(/../g)!, v => parseInt(v,16));
  return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv)},key,bytes(cipher)));
}

export async function loginNameTaken(endpoint: URL, username: string) {
  const name = await digest('mu:user:v1:' + username.trim().toLowerCase());
  const res = await fetch(route(endpoint,name), {...options(),method:'HEAD'});
  // A static SPA host may reply to unknown paths with its HTML entry page.
  return res.status === 200 && !res.headers.get('content-type')?.includes('text/html');
}
