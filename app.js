import { getFirebaseConfig, collectionName } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getFirestore, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

let db;

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
  beanCategory: document.getElementById('beanCategory'),
  name: document.getElementById('beanName'),
  subtitle: document.getElementById('beanSubtitle'),
  scorePill: document.getElementById('scorePill'),
  score: document.getElementById('cuppingScore'),
  chips: document.getElementById('flavorChips'),
  country: document.getElementById('country'),
  region: document.getElementById('region'),
  farm: document.getElementById('farm'),
  producer: document.getElementById('producer'),
  variety: document.getElementById('variety'),
  process: document.getElementById('process'),
  altitude: document.getElementById('altitude'),
  roastLevel: document.getElementById('roastLevel'),
  mapWrap: document.getElementById('mapWrap'),
  mapCaption: document.getElementById('mapCaption'),
  officialFlavor: document.getElementById('officialFlavor'),
  flavorBars: document.getElementById('flavorBars'),
  brewMethod: document.getElementById('brewMethod'),
  brewRatio: document.getElementById('brewRatio'),
  brewTemp: document.getElementById('brewTemp'),
  grind: document.getElementById('grind'),
  brewTime: document.getElementById('brewTime'),
  storyOrigin: document.getElementById('storyOrigin'),
  storyProducer: document.getElementById('storyProducer'),
  processNote: document.getElementById('processNote'),
  sourceText: document.getElementById('sourceText'),
  qrImage: document.getElementById('qrImage'),
  shareLink: document.getElementById('shareLink')
};

let beans = [];

function value(v, fallback = '—') {
  if (v === undefined || v === null || v === '') return fallback;
  return v;
}

function toArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string') return v.split(/[|,;\n]/).map(s => s.trim()).filter(Boolean);
  return [];
}

function scoreValue(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(5, n));
}

function renderBars(bean) {
  const items = [
    ['酸質', bean.acidityScore],
    ['甜感', bean.sweetnessScore],
    ['苦感', bean.bitternessScore],
    ['醇厚度', bean.bodyScore],
    ['香氣', bean.aromaScore],
    ['餘韻', bean.aftertasteScore],
    ['發酵感', bean.fermentationScore],
    ['乾淨度', bean.cleanScore]
  ];
  els.flavorBars.innerHTML = items.map(([label, raw]) => {
    const s = scoreValue(raw);
    const width = s === null ? 0 : (s / 5) * 100;
    return `<div class="bar-row"><span>${label}</span><div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div><strong>${s ?? '—'}</strong></div>`;
  }).join('');
}

function renderMap(bean) {
  const lat = Number(bean.latitude);
  const lng = Number(bean.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    els.mapWrap.innerHTML = `<div class="map-placeholder">尚未提供經緯度。<br>可以先用文字標示產區，避免假精準。</div>`;
    els.mapCaption.textContent = `地圖精準度：${value(bean.mapAccuracy, '未確認')}`;
    return;
  }
  const delta = 0.18;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join('%2C');
  const marker = `${lat}%2C${lng}`;
  els.mapWrap.innerHTML = `<iframe title="Origin map" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}" loading="lazy"></iframe>`;
  els.mapCaption.textContent = `${value(bean.region)} ${value(bean.country, '')}｜地圖精準度：${value(bean.mapAccuracy, '未確認')}`;
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

  els.beanCategory.textContent = bean.competitionName || bean.category || 'Origin Card';
  els.name.textContent = value(bean.name, 'Untitled Coffee Bean');
  els.subtitle.textContent = [bean.country, bean.region, bean.process, bean.variety].filter(Boolean).join(' · ');

  if (bean.cuppingScore !== undefined && bean.cuppingScore !== '') {
    els.scorePill.hidden = false;
    els.score.textContent = bean.cuppingScore;
  } else {
    els.scorePill.hidden = true;
  }

  const chips = [...toArray(bean.flavorNotes), ...toArray(bean.tags)].slice(0, 10);
  els.chips.innerHTML = chips.map(tag => `<span class="chip">${tag}</span>`).join('');

  ['country', 'region', 'farm', 'producer', 'variety', 'process', 'altitude', 'roastLevel'].forEach(key => {
    els[key].textContent = value(bean[key]);
  });

  els.officialFlavor.textContent = value(bean.officialFlavor, '尚未填寫官方風味描述。');
  renderBars(bean);
  renderMap(bean);

  els.brewMethod.textContent = value(bean.brewMethod);
  els.brewRatio.textContent = value(bean.brewRatio);
  els.brewTemp.textContent = value(bean.brewTemp);
  els.grind.textContent = value(bean.grind);
  els.brewTime.textContent = value(bean.brewTime);

  els.storyOrigin.textContent = value(bean.storyOrigin, '尚未填寫。');
  els.storyProducer.textContent = value(bean.storyProducer, '尚未填寫。');
  els.processNote.textContent = value(bean.processNote, '尚未填寫。');

  const sources = [bean.sourceOfficial, bean.sourceCupping, bean.sourcePersonal].filter(Boolean);
  els.sourceText.textContent = sources.length ? sources.join('｜') : '尚未填寫。';

  const share = beanUrl(bean);
  els.qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(share)}`;
  els.shareLink.href = share;
  els.shareLink.textContent = share;
}

function populateSelect() {
  els.select.innerHTML = beans.map((bean, index) => `<option value="${index}">${value(bean.name, 'Untitled')}</option>`).join('');
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
    const targetIndex = Math.max(0, beans.findIndex(bean => bean.slug === target || bean.id === target));
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
