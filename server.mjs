import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8787);
let upstreamUrl = process.env.SHADOWROCKET_LOG_URL || 'http://127.0.0.1:1080/api/log';
const clients = new Set();
let upstream;
let reconnectTimer;
let currentAbortController;
let pendingRule;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function send(client, event) {
  try {
    client.write(`data: ${JSON.stringify(event)}\n\n`);
  } catch {
    clients.delete(client);
  }
}

function broadcast(event) {
  for (const client of clients) send(client, event);
}

function flushPendingRule() {
  if (!pendingRule) return;
  broadcast({ timestamp: pendingRule.timestamp, message: pendingRule.lines.join('\n') });
  pendingRule = undefined;
}

function emitLine(line) {
  const match = line.match(/^\[([^\]]+)\]\s+(.+)$/);
  if (!match) {
    if (pendingRule) {
      pendingRule.lines.push(line);
      if (line.trim() === '}') flushPendingRule();
    }
    return;
  }
  if (pendingRule) flushPendingRule();
  if (match[2].includes('rule => {') || match[2].endsWith('{')) {
    pendingRule = { timestamp: match[1], lines: [match[2]] };
    return;
  }
  broadcast({ timestamp: match[1], message: match[2] });
}

async function connectUpstream() {
  clearTimeout(reconnectTimer);
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = undefined;
  }

  const controller = new AbortController();
  currentAbortController = controller;

  try {
    upstream = await fetch(upstreamUrl, { signal: controller.signal });
    if (!upstream.ok || !upstream.body) throw new Error(`Shadowrocket 返回异常状态码: ${upstream.status}`);
    broadcast({ type: 'status', connected: true, upstreamUrl });
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value || new Uint8Array(), { stream: true });
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() || '';
      for (const line of lines) emitLine(line);
    }
  } catch (error) {
    if (controller.signal.aborted) return;
    broadcast({ type: 'status', connected: false, error: error.message, upstreamUrl });
  } finally {
    if (currentAbortController === controller) {
      upstream = undefined;
      currentAbortController = undefined;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connectUpstream, 1000);
    }
  }
}

async function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let data = '';
    request.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        request.destroy();
        reject(new Error('Payload too large'));
      }
    });
    request.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    request.on('error', reject);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (url.pathname === '/events') {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    response.write(': connected\n\n');
    clients.add(response);
    send(response, {
      type: 'status',
      connected: Boolean(upstream),
      upstreamUrl,
    });
    request.on('close', () => clients.delete(response));
    return;
  }

  // API to test connectivity with Shadowrocket
  if (url.pathname === '/api/test' && request.method === 'POST') {
    try {
      const body = await readJsonBody(request);
      const testUrl = String(body.url || upstreamUrl).trim();
      if (!testUrl || (!testUrl.startsWith('http://') && !testUrl.startsWith('https://'))) {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ ok: false, error: '无效的 API 地址，必须以 http:// 或 https:// 开头' }));
        return;
      }

      const testController = new AbortController();
      const testTimeout = setTimeout(() => testController.abort(), 2500);
      const startTime = Date.now();

      try {
        const testRes = await fetch(testUrl, { signal: testController.signal });
        clearTimeout(testTimeout);
        const cost = Date.now() - startTime;
        if (testRes.ok || testRes.status === 200) {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ ok: true, status: testRes.status, cost, url: testUrl }));
        } else {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ ok: false, status: testRes.status, error: `Shadowrocket 响应异常状态码: HTTP ${testRes.status}` }));
        }
      } catch (fetchErr) {
        clearTimeout(testTimeout);
        const isTimeout = fetchErr.name === 'AbortError';
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          ok: false,
          error: isTimeout ? '连接超时 (2.5s)，请确认 Shadowrocket 是否已开启「启用日志记录」与「允许访问」' : `无法连接至 ${testUrl} (${fetchErr.message})`
        }));
      }
    } catch (err) {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // API to get / update configuration
  if (url.pathname === '/api/config') {
    if (request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ upstreamUrl, upstreamConnected: Boolean(upstream) }));
      return;
    }

    if (request.method === 'POST') {
      try {
        const body = await readJsonBody(request);
        const nextUrl = String(body.upstreamUrl || '').trim();
        if (!nextUrl || (!nextUrl.startsWith('http://') && !nextUrl.startsWith('https://'))) {
          response.writeHead(400, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ error: '无效的 API 地址，必须以 http:// 或 https:// 开头' }));
          return;
        }

        upstreamUrl = nextUrl;
        console.log(`\x1b[35m🔄 Shadowrocket upstream API updated to:\x1b[0m \x1b[33m${upstreamUrl}\x1b[0m`);
        broadcast({ type: 'status', connected: false, error: '正在重连新端点…', upstreamUrl });
        connectUpstream();

        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: true, upstreamUrl }));
      } catch (err) {
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: err.message || '请求处理失败' }));
      }
      return;
    }
  }

  if (url.pathname === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ upstreamUrl, upstreamConnected: Boolean(upstream) }));
    return;
  }

  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.join(root, 'public', path.normalize(requested).replace(/^\.\.(?:[\\/]|$)/, ''));
  const ext = path.extname(file).toLowerCase();

  try {
    const body = await readFile(file);
    const contentType = MIME_TYPES[ext] || 'text/plain; charset=utf-8';
    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`\x1b[36m🚀 Shadowrocket Dashboard running at:\x1b[0m \x1b[1;32mhttp://127.0.0.1:${port}\x1b[0m`);
  console.log(`\x1b[34m📡 Upstream diagnostic endpoint:\x1b[0m \x1b[33m${upstreamUrl}\x1b[0m\n`);
  connectUpstream();
});

function handleExit() {
  clearTimeout(reconnectTimer);
  if (currentAbortController) currentAbortController.abort();
  server.close(() => process.exit(0));
}
process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);

