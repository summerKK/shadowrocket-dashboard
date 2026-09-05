import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { isIP } from 'node:net';

const tables = await Promise.all([4, 6].map(async family =>
  gunzipSync(await readFile(new URL(`./data/country-v${family}.bin.gz`, import.meta.url)))));

function addressBytes(ip) {
  const family = isIP(ip);
  if (family === 4) return Buffer.from(ip.split('.').map(Number));
  if (family !== 6 || ip.includes('%')) return null;
  let normalized = ip;
  if (ip.includes('.')) {
    const lastColon = ip.lastIndexOf(':');
    const octets = ip.slice(lastColon + 1).split('.').map(Number);
    normalized = ip.slice(0, lastColon + 1) + ((octets[0] << 8) | octets[1]).toString(16) + ':' + ((octets[2] << 8) | octets[3]).toString(16);
  }
  const halves = normalized.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const parts = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  const bytes = Buffer.alloc(16);
  parts.forEach((part, i) => bytes.writeUInt16BE(parseInt(part, 16), i * 2));
  // IPv4-mapped addresses must use IPv4 classification, including private ranges.
  if (bytes.subarray(0, 10).every(x => x === 0) && bytes[10] === 255 && bytes[11] === 255) return bytes.subarray(12);
  return bytes;
}

export function lookupCountry(ip) {
  const address = addressBytes(ip);
  if (!address) return null;
  const width = address.length;
  if (width === 4) {
    const [a, b, c] = address;
    if (a === 0 || a === 10 || a === 127 || a >= 224 ||
        (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) ||
        (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113)) return null;
  } else {
    // Restrict to global unicast and exclude documentation allocations.
    if ((address[0] & 0xe0) !== 0x20 ||
        (address[0] === 0x20 && address[1] === 1 && address[2] === 0x0d && address[3] === 0xb8) ||
        (address[0] === 0x3f && (address[1] & 0xf0) === 0xf0)) return null;
  }
  const data = tables[width === 4 ? 0 : 1];
  const stride = width * 2 + 2;
  let low = 0, high = data.length / stride - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2), offset = mid * stride;
    if (Buffer.compare(address, data.subarray(offset, offset + width)) < 0) high = mid - 1;
    else if (Buffer.compare(address, data.subarray(offset + width, offset + width * 2)) > 0) low = mid + 1;
    else return data.toString('ascii', offset + width * 2, offset + stride);
  }
  return null;
}

const domainCache = new Map();

const KNOWN_DOMAINS = [
  [/(\.|\/|^)(google|youtube|googlevideo|gstatic|gmail|openai|chatgpt|github|githubusercontent|githubassets|apple|icloud|aaplimg|microsoft|live|office|azure|twitter|x|twimg|cloudflare|facebook|instagram|whatsapp|netflix|amazon|amazonaws|wikipedia)\.(com|org|net)$/i, 'US'],
  [/(\.|\/|^)(telegram|t)\.(org|me)$/i, 'GB'],
  [/(\.|\/|^)(baidu|qq|bilibili|taobao|alipay|jd|weibo|zhihu|163|bytedance|douyin|feishu)\.(com|cn)$/i, 'CN'],
  [/\.cn$/i, 'CN'],
  [/\.(jp|co\.jp)$/i, 'JP'],
  [/\.(uk|co\.uk)$/i, 'GB'],
  [/\.de$/i, 'DE'],
  [/\.fr$/i, 'FR'],
  [/\.sg$/i, 'SG'],
  [/\.hk$/i, 'HK'],
  [/\.tw$/i, 'TW'],
  [/\.kr$/i, 'KR'],
  [/\.nl$/i, 'NL'],
  [/\.ru$/i, 'RU'],
  [/\.ca$/i, 'CA'],
  [/\.au$/i, 'AU']
];

export async function resolveHost(target) {
  if (!target || typeof target !== 'string') return null;
  const clean = target.replace(/^\[|\]$/g, '').split(':')[0].trim().toLowerCase();
  if (!clean || clean === '<null>' || clean === 'localhost') return null;

  if (isIP(clean)) {
    return lookupCountry(clean);
  }

  if (domainCache.has(clean)) {
    return domainCache.get(clean);
  }

  for (const [pattern, code] of KNOWN_DOMAINS) {
    if (pattern.test(clean)) {
      domainCache.set(clean, code);
      return code;
    }
  }

  try {
    const res = await fetch(`https://223.5.5.5/resolve?name=${encodeURIComponent(clean)}&type=A`, {
      signal: AbortSignal.timeout(1200)
    });
    if (res.ok) {
      const data = await res.json();
      const ip = data.Answer?.find(a => a.type === 1 && a.data)?.data;
      if (ip && isIP(ip)) {
        const country = lookupCountry(ip);
        if (country) {
          domainCache.set(clean, country);
          return country;
        }
      }
    }
  } catch {}

  domainCache.set(clean, null);
  return null;
}
