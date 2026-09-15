import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {parseIntegrationKey,encryptIntegrationSecret,decryptIntegrationSecret,integrationEncryptionConfigured} from '../lib/integration-crypto.js';

const key=crypto.randomBytes(32).toString('base64url');
const otherKey=crypto.randomBytes(32).toString('base64url');

test('integration key accepts a 32-byte base64url key and a 64-char hex key',()=>{
  assert.equal(parseIntegrationKey(key).length,32);
  assert.equal(parseIntegrationKey(crypto.randomBytes(32).toString('hex')).length,32);
  assert.equal(integrationEncryptionConfigured({INTEGRATION_TOKEN_ENCRYPTION_KEY:key}),true);
});

test('integration key rejects missing or malformed material',()=>{
  assert.throws(()=>parseIntegrationKey(''),/not configured/i);
  assert.throws(()=>parseIntegrationKey('too-short'),/32 bytes/i);
  assert.equal(integrationEncryptionConfigured({INTEGRATION_TOKEN_ENCRYPTION_KEY:'bad'}),false);
});

test('provider secrets encrypt with authenticated encryption and round-trip',()=>{
  const secret='shpat_example-sensitive-token';
  const encrypted=encryptIntegrationSecret(secret,key);
  assert.ok(encrypted.startsWith('v1.'));
  assert.equal(encrypted.includes(secret),false);
  assert.equal(decryptIntegrationSecret(encrypted,key),secret);
  assert.notEqual(encryptIntegrationSecret(secret,key),encrypted,'random IV should prevent deterministic ciphertext');
});

test('wrong key and tampered ciphertext fail closed',()=>{
  const encrypted=encryptIntegrationSecret('refresh-token',key);
  assert.throws(()=>decryptIntegrationSecret(encrypted,otherKey));
  const parts=encrypted.split('.');
  parts[3]=parts[3].slice(0,-1)+(parts[3].endsWith('A')?'B':'A');
  assert.throws(()=>decryptIntegrationSecret(parts.join('.'),key));
});

test('empty optional provider secrets stay null',()=>{
  assert.equal(encryptIntegrationSecret('',key),null);
  assert.equal(decryptIntegrationSecret(null,key),null);
});
