(() => {
  const $ = id => document.getElementById(id);
  const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let world, loading, lookupBusy = false, geoError = '', selectedHub = '', selectedApp = '', searchQuery = '';
  let lastMaxCount = 1, lastTotalLocated = 1;
  const locations = new Map();
  let previousArcs = '', previousMarkers = '';
  let getState, openDetail, readFiltered;

  // 3D Polyglobe State & Memoization Signatures
  let globe = null;
  let countriesGeoJson = null;
  let globeInitialized = false;
  let hoveredCountry = null;
  let currentCountryTraffic = new Map();
  let currentMaxCountryCount = 1;
  let currentOriginCode = '';

  let lastArcsSig = '';
  let lastRingsSig = '';
  let lastHubsSig = '';
  let lastCountrySig = '';
  let hoverRafId = null;

  const has3DSupport = typeof Globe === 'function' && (() => {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch { return false; }
  })();

  let currentProjection = '3d';
  try {
    const savedProj = localStorage.getItem('map-projection-mode');
    if (savedProj === '2d' || savedProj === '3d') currentProjection = savedProj;
  } catch {}
  if (!has3DSupport) currentProjection = '2d';

  let autoRotateEnabled = true;
  try {
    const savedRotate = localStorage.getItem('map-auto-rotate');
    if (savedRotate !== null) autoRotateEnabled = savedRotate === 'true';
  } catch {}

  // Global Equirectangular Projection to SVG coordinates (2D mode)
  const point = loc => [(loc.lon + 180) * 3, (90 - loc.lat) * 3];

  // Little Snitch Color Scheme
  const color = (route, isActive = true) => {
    if (route === 'REJECT') return '#ef4444'; // Red for Blocked / Denied
    if (isActive) return '#10b981'; // Neon Emerald for Active Live Traffic
    if (route === 'DIRECT') return '#34d399'; // Mint for Direct
    return '#60a5fa'; // Electric Blue for Proxy
  };

  function normalizeCountry(code) {
    if (!code) return '';
    const upper = String(code).toUpperCase().trim();
    if (upper === 'TW' || upper === 'HK' || upper === 'MO') return 'CN';
    return upper;
  }

  function getFlag(code) {
    if (!code) return '🌐';
    const c = String(code).toUpperCase().trim();
    if (c === 'TW' || c === 'HK' || c === 'MO') return '🇨🇳';
    if (c.length !== 2) return '🌐';
    const base = 127397;
    return String.fromCodePoint(c.charCodeAt(0) + base, c.charCodeAt(1) + base);
  }

  // Major Tech Hubs & Internet Exchanges (Little Snitch City Precision)
  const TECH_HUBS = {
    'US_WEST': { id: 'US_WEST', name: '硅谷 · 加州', city: 'Silicon Valley / San Jose', flag: '🇺🇸', lon: -121.89, lat: 37.33, country: 'US' },
    'US_LA': { id: 'US_LA', name: '洛杉矶 · 加州', city: 'Los Angeles', flag: '🇺🇸', lon: -118.24, lat: 34.05, country: 'US' },
    'US_SF': { id: 'US_SF', name: '旧金山 · 加州', city: 'San Francisco', flag: '🇺🇸', lon: -122.41, lat: 37.77, country: 'US' },
    'US_SEA': { id: 'US_SEA', name: '西雅图 · 华盛顿州', city: 'Seattle', flag: '🇺🇸', lon: -122.33, lat: 47.60, country: 'US' },
    'US_NY': { id: 'US_NY', name: '纽约 · 美东', city: 'New York', flag: '🇺🇸', lon: -74.00, lat: 40.71, country: 'US' },
    'US_CHI': { id: 'US_CHI', name: '芝加哥 · 美中', city: 'Chicago', flag: '🇺🇸', lon: -87.62, lat: 41.88, country: 'US' },

    'CN_SH': { id: 'CN_SH', name: '上海', city: 'Shanghai', flag: '🇨🇳', lon: 121.47, lat: 31.23, country: 'CN' },
    'CN_BJ': { id: 'CN_BJ', name: '北京', city: 'Beijing', flag: '🇨🇳', lon: 116.40, lat: 39.90, country: 'CN' },
    'CN_SZ': { id: 'CN_SZ', name: '深圳 · 腾讯总部', city: 'Shenzhen', flag: '🇨🇳', lon: 114.05, lat: 22.54, country: 'CN' },
    'CN_HZ': { id: 'CN_HZ', name: '杭州 · 阿里总部', city: 'Hangzhou', flag: '🇨🇳', lon: 120.15, lat: 30.28, country: 'CN' },
    'CN_GZ': { id: 'CN_GZ', name: '广州', city: 'Guangzhou', flag: '🇨🇳', lon: 113.26, lat: 23.13, country: 'CN' },
    'HK': { id: 'HK', name: '中国香港', city: 'Hong Kong', flag: '🇨🇳', lon: 114.17, lat: 22.32, country: 'CN' },
    'TW': { id: 'TW', name: '中国台湾 · 台北', city: 'Taipei', flag: '🇨🇳', lon: 121.56, lat: 25.03, country: 'CN' },
    'JP_TYO': { id: 'JP_TYO', name: '东京 · 日本', city: 'Tokyo', flag: '🇯🇵', lon: 139.69, lat: 35.68, country: 'JP' },
    'SG': { id: 'SG', name: '新加坡', city: 'Singapore', flag: '🇸🇬', lon: 103.82, lat: 1.35, country: 'SG' },
    'KR_SEL': { id: 'KR_SEL', name: '首尔 · 韩国', city: 'Seoul', flag: '🇰🇷', lon: 126.97, lat: 37.56, country: 'KR' },

    'GB_LON': { id: 'GB_LON', name: '伦敦 · 英国', city: 'London', flag: '🇬🇧', lon: -0.12, lat: 51.50, country: 'GB' },
    'DE_FRA': { id: 'DE_FRA', name: '法兰克福 · 德国', city: 'Frankfurt', flag: '🇩🇪', lon: 8.68, lat: 50.11, country: 'DE' },
    'NL_AMS': { id: 'NL_AMS', name: '阿姆斯特丹 · 荷兰', city: 'Amsterdam', flag: '🇳🇱', lon: 4.90, lat: 52.37, country: 'NL' },
    'FR_PAR': { id: 'FR_PAR', name: '巴黎 · 法国', city: 'Paris', flag: '🇫🇷', lon: 2.35, lat: 48.85, country: 'FR' },

    'AU_SYD': { id: 'AU_SYD', name: '悉尼 · 澳大利亚', city: 'Sydney', flag: '🇦🇺', lon: 151.20, lat: -33.86, country: 'AU' },
    'CA_TOR': { id: 'CA_TOR', name: '多伦多 · 加拿大', city: 'Toronto', flag: '🇨🇦', lon: -79.38, lat: 43.65, country: 'CA' },
  };

  function resolveHub(item, role = 'target') {
    const host = (item.host || '').toLowerCase();
    const node = (item.node || '').toLowerCase();
    const remoteIP = (item.remoteIP || '');
    const ua = (item.ua || '').toLowerCase();

    // 1. Check Node keywords
    if (role === 'proxy' || role === 'relay') {
      if (node.includes('la') || node.includes('los angeles') || node.includes('dmit')) return TECH_HUBS['US_LA'];
      if (node.includes('sjc') || node.includes('san jose') || node.includes('silicon')) return TECH_HUBS['US_WEST'];
      if (node.includes('hk') || node.includes('hong')) return TECH_HUBS['HK'];
      if (node.includes('jp') || node.includes('tokyo') || node.includes('japan')) return TECH_HUBS['JP_TYO'];
      if (node.includes('sg') || node.includes('singapore')) return TECH_HUBS['SG'];
      if (node.includes('tw') || node.includes('taiwan') || node.includes('taipei')) return TECH_HUBS['TW'];
      if (node.includes('de') || node.includes('frankfurt') || node.includes('germany')) return TECH_HUBS['DE_FRA'];
      if (node.includes('uk') || node.includes('london') || node.includes('britain')) return TECH_HUBS['GB_LON'];
      if (node.includes('kr') || node.includes('seoul') || node.includes('korea')) return TECH_HUBS['KR_SEL'];
      if (node.includes('us') || node.includes('america')) return TECH_HUBS['US_WEST'];
    }

    // 2. Check Service / Domain / UA keywords
    if (host.includes('openai') || host.includes('chatgpt') || host.includes('oaistatic') || host.includes('oaiusercontent') || host.includes('anthropic') || host.includes('claude') || host.includes('cursor') || ua.includes('codex')) return TECH_HUBS['US_SF'];
    if (host.includes('gmail') || host.includes('google') || host.includes('youtube') || host.includes('googlevideo') || host.includes('1e100') || host.includes('gvt1') || host.includes('gvt2') || host.includes('gstatic')) return TECH_HUBS['US_WEST'];
    if (host.includes('apple') || host.includes('icloud') || host.includes('aaplimg') || host.includes('cdn-apple')) {
      const appleCode = locations.get(host) || locations.get(remoteIP);
      if (appleCode && TECH_HUBS[appleCode]) return TECH_HUBS[appleCode];
      return TECH_HUBS['US_WEST'];
    }
    if (host.includes('github') || host.includes('twitter') || host.includes('x.com') || host.includes('twimg') || host.includes('cloudflare') || host.includes('stripe')) return TECH_HUBS['US_SF'];
    if (host.includes('microsoft') || host.includes('azure') || host.includes('office') || host.includes('live.com') || host.includes('amazon') || host.includes('aws') || host.includes('cloudfront')) return TECH_HUBS['US_SEA'];
    if (host.includes('telegram') || host.includes('t.me') || host.includes('telesco.pe') || host.startsWith('149.154.') || host.startsWith('91.108.')) return TECH_HUBS['GB_LON'];
    if (host.includes('qq.com') || host.includes('weixin') || host.includes('wechat') || host.includes('tencent') || host.includes('qpic')) return TECH_HUBS['CN_SZ'];
    if (host.includes('taobao') || host.includes('alipay') || host.includes('aliyun') || host.includes('alibaba') || host.includes('tmall') || host.includes('163.com') || host.includes('netease')) return TECH_HUBS['CN_HZ'];
    if (host.includes('bilibili') || host.includes('hdslb') || host.includes('pinduoduo') || host.includes('yangkeduo')) return TECH_HUBS['CN_SH'];
    if (host.includes('baidu') || host.includes('bdimg') || host.includes('douyin') || host.includes('bytedance') || host.includes('tiktok') || host.includes('byteoversea') || host.includes('jd.com') || host.includes('360buy')) return TECH_HUBS['CN_BJ'];
    if (host.includes('netflix') || host.includes('nflxvideo') || host.includes('spotify')) return TECH_HUBS['US_WEST'];

    // 3. Check Country Code fallback
    const cCode = (role === 'proxy' ? locations.get(remoteIP) : (locations.get(host) || locations.get(remoteIP)));
    if (cCode === 'US') return TECH_HUBS['US_WEST'];
    if (cCode === 'CN') return TECH_HUBS['CN_SH'];
    if (cCode === 'GB') return TECH_HUBS['GB_LON'];
    if (cCode === 'DE') return TECH_HUBS['DE_FRA'];
    if (cCode === 'JP') return TECH_HUBS['JP_TYO'];
    if (cCode === 'SG') return TECH_HUBS['SG'];
    if (cCode === 'HK') return TECH_HUBS['HK'];
    if (cCode === 'TW') return TECH_HUBS['TW'];
    if (cCode === 'KR') return TECH_HUBS['KR_SEL'];
    if (cCode === 'NL') return TECH_HUBS['NL_AMS'];
    if (cCode === 'FR') return TECH_HUBS['FR_PAR'];
    if (cCode === 'AU') return TECH_HUBS['AU_SYD'];
    if (cCode === 'CA') return TECH_HUBS['CA_TOR'];

    if (cCode && world?.countries?.[cCode]) {
      const c = world.countries[cCode];
      return { id: cCode, name: c.name, city: c.name, flag: getFlag(cCode), lon: c.lon, lat: c.lat, country: cCode };
    }
    return null;
  }

  function getAppCategory(item) {
    const host = (item.host || '').toLowerCase();
    const ua = (item.ua || '').toLowerCase();
    const port = item.port;

    if (host.includes('openai') || host.includes('chatgpt') || host.includes('anthropic') || host.includes('claude') || host.includes('oaistatic') || host.includes('cursor') || ua.includes('codex') || ua.includes('chatgpt')) {
      return { name: 'AI 助手 (Codex / ChatGPT / Claude)', icon: '🤖', key: 'ai' };
    }
    if (host.includes('telegram') || host.includes('t.me') || host.includes('telesco.pe') || host.startsWith('149.154.') || host.startsWith('91.108.')) {
      return { name: 'Telegram', icon: '✈️', key: 'telegram' };
    }
    if (host.includes('gmail') || host.includes('imap') || host.includes('smtp') || host.includes('outlook') || port === 993 || port === 465 || port === 587 || ua.includes('mail')) {
      return { name: '邮件服务 (Mail)', icon: '✉️', key: 'mail' };
    }
    if (host.includes('qq.com') || host.includes('weixin') || host.includes('wechat') || host.includes('tencent') || host.includes('qpic')) {
      return { name: '腾讯 / 微信 / QQ', icon: '🐧', key: 'tencent' };
    }
    if (host.includes('google') || host.includes('youtube') || host.includes('googlevideo') || host.includes('1e100') || host.includes('gvt1') || host.includes('gvt2')) {
      return { name: 'Google / YouTube', icon: '▶️', key: 'google' };
    }
    if (host.includes('apple') || host.includes('icloud') || host.includes('aaplimg') || ua.includes('darwin')) {
      return { name: 'Apple 系统服务', icon: '🍎', key: 'apple' };
    }
    if (host.includes('github') || host.includes('gitlab') || ua.includes('git') || ua.includes('vscode')) {
      return { name: 'GitHub / 开发工具', icon: '🐙', key: 'github' };
    }
    if (host.includes('twitter') || host.includes('x.com') || host.includes('twimg')) {
      return { name: 'X / Twitter', icon: '🐦', key: 'twitter' };
    }
    if (host.includes('netflix') || host.includes('nflxvideo') || host.includes('spotify') || host.includes('disney')) {
      return { name: '流媒体 (Netflix / Spotify)', icon: '🍿', key: 'streaming' };
    }
    if (host.includes('bilibili') || host.includes('hdslb')) {
      return { name: '哔哩哔哩 (Bilibili)', icon: '📺', key: 'bilibili' };
    }
    if (host.includes('baidu') || host.includes('bdimg')) {
      return { name: '百度 (Baidu)', icon: '🔍', key: 'baidu' };
    }
    if (host.includes('taobao') || host.includes('alipay') || host.includes('aliyun') || host.includes('alibaba') || host.includes('tmall')) {
      return { name: '阿里巴巴 / 淘宝', icon: '🛍️', key: 'alibaba' };
    }
    if (host.includes('douyin') || host.includes('bytedance') || host.includes('tiktok') || host.includes('byteoversea')) {
      return { name: '字节跳动 / 抖音 / TikTok', icon: '🎵', key: 'bytedance' };
    }
    return { name: 'Web 与其他服务', icon: '🌐', key: 'web' };
  }

  // Pan & Zoom State (2D Flat Canvas)
  let viewBox = { x: 0, y: 0, w: 1080, h: 540 };
  let isDragging = false, dragStart = { x: 0, y: 0 }, startViewBox = { x: 0, y: 0 };

  function updateViewBox() {
    const svg = $('map-svg');
    if (svg) svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
  }

  function zoomMap(factor, focalX = 540, focalY = 270) {
    const newW = Math.max(160, Math.min(1080, viewBox.w * factor));
    const newH = Math.max(80, Math.min(540, viewBox.h * factor));
    const ratio = newW / viewBox.w;
    viewBox.x = focalX - (focalX - viewBox.x) * ratio;
    viewBox.y = focalY - (focalY - viewBox.y) * ratio;
    viewBox.w = newW;
    viewBox.h = newH;
    viewBox.x = Math.max(-100, Math.min(1080 - viewBox.w + 100, viewBox.x));
    viewBox.y = Math.max(-50, Math.min(540 - viewBox.h + 50, viewBox.y));
    updateViewBox();
  }

  function resetZoom() {
    viewBox = { x: 0, y: 0, w: 1080, h: 540 };
    updateViewBox();
  }

  // 3D Globe Zoom & Camera Control
  function zoomGlobe(factor) {
    if (!globe) return;
    const pov = globe.pointOfView();
    const targetAltitude = Math.max(0.35, Math.min(4.5, pov.altitude * factor));
    globe.pointOfView({ altitude: targetAltitude }, 250);
  }

  const CN_CITY_COORDS = {
    '深圳': [114.05, 22.54],
    '广州': [113.26, 23.13],
    '北京': [116.40, 39.90],
    '上海': [121.47, 31.23],
    '杭州': [120.15, 30.28],
    '香港': [114.17, 22.32],
    '台北': [121.56, 25.03],
    '成都': [104.06, 30.57],
    '武汉': [114.30, 30.59],
    '重庆': [106.55, 29.56],
    '南京': [118.79, 32.06],
    '西安': [108.93, 34.34],
    '天津': [117.20, 39.13],
    '苏州': [120.58, 31.30],
    '长沙': [112.93, 28.23],
    '厦门': [118.08, 24.48],
    '福州': [119.30, 26.08],
    '济南': [117.00, 36.65],
    '青岛': [120.38, 36.07],
    '合肥': [117.28, 31.86],
    '郑州': [113.62, 34.75],
    '沈阳': [123.43, 41.80],
    '大连': [121.61, 38.91],
    '昆明': [102.83, 24.88],
    '贵阳': [106.63, 26.65],
    '南宁': [108.36, 22.81],
    '哈尔滨': [126.53, 45.80],
    '长春': [125.32, 43.81],
    '太原': [112.55, 37.87],
    '南昌': [115.89, 28.68],
    '海口': [110.32, 20.04],
    '乌鲁木齐': [87.61, 43.82],
    '兰州': [103.83, 36.06],
    '西宁': [101.78, 36.62],
    '银川': [106.27, 38.47],
    '呼和浩特': [111.75, 40.84],
    '拉萨': [91.11, 29.65]
  };

  let localPosition = null; // { lat, lon, name, city, country, flag }
  let isLocating = false;

  function updateOriginDisplay() {
    const label = $('map-origin-label');
    const chip = $('map-origin-chip');
    const desc = localPosition ? (localPosition.country === 'CN' ? (localPosition.name || '中国 · 本机') : localPosition.name) : '中国 · 本机';
    if (label) label.textContent = `📍 ${desc}`;
    if (chip) chip.title = localPosition ? `当前位置: ${localPosition.name} (${localPosition.lon.toFixed(2)}, ${localPosition.lat.toFixed(2)}) · 点击重新定位` : '点击重新获取本机真实地理位置';
  }

  function initLocalPosition() {
    if (localPosition) return;
    try {
      const saved = localStorage.getItem('map-user-position');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lon === 'number') {
          localPosition = parsed;
          updateOriginDisplay();
          return;
        }
      }
    } catch {}

    fallbackTimezoneLocation();
  }

  async function requestLocation(force = false) {
    if (isLocating) return;
    isLocating = true;
    if (force) {
      const label = $('map-origin-label');
      if (label) label.textContent = '📍 正在定位…';
    }

    // 1. First priority: Server-side fast IP location (<200ms, non-blocking, zero prompt)
    try {
      const res = await fetch('/api/origin');
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          const city = data.city || '';
          const province = data.province || '';
          let coords = CN_CITY_COORDS[city];
          if (!coords && province) {
            for (const [k, v] of Object.entries(CN_CITY_COORDS)) {
              if (province.includes(k) || k.includes(province)) { coords = v; break; }
            }
          }
          const lon = coords ? coords[0] : (localPosition?.lon ?? 114.05);
          const lat = coords ? coords[1] : (localPosition?.lat ?? 22.54);
          const name = data.name || (city ? `中国 · ${city}` : '中国 · 本机');

          localPosition = {
            lon,
            lat,
            name,
            city: city || '中国',
            country: 'CN',
            flag: '🇨🇳'
          };
          try { localStorage.setItem('map-user-position', JSON.stringify(localPosition)); } catch {}
          isLocating = false;
          updateOriginDisplay();
          focusGlobeOnOrigin(true);
          render(true);
          return;
        }
      }
    } catch (e) {
      console.warn('Origin API lookup error:', e.message);
    }

    // 2. Second priority: If explicitly requested by clicking '重新定位' and browser GPS is supported, try with strict 2.5s timeout
    if (force && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        const pos = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('GPS timeout')), 2500);
          navigator.geolocation.getCurrentPosition(
            p => { clearTimeout(timer); resolve(p); },
            err => { clearTimeout(timer); reject(err); },
            { timeout: 2500, maximumAge: 300000, enableHighAccuracy: false }
          );
        });

        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const inChina = (lat >= 18 && lat <= 54 && lon >= 73 && lon <= 135) || (lat >= 21 && lat <= 26 && lon >= 119 && lon <= 122);
        const country = inChina ? 'CN' : 'US';
        localPosition = {
          lat,
          lon,
          name: inChina ? '中国 · 本机' : '本机位置',
          city: inChina ? '中国' : 'Local Host',
          country,
          flag: inChina ? '🇨🇳' : '💻'
        };
        try { localStorage.setItem('map-user-position', JSON.stringify(localPosition)); } catch {}
      } catch (err) {
        console.warn('GPS prompt notice:', err.message);
      }
    }

    isLocating = false;
    if (!localPosition) fallbackTimezoneLocation();
    else updateOriginDisplay();
    render(true);
  }

  function fallbackTimezoneLocation() {
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
    let lat = 22.54, lon = 114.05, name = '中国 · 本机', country = 'CN';
    if (tz.includes('shanghai')) { lat = 31.23; lon = 121.47; name = '中国 · 上海'; }
    else if (tz.includes('beijing') || tz.includes('chongqing') || tz.includes('harbin') || (navigator.language || '').startsWith('zh')) { lat = 39.90; lon = 116.40; name = '中国 · 北京'; }
    else if (tz.includes('hong_kong')) { lat = 22.32; lon = 114.17; name = '中国香港'; }
    else if (tz.includes('taipei')) { lat = 25.03; lon = 121.56; name = '中国台湾'; }
    else if (tz.includes('tokyo')) { lat = 35.68; lon = 139.69; name = '东京'; country = 'JP'; }
    else if (tz.includes('singapore')) { lat = 1.35; lon = 103.82; name = '新加坡'; country = 'SG'; }
    else if (tz.includes('london')) { lat = 51.50; lon = -0.12; name = '伦敦'; country = 'GB'; }
    else if (tz.includes('america/') || tz.includes('us/')) { lat = 37.77; lon = -122.41; name = '美国'; country = 'US'; }

    localPosition = { lat, lon, name, city: name, country, flag: country === 'CN' ? '🇨🇳' : getFlag(country) };
    try { localStorage.setItem('map-user-position', JSON.stringify(localPosition)); } catch {}
    updateOriginDisplay();
  }

  function focusGlobeOnOrigin(animate = true) {
    if (!globe) return;
    initLocalPosition();
    const lat = localPosition?.lat ?? 31.23;
    const lng = localPosition?.lon ?? 121.47;
    globe.pointOfView({ lat, lng, altitude: 2.2 }, animate ? 1000 : 0);
  }

  function toggleAutoRotate() {
    autoRotateEnabled = !autoRotateEnabled;
    try { localStorage.setItem('map-auto-rotate', String(autoRotateEnabled)); } catch {}
    if (globe) {
      const controls = globe.controls();
      if (controls) controls.autoRotate = autoRotateEnabled;
    }
    $('map-rotate-toggle')?.classList.toggle('active', autoRotateEnabled);
  }

  function resizeGlobe() {
    if (!globe || currentProjection !== '3d') return;
    const stage = $('map-stage-container');
    if (stage && stage.clientWidth > 0 && stage.clientHeight > 0) {
      globe.width(stage.clientWidth).height(stage.clientHeight);
    }
  }

  function setProjection(mode, shouldSave = true) {
    if (mode === '3d' && !has3DSupport) return;
    currentProjection = mode;
    if (shouldSave) {
      try { localStorage.setItem('map-projection-mode', mode); } catch {}
    }
    const stage = $('map-stage-container');
    if (stage) {
      stage.classList.toggle('mode-3d', mode === '3d');
      stage.classList.toggle('mode-2d', mode === '2d');
    }
    $('map-proj-3d')?.classList.toggle('active', mode === '3d');
    $('map-proj-2d')?.classList.toggle('active', mode === '2d');
    const rotateBtn = $('map-rotate-toggle');
    if (rotateBtn) rotateBtn.style.display = (mode === '3d') ? '' : 'none';

    const legendTip = $('legend-tip');
    if (legendTip) {
      legendTip.textContent = mode === '3d'
        ? '💡 鼠标拖拽旋转 · 滚轮缩放 · 悬停探测 · 3D 流量跃升'
        : '💡 滚轮缩放 · 拖拽平移 · 跨太平洋自然光流';
    }

    if (mode === '3d') {
      if (!globeInitialized) {
        initGlobe();
      }
      try {
        if (globe) {
          globe.resumeAnimation();
          const controls = globe.controls();
          if (controls) controls.autoRotate = autoRotateEnabled;
        }
      } catch {}
      setTimeout(resizeGlobe, 40);
    } else {
      try {
        if (globe) {
          globe.pauseAnimation();
          const controls = globe.controls();
          if (controls) controls.autoRotate = false;
        }
      } catch {}
    }
    render(true);
  }

  // 3D Country Polygons Accessors (Polyglobe Style)
  function getPolygonAltitude(feat) {
    if (!feat || !feat.properties) return 0.005;
    const cCode = normalizeCountry(feat.properties.ISO_A2);
    if (!cCode) return 0.005;
    const isSelected = selectedHub && (normalizeCountry(selectedHub) === cCode || normalizeCountry(TECH_HUBS[selectedHub]?.country) === cCode);
    if (isSelected) return 0.065;
    const count = currentCountryTraffic.get(cCode) || 0;
    if (count <= 0) return cCode === normalizeCountry(currentOriginCode) ? 0.022 : 0.005;
    const ratio = count / (currentMaxCountryCount || 1);
    if (ratio >= 0.75) return 0.052; // Top Hot extruded high in 3D!
    if (ratio >= 0.35) return 0.032; // Hot
    return 0.020;
  }

  function getPolygonCapColor(feat) {
    if (!feat || !feat.properties) return 'rgba(15, 23, 42, 0.55)';
    const cCode = normalizeCountry(feat.properties.ISO_A2);
    if (!cCode) return 'rgba(15, 23, 42, 0.55)';
    const isSelected = selectedHub && (normalizeCountry(selectedHub) === cCode || normalizeCountry(TECH_HUBS[selectedHub]?.country) === cCode);
    if (isSelected) return 'rgba(96, 165, 250, 0.95)';
    if (hoveredCountry && normalizeCountry(hoveredCountry) === cCode) return 'rgba(255, 255, 255, 0.85)';
    const count = currentCountryTraffic.get(cCode) || 0;
    const isOrigin = cCode === normalizeCountry(currentOriginCode);
    if (count <= 0) {
      return isOrigin ? 'rgba(217, 119, 6, 0.45)' : 'rgba(15, 23, 42, 0.55)';
    }
    const ratio = count / (currentMaxCountryCount || 1);
    if (ratio >= 0.75) return 'rgba(16, 185, 129, 0.95)'; // Blazing Neon Emerald
    if (ratio >= 0.35) return 'rgba(5, 150, 105, 0.82)'; // Emerald Green
    return isOrigin ? 'rgba(245, 158, 11, 0.85)' : 'rgba(2, 132, 199, 0.70)'; // Cyan
  }

  function getPolygonSideColor(feat) {
    if (!feat || !feat.properties) return 'rgba(30, 41, 59, 0.3)';
    const cCode = normalizeCountry(feat.properties.ISO_A2);
    const isSelected = selectedHub && (normalizeCountry(selectedHub) === cCode || normalizeCountry(TECH_HUBS[selectedHub]?.country) === cCode);
    if (isSelected) return 'rgba(96, 165, 250, 0.75)';
    const count = currentCountryTraffic.get(cCode) || 0;
    if (count <= 0) return 'rgba(30, 41, 59, 0.3)';
    const ratio = count / (currentMaxCountryCount || 1);
    if (ratio >= 0.75) return 'rgba(52, 211, 153, 0.75)';
    if (ratio >= 0.35) return 'rgba(16, 185, 129, 0.55)';
    return 'rgba(56, 189, 248, 0.45)';
  }

  function getPolygonStrokeColor(feat) {
    if (!feat || !feat.properties) return 'rgba(148, 163, 184, 0.2)';
    const cCode = normalizeCountry(feat.properties.ISO_A2);
    const isSelected = selectedHub && (normalizeCountry(selectedHub) === cCode || normalizeCountry(TECH_HUBS[selectedHub]?.country) === cCode);
    if (isSelected || (hoveredCountry && normalizeCountry(hoveredCountry) === cCode)) return '#ffffff';
    const count = currentCountryTraffic.get(cCode) || 0;
    if (count <= 0) return cCode === normalizeCountry(currentOriginCode) ? '#fbbf24' : 'rgba(148, 163, 184, 0.22)';
    const ratio = count / (currentMaxCountryCount || 1);
    if (ratio >= 0.75) return '#a7f3d0';
    if (ratio >= 0.35) return '#34d399';
    return '#38bdf8';
  }

  function getPolygonLabel(feat) {
    if (!feat || !feat.properties) return '';
    const rawCode = feat.properties.ISO_A2 || '';
    const isTaiwan = rawCode === 'TW';
    const cCode = normalizeCountry(rawCode);
    const nameZh = isTaiwan ? '中国台湾' : (feat.properties.NAME_ZH || feat.properties.NAME || '未知地区');
    const nameEn = isTaiwan ? 'Taiwan, China' : (feat.properties.NAME || '');
    const flag = getFlag(cCode);
    const count = currentCountryTraffic.get(cCode) || 0;
    const isOrigin = cCode === normalizeCountry(currentOriginCode);
    const sharePct = lastTotalLocated ? Math.round((count / lastTotalLocated) * 100) : 0;
    const ratio = count / (currentMaxCountryCount || 1);
    const isTop = ratio >= 0.75 && count > 1;
    const isHot = ratio >= 0.35 && count > 1 && !isTop;

    return `
      <div style="min-width:140px; padding:3px 5px;">
        <div style="display:flex; align-items:center; gap:6px; font-weight:700; font-size:12px; margin-bottom:4px;">
          <span style="font-size:16px;">${flag}</span>
          <span>${esc(nameZh)}</span>
          ${nameZh !== nameEn ? `<span style="font-weight:400; font-size:10px; color:#94a3b8">(${esc(nameEn)})</span>` : ''}
        </div>
        <div style="font-size:11px; color:#94a3b8; line-height:1.5;">
          ${isOrigin ? '<div style="color:#fbbf24; font-weight:600; margin-bottom:2px;">💻 本机所在国家/地区</div>' : ''}
          <div>实时连接：<strong style="color:${isTop ? '#fef08a' : (isHot ? '#34d399' : '#ffffff')}">${count}</strong> 条 (${sharePct}%)</div>
          ${isTop ? '<div style="color:#f59e0b; font-weight:600; margin-top:2px;">🔥 极高流量热点聚集</div>' : ''}
          <div style="color:#60a5fa; font-size:10px; margin-top:3px;">💡 点击可按此地区筛选</div>
        </div>
      </div>
    `;
  }

  function getArcLabel(arc) {
    if (!arc) return '';
    return `
      <div style="min-width:130px; padding:3px 5px;">
        <div style="font-weight:600; font-size:12px; margin-bottom:3px; color:#ffffff;">${arc.label || '数据链路'}</div>
        <div style="font-size:11px; color:#94a3b8; line-height:1.5;">
          <div>并发连接：<strong style="color:#ffffff;">${arc.count || 1}</strong> 条</div>
          <div>路由类型：<span style="color:${arc.routeColor || '#60a5fa'}; font-weight:600;">${arc.routeDesc || '数据传输'}</span></div>
        </div>
      </div>
    `;
  }

  function createHubElement(d) {
    const el = document.createElement('div');
    el.className = 'globe-html-marker';
    el.setAttribute('data-hub', d.id);
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');

    const dot = document.createElement('div');
    dot.className = `globe-marker-dot ${d.isTopHot ? 'top-hot' : ''} ${d.isOrigin ? 'origin' : ''}`;

    const pill = document.createElement('div');
    pill.className = `globe-marker-pill ${d.isTopHot ? 'top-hot' : ''} ${d.isOrigin ? 'origin' : ''}`;

    const icon = d.isOrigin ? '💻' : (d.hub.flag || '🌐');
    const badge = d.isTopHot ? '🔥 ' : (d.isHot ? '⚡️ ' : '');
    const title = d.isOrigin ? `本机 · ${d.hub.name}` : `${badge}${d.hub.name}`;
    const countText = d.isOrigin ? '' : `<span class="globe-marker-count">${d.count}</span>`;

    pill.innerHTML = `<span>${icon}</span> <span>${esc(title)}</span> ${countText}`;
    el.appendChild(dot);
    el.appendChild(pill);

    el.addEventListener('click', e => {
      e.stopPropagation();
      if (d.id !== '_origin') {
        selectedHub = selectedHub === d.id ? '' : d.id;
        render();
      }
    });

    el.addEventListener('mouseenter', e => {
      showPopover(e, d.hub, d.hItems, lastTotalLocated, lastMaxCount);
    });
    el.addEventListener('mouseleave', () => {
      hidePopover();
    });

    return el;
  }

  // 3D Globe WebGL Initialization (Optimized for 60FPS Performance)
  function initGlobe() {
    if (globeInitialized || !countriesGeoJson || !has3DSupport) return;
    const container = $('globe-3d-stage');
    if (!container || typeof Globe !== 'function') return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 540;

    try {
      globe = Globe()(container)
        .width(width)
        .height(height)
        .backgroundColor('rgba(0,0,0,0)')
        .showAtmosphere(true)
        .atmosphereColor('#38bdf8')
        .atmosphereAltitude(0.24)
        .showGraticules(true)
        // 3D Country Polygons (Extruded height & neon glow for active traffic)
        .polygonsData(countriesGeoJson.features)
        .polygonGeoJsonGeometry('geometry')
        .polygonCapColor(getPolygonCapColor)
        .polygonSideColor(getPolygonSideColor)
        .polygonStrokeColor(getPolygonStrokeColor)
        .polygonAltitude(getPolygonAltitude)
        .polygonsTransitionDuration(200)
        .onPolygonHover(feat => {
          const next = feat?.properties?.ISO_A2 ? normalizeCountry(feat.properties.ISO_A2) : null;
          if (hoveredCountry !== next) {
            hoveredCountry = next;
            if (globe && !hoverRafId) {
              hoverRafId = requestAnimationFrame(() => {
                hoverRafId = null;
                if (globe) {
                  globe
                    .polygonCapColor(getPolygonCapColor)
                    .polygonStrokeColor(getPolygonStrokeColor);
                }
              });
            }
          }
        })
        .onPolygonClick(feat => {
          if (feat && feat.properties.ISO_A2) {
            const cCode = normalizeCountry(feat.properties.ISO_A2);
            selectedHub = selectedHub === cCode ? '' : cCode;
            render();
          }
        })
        .polygonLabel(getPolygonLabel)
        // 3D Flying Arcs (Dual-Layer: Base Optical Fiber Tracks + High-Speed Photon Laser Comets)
        .arcsData([])
        .arcStartLat('startLat')
        .arcStartLng('startLng')
        .arcEndLat('endLat')
        .arcEndLng('endLng')
        .arcColor('color')
        .arcAltitude('altitude')
        .arcStroke('stroke')
        .arcDashLength('dashLength')
        .arcDashGap('dashGap')
        .arcDashInitialGap('dashInitialGap')
        .arcDashAnimateTime('dashAnimateTime')
        .arcLabel(getArcLabel)
        .arcsTransitionDuration(0)
        // 3D Sonar Pulsing Rings
        .ringsData([])
        .ringLat('lat')
        .ringLng('lng')
        .ringColor('color')
        .ringMaxRadius('maxR')
        .ringPropagationSpeed('speed')
        .ringRepeatPeriod('period')
        // 3D HTML Markers
        .htmlElementsData([])
        .htmlLat('lat')
        .htmlLng('lng')
        .htmlAltitude(0.022)
        .htmlElement(createHubElement);

      // Retina pixel ratio capping: 1.5 max cuts GPU fill rate burden in half on Mac Retina displays!
      if (globe.renderer()) {
        globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      }

      const mat = globe.globeMaterial();
      if (mat && mat.color) {
        mat.color.setHex(0x070d1e);
        if (mat.emissive) mat.emissive.setHex(0x02040b);
        mat.shininess = 25;
      }

      const controls = globe.controls();
      if (controls) {
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.rotateSpeed = 0.7;
        controls.autoRotate = autoRotateEnabled;
        controls.autoRotateSpeed = 0.6;
        controls.minDistance = 110;
        controls.maxDistance = 500;
      }

      globeInitialized = true;
      focusGlobeOnOrigin(false);
    } catch (e) {
      console.warn('3D Globe initialization failed, falling back to 2D:', e);
      setProjection('2d', false);
    }
  }

  async function loadWorld() {
    const [worldRes, geoRes] = await Promise.all([
      fetch('/map/world.json'),
      fetch('/map/countries.geojson')
    ]);
    if (!worldRes.ok || !worldRes.headers.get('content-type')?.includes('application/json')) throw new Error('2D 地图资源加载失败');
    if (!geoRes.ok || !geoRes.headers.get('content-type')?.includes('application/json')) throw new Error('3D 地球资源加载失败');
    world = await worldRes.json();
    countriesGeoJson = await geoRes.json();

    $('map-land').innerHTML = world.paths.map(p => {
      const code = typeof p === 'object' && p ? p.code : '';
      const d = typeof p === 'object' && p ? p.d : p;
      const attr = code ? ` data-country="${code}" class="map-country country-${code}"` : ` class="map-country"`;
      return `<path d="${d}"${attr}/>`;
    }).join('');
    initLocalPosition();
    void requestLocation();

    if (has3DSupport && currentProjection === '3d') {
      initGlobe();
    }
  }

  async function locate(targets) {
    if (lookupBusy || geoError) return;
    const missing = [...new Set(targets)].filter(t => t && typeof t === 'string' && !locations.has(t)).slice(0, 128);
    if (!missing.length) return;
    lookupBusy = true;
    try {
      const response = await fetch('/api/geo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: missing })
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('本地定位接口不可用，请确认已重启新版服务');
      const data = await response.json();
      if (!data.countries || typeof data.countries !== 'object') throw new Error('本地定位返回格式异常');
      Object.entries(data.countries).forEach(([target, country]) => locations.set(target, country));
      const live = new Set();
      for (const x of getState().connections.values()) {
        if (x.remoteIP) live.add(x.remoteIP);
        if (x.host) live.add(x.host);
      }
      for (const k of locations.keys()) if (!live.has(k)) locations.delete(k);
    } catch (error) { geoError = error.message; }
    finally { lookupBusy = false; render(); }
  }

  // 2D Arc: Direct, Unbroken Flow from Start Node to End Node
  function drawArc(fromPoint, toPoint, strokeColor, count, arcs, isLive = true, heatRatio = 0) {
    const [sx, sy] = fromPoint;
    const [x, y] = toPoint;
    const isSelf = x === sx && y === sy;

    let path = '';

    if (isSelf) {
      path = `M${x},${y} c-35,-45 35,-45 0,0`;
    } else {
      const dx = x - sx;
      const dy = y - sy;
      const dist = Math.hypot(dx, dy);

      let cx, cy;
      if (Math.abs(dx) < 65) {
        // North-South dominant: slight lateral curve
        cx = (sx + x) / 2 + (dx >= 0 ? 35 : -35);
        cy = (sy + y) / 2;
      } else {
        // East-West dominant: smooth upward arch across the map directly from start to end
        const bend = Math.min(110, Math.max(28, dist * 0.16 + Math.abs(dy) * 0.08));
        cx = (sx + x) / 2;
        cy = Math.max(20, Math.min(sy, y) - bend);
      }
      path = `M${sx},${sy} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x},${y}`;
    }

    const isHotArc = (heatRatio >= 0.45 || count >= 5) && count > 1;
    const trackWidth = Math.max(1, Math.min(5.0, 0.8 + Math.log2(count + 1) + heatRatio * 2.0));
    const streamWidth = trackWidth + (isHotArc ? 1.6 : 1.1);
    const dur = Math.max(0.75, 2.4 - Math.log2(count + 1) * 0.35 - heatRatio * 0.6).toFixed(2);

    // 1. Static track: single unbroken curve directly connecting start to end
    arcs.push(`<path class="map-arc-track ${isHotArc ? 'hot' : ''}" stroke="${strokeColor}" stroke-width="${trackWidth.toFixed(1)}" d="${path}"/>`);

    // 2. Animated luminous flow beam & continuous flowing particles
    if (isLive) {
      arcs.push(`<path class="map-arc-stream ${isHotArc ? 'hot' : ''}" pathLength="1000" stroke="${strokeColor}" stroke-width="${streamWidth.toFixed(1)}" d="${path}" style="animation-duration:${dur}s;"/>`);
      const particleCount = isHotArc ? (heatRatio >= 0.8 ? 3 : 2) : (count > 1 ? 2 : 1);
      const particleRadius = isHotArc ? '3.4' : '2.6';

      for (let p = 0; p < particleCount; p++) {
        const delay = (-p * (dur / particleCount)).toFixed(2);
        arcs.push(`
          <circle class="map-particle ${isHotArc ? 'hot' : ''}" r="${particleRadius}" fill="#ffffff" stroke="${isHotArc ? '#f59e0b' : strokeColor}" stroke-width="${isHotArc ? '1.8' : '1.4'}" filter="url(#map-glow)">
            <animateMotion dur="${dur}s" begin="${delay}s" repeatCount="indefinite" path="${path}"/>
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.92;1" dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>
          </circle>
        `);
      }
    }
  }

  function render(force = false) {
    const state = getState();
    $('view-map').classList.toggle('is-paused', state.paused);
    const svg = $('map-svg');
    if (svg) {
      if (state.paused) {
        try { svg.pauseAnimations(); } catch {}
      } else {
        try { svg.unpauseAnimations(); } catch {}
      }
    }

    // 3D Globe animation pause/resume
    if (globe) {
      try {
        const isGlobeActive = !state.paused && state.activeView === 'map' && currentProjection === '3d';
        if (!isGlobeActive) {
          globe.pauseAnimation();
          const controls = globe.controls();
          if (controls) controls.autoRotate = false;
        } else {
          globe.resumeAnimation();
          const controls = globe.controls();
          if (controls) controls.autoRotate = autoRotateEnabled;
        }
      } catch {}
    }

    if (state.activeView !== 'map' || (state.paused && !force)) return;
    if (!world || (has3DSupport && !countriesGeoJson)) {
      if (!loading) loading = loadWorld().then(render).catch(error => { geoError = error.message; $('map-message').textContent = geoError; $('map-retry').hidden = false; });
      return;
    }

    if (currentProjection === '3d' && has3DSupport) {
      if (!globeInitialized) {
        initGlobe();
      } else {
        resizeGlobe();
      }
    }

    const timeWindow = $('map-window').value;
    let items = readFiltered().filter(x => timeWindow === 'all' || (timeWindow === 'active' ? !x.closed : Date.now() - x.lastSeen < 60000));
    const selectedNode = $('map-node').value;
    const nodes = [...new Set([...state.connections.values()].map(x => x.node).filter(Boolean))].sort();
    const options = '<option value="">全部节点</option>' + nodes.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
    if ($('map-node').innerHTML !== options) { $('map-node').innerHTML = options; $('map-node').value = nodes.includes(selectedNode) ? selectedNode : ''; }
    if ($('map-node').value) items = items.filter(x => x.node === $('map-node').value);

    const mode = $('map-mode')?.value || 'target';
    const eligible = items.filter(x => x.connected && ['PROXY','DIRECT'].includes(x.route));
    const toLocate = [];
    for (const x of eligible) {
      if (x.remoteIP) toLocate.push(x.remoteIP);
      if (x.host) toLocate.push(x.host);
    }
    void locate(toLocate);

    // Origin resolution (Your Mac)
    initLocalPosition();
    const originCountryCode = normalizeCountry(localPosition?.country || 'CN');
    currentOriginCode = originCountryCode;
    const originHub = {
      id: '_origin',
      name: localPosition?.name || '中国 · 本机',
      city: localPosition?.city || '本机',
      flag: localPosition?.flag || '🇨🇳',
      lon: localPosition?.lon ?? 121.47,
      lat: localPosition?.lat ?? 31.23,
      country: originCountryCode
    };

    const arcs = [];
    const globeArcs = [];
    const hubCounts = new Map(); // hub.id -> { hub, count, items: [] }

    function registerHub(hub, item) {
      if (!hub) return;
      const entry = hubCounts.get(hub.id) || { hub, count: 0, items: [] };
      entry.count++;
      entry.items.push(item);
      hubCounts.set(hub.id, entry);
    }

    // Filter items by App or Search if active
    let displayItems = eligible;
    if (selectedApp) {
      displayItems = displayItems.filter(x => getAppCategory(x).key === selectedApp);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      displayItems = displayItems.filter(x => `${x.host} ${x.node} ${x.remoteIP} ${getAppCategory(x).name}`.toLowerCase().includes(q));
    }

    if (mode === 'relay') {
      const directGroups = new Map();
      const proxyHops1 = new Map();
      const proxyHops2 = new Map();

      for (const item of displayItems) {
        const pHub = resolveHub(item, 'proxy');
        const tHub = resolveHub(item, 'target');

        if (item.route === 'DIRECT') {
          if (!tHub) continue;
          registerHub(tHub, item);
          const list = directGroups.get(tHub.id) || { hub: tHub, items: [] };
          list.items.push(item);
          directGroups.set(tHub.id, list);
        } else {
          if (pHub) {
            registerHub(pHub, item);
            const list1 = proxyHops1.get(pHub.id) || { hub: pHub, items: [] };
            list1.items.push(item);
            proxyHops1.set(pHub.id, list1);

            if (tHub && tHub.id !== pHub.id) {
              registerHub(tHub, item);
              const hop2Key = `${pHub.id}->${tHub.id}`;
              const list2 = proxyHops2.get(hop2Key) || { fromHub: pHub, toHub: tHub, items: [] };
              list2.items.push(item);
              proxyHops2.set(hop2Key, list2);
            }
          }
        }
      }

      if (originHub) {
        const originPt = point(originHub);
        const maxCount = Math.max(...[...hubCounts.values()].map(e => e.count), 1);
        for (const { hub, items: dItems } of directGroups.values()) {
          if (selectedHub && selectedHub !== hub.id) continue;
          const heatRatio = dItems.length / maxCount;
          drawArc(originPt, point(hub), color('DIRECT'), dItems.length, arcs, true, heatRatio);

          const isTop = heatRatio >= 0.75 && dItems.length >= 3;
          const arcAlt = 0.14 + heatRatio * 0.12;

          // 1. Base Optical Guidance Track (Translucent Cyber Conduits)
          globeArcs.push({
            startLat: originHub.lat,
            startLng: originHub.lon,
            endLat: hub.lat,
            endLng: hub.lon,
            color: isTop ? 'rgba(245, 158, 11, 0.22)' : 'rgba(16, 185, 129, 0.16)',
            altitude: arcAlt,
            stroke: 0.6,
            dashLength: 1.0,
            dashGap: 0,
            dashInitialGap: 0,
            dashAnimateTime: 0,
            count: dItems.length,
            routeColor: '#10b981',
            routeDesc: '直连光纤基底',
            label: `${originHub.flag || '💻'} ${originHub.name} ➔ ${hub.flag || '🌐'} ${hub.name}`
          });

          // 2. High-Speed Luminous Laser Comet Pulses
          const cometCount = isTop ? 3 : (dItems.length >= 3 ? 2 : 1);
          const dashLen = isTop ? 0.14 : (dItems.length >= 3 ? 0.18 : 0.22);
          const dashGap = cometCount === 3 ? 0.18 : (cometCount === 2 ? 0.32 : 0.78);
          const animTime = Math.max(650, 1600 - Math.log2(dItems.length + 1) * 260);

          globeArcs.push({
            startLat: originHub.lat,
            startLng: originHub.lon,
            endLat: hub.lat,
            endLng: hub.lon,
            color: isTop
              ? ['rgba(245, 158, 11, 0.08)', '#ea580c', '#f59e0b', '#fef08a', '#ffffff']
              : ['rgba(16, 185, 129, 0.08)', '#059669', '#10b981', '#6ee7b7', '#ffffff'],
            altitude: arcAlt,
            stroke: Math.min(3.4, Math.max(1.3, 1.2 + Math.log2(dItems.length + 1) * 0.4 + heatRatio * 1.5)),
            dashLength: dashLen,
            dashGap: dashGap,
            dashInitialGap: 0,
            dashAnimateTime: animTime,
            count: dItems.length,
            routeColor: '#10b981',
            routeDesc: '直连高速光子流',
            label: `${originHub.flag || '💻'} ${originHub.name} ➔ ${hub.flag || '🌐'} ${hub.name}`
          });
        }
        for (const { hub, items: pItems } of proxyHops1.values()) {
          if (selectedHub && selectedHub !== hub.id && ![...proxyHops2.values()].some(h => h.fromHub.id === hub.id && h.toHub.id === selectedHub)) continue;
          const heatRatio = pItems.length / maxCount;
          drawArc(originPt, point(hub), '#60a5fa', pItems.length, arcs, true, heatRatio);

          const arcAlt1 = 0.15 + heatRatio * 0.13;
          // 1. Base Guidance Track
          globeArcs.push({
            startLat: originHub.lat,
            startLng: originHub.lon,
            endLat: hub.lat,
            endLng: hub.lon,
            color: 'rgba(56, 189, 248, 0.18)',
            altitude: arcAlt1,
            stroke: 0.6,
            dashLength: 1.0,
            dashGap: 0,
            dashInitialGap: 0,
            dashAnimateTime: 0,
            count: pItems.length,
            routeColor: '#60a5fa',
            routeDesc: '第 1 跳：中继光纤基底 (本机 ➔ 代理入口)',
            label: `${originHub.flag || '💻'} ${originHub.name} ➔ ${hub.flag || '🌐'} ${hub.name} (代理)`
          });

          // 2. High-Speed Laser Comet Pulses
          const cometCount1 = pItems.length >= 6 ? 3 : (pItems.length >= 3 ? 2 : 1);
          const dashLen1 = pItems.length >= 6 ? 0.14 : (pItems.length >= 3 ? 0.18 : 0.22);
          const dashGap1 = cometCount1 === 3 ? 0.18 : (cometCount1 === 2 ? 0.32 : 0.78);
          const animTime1 = Math.max(650, 1550 - Math.log2(pItems.length + 1) * 260);

          globeArcs.push({
            startLat: originHub.lat,
            startLng: originHub.lon,
            endLat: hub.lat,
            endLng: hub.lon,
            color: ['rgba(56, 189, 248, 0.08)', '#0284c7', '#38bdf8', '#93c5fd', '#ffffff'],
            altitude: arcAlt1,
            stroke: Math.min(3.4, Math.max(1.3, 1.2 + Math.log2(pItems.length + 1) * 0.4 + heatRatio * 1.5)),
            dashLength: dashLen1,
            dashGap: dashGap1,
            dashInitialGap: 0,
            dashAnimateTime: animTime1,
            count: pItems.length,
            routeColor: '#60a5fa',
            routeDesc: '第 1 跳：高速光子流 (本机 ➔ 代理入口)',
            label: `${originHub.flag || '💻'} ${originHub.name} ➔ ${hub.flag || '🌐'} ${hub.name} (代理)`
          });
        }
        for (const { fromHub, toHub, items: hItems } of proxyHops2.values()) {
          if (selectedHub && selectedHub !== toHub.id && selectedHub !== fromHub.id) continue;
          const heatRatio = hItems.length / maxCount;
          drawArc(point(fromHub), point(toHub), '#a855f7', hItems.length, arcs, true, heatRatio);

          const arcAlt2 = 0.22 + heatRatio * 0.15;
          // 1. Base Guidance Track
          globeArcs.push({
            startLat: fromHub.lat,
            startLng: fromHub.lon,
            endLat: toHub.lat,
            endLng: toHub.lon,
            color: 'rgba(168, 85, 247, 0.20)',
            altitude: arcAlt2,
            stroke: 0.6,
            dashLength: 1.0,
            dashGap: 0,
            dashInitialGap: 0,
            dashAnimateTime: 0,
            count: hItems.length,
            routeColor: '#a855f7',
            routeDesc: '第 2 跳：中继光纤基底 (代理机房 ➔ 最终目标)',
            label: `${fromHub.flag || '🌐'} ${fromHub.name} ➔ ${toHub.flag || '🌐'} ${toHub.name}`
          });

          // 2. High-Speed Laser Comet Pulses
          const cometCount2 = hItems.length >= 6 ? 3 : (hItems.length >= 3 ? 2 : 1);
          const dashLen2 = hItems.length >= 6 ? 0.14 : (hItems.length >= 3 ? 0.18 : 0.22);
          const dashGap2 = cometCount2 === 3 ? 0.18 : (cometCount2 === 2 ? 0.32 : 0.78);
          const animTime2 = Math.max(650, 1500 - Math.log2(hItems.length + 1) * 260);

          globeArcs.push({
            startLat: fromHub.lat,
            startLng: fromHub.lon,
            endLat: toHub.lat,
            endLng: toHub.lon,
            color: ['rgba(168, 85, 247, 0.08)', '#7c3aed', '#c084fc', '#f43f5e', '#ffffff'],
            altitude: arcAlt2,
            stroke: Math.min(3.4, Math.max(1.3, 1.2 + Math.log2(hItems.length + 1) * 0.4 + heatRatio * 1.5)),
            dashLength: dashLen2,
            dashGap: dashGap2,
            dashInitialGap: 0.25, // Staggered so hop 2 pulses appear to follow hop 1!
            dashAnimateTime: animTime2,
            count: hItems.length,
            routeColor: '#a855f7',
            routeDesc: '第 2 跳：高速光子流 (代理机房 ➔ 最终目标)',
            label: `${fromHub.flag || '🌐'} ${fromHub.name} ➔ ${toHub.flag || '🌐'} ${toHub.name}`
          });
        }
      }
    } else {
      // mode === 'target' or 'proxy'
      const targetGroups = new Map();
      for (const item of displayItems) {
        const hub = resolveHub(item, mode);
        if (!hub) continue;
        registerHub(hub, item);
        const key = `${hub.id}:${item.route}`;
        const entry = targetGroups.get(key) || { hub, route: item.route, items: [] };
        entry.items.push(item);
        targetGroups.set(key, entry);
      }

      if (originHub) {
        const originPt = point(originHub);
        const maxCount = Math.max(...[...hubCounts.values()].map(e => e.count), 1);
        for (const { hub, route, items: gItems } of targetGroups.values()) {
          if (selectedHub && selectedHub !== hub.id) continue;
          const isLive = !gItems.every(x => x.closed);
          const heatRatio = (hubCounts.get(hub.id)?.count || gItems.length) / maxCount;
          const isTopHot = heatRatio >= 0.75 && gItems.length >= 3;
          drawArc(originPt, point(hub), color(route, isLive), gItems.length, arcs, isLive, heatRatio);

          const arcAlt = Math.min(0.35, Math.max(0.12, 0.12 + heatRatio * 0.18));

          // 1. Base Optical Guidance Track
          const baseColor = isTopHot ? 'rgba(245, 158, 11, 0.22)' : (isLive ? 'rgba(16, 185, 129, 0.16)' : 'rgba(56, 189, 248, 0.14)');
          globeArcs.push({
            startLat: originHub.lat,
            startLng: originHub.lon,
            endLat: hub.lat,
            endLng: hub.lon,
            color: baseColor,
            altitude: arcAlt,
            stroke: 0.6,
            dashLength: 1.0,
            dashGap: 0,
            dashInitialGap: 0,
            dashAnimateTime: 0,
            count: gItems.length,
            routeColor: color(route, isLive),
            routeDesc: route === 'DIRECT' ? '直连光纤基底' : '代理光纤基底',
            label: `${originHub.flag || '💻'} ${originHub.name} ➔ ${hub.flag || '🌐'} ${hub.name}`
          });

          // 2. High-Speed Luminous Laser Comet Pulses
          const cometCount = isTopHot ? 3 : (gItems.length >= 3 ? 2 : 1);
          const dashLen = isTopHot ? 0.14 : (gItems.length >= 3 ? 0.18 : 0.22);
          const dashGap = cometCount === 3 ? 0.18 : (cometCount === 2 ? 0.32 : 0.78);
          const animTime = Math.max(650, 1700 - Math.log2(gItems.length + 1) * 280);

          let cometColor;
          if (isTopHot) {
            cometColor = ['rgba(245, 158, 11, 0.08)', '#ea580c', '#f59e0b', '#fef08a', '#ffffff'];
          } else if (route === 'DIRECT') {
            cometColor = ['rgba(16, 185, 129, 0.08)', '#059669', '#10b981', '#6ee7b7', '#ffffff'];
          } else {
            cometColor = ['rgba(56, 189, 248, 0.08)', '#0284c7', '#38bdf8', '#93c5fd', '#ffffff'];
          }

          globeArcs.push({
            startLat: originHub.lat,
            startLng: originHub.lon,
            endLat: hub.lat,
            endLng: hub.lon,
            color: cometColor,
            altitude: arcAlt,
            stroke: Math.min(3.4, Math.max(1.3, 1.2 + Math.log2(gItems.length + 1) * 0.4 + heatRatio * 1.5)),
            dashLength: dashLen,
            dashGap: dashGap,
            dashInitialGap: 0,
            dashAnimateTime: animTime,
            count: gItems.length,
            routeColor: color(route, isLive),
            routeDesc: route === 'DIRECT' ? '直连高速光流' : '代理高速光流',
            label: `${originHub.flag || '💻'} ${originHub.name} ➔ ${hub.flag || '🌐'} ${hub.name}`
          });
        }
      }
    }

    const located = [...hubCounts.values()].reduce((sum, e) => sum + e.count, 0);
    const maxCount = Math.max(...[...hubCounts.values()].map(e => e.count), 1);
    lastMaxCount = maxCount;
    lastTotalLocated = located;
    $('map-count').textContent = items.length;
    $('map-located').textContent = located;
    $('map-unknown').textContent = Math.max(0, items.length - located);
    $('map-regions').textContent = hubCounts.size;

    // Dynamic Geo Country Territory Highlighting
    const countryTraffic = new Map();
    for (const { hub, count } of hubCounts.values()) {
      const cCode = normalizeCountry(hub?.country);
      if (cCode) countryTraffic.set(cCode, (countryTraffic.get(cCode) || 0) + count);
    }
    const maxCountryCount = Math.max(...countryTraffic.values(), 1);
    currentCountryTraffic = countryTraffic;
    currentMaxCountryCount = maxCountryCount;

    // 2D SVG Country Territory Highlighting
    const landGroup = $('map-land');
    if (landGroup) {
      const paths = landGroup.querySelectorAll('path[data-country]');
      const normOrigin = normalizeCountry(currentOriginCode);
      const normSelected = normalizeCountry(selectedHub) || (TECH_HUBS[selectedHub] ? normalizeCountry(TECH_HUBS[selectedHub].country) : '');

      for (const p of paths) {
        const cCode = normalizeCountry(p.dataset.country);
        const count = countryTraffic.get(cCode) || 0;
        const isOrigin = cCode === normOrigin;
        const isSelected = normSelected && (normSelected === cCode);
        const cRatio = count / maxCountryCount;
        const isTopHot = count > 0 && cRatio >= 0.75;
        const isHot = count > 0 && cRatio >= 0.35 && !isTopHot;

        p.classList.toggle('has-traffic', count > 0);
        p.classList.toggle('hot-traffic', isHot);
        p.classList.toggle('top-hot-traffic', isTopHot);
        p.classList.toggle('is-origin', isOrigin);
        p.classList.toggle('is-selected', Boolean(isSelected));
      }
    }

    // 2D SVG Markers with Smart Collision Avoidance & Label Pills
    const hubList = [...hubCounts.values()].map(e => {
      const [x, y] = point(e.hub);
      return { ...e, x, y, labelPlacement: 'right' };
    });

    // Detect neighboring pins to prevent overlapping labels
    for (let i = 0; i < hubList.length; i++) {
      const h1 = hubList[i];
      for (let j = 0; j < hubList.length; j++) {
        if (i === j) continue;
        const h2 = hubList[j];
        const dx = Math.abs(h1.x - h2.x);
        const dy = Math.abs(h1.y - h2.y);
        if (dx < 65 && dy < 45) {
          if (h1.y < h2.y) {
            h1.labelPlacement = 'top';
          } else if (h1.y > h2.y) {
            h1.labelPlacement = 'bottom';
          }
        }
      }
    }

    const markers = [];
    for (const item of hubList) {
      const { hub, count, items: hItems, x, y, labelPlacement } = item;
      const isProxyRelay = mode === 'relay' && hItems.some(x => x.route === 'PROXY' && resolveHub(x, 'proxy')?.id === hub.id);
      const isLive = hItems.some(x => !x.closed);
      const heatRatio = count / maxCount;
      const sharePct = Math.round((count / (located || 1)) * 100);
      const isTopHot = heatRatio >= 0.75 && count >= 3;
      const isHot = (heatRatio >= 0.38 || count >= 5) && count > 1;

      const markerColor = isProxyRelay ? '#a855f7' : (isLive ? '#10b981' : '#60a5fa');
      const auraGradient = isTopHot ? 'url(#heat-glow-hot)' : (isProxyRelay ? 'url(#heat-glow-blue)' : 'url(#heat-glow-green)');
      const label = isProxyRelay ? `${esc(hub.name)} (中继)` : esc(hub.name);
      const badgeIcon = isTopHot ? '🔥 ' : (isHot ? '⚡️ ' : '');
      const displayText = `${hub.flag || ''} ${badgeIcon}${label} ${count}`;

      const discRadius = Math.min(22, 4.5 + Math.log2(count + 1) * 2.0 + heatRatio * 7);
      const coreRadius = Math.min(5, 3.0 + heatRatio * 1.8);
      const pointClass = `map-point ${isTopHot ? 'hot top-hot' : (isHot ? 'hot' : '')}`;

      const auraElement = (isHot || isTopHot)
        ? `<circle class="map-heat-aura" cx="${x}" cy="${y}" r="${(discRadius * 1.7).toFixed(1)}" fill="${auraGradient}"/>`
        : '';
      const secondaryRipple = (isHot || isTopHot)
        ? `<circle class="map-ripple-secondary" cx="${x}" cy="${y}" r="3.5" stroke="${isTopHot ? '#f59e0b' : markerColor}"/>`
        : '';

      // Smart label positioning and background pill bounds
      const textLen = (hub.name.length || 4) * 10.5 + 34;
      const pillH = 18;
      let textX = x + discRadius + 7, textY = y + 4, anchor = 'start';
      let pillX = x + discRadius + 3, pillY = y - 9;

      if (labelPlacement === 'top') {
        textX = x;
        textY = y - discRadius - 7;
        anchor = 'middle';
        pillX = x - textLen / 2;
        pillY = y - discRadius - 20;
      } else if (labelPlacement === 'bottom') {
        textX = x;
        textY = y + discRadius + 15;
        anchor = 'middle';
        pillX = x - textLen / 2;
        pillY = y + discRadius + 4;
      }

      markers.push(`
        <g class="${pointClass}" data-hub="${esc(hub.id)}" role="button" tabindex="0" aria-label="${label}，${count} 条连接 (${sharePct}%)" opacity="${selectedHub && selectedHub !== hub.id ? .3 : 1}">
          <title>${label} · ${count} 条连接记录 (${sharePct}%)</title>
          ${auraElement}
          <circle class="map-ripple" cx="${x}" cy="${y}" r="3.5" stroke="${isTopHot ? '#f59e0b' : markerColor}"/>
          ${secondaryRipple}
          <circle class="map-disc" cx="${x}" cy="${y}" r="${discRadius.toFixed(1)}" fill="${markerColor}" fill-opacity="${(0.18 + heatRatio * 0.28).toFixed(2)}" filter="${(isHot || isTopHot) ? 'url(#map-glow)' : 'none'}"/>
          <circle class="map-core" cx="${x}" cy="${y}" r="${coreRadius.toFixed(1)}" fill="${(isHot || isTopHot) ? '#ffffff' : markerColor}" stroke="${isTopHot ? '#f59e0b' : '#ffffff'}" stroke-width="${(isHot || isTopHot) ? '1.8' : '0.8'}"/>
          <rect class="map-label-bg" x="${pillX.toFixed(1)}" y="${pillY.toFixed(1)}" width="${textLen}" height="${pillH}"/>
          <text x="${textX.toFixed(1)}" y="${textY.toFixed(1)}" text-anchor="${anchor}">${displayText}</text>
        </g>
      `);
    }

    if (originHub) {
      const [x, y] = point(originHub);
      const originText = `💻 本机 · ${esc(originHub.name)}`;
      const oTextLen = originHub.name.length * 10.5 + 46;
      // Position Origin Label to the LEFT so it NEVER collides with eastward destinations!
      const oPillX = x - oTextLen - 10;
      const oPillY = y - 9;
      const oTextX = x - 14;
      const oTextY = y + 4;

      markers.push(`
        <g class="map-origin-group" data-hub="_origin">
          <circle class="map-origin-ripple" cx="${x}" cy="${y}" r="4"/>
          <circle class="map-origin" cx="${x}" cy="${y}" r="5"/>
          <rect class="map-origin-label-bg" x="${oPillX.toFixed(1)}" y="${oPillY.toFixed(1)}" width="${oTextLen}" height="19"/>
          <text x="${oTextX.toFixed(1)}" y="${oTextY.toFixed(1)}" text-anchor="end" fill="#fef08a" font-size="10.5" font-weight="600">${originText}</text>
        </g>
      `);
    }

    const nextArcs = arcs.join(''), nextMarkers = markers.join('');
    if (nextArcs !== previousArcs) { $('map-arcs').innerHTML = nextArcs; previousArcs = nextArcs; }
    if (nextMarkers !== previousMarkers) {
      const staging = document.createElementNS('http://www.w3.org/2000/svg','g');
      staging.innerHTML = nextMarkers;
      const parent = $('map-points');
      const ids = new Set(hubCounts.keys());
      if (originHub) ids.add('_origin');
      for (const child of [...parent.children]) {
        if (!child.dataset.hub || !ids.has(child.dataset.hub)) child.remove();
      }
      for (const child of [...staging.children]) {
        const existing = child.dataset.hub && parent.querySelector(`[data-hub="${child.dataset.hub}"]`);
        if (!existing) { parent.append(child); continue; }
        if (existing.children.length !== child.children.length) {
          existing.replaceWith(child);
          continue;
        }
        existing.setAttribute('aria-label', child.getAttribute('aria-label') || '');
        existing.setAttribute('opacity', child.getAttribute('opacity') || '1');
        existing.setAttribute('class', child.getAttribute('class') || 'map-point');
        [...child.children].forEach((part, i) => {
          const target = existing.children[i];
          if (!target) return;
          for (const attr of part.attributes) target.setAttribute(attr.name, attr.value);
          if (part.tagName === 'text' || part.tagName === 'title') target.textContent = part.textContent;
        });
      }
      previousMarkers = nextMarkers;
    }

    // 3D Globe Sync (Optimized 60FPS with Strict Dirty-Checking)
    if (globe) {
      const globeRings = [];
      for (const { hub, count, items: hItems } of hubCounts.values()) {
        const heatRatio = count / maxCount;
        const isTopHot = heatRatio >= 0.75 && count >= 3;
        const isHot = (heatRatio >= 0.38 || count >= 5) && count > 1;
        const isLive = hItems.some(x => !x.closed);
        globeRings.push({
          lat: hub.lat,
          lng: hub.lon,
          maxR: isTopHot ? 16 : (isHot ? 11 : 7.5),
          speed: isTopHot ? 3.0 : 2.0,
          period: isTopHot ? 700 : 1100,
          color: t => {
            const alpha = Math.max(0, 1 - t);
            if (isTopHot) return `rgba(245, 158, 11, ${alpha * 0.95})`;
            if (isLive) return `rgba(16, 185, 129, ${alpha * 0.90})`;
            return `rgba(56, 189, 248, ${alpha * 0.80})`;
          }
        });
      }
      if (originHub) {
        globeRings.push({
          lat: originHub.lat,
          lng: originHub.lon,
          maxR: 9.5,
          speed: 1.8,
          period: 1300,
          color: t => `rgba(245, 158, 11, ${Math.max(0, 1 - t) * 0.90})`
        });
      }

      const globeHubs = [];
      for (const { hub, count, items: hItems } of hubCounts.values()) {
        const heatRatio = count / maxCount;
        const isTopHot = heatRatio >= 0.75 && count >= 3;
        const isHot = (heatRatio >= 0.38 || count >= 5) && count > 1;
        globeHubs.push({
          id: hub.id,
          lat: hub.lat,
          lng: hub.lon,
          hub,
          count,
          hItems,
          isTopHot,
          isHot,
          isOrigin: false
        });
      }
      if (originHub) {
        globeHubs.push({
          id: '_origin',
          lat: originHub.lat,
          lng: originHub.lon,
          hub: originHub,
          count: located,
          hItems: [],
          isTopHot: false,
          isHot: false,
          isOrigin: true
        });
      }

      // Dirty check 1: Arcs (Dual-Layer)
      const arcsSig = globeArcs.map(a => `${a.startLat.toFixed(1)},${a.startLng.toFixed(1)}->${a.endLat.toFixed(1)},${a.endLng.toFixed(1)}:${a.count}:${a.dashLength}:${a.dashAnimateTime}`).join('|');
      if (arcsSig !== lastArcsSig) {
        globe.arcsData(globeArcs);
        lastArcsSig = arcsSig;
      }

      // Dirty check 3: Sonar Rings
      const ringsSig = globeRings.map(r => `${r.lat.toFixed(1)},${r.lng.toFixed(1)}:${r.maxR}`).join('|');
      if (ringsSig !== lastRingsSig) {
        globe.ringsData(globeRings);
        lastRingsSig = ringsSig;
      }

      // Dirty check 4: Hubs HTML Markers
      const hubsSig = globeHubs.map(h => `${h.id}:${h.count}:${h.isTopHot}`).join('|');
      if (hubsSig !== lastHubsSig) {
        globe.htmlElementsData(globeHubs);
        lastHubsSig = hubsSig;
      }

      // Dirty check 4: Country Extrusion Polygons
      const countrySig = [...countryTraffic.entries()].sort().map(([k,v]) => `${k}:${v}`).join(',') + `|origin:${currentOriginCode}|sel:${selectedHub}`;
      if (countrySig !== lastCountrySig) {
        globe
          .polygonCapColor(getPolygonCapColor)
          .polygonAltitude(getPolygonAltitude)
          .polygonSideColor(getPolygonSideColor)
          .polygonStrokeColor(getPolygonStrokeColor);
        lastCountrySig = countrySig;
      }
    }

    // Sidebar: Little Snitch App Grouping Tree (Sorted by Traffic Volume)
    const appGroups = new Map();
    for (const item of displayItems) {
      const app = getAppCategory(item);
      const group = appGroups.get(app.key) || { app, count: 0, items: [] };
      group.count++;
      group.items.push(item);
      appGroups.set(app.key, group);
    }

    const sortedAppGroups = [...appGroups.values()].sort((a, b) => b.count - a.count);
    const maxAppCount = Math.max(...sortedAppGroups.map(x => x.count), 1);

    const selectionText = selectedHub
      ? `${(TECH_HUBS[selectedHub] || world.countries[selectedHub])?.name || selectedHub} · 清除筛选`
      : (selectedApp ? `${appGroups.get(selectedApp)?.app.name || selectedApp} · 清除应用筛选` : '全部应用 / 地区');
    $('map-selection').textContent = selectionText;
    $('map-list-title').textContent = `应用与连接分组 · ${displayItems.length} 条`;

    $('map-connections').innerHTML = sortedAppGroups.map(({ app, count, items: appItems }, index) => {
      const isSelected = selectedApp === app.key;
      const isTopApp = index === 0 && count > 1;
      const appPct = Math.round((count / (displayItems.length || 1)) * 100);
      const heatWidth = Math.max(8, Math.round((count / maxAppCount) * 100));
      const subItems = appItems.slice(0, 8).map(item => {
        const hub = resolveHub(item, mode);
        const status = item.closed ? '已关闭' : '🟢 活跃';
        const nodeText = item.node ? ` · ${esc(item.node)}` : (item.route === 'DIRECT' ? ' · 直连' : '');
        return `
          <div class="map-sub-item" data-connection="${esc(item.id)}">
            <div>
              <div style="font-weight:500; color:var(--text-primary);">${esc(item.host || '未知')}</div>
              <div style="font-size:10px; color:var(--text-muted);">${hub ? `${hub.flag} ${esc(hub.name)}` : '待定位'}${nodeText}</div>
            </div>
            <span style="font-size:10px; color:${item.closed ? 'var(--text-muted)' : '#10b981'}">${status}</span>
          </div>
        `;
      }).join('');

      return `
        <div class="map-app-card ${isSelected ? 'selected' : ''}" data-app="${esc(app.key)}">
          <div class="map-app-header">
            <div class="map-app-title"><span>${app.icon}</span> <span>${esc(app.name)}</span></div>
            <span class="map-app-badge ${isTopApp ? 'hot' : ''}">${isTopApp ? '🔥 ' : ''}${count} 条 (${appPct}%)</span>
          </div>
          <div style="padding:0 12px 6px;">
            <div class="map-heat-bar"><div class="map-heat-fill ${isTopApp ? 'hot' : ''}" style="width:${heatWidth}%"></div></div>
          </div>
          <div class="map-app-sublist">${subItems}</div>
        </div>
      `;
    }).join('') || '<p class="map-muted">暂无匹配连接。等待网络活动，或调整上方筛选条件。</p>';

    const msg = $('map-message');
    if (msg) {
      if (geoError) {
        msg.textContent = geoError;
        msg.hidden = false;
        if ($('map-retry')) $('map-retry').hidden = false;
      } else {
        msg.hidden = true;
        if ($('map-retry')) $('map-retry').hidden = true;
      }
    }
  }

  // Hover Popover Inspector with Traffic Heat Indicator
  function showPopover(e, hub, hItems, totalConnections = 0, maxHubCount = 1) {
    const pop = $('map-popover');
    if (!pop || !hub) return;
    const stage = $('map-stage-container').getBoundingClientRect();
    const x = e.clientX - stage.left;
    const y = e.clientY - stage.top;
    const count = hItems?.length || 0;
    const primary = hItems?.[0];
    const app = primary ? getAppCategory(primary) : null;
    const isLive = hItems ? hItems.some(x => !x.closed) : true;
    const sharePct = totalConnections ? Math.round((count / totalConnections) * 100) : 0;
    const isTop = count >= maxHubCount && count > 1;
    const isHot = (count / maxHubCount >= 0.38 || count >= 5) && count > 1;

    pop.innerHTML = `
      <div class="popover-header">
        <span style="font-size:18px">${hub.flag || '🌐'}</span>
        <div>
          <div class="popover-city">${esc(hub.name)} ${isTop ? '🔥' : (isHot ? '⚡️' : '')}</div>
          <div style="font-size:10px; color:#94a3b8">${esc(hub.city || '')}</div>
        </div>
      </div>
      <div class="popover-meta">
        <div>主要应用：<span class="active-tag">${app ? `${app.icon} ${esc(app.name)}` : '网络服务'}</span></div>
        <div>实时状态：<span style="color:${isLive ? '#10b981' : 'var(--text-muted)'}">${isLive ? '🟢 活跃数据传输中' : '⚪️ 已关闭/闲置'}</span></div>
        <div>流量热度：<span class="${isTop || isHot ? 'hot-tag' : ''}">${isTop ? '🔥 极高流量聚集' : (isHot ? '⚡️ 较活跃通信' : '常规负载')}${totalConnections ? ` · 占比 ${sharePct}%` : ''}</span></div>
        ${primary?.node ? `<div>出站代理：<span class="proxy-tag">${esc(primary.node)}</span></div>` : '<div>出站策略：<span>DIRECT 直连</span></div>'}
        ${primary?.remoteIP ? `<div>中继入口：<span>${esc(primary.remoteIP)}</span></div>` : ''}
        ${hItems ? `<div>并发连接：<strong style="color:#fff">${count}</strong> 条记录</div>` : ''}
      </div>
    `;
    pop.style.left = `${Math.min(stage.width - 150, Math.max(140, x))}px`;
    pop.style.top = `${Math.max(120, y)}px`;
    pop.hidden = false;
  }
  function hidePopover() {
    const pop = $('map-popover');
    if (pop) pop.hidden = true;
  }

  globalThis.TrafficMap = {
    init(stateReader, filteredReader, detail) {
      getState = stateReader; readFiltered = filteredReader; openDetail = detail;

      // Pan & Zoom Event Listeners (2D Flat Canvas)
      const stage = $('map-stage-container');
      if (stage) {
        stage.addEventListener('mousedown', e => {
          if (currentProjection === '3d') return; // Handled by 3D OrbitControls
          if (e.target.closest('.hud-btn') || e.target.closest('.map-hud-group') || e.target.closest('.map-legend') || e.target.closest('#map-popover')) return;
          isDragging = true;
          dragStart = { x: e.clientX, y: e.clientY };
          startViewBox = { x: viewBox.x, y: viewBox.y };
        });
        window.addEventListener('mousemove', e => {
          if (currentProjection === '3d' || !isDragging) return;
          const svg = $('map-svg');
          if (!svg) return;
          const rect = svg.getBoundingClientRect();
          const scaleX = viewBox.w / rect.width;
          const scaleY = viewBox.h / rect.height;
          const dx = (e.clientX - dragStart.x) * scaleX;
          const dy = (e.clientY - dragStart.y) * scaleY;
          viewBox.x = Math.max(-100, Math.min(1080 - viewBox.w + 100, startViewBox.x - dx));
          viewBox.y = Math.max(-50, Math.min(540 - viewBox.h + 50, startViewBox.y - dy));
          updateViewBox();
        });
        window.addEventListener('mouseup', () => { isDragging = false; });
        stage.addEventListener('wheel', e => {
          e.stopPropagation();
          if (currentProjection === '3d') {
            e.preventDefault();
            return; // Handled by 3D OrbitControls
          }
          e.preventDefault();
          const svg = $('map-svg');
          if (!svg) return;
          const rect = svg.getBoundingClientRect();
          const focalX = viewBox.x + (e.clientX - rect.left) * (viewBox.w / rect.width);
          const focalY = viewBox.y + (e.clientY - rect.top) * (viewBox.h / rect.height);
          const factor = e.deltaY < 0 ? 0.84 : 1.19;
          zoomMap(factor, focalX, focalY);
        }, { passive: false });
      }

      // HUD Projection Toggle & Auto-Rotate
      $('map-proj-3d')?.addEventListener('click', () => setProjection('3d'));
      $('map-proj-2d')?.addEventListener('click', () => setProjection('2d'));
      $('map-rotate-toggle')?.addEventListener('click', toggleAutoRotate);

      $('map-zoom-in')?.addEventListener('click', () => {
        if (currentProjection === '3d') zoomGlobe(0.78);
        else zoomMap(0.8);
      });
      $('map-zoom-out')?.addEventListener('click', () => {
        if (currentProjection === '3d') zoomGlobe(1.28);
        else zoomMap(1.25);
      });
      $('map-zoom-reset')?.addEventListener('click', () => {
        if (currentProjection === '3d') focusGlobeOnOrigin(true);
        else resetZoom();
      });

      // Sidebar collapse toggle (maximum width map mode)
      $('map-toggle-side')?.addEventListener('click', () => {
        const layout = $('map-layout');
        const btn = $('map-toggle-side');
        if (layout) {
          const collapsed = layout.classList.toggle('sidebar-collapsed');
          if (btn) btn.textContent = collapsed ? '⇤ 展开侧栏' : '⇥ 收起侧栏';
          setTimeout(resizeGlobe, 280);
        }
      });

      // Fullscreen mode toggle
      $('map-fullscreen')?.addEventListener('click', () => {
        const target = $('map-card') || $('view-map');
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          if (target.requestFullscreen) target.requestFullscreen();
          else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
        } else {
          if (document.exitFullscreen) document.exitFullscreen();
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
      });

      const onFullChange = () => {
        const isFull = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
        const btn = $('map-fullscreen');
        if (btn) btn.textContent = isFull ? '✕ 退出全屏' : '⛶ 全屏';
        setTimeout(resizeGlobe, 120);
      };
      document.addEventListener('fullscreenchange', onFullChange);
      document.addEventListener('webkitfullscreenchange', onFullChange);

      // Auto-resize Globe when container dimension changes
      if (typeof ResizeObserver === 'function' && $('map-stage-container')) {
        new ResizeObserver(() => resizeGlobe()).observe($('map-stage-container'));
      }
      window.addEventListener('resize', resizeGlobe);

      try {
        if ($('map-mode')) {
          $('map-mode').value = localStorage.getItem('map-display-mode') || 'target';
        }
      } catch {}

      ['map-mode', 'map-window', 'map-node'].forEach(id => {
        const el = $(id);
        if (!el) return;
        el.addEventListener('change', () => {
          if (id === 'map-mode') { try { localStorage.setItem('map-display-mode', el.value); } catch {} }
          render();
        });
      });

      $('map-locate-btn')?.addEventListener('click', () => requestLocation(true));
      $('map-origin-chip')?.addEventListener('click', () => requestLocation(true));

      // Search input filter
      $('map-search')?.addEventListener('input', e => {
        searchQuery = e.target.value.trim();
        render();
      });

      $('map-selection').addEventListener('click', () => {
        selectedHub = '';
        selectedApp = '';
        render();
      });

      // 2D Point hover & click
      const points = $('map-points');
      if (points) {
        points.addEventListener('click', e => {
          const target = e.target.closest('[data-hub]');
          if (target && target.dataset.hub !== '_origin') {
            selectedHub = selectedHub === target.dataset.hub ? '' : target.dataset.hub;
            render();
          }
        });
        points.addEventListener('mousemove', e => {
          const target = e.target.closest('[data-hub]');
          if (target) {
            const hId = target.dataset.hub;
            const hub = TECH_HUBS[hId] || (world?.countries?.[hId] ? { id: hId, name: world.countries[hId].name, city: world.countries[hId].name, flag: getFlag(hId) } : null);
            const state = getState();
            const hItems = [...state.connections.values()].filter(x => resolveHub(x, $('map-mode')?.value || 'target')?.id === hId);
            if (hub) showPopover(e, hub, hItems, lastTotalLocated, lastMaxCount);
          }
        });
        points.addEventListener('mouseleave', hidePopover);
      }

      // 2D Land click interaction (filter by clicked country territory)
      const land = $('map-land');
      if (land) {
        land.addEventListener('click', e => {
          const target = e.target.closest('[data-country]');
          if (target && target.dataset.country) {
            const cCode = target.dataset.country;
            selectedHub = selectedHub === cCode ? '' : cCode;
            render();
          }
        });
      }

      // App Card click
      $('map-connections').addEventListener('click', e => {
        const sub = e.target.closest('[data-connection]');
        if (sub) {
          openDetail(sub.dataset.connection);
          return;
        }
        const appCard = e.target.closest('[data-app]');
        if (appCard) {
          const appKey = appCard.dataset.app;
          selectedApp = selectedApp === appKey ? '' : appKey;
          render();
        }
      });

      $('map-retry').addEventListener('click', () => { geoError = ''; if (!world) loading = null; render(); });

      // Apply initial projection state
      setProjection(currentProjection, false);
      $('map-rotate-toggle')?.classList.toggle('active', autoRotateEnabled);

      setInterval(render, 2000);
    },
    render,
    clear() {
      selectedHub = '';
      selectedApp = '';
      searchQuery = '';
      locations.clear();
      resetZoom();
      lastArcsSig = '';
      lastRingsSig = '';
      lastHubsSig = '';
      lastCountrySig = '';
      if (globe) focusGlobeOnOrigin(true);
      render(true);
    }
  };
})();
