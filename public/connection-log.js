/* Shared by the connection table and map; diagnostic events are not connections. */
(() => {
  function endpoint(value) {
    const match = value.match(/^\[([^\]]+)\]:(\d+)$/) || value.match(/^(.+):(\d+)$/);
    return match ? { host: match[1], port: Number(match[2]) } : { host: value };
  }
  function apply(connections, message, timestamp) {
    const stream = message.match(/^(proxy|tcp|udp) stream <(\d+)>/);
    if (!stream) return null;
    const id = stream[2];
    let item = connections.get(id);
    if (!item || (item.closed && /(?:start host|loopback) =>/.test(message))) {
      item = { id, firstSeen: timestamp, rawLogs: [], closed: false };
    }
    item.timestamp = timestamp;
    item.lastSeen = Date.now();
    item.rawLogs.push(`[${timestamp}] ${message}`);
    if (item.rawLogs.length > 20) item.rawLogs.shift();
    const request = message.match(/\b(?:rule url|proxy lookup host|tcp direct) => ([^\s,]+)/);
    const start = message.match(/start host => (\S+) port => (\d+)/);
    if (start) { item.host = start[1].replace(/^\[|\]$/g, ''); item.port = Number(start[2]); }
    const url = message.match(/(?:^|\n)\s*url = ([^\n]+)/);
    if (url) {
      item.url = url[1].replace(/,\s*$/, '').trim();
      if (/^https?:\/\//.test(item.url)) {
        try { const parsed = new URL(item.url); item.host = parsed.hostname; item.port = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80)); } catch {}
      } else Object.assign(item, endpoint(item.url));
    } else if (request) Object.assign(item, endpoint(request[1]));
    const host = message.match(/\bdomain => ([^\s]+) host => ([^\s]+)/);
    if (!item.host && host) item.host = [host[1], host[2]].find(x => x !== '<null>');
    const port = message.match(/\bport => (\d+)/);
    if (port && !item.port) item.port = Number(port[1]);
    const rule = message.match(/(?:^|\n)\s*result = ([^\n]+)/);
    if (rule) {
      const parts = rule[1].replace(/,\s*$/, '').split(/\s+#\s*/);
      item.rule = parts[0].trim();
      if (parts[1]) item.node = parts[1].trim();
    }
    const route = message.match(/\btype = (PROXY|DIRECT|REJECT)/);
    if (route) item.route = route[1];
    if (message.includes('tcp direct =>')) item.route = 'DIRECT';
    const policy = message.match(/server => (.*?) policy => (.*?) group => (.*)$/);
    if (policy) [item.server, item.policy, item.group] = policy.slice(1).map(x => x.trim());
    const remote = message.match(/connect stream host => (\S+) port => (\d+)/) || message.match(/connect to host => .*? > (\S+):(\d+)/);
    if (remote) { item.remoteIP = remote[1].replace(/^\[|\]$/g, ''); item.remotePort = Number(remote[2]); }
    const connected = /(?:did connect to host|connect to host) =>/.test(message);
    if (!item.host) {
      const target = message.match(/connect to host => (\S+) >/);
      if (target) Object.assign(item, endpoint(target[1]));
      const removed = message.match(/remove host => (\S+) port => (\d+)/);
      if (removed) { item.host = removed[1].replace(/^\[|\]$/g, ''); item.port = Number(removed[2]); }
    }
    const cost = message.match(/cost => ([\d.]+) ms/);
    if (connected) { item.connected = true; if (cost) item.cost = Math.round(Number(cost[1])); }
    const error = message.match(/error => (.*?) reason => (.*?)(?: cost =>|$)/);
    if (error) item.error = error[1];
    if (/\b(?:disconnect|remove host|closed)\b/.test(message)) item.closed = true;
    const ua = message.match(/(?:^|\n)\s*ua = (.+)/);
    if (ua) item.ua = ua[1].trim();
    item.proto = stream[1] === 'udp' ? 'UDP' : item.url?.startsWith('https://') ? 'HTTPS' : item.url?.startsWith('http://') ? 'HTTP' : 'TCP';
    connections.set(id, item);
    return item;
  }
  globalThis.ConnectionLog = { apply };
})();
