import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupCountry, resolveHost } from '../geo.mjs';

test('offline lookup matches the bundled September 2026 ranges for IPv4, IPv6 and mapped IPv4', () => {
  assert.equal(lookupCountry('8.8.8.8'),'US');
  assert.equal(lookupCountry('223.5.5.5'),'CN');
  assert.equal(lookupCountry('2001:4860:4860::8888'),'CA');
  assert.equal(lookupCountry('::ffff:8.8.8.8'),'US');
});

test('private, Fake-IP, documentation and malformed addresses stay unlocated', () => {
  for(const ip of ['127.0.0.1','10.0.0.1','192.168.3.129','100.64.0.1','198.18.0.43','198.19.255.255','::ffff:0:c612:2b','::ffff:198.18.0.43','::1','fe80::1','fc00::1','2001:db8::1','192.0.2.1','invalid','8.8.8.999']) assert.equal(lookupCountry(ip),null,ip);
});

test('resolveHost resolves target IPs, known brands, and country TLDs', async () => {
  assert.equal(await resolveHost('149.154.175.57'), 'GB');
  assert.equal(await resolveHost('160.47.1.129'), 'DE');
  assert.equal(await resolveHost('mtalk.google.com'), 'US');
  assert.equal(await resolveHost('github.com'), 'US');
  assert.equal(await resolveHost('t.me'), 'GB');
  assert.equal(await resolveHost('bilibili.com'), 'CN');
  assert.equal(await resolveHost('yahoo.co.jp'), 'JP');
  assert.equal(await resolveHost('bbc.co.uk'), 'GB');
  assert.equal(await resolveHost('invalid-test-domain-not-exist.xyz'), null);
});

