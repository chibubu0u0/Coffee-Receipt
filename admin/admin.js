import { getFirebaseConfig, collectionName } from '../firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

let auth;
let db;

async function initFirebase() {
  const firebaseConfig = await getFirebaseConfig();
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

const els = {
  adminHeader: document.getElementById('adminHeader'),
  loginPanel: document.getElementById('loginPanel'),
  adminPanel: document.getElementById('adminPanel'),
  loginForm: document.getElementById('loginForm'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  loginMessage: document.getElementById('loginMessage'),
  userLabel: document.getElementById('userLabel'),
  logoutBtn: document.getElementById('logoutBtn'),
  newBeanBtn: document.getElementById('newBeanBtn'),
  beanList: document.getElementById('beanList'),
  beanForm: document.getElementById('beanForm'),
  editorTitle: document.getElementById('editorTitle'),
  saveMessage: document.getElementById('saveMessage'),
  deleteBtn: document.getElementById('deleteBtn'),
  resetBtn: document.getElementById('resetBtn'),
  csvFile: document.getElementById('csvFile'),
  importCsvBtn: document.getElementById('importCsvBtn'),
  importLog: document.getElementById('importLog'),
  downloadTemplateBtn: document.getElementById('downloadTemplateBtn'),
  quickUrl: document.getElementById('quickUrl'),
  parseUrlBtn: document.getElementById('parseUrlBtn'),
  quickText: document.getElementById('quickText'),
  parseTextBtn: document.getElementById('parseTextBtn'),
  aiParseUrlBtn: document.getElementById('aiParseUrlBtn'),
  aiParseTextBtn: document.getElementById('aiParseTextBtn'),
  quickCsv: document.getElementById('quickCsv'),
  parseCsvTextBtn: document.getElementById('parseCsvTextBtn'),
  quickImportLog: document.getElementById('quickImportLog'),
  quickPreview: document.getElementById('quickPreview'),
  applyPreviewBtn: document.getElementById('applyPreviewBtn'),
  savePreviewBtn: document.getElementById('savePreviewBtn'),
  saveAllPreviewBtn: document.getElementById('saveAllPreviewBtn')
};

let beans = [];
let activeId = '';
let quickPreviewBeans = [];

const fields = [
  'name','slug','country','region','subregion','farm','producer','variety','process','altitude','roastLevel','cuppingScore','published',
  'competitionName','auctionTheme','category','lotNumber','code','rank','bidPrice','priceUnit','winningBidder','boxes','weight',
  'officialFlavor','flavorNotes','tags',
  'acidityScore','sweetnessScore','bitternessScore','bodyScore','aromaScore','aftertasteScore','fermentationScore','cleanScore',
  'latitude','longitude','mapAccuracy',
  'brewMethod','brewRatio','brewTemp','grind','brewTime',
  'storyOrigin','storyProducer','processNote','sourceUrl','sourceOfficial','sourceCupping','sourcePersonal'
];

const numericFields = new Set([
  'cuppingScore','acidityScore','sweetnessScore','bitternessScore','bodyScore','aromaScore','aftertasteScore','fermentationScore','cleanScore',
  'latitude','longitude','boxes','weight'
]);
const arrayFields = new Set(['flavorNotes','tags']);

const headerAliases = {
  bean: 'name', beanName: 'name', title: 'name', coffee: 'name', coffeeName: 'name',
  lot: 'lotNumber', lotCode: 'lotNumber', lotNo: 'lotNumber', rankNo: 'rank',
  theme: 'auctionTheme', auction: 'competitionName', auctionName: 'competitionName', competition: 'competitionName',
  price: 'bidPrice', bid: 'bidPrice', winningPrice: 'bidPrice', bidder: 'winningBidder', winner: 'winningBidder',
  score: 'cuppingScore', cupping: 'cuppingScore', cupping_score: 'cuppingScore',
  flavor: 'officialFlavor', flavors: 'officialFlavor', officialFlavorDescription: 'officialFlavor',
  notes: 'flavorNotes', flavor_tags: 'flavorNotes',
  lat: 'latitude', lng: 'longitude', lon: 'longitude', long: 'longitude',
  url: 'sourceUrl', source: 'sourceOfficial', sourceURL: 'sourceUrl', sourceUrl: 'sourceUrl',
  subRegion: 'subregion', sub_area: 'subregion', map_accuracy: 'mapAccuracy',
  processMethod: 'process', processing: 'process'
};

function canonicalKey(header) {
  const trimmed = String(header || '').trim();
  if (!trimmed) return '';
  if (fields.includes(trimmed)) return trimmed;
  const camel = trimmed
    .replace(/^[\s_\-]+|[\s_\-]+$/g, '')
    .replace(/[\s_\-]+([a-zA-Z0-9])/g, (_, c) => c.toUpperCase());
  return headerAliases[trimmed] || headerAliases[camel] || camel;
}

function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseArray(text) {
  if (Array.isArray(text)) return text.filter(Boolean);
  return String(text || '').split(/[|,;\n]/).map(item => item.trim()).filter(Boolean);
}

function arrayToText(value) {
  return Array.isArray(value) ? value.join(', ') : (value || '');
}

function toBool(value) {
  if (typeof value === 'boolean') return value;
  const s = String(value || '').trim().toLowerCase();
  return ['true','1','yes','y','公開','是','published'].includes(s);
}

function cleanNumberText(value) {
  return String(value || '').replace(/[$,]/g, '').trim();
}

function normalizeBean(bean) {
  const normalized = { ...bean };

  arrayFields.forEach(field => {
    if (normalized[field] !== undefined) normalized[field] = parseArray(normalized[field]);
  });

  numericFields.forEach(field => {
    if (normalized[field] === undefined || normalized[field] === '') return;
    const n = Number(cleanNumberText(normalized[field]));
    if (Number.isFinite(n)) normalized[field] = n;
    else delete normalized[field];
  });

  if (normalized.published !== undefined) normalized.published = toBool(normalized.published);
  if (!normalized.slug && normalized.name) normalized.slug = slugify(normalized.name);

  Object.keys(normalized).forEach(key => {
    if (normalized[key] === '' || normalized[key] === null || normalized[key] === undefined) delete normalized[key];
  });

  return normalized;
}

function formToBean() {
  const data = new FormData(els.beanForm);
  const bean = {};
  fields.forEach(field => {
    const input = els.beanForm.elements[field];
    if (!input) return;
    if (field === 'published') {
      bean.published = input.checked;
      return;
    }
    let value = data.get(field);
    if (arrayFields.has(field)) {
      bean[field] = parseArray(value);
      return;
    }
    if (numericFields.has(field)) {
      if (value === '' || value === null) return;
      const n = Number(cleanNumberText(value));
      if (Number.isFinite(n)) bean[field] = n;
      return;
    }
    value = String(value || '').trim();
    if (value !== '') bean[field] = value;
  });
  if (!bean.slug && bean.name) bean.slug = slugify(bean.name);
  return bean;
}

function fillForm(bean = {}) {
  activeId = bean.id || '';
  els.beanForm.reset();
  els.beanForm.elements.id.value = activeId;
  fields.forEach(field => {
    const input = els.beanForm.elements[field];
    if (!input) return;
    if (field === 'published') {
      input.checked = Boolean(bean.published);
    } else if (arrayFields.has(field)) {
      input.value = arrayToText(bean[field]);
    } else {
      input.value = bean[field] ?? '';
    }
  });
  els.editorTitle.textContent = activeId ? `編輯：${bean.name || 'Untitled'}` : '新增咖啡豆';
  els.deleteBtn.hidden = !activeId;
  renderBeanList();
}

function status(message, isError = false) {
  els.saveMessage.textContent = message;
  els.saveMessage.style.color = isError ? '#8a2d20' : '';
  window.clearTimeout(status.timer);
  status.timer = window.setTimeout(() => {
    els.saveMessage.textContent = '';
  }, 5000);
}

function importStatus(message) {
  els.importLog.textContent = message;
}

function quickStatus(message) {
  els.quickImportLog.textContent = message;
  els.quickImportLog.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderBeanList() {
  if (!beans.length) {
    els.beanList.innerHTML = '<p class="muted">目前沒有資料。</p>';
    return;
  }
  els.beanList.innerHTML = beans.map(bean => `
    <button type="button" class="bean-item ${bean.id === activeId ? 'active' : ''}" data-id="${bean.id}">
      <strong>${bean.name || 'Untitled Coffee Bean'}</strong>
      <span>${bean.published ? '公開' : '未公開'}｜${[bean.country, bean.region, bean.process].filter(Boolean).join(' · ') || '尚未填寫'}</span>
    </button>
  `).join('');
  els.beanList.querySelectorAll('.bean-item').forEach(button => {
    button.addEventListener('click', () => {
      const bean = beans.find(item => item.id === button.dataset.id);
      if (bean) fillForm(bean);
    });
  });
}

async function loadBeans() {
  const snapshot = await getDocs(collection(db, collectionName));
  beans = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  beans.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant'));
  renderBeanList();
}

async function addBeanToFirestore(bean) {
  const normalized = normalizeBean(bean);
  if (!normalized.name) throw new Error('請至少填寫咖啡豆名稱。');
  const docRef = await addDoc(collection(db, collectionName), {
    ...normalized,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

async function saveBean(event) {
  event.preventDefault();
  try {
    const bean = formToBean();
    if (!bean.name) throw new Error('請至少填寫咖啡豆名稱。');

    if (activeId) {
      await updateDoc(doc(db, collectionName, activeId), {
        ...bean,
        updatedAt: serverTimestamp()
      });
      status('已更新 Firestore。前台重新整理後會看到最新資料。');
    } else {
      const docRef = await addDoc(collection(db, collectionName), {
        ...bean,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      activeId = docRef.id;
      els.beanForm.elements.id.value = activeId;
      status('已新增到 Firestore。');
    }
    await loadBeans();
    const saved = beans.find(bean => bean.id === activeId);
    if (saved) fillForm(saved);
  } catch (error) {
    console.error(error);
    status(error.message, true);
  }
}

async function deleteActiveBean() {
  if (!activeId) return;
  const bean = beans.find(item => item.id === activeId);
  const ok = window.confirm(`確定刪除「${bean?.name || activeId}」嗎？此動作無法復原。`);
  if (!ok) return;
  try {
    await deleteDoc(doc(db, collectionName, activeId));
    status('已刪除。');
    activeId = '';
    await loadBeans();
    fillForm({});
  } catch (error) {
    console.error(error);
    status(error.message, true);
  }
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some(value => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some(value => value.trim() !== '')) rows.push(row);
  return rows;
}

function rowToBean(headers, row) {
  const bean = {};
  headers.forEach((header, index) => {
    const key = canonicalKey(header);
    if (!key) return;
    const raw = row[index] ?? '';
    if (key === 'published') {
      bean.published = toBool(raw);
    } else if (arrayFields.has(key)) {
      bean[key] = String(raw || '').split(/[|;]/).map(item => item.trim()).filter(Boolean);
    } else if (numericFields.has(key)) {
      if (String(raw).trim() === '') return;
      const n = Number(cleanNumberText(raw));
      if (Number.isFinite(n)) bean[key] = n;
    } else {
      const value = String(raw || '').trim();
      if (value !== '') bean[key] = value;
    }
  });
  return normalizeBean(bean);
}

async function importCSV() {
  const file = els.csvFile.files?.[0];
  if (!file) {
    importStatus('請先選擇 CSV 檔案。');
    return;
  }
  try {
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error('CSV 至少需要標題列與一筆資料。');
    const headers = rows[0];
    let count = 0;
    importStatus('匯入中…\n');
    for (const row of rows.slice(1)) {
      const bean = rowToBean(headers, row);
      if (!bean.name) {
        els.importLog.textContent += '跳過一筆：沒有 name。\n';
        continue;
      }
      await addBeanToFirestore(bean);
      count += 1;
      els.importLog.textContent += `已匯入：${bean.name}\n`;
    }
    els.importLog.textContent += `完成，共匯入 ${count} 筆。`;
    await loadBeans();
  } catch (error) {
    console.error(error);
    importStatus(`匯入失敗：${error.message}`);
  }
}

function downloadCSVTemplate() {
  const headers = [
    'name','slug','country','region','subregion','farm','producer','variety','process','altitude','roastLevel','officialFlavor','flavorNotes','cuppingScore','competitionName','auctionTheme','category','lotNumber','code','bidPrice','priceUnit','winningBidder','boxes','weight','latitude','longitude','mapAccuracy','published','sourceUrl','sourceOfficial'
  ];
  const sample = [
    'GW-01 Hacienda La Esmeralda Geisha Washed','gw-01-hacienda-la-esmeralda-geisha-washed','Panama','Cañas Verdes','Nido region, Cañas Verdes','Hacienda La Esmeralda','Hacienda La Esmeralda','Geisha','Washed','2050 masl','',
    'Super floral, tangerine, mandarin, white peach, guava, jasmine, lemongrass, bergamot, pineapple, raspberry, citrus, honey, long aftertaste',
    'jasmine|bergamot|honey|white peach','98','Best of Panama 2025 Auction','Canvas of Terroir','Geisha Washed','GW-01','G652','30204','USD/kg','Julith Coffee','2','20','','','region','true','https://app.bestofpanama.auction/auction/canvas-of-terroir?product=3981','Best of Panama 2025 Auction product page'
  ];
  const csv = `${headers.join(',')}\n${sample.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')}\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'coffee-beans-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function findFirst(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return (match[1] || match[0]).trim();
  }
  return '';
}

function collectFlavorNotes(text) {
  const source = String(text || '').replace(/\u00a0/g, ' ');
  const match = source.match(/(?:flavou?r notes?|tasting notes?|official flavou?r|cup notes?)\s*[:：]\s*([^\n\r.。]{3,500})/i);
  if (!match) return [];
  return match[1]
    .split(/[,;，、|]/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 24);
}

function parseTextToBean(rawText, sourceUrl = '') {
  const text = String(rawText || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
  if (!text) throw new Error('請先貼上頁面文字。');

  const lower = text.toLowerCase();
  const notes = collectFlavorNotes(text);
  const lotNumber = findFirst(text, [/\b((?:GW|GN|V|VA|PN)-?\d{1,2})\b/i]);
  const cuppingScore = findFirst(text, [
    /(?:score|cupping score|cup score|points?)\s*[:：]?\s*(\d{2,3}(?:\.\d+)?)/i,
    /(\d{2,3}(?:\.\d+)?)\s*(?:points|pts)/i
  ]);
  const bidPrice = findFirst(text, [
    /(?:US\$|USD|\$)\s*([\d,]+(?:\.\d+)?)\s*\/\s*kg/i,
    /(?:price|bid|winning price)\s*[:：]?\s*(?:US\$|USD|\$)?\s*([\d,]+(?:\.\d+)?)/i
  ]);
  const winner = findFirst(text, [/(?:winner|winning bidder|buyer)\s*[:：]?\s*([^\n\r]+)/i]);
  const code = findFirst(text, [/(?:code)\s*[:：]?\s*([A-Z]\d{2,5})/i, /\b([A-Z]\d{3,4})\b/]);
  const altitude = findFirst(text, [/(\d{3,4}\s*(?:masl|m\.a\.s\.l\.|meters|metres|m))/i]);
  const boxes = findFirst(text, [/(?:boxes)\s*[:：]?\s*(\d+)/i]);
  const weight = findFirst(text, [/(?:weight)\s*[:：]?\s*([\d.]+)\s*(?:kg|kgs|kilograms)?/i]);

  const bean = {
    sourceUrl,
    published: false,
    sourceOfficial: sourceUrl ? `Imported from ${sourceUrl}` : 'Imported from pasted page text'
  };

  if (lotNumber) bean.lotNumber = lotNumber.toUpperCase().replace(/^(GW|GN|VA|PN)(\d)/i, '$1-$2');
  if (code) bean.code = code;
  if (cuppingScore) bean.cuppingScore = cuppingScore;
  if (bidPrice) bean.bidPrice = bidPrice;
  if (bidPrice) bean.priceUnit = 'USD/kg';
  if (winner) bean.winningBidder = winner.replace(/\s{2,}.*/, '').trim();
  if (altitude) bean.altitude = altitude;
  if (boxes) bean.boxes = boxes;
  if (weight) bean.weight = weight;

  if (/best of panama/i.test(text) || /bestofpanama/i.test(sourceUrl)) {
    bean.competitionName = 'Best of Panama 2025 Auction';
    if (/canvas of terroir/i.test(text) || /canvas-of-terroir/i.test(sourceUrl)) bean.auctionTheme = 'Canvas of Terroir';
    bean.country = 'Panama';
  }
  if (/geisha washed/i.test(text) || /^GW/i.test(bean.lotNumber || '')) bean.category = 'Geisha Washed';
  if (/geisha natural/i.test(text) || /^GN/i.test(bean.lotNumber || '')) bean.category = 'Geisha Natural';
  if (/varietal/i.test(text) || /^V/i.test(bean.lotNumber || '')) bean.category = bean.category || 'Varietals';

  if (/geisha/i.test(text)) bean.variety = 'Geisha';
  if (/washed/i.test(text)) bean.process = 'Washed';
  else if (/natural/i.test(text)) bean.process = 'Natural';
  else if (/honey/i.test(text)) bean.process = 'Honey';
  else if (/anaerobic/i.test(text)) bean.process = 'Anaerobic';

  if (/hacienda la esmeralda/i.test(text)) {
    bean.farm = 'Hacienda La Esmeralda';
    bean.producer = 'Hacienda La Esmeralda';
  }
  if (/cañas verdes|canas verdes/i.test(text)) bean.region = 'Cañas Verdes';
  else if (/boquete/i.test(text)) bean.region = 'Boquete';
  if (/nido region/i.test(text)) bean.subregion = 'Nido region, Cañas Verdes';

  const titleLine = findFirst(text, [
    /\b((?:GW|GN|V|VA|PN)-?\d{1,2}\s+[^\n\r]{8,120})/i,
    /(Hacienda\s+La\s+Esmeralda\s+Geisha\s+Washed)/i,
    /(Hacienda\s+La\s+Esmeralda[^\n\r]{0,80})/i
  ]);
  if (titleLine) bean.name = titleLine.replace(/\s{2,}/g, ' ').trim();
  if (!bean.name && bean.lotNumber && bean.farm && bean.variety) bean.name = `${bean.lotNumber} ${bean.farm} ${bean.variety} ${bean.process || ''}`.trim();

  if (notes.length) {
    bean.flavorNotes = notes;
    bean.officialFlavor = notes.join(', ');
  }

  if (/cool temperature/i.test(text) || /cold-temperature|cold temperature/i.test(text)) {
    bean.processNote = 'Cool Temperature Washed Fermentation with Climate Controlled Drying';
  }

  return normalizeBean(bean);
}

function renderQuickPreview() {
  const count = quickPreviewBeans.length;
  els.applyPreviewBtn.disabled = count === 0;
  els.savePreviewBtn.disabled = count === 0;
  els.saveAllPreviewBtn.disabled = count === 0;

  if (!count) {
    els.quickPreview.innerHTML = '';
    return;
  }

  els.quickPreview.innerHTML = quickPreviewBeans.map((bean, index) => `
    <article class="preview-item">
      <div>
        <strong>${bean.name || 'Untitled Coffee Bean'}</strong>
        <span>${[bean.country, bean.region, bean.process, bean.variety].filter(Boolean).join(' · ') || '尚未填寫基本資料'}</span>
      </div>
      <dl>
        <div><dt>分數</dt><dd>${bean.cuppingScore ?? '—'}</dd></div>
        <div><dt>Lot</dt><dd>${bean.lotNumber ?? '—'}</dd></div>
        <div><dt>價格</dt><dd>${bean.bidPrice ? `${bean.bidPrice} ${bean.priceUnit || ''}` : '—'}</dd></div>
        <div><dt>Published</dt><dd>${bean.published ? 'true' : 'false'}</dd></div>
      </dl>
      <div class="preview-actions">
        <button type="button" class="secondary" data-apply-preview="${index}">套用到表單</button>
        <button type="button" data-save-preview="${index}">儲存這筆</button>
      </div>
    </article>
  `).join('');

  els.quickPreview.querySelectorAll('[data-apply-preview]').forEach(button => {
    button.addEventListener('click', () => applyPreviewBean(Number(button.dataset.applyPreview)));
  });
  els.quickPreview.querySelectorAll('[data-save-preview]').forEach(button => {
    button.addEventListener('click', () => savePreviewBean(Number(button.dataset.savePreview)));
  });
}

function setQuickPreview(beansInput, message) {
  quickPreviewBeans = beansInput.map(bean => normalizeBean(bean)).filter(bean => bean.name);
  quickStatus(message || `已解析 ${quickPreviewBeans.length} 筆資料。請確認後再儲存。`);
  renderQuickPreview();
  document.querySelector('.quick-preview-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function applyPreviewBean(index = 0) {
  const bean = quickPreviewBeans[index];
  if (!bean) return;
  fillForm({ ...bean, id: '' });
  status('已套用到表單。請檢查後儲存。');
  document.querySelector('.editor-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function savePreviewBean(index = 0) {
  const bean = quickPreviewBeans[index];
  if (!bean) return;
  try {
    const id = await addBeanToFirestore(bean);
    quickStatus(`已儲存：${bean.name}\nDocument ID: ${id}`);
    await loadBeans();
  } catch (error) {
    console.error(error);
    quickStatus(`儲存失敗：${error.message}`);
  }
}

async function saveAllPreviewBeans() {
  if (!quickPreviewBeans.length) return;
  const ok = window.confirm(`確定要儲存 ${quickPreviewBeans.length} 筆資料到 Firestore 嗎？`);
  if (!ok) return;
  try {
    let count = 0;
    quickStatus('全部儲存中…\n');
    for (const bean of quickPreviewBeans) {
      await addBeanToFirestore(bean);
      count += 1;
      els.quickImportLog.textContent += `已儲存：${bean.name}\n`;
    }
    els.quickImportLog.textContent += `完成，共儲存 ${count} 筆。`;
    await loadBeans();
  } catch (error) {
    console.error(error);
    quickStatus(`儲存失敗：${error.message}`);
  }
}


async function aiParseImport(mode = 'text') {
  const url = els.quickUrl.value.trim();
  const text = els.quickText.value.trim();
  if (mode === 'url' && !url) {
    quickStatus('請先貼上 URL。');
    return;
  }
  if (mode === 'text' && !text) {
    quickStatus('請先貼上頁面文字。');
    return;
  }
  try {
    quickStatus(`AI 抽取${mode === 'url' ? '網址' : '文字'}中…這會消耗你的 OpenAI API 額度。`);
    const response = await fetch('/api/ai-parse-bean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, url, text })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.detail?.message || 'AI 抽取失敗。');
    const parsed = (data.beans || []).map(bean => normalizeBean(bean)).filter(bean => bean.name);
    if (!parsed.length) throw new Error('AI 沒有抽取到可用的咖啡豆資料。');
    setQuickPreview(parsed, `${data.message || 'AI 抽取完成。'}\n${data.note || '請確認欄位後再儲存。'}\nModel: ${data.model || 'default'}`);
  } catch (error) {
    console.error(error);
    quickStatus(`AI 抽取失敗：${error.message}\n請確認 Vercel 已設定 OPENAI_API_KEY，或改用規則抽取 / CSV 匯入。`);
  }
}

async function parseUrlImport() {
  const url = els.quickUrl.value.trim();
  if (!url) {
    quickStatus('請先貼上 URL。');
    return;
  }
  try {
    quickStatus('解析網址中…');
    const response = await fetch(`/api/parse-bean-url?url=${encodeURIComponent(url)}`, { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'URL 解析失敗。');
    const parsed = (data.beans || []).map(bean => normalizeBean(bean)).filter(bean => bean.name);
    if (!parsed.length) throw new Error('沒有從網址解析到可用資料。你可以改用「貼頁面文字解析」。');
    setQuickPreview(parsed, `${data.message || '網址解析完成。'}\n${data.note || '請確認欄位後再儲存。'}`);
  } catch (error) {
    console.error(error);
    quickStatus(`解析網址失敗：${error.message}\n建議：從網頁複製公開文字，貼到「貼頁面文字解析」。`);
  }
}

function parseTextImport() {
  try {
    const bean = parseTextToBean(els.quickText.value, els.quickUrl.value.trim());
    setQuickPreview([bean], '文字解析完成。系統只會根據貼上的文字與明顯欄位推測，請確認後再儲存。');
  } catch (error) {
    console.error(error);
    quickStatus(`文字解析失敗：${error.message}`);
  }
}

function parseCsvTextImport() {
  try {
    const rows = parseCSV(els.quickCsv.value);
    if (rows.length < 2) throw new Error('CSV 至少需要標題列與一筆資料。');
    const headers = rows[0];
    const parsed = rows.slice(1).map(row => rowToBean(headers, row)).filter(bean => bean.name);
    if (!parsed.length) throw new Error('沒有找到含 name 的資料列。');
    setQuickPreview(parsed, `CSV 解析完成，共 ${parsed.length} 筆。`);
  } catch (error) {
    console.error(error);
    quickStatus(`CSV 解析失敗：${error.message}`);
  }
}

function attachEventListeners() {
  els.loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    els.loginMessage.textContent = '登入中…';
    try {
      await signInWithEmailAndPassword(auth, els.email.value, els.password.value);
      els.loginMessage.textContent = '';
    } catch (error) {
      console.error(error);
      els.loginMessage.textContent = error.message;
    }
  });

  els.logoutBtn.addEventListener('click', () => signOut(auth));
  els.beanForm.addEventListener('submit', saveBean);
  els.deleteBtn.addEventListener('click', deleteActiveBean);
  els.resetBtn.addEventListener('click', () => fillForm({}));
  els.newBeanBtn.addEventListener('click', () => fillForm({}));
  els.importCsvBtn.addEventListener('click', importCSV);
  els.downloadTemplateBtn.addEventListener('click', downloadCSVTemplate);
  els.parseUrlBtn.addEventListener('click', parseUrlImport);
  els.parseTextBtn.addEventListener('click', parseTextImport);
  els.aiParseUrlBtn.addEventListener('click', () => aiParseImport('url'));
  els.aiParseTextBtn.addEventListener('click', () => aiParseImport('text'));
  els.parseCsvTextBtn.addEventListener('click', parseCsvTextImport);
  els.applyPreviewBtn.addEventListener('click', () => applyPreviewBean(0));
  els.savePreviewBtn.addEventListener('click', () => savePreviewBean(0));
  els.saveAllPreviewBtn.addEventListener('click', saveAllPreviewBeans);

  els.beanForm.elements.name.addEventListener('input', event => {
    const slugInput = els.beanForm.elements.slug;
    if (!activeId && !slugInput.value) slugInput.value = slugify(event.target.value);
  });
}

async function boot() {
  try {
    await initFirebase();
    attachEventListeners();

    onAuthStateChanged(auth, async user => {
      if (user) {
        document.body.classList.remove('admin-auth-locked');
        document.body.classList.add('admin-authenticated');
        els.adminHeader.hidden = false;
        els.loginPanel.hidden = true;
        els.adminPanel.hidden = false;
        els.userLabel.textContent = `登入中：${user.email}`;
        try {
          await loadBeans();
          fillForm({});
        } catch (error) {
          console.error(error);
          status(`讀取失敗：${error.message}`, true);
        }
      } else {
        document.body.classList.remove('admin-authenticated');
        document.body.classList.add('admin-auth-locked');
        els.adminHeader.hidden = true;
        els.loginPanel.hidden = false;
        els.adminPanel.hidden = true;
      }
    });
  } catch (error) {
    console.error(error);
    els.loginMessage.textContent = `Firebase 設定讀取失敗：${error.message}`;
  }
}

boot();
