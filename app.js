import { getFirebaseConfig, collectionName } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getFirestore, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

let db;
let beans = [];

async function initFirebase() {
  const firebaseConfig = await getFirebaseConfig();
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}

const els = {
  select: document.getElementById('beanSelect'),
  status: document.getElementById('statusText'),
  empty: document.getElementById('emptyState'),
  card: document.getElementById('beanCard'),
  name: document.getElementById('beanName'),
  producer: document.getElementById('beanProducer'),
  scorePill: document.getElementById('scorePill'),
  score: document.getElementById('cuppingScore'),
  originReading: document.getElementById('originReading'),
  tagline: document.getElementById('receiptTagline'),
  flavorTags: document.getElementById('flavorTags'),
  colorPalette: document.getElementById('colorPalette'),
  mapWrap: document.getElementById('mapWrap'),
  mapCaption: document.getElementById('mapCaption'),
  originCurve: document.getElementById('originCurve'),
  microMeta: document.getElementById('microMeta'),
  coffeeSymbols: document.getElementById('coffeeSymbols'),
  flavorLedger: document.getElementById('flavorLedger'),
  overallVibe: document.getElementById('overallVibe'),
  overallNote: document.getElementById('overallNote'),
  sourceText: document.getElementById('sourceText'),
  qrImage: document.getElementById('qrImage'),
  shareLink: document.getElementById('shareLink')
};

function value(v, fallback = '—') {
  if (v === undefined || v === null || v === '') return fallback;
  return v;
}

function toArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string') return v.split(/[|,;，、\n]/).map(s => s.trim()).filter(Boolean);
  return [];
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function score5(raw, fallback = 3.5) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return clamp(n, 0, 5);
}

function percent(raw, fallback = 70) {
  const s = score5(raw, null);
  if (s === null) return fallback;
  return Math.round((s / 5) * 100);
}

function cssSafe(text) {
  return String(text ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function makeOriginReading(bean) {
  if (bean.storyOrigin) return bean.storyOrigin;
  const parts = [bean.region, bean.subRegion, bean.country].filter(Boolean).join('，');
  const process = value(bean.process, '未標示處理法');
  const variety = value(bean.variety, '未標示品種');
  const flavor = value(bean.officialFlavor, '尚未填寫官方風味');
  return `這支咖啡來自 ${parts || '尚未標示產地'}。以 ${variety} 與 ${process} 為主要線索，官方風味描述包含 ${flavor}。本段為依據資料欄位整理的產地摘要，建議搭配原始來源一起閱讀。`;
}

function makeTagline(bean) {
  if (bean.category) return `${bean.category} 的產地切片`;
  if (bean.process && bean.region) return `${bean.region} 的 ${bean.process} 風味輪廓`;
  if (bean.region) return `${bean.region} 的風味輪廓`;
  return '一張可以被查證的咖啡豆收據';
}

function renderFlavorTags(bean) {
  const items = [
    { icon: '☼', label: '香氣明亮', sub: '香氣', score: bean.aromaScore, fallback: 82 },
    { icon: '≋', label: '酸質輪廓', sub: '酸質', score: bean.acidityScore, fallback: 78 },
    { icon: '♡', label: '甜感厚度', sub: '甜感', score: bean.sweetnessScore, fallback: 84 },
    { icon: '△', label: '口感結構', sub: '醇厚', score: bean.bodyScore, fallback: 72 },
    { icon: '◇', label: '乾淨透明', sub: '乾淨度', score: bean.cleanScore, fallback: 80 },
    { icon: '—', label: '餘韻長度', sub: '餘韻', score: bean.aftertasteScore, fallback: 76 }
  ];

  els.flavorTags.innerHTML = items.map(item => {
    const p = percent(item.score, item.fallback);
    return `
      <div class="flavor-tag-row">
        <div class="tag-icon">${item.icon}</div>
        <div class="tag-copy">
          <strong>${item.label}</strong>
          <span>${item.sub}</span>
        </div>
        <div class="receipt-bar"><i style="width:${p}%"></i></div>
        <b>${p}%</b>
      </div>`;
  }).join('');
}

function paletteFor(bean) {
  const process = String(bean.process || '').toLowerCase();
  const flavor = String(bean.officialFlavor || '').toLowerCase();
  if (process.includes('natural') || process.includes('日曬')) {
    return [
      ['莓果酒紅', '#8A4B46'],
      ['熟果琥珀', '#C8844B'],
      ['深焙陰影', '#4B3D37']
    ];
  }
  if (process.includes('washed') || process.includes('水洗')) {
    return [
      ['花香霧綠', '#9BAF9F'],
      ['柑橘米杏', '#D8C29B'],
      ['茶感墨灰', '#4B4A44']
    ];
  }
  if (process.includes('anaerobic') || process.includes('厭氧') || flavor.includes('ferment')) {
    return [
      ['發酵玫瑰', '#B56D6F'],
      ['果皮琥珀', '#D1A15F'],
      ['可可棕黑', '#49362F']
    ];
  }
  return [
    ['咖啡紙白', '#F3EEE4'],
    ['烘焙杏褐', '#C7AA86'],
    ['產地深棕', '#4D382A']
  ];
}

function renderPalette(bean) {
  els.colorPalette.innerHTML = paletteFor(bean).map(([name, hex]) => `
    <div class="palette-row">
      <i style="background:${hex}"></i>
      <strong>${name}</strong>
      <span>${hex}</span>
    </div>`).join('');
}

function renderCurve(bean) {
  const values = [
    percent(bean.aromaScore, 75),
    percent(bean.acidityScore, 68),
    percent(bean.sweetnessScore, 82),
    percent(bean.bodyScore, 64),
    percent(bean.aftertasteScore, 78),
    percent(bean.cleanScore, 74)
  ];
  const points = values.map((v, i) => {
    const x = 8 + i * 18;
    const y = 78 - (v * 0.5);
    return `${x},${y}`;
  }).join(' ');
  els.originCurve.innerHTML = `
    <svg viewBox="0 0 110 70" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="receiptCurve" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#93aaa0" />
          <stop offset="0.5" stop-color="#d2bea1" />
          <stop offset="1" stop-color="#4b4a44" />
        </linearGradient>
      </defs>
      <polyline points="${points}" fill="none" stroke="url(#receiptCurve)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" />
      <line x1="8" y1="60" x2="100" y2="60" stroke="#d7cfc4" stroke-dasharray="2 3" />
    </svg>`;
}

function renderMap(bean) {
  const lat = Number(bean.latitude);
  const lng = Number(bean.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    els.mapWrap.innerHTML = `<div class="map-placeholder">尚未提供經緯度<br><small>可先以文字標示產區</small></div>`;
    els.mapCaption.textContent = `Map accuracy｜${value(bean.mapAccuracy, '未確認')}`;
    return;
  }
  const delta = 0.16;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join('%2C');
  const marker = `${lat}%2C${lng}`;
  els.mapWrap.innerHTML = `<iframe title="Origin map" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}" loading="lazy"></iframe>`;
  els.mapCaption.textContent = `${value(bean.region)} ${value(bean.country, '')}｜Map accuracy｜${value(bean.mapAccuracy, '未確認')}`;
}

function renderMicroMeta(bean) {
  const items = [
    ['產地', [bean.country, bean.region].filter(Boolean).join(' / ')],
    ['莊園', bean.farm],
    ['品種', bean.variety],
    ['處理法', bean.process],
    ['海拔', bean.altitude]
  ].filter(([, v]) => v);
  els.microMeta.innerHTML = items.map(([k, v]) => `<span>${cssSafe(k)}：${cssSafe(v)}</span>`).join('');
}

function renderSymbols(bean) {
  const flavors = toArray(bean.flavorNotes).slice(0, 3);
  const primaryFlavor = flavors[0] || String(bean.officialFlavor || '').split(/[，,]/)[0] || '風味線索';
  const symbols = [
    ['產地', bean.region ? `${bean.region} 的高地座標` : '尚未標示產地'],
    ['處理法', bean.process ? `${bean.process} 帶出的乾淨度與層次` : '尚未標示處理法'],
    ['風味', `${primaryFlavor} 作為第一個記憶點`]
  ];
  els.coffeeSymbols.innerHTML = symbols.map(([title, desc]) => `<li><strong>${cssSafe(title)}</strong><span>${cssSafe(desc)}</span></li>`).join('');
}

function renderLedger(bean) {
  const rows = [
    ['花果香氣', bean.aromaScore, 82],
    ['明亮酸質', bean.acidityScore, 78],
    ['甜感層次', bean.sweetnessScore, 84],
    ['醇厚口感', bean.bodyScore, 72],
    ['乾淨度', bean.cleanScore, 80],
    ['餘韻', bean.aftertasteScore, 76]
  ];
  els.flavorLedger.innerHTML = rows.map(([label, raw, fallback]) => {
    const p = percent(raw, fallback);
    const qty = Math.max(1, Math.round(p / 30));
    return `<tr><td>${label}</td><td>${qty}</td><td>${p}%</td></tr>`;
  }).join('');
}

function renderOverall(bean) {
  const process = String(bean.process || '').toLowerCase();
  if (process.includes('washed') || process.includes('水洗')) {
    els.overallVibe.textContent = '清澈花香型';
    els.overallNote.textContent = '以乾淨酸質、花香與透明感作為主要輪廓。';
    return;
  }
  if (process.includes('natural') || process.includes('日曬')) {
    els.overallVibe.textContent = '熟果甜感型';
    els.overallNote.textContent = '以果實甜感、發酵香氣與圓潤口感作為主要輪廓。';
    return;
  }
  if (process.includes('anaerobic') || process.includes('厭氧')) {
    els.overallVibe.textContent = '實驗發酵型';
    els.overallNote.textContent = '以強烈香氣、發酵層次與辨識度作為主要輪廓。';
    return;
  }
  els.overallVibe.textContent = bean.category || '產地風味型';
  els.overallNote.textContent = '依據產地、處理法與官方風味欄位整理。';
}

function beanUrl(bean) {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('bean', bean.slug || bean.id);
  return url.toString();
}

function renderBean(bean) {
  if (!bean) return;
  els.card.hidden = false;
  els.empty.hidden = true;

  els.name.textContent = value(bean.name, 'Untitled Coffee Bean');
  els.producer.textContent = [bean.farm, bean.producer].filter(Boolean).join('｜') || value(bean.producer, 'Producer not provided');
  if (bean.cuppingScore !== undefined && bean.cuppingScore !== '') {
    els.scorePill.hidden = false;
    els.score.textContent = bean.cuppingScore;
  } else {
    els.scorePill.hidden = true;
  }

  els.originReading.textContent = makeOriginReading(bean);
  els.tagline.textContent = makeTagline(bean);
  renderFlavorTags(bean);
  renderPalette(bean);
  renderMap(bean);
  renderCurve(bean);
  renderMicroMeta(bean);
  renderSymbols(bean);
  renderLedger(bean);
  renderOverall(bean);

  const sources = [bean.sourceUrl, bean.sourceOfficial, bean.sourceCupping, bean.sourcePersonal].filter(Boolean);
  els.sourceText.textContent = sources.length ? sources.join('｜') : '尚未填寫。';

  const share = beanUrl(bean);
  els.qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(share)}`;
  els.shareLink.href = share;
  els.shareLink.textContent = '掃描 / 開啟此咖啡收據';
}

function populateSelect() {
  els.select.innerHTML = beans.map((bean, index) => `<option value="${index}">${cssSafe(value(bean.name, 'Untitled'))}</option>`).join('');
  els.select.addEventListener('change', () => renderBean(beans[Number(els.select.value)]));
}

async function loadBeans() {
  try {
    const q = query(collection(db, collectionName), where('published', '==', true));
    const snapshot = await getDocs(q);
    beans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    beans.sort((a, b) => value(a.name, '').localeCompare(value(b.name, ''), 'zh-Hant'));

    if (!beans.length) {
      els.status.textContent = '沒有公開資料';
      els.empty.hidden = false;
      els.card.hidden = true;
      return;
    }

    populateSelect();
    const params = new URLSearchParams(window.location.search);
    const target = params.get('bean');
    const found = beans.findIndex(bean => bean.slug === target || bean.id === target);
    const targetIndex = found >= 0 ? found : 0;
    els.select.value = targetIndex;
    renderBean(beans[targetIndex]);
    els.status.textContent = `已載入 ${beans.length} 筆公開資料`;
  } catch (error) {
    console.error(error);
    els.status.textContent = '讀取失敗，請確認 Firestore Rules 與 Firebase 設定。';
    els.empty.hidden = false;
    els.empty.querySelector('p').textContent = error.message;
  }
}

initFirebase().then(loadBeans).catch(error => {
  console.error(error);
  els.status.textContent = 'Firebase 設定讀取失敗，請確認 Vercel Environment Variables。';
  els.empty.hidden = false;
  els.empty.querySelector('p').textContent = error.message;
});
