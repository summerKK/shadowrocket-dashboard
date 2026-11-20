import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startServer, stopServer } from '../server.mjs';

let port;
let originalUpstreamUrl;

async function getConfig() {
  const response = await fetch(`http://127.0.0.1:${port}/api/config`);
  return response.json();
}

function requestWithHeaders(path, headers) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      headers,
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    request.on('error', reject);
    request.end();
  });
}

before(async () => {
  ({ port } = await startServer(0));
  originalUpstreamUrl = (await getConfig()).upstreamUrl;
});

after(async () => {
  await stopServer();
});

test('GET /health works without an Origin header', async () => {
  const response = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(response.status, 200);
});

test('cross-origin EventSource requests are rejected without CORS access', async () => {
  const response = await fetch(`http://127.0.0.1:${port}/events`, {
    headers: { Origin: 'https://evil.example' },
  });
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('same-origin EventSource requests stream events', async () => {
  const response = await fetch(`http://127.0.0.1:${port}/events`, {
    headers: { Origin: `http://127.0.0.1:${port}` },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/event-stream/);
  await response.body.cancel();
});

test('requests with an untrusted Host header are rejected', async () => {
  const response = await requestWithHeaders('/health', { Host: `attacker.example:${port}` });
  assert.equal(response.status, 403);
});

test('cross-origin JSON configuration changes are rejected', async () => {
  const before = await getConfig();
  const response = await fetch(`http://127.0.0.1:${port}/api/config`, {
    method: 'POST',
    headers: {
      Origin: 'https://evil.example',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ upstreamUrl: 'http://127.0.0.1:16666/api/log' }),
  });
  assert.equal(response.status, 403);
  assert.equal((await getConfig()).upstreamUrl, before.upstreamUrl);
});

test('API POST requests require an application/json content type', async () => {
  const before = await getConfig();
  const response = await fetch(`http://127.0.0.1:${port}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ upstreamUrl: 'http://127.0.0.1:16666/api/log' }),
  });
  assert.equal(response.status, 415);
  assert.equal((await getConfig()).upstreamUrl, before.upstreamUrl);
});

test('same-origin JSON configuration changes are accepted and restored', async () => {
  const changedUrl = 'http://127.0.0.1:65534/api/log';
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/config`, {
      method: 'POST',
      headers: {
        Origin: `http://127.0.0.1:${port}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ upstreamUrl: changedUrl }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).upstreamUrl, changedUrl);
  } finally {
    await fetch(`http://127.0.0.1:${port}/api/config`, {
      method: 'POST',
      headers: {
        Origin: `http://127.0.0.1:${port}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ upstreamUrl: originalUpstreamUrl }),
    });
  }
});

test('cross-site Fetch Metadata is rejected without an Origin header', async () => {
  const response = await fetch(`http://127.0.0.1:${port}/api/config`, {
    headers: { 'Sec-Fetch-Site': 'cross-site' },
  });
  assert.equal(response.status, 403);
});
