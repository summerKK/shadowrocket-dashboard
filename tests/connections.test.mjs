import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/connection-log.js';
const apply = globalThis.ConnectionLog.apply;
const time = '12:00:00.000';

test('keeps target hostname separate from the proxy endpoint and protocol', () => {
  const records = new Map();
  apply(records, 'proxy stream <1> proxy lookup host => example.com:443 server => Socks5 policy => My Policy group => My Group', time);
  apply(records, 'proxy stream <1> lookup host => 8.8.8.8:443 domain => <null> host => example.com ip => <null>', time);
  const row = apply(records, 'proxy stream <1> connect stream host => 8.8.8.8 port => 443', time);
  assert.equal(row.host, 'example.com');
  assert.equal(row.remoteIP, '8.8.8.8');
  assert.equal(row.server, 'Socks5');
  assert.equal(row.policy, 'My Policy');
  assert.equal(row.group, 'My Group');
});

test('DNS, UUID backend and QUIC stream IDs cannot create connection records', () => {
  const records = new Map();
  for (const line of ['dns response record => {\nresult = 8.8.8.8\n}', 'backend chain <UUID> proxy start => A <--> B', 'dns over quic https://dns.example/dns-query#h3 flush stream <4> bytes <97>']) {
    assert.equal(apply(records,line,time),null);
  }
  assert.equal(records.size,0);
});

test('disconnect duration cannot overwrite handshake cost', () => {
  const records = new Map();
  apply(records,'proxy stream <1> did connect to host => example.com:443 > 8.8.8.8:443 fastopen => 0 cost => 42.6 ms',time);
  const row = apply(records,'proxy stream <1> disconnect example.com:443 error => Socket closed by remote peer reason => none cost => 39780.5 ms',time);
  assert.equal(row.cost,43);
  assert.equal(row.closed,true);
  assert.equal(row.connected,true);
});

test('direct IPv6 endpoint, route and rule node are extracted independently', () => {
  const records = new Map();
  apply(records,'tcp stream <2> tcp rule => {\nresult = MATCH,DIRECT,\nurl = example.com:443,\ntype = DIRECT,\nua = TCP Stream\n}',time);
  const row = apply(records,'tcp stream <2> connect to host => example.com:443 > [2001:4860:4860::8888]:443, fastopen => 0, cost => 10 ms',time);
  assert.equal(row.host,'example.com');
  assert.equal(row.remoteIP,'2001:4860:4860::8888');
  assert.equal(row.route,'DIRECT');
  assert.equal(row.node,undefined);
});

test('a failed attempt is closed but not marked as a successful endpoint', () => {
  const records = new Map();
  apply(records,'tcp stream <3> start host => example.com port => 443 total => 1',time);
  const row = apply(records,'tcp stream <3> disconnect example.com:443 error => Attempt to connect to host timed out reason => none cost => 5000 ms',time);
  assert.equal(row.closed,true);
  assert.equal(row.connected,undefined);
  assert.equal(row.cost,undefined);
});

test('IPv6 start and removal events have a separate port field', () => {
  const records = new Map();
  const row = apply(records,'tcp stream <5> start host => 2001:4860:4860::8888 port => 443 total => 1',time);
  assert.equal(row.host,'2001:4860:4860::8888');
  assert.equal(row.port,443);
  const partial = apply(records,'tcp stream <6> remove host => 2001:4860:4860::8888 port => 443 total => 0',time);
  assert.equal(partial.host,'2001:4860:4860::8888');
  assert.equal(partial.route,undefined);
});

test('reused stream IDs start a fresh record and raw logs remain bounded', () => {
  const records = new Map();
  apply(records,'proxy stream <4> remove host => old.example port => 443',time);
  const row = apply(records,'proxy stream <4> loopback => 1 total => 1',time);
  assert.equal(row.closed,false);
  assert.equal(row.host,undefined);
  for(let i=0;i<30;i++) apply(records,'proxy stream <4> loopback => 1 total => 1',time);
  assert.equal(records.get('4').rawLogs.length,20);
});
