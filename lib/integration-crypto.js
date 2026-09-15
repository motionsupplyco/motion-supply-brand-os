import crypto from 'node:crypto';

const VERSION='v1';

export function parseIntegrationKey(value=process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY){
  const raw=String(value||'').trim();
  if(!raw)throw new Error('Integration token encryption key is not configured.');
  let key;
  if(/^[0-9a-f]{64}$/i.test(raw))key=Buffer.from(raw,'hex');
  else{
    try{key=Buffer.from(raw.replace(/-/g,'+').replace(/_/g,'/'),'base64')}catch{key=null}
  }
  if(!key||key.length!==32)throw new Error('Integration token encryption key must decode to exactly 32 bytes.');
  return key;
}

export function encryptIntegrationSecret(value,keyValue=process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY){
  if(value===null||value===undefined||value==='')return null;
  const key=parseIntegrationKey(keyValue);
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from('motion-supply-brand-os:integration-token:v1','utf8'));
  const ciphertext=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
  const tag=cipher.getAuthTag();
  return [VERSION,iv.toString('base64url'),tag.toString('base64url'),ciphertext.toString('base64url')].join('.');
}

export function decryptIntegrationSecret(payload,keyValue=process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY){
  if(payload===null||payload===undefined||payload==='')return null;
  const parts=String(payload).split('.');
  if(parts.length!==4||parts[0]!==VERSION)throw new Error('Unsupported encrypted integration token format.');
  const key=parseIntegrationKey(keyValue);
  const iv=Buffer.from(parts[1],'base64url');
  const tag=Buffer.from(parts[2],'base64url');
  const ciphertext=Buffer.from(parts[3],'base64url');
  if(iv.length!==12||tag.length!==16)throw new Error('Invalid encrypted integration token payload.');
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);
  decipher.setAAD(Buffer.from('motion-supply-brand-os:integration-token:v1','utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString('utf8');
}

export function integrationEncryptionConfigured(env=process.env){
  try{return Boolean(parseIntegrationKey(env.INTEGRATION_TOKEN_ENCRYPTION_KEY))}catch{return false}
}
