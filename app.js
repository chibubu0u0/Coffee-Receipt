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
  heroFacts: document.getElementById('heroFacts'),
  sections: document.getElementById('receiptSections'),
  download: document.getElementById('downloadImage')
};

function hasValue(v) {
  return !(v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0));
}

function value(v, fallback = '—') {
  return hasValue(v) ? v : fallback;
}

function toArray(v) {
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(/[|,;，、\n]/).map(s => s.trim()).filter(Boolean);
  return [];
}

function cssSafe(text) {
  return String(text ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function numericValue(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function flavorIcon(note) {
  const s = String(note || '').toLowerCase();
  if (/jasmine|rose|floral|flower|white flower|花|茉莉|玫瑰/.test(s)) return '✿';
  if (/tangerine|mandarin|citrus|orange|lemon|bergamot|grapefruit|柑|橘|檸檬|佛手柑/.test(s)) return '◌';
  if (/peach|guava|pineapple|raspberry|berry|apple|grape|fruit|桃|芭樂|鳳梨|莓|水果/.test(s)) return '●';
  if (/honey|caramel|sugar|syrup|molasses|甜|蜂蜜|焦糖|糖/.test(s)) return '◆';
  if (/tea|herb|lemongrass|mint|茶|草本|香茅|薄荷/.test(s)) return '≋';
  if (/chocolate|cocoa|cacao|nut|almond|hazelnut|巧克力|可可|堅果|杏仁/.test(s)) return '■';
  if (/spice|cinnamon|clove|pepper|香料|肉桂|胡椒/.test(s)) return '✦';
  if (/wine|rum|ferment|酒|發酵/.test(s)) return '◒';
  return '·';
}

function renderFlavorIcons(notes) {
  const list = notes.slice(0, 28);
  if (!list.length) return '';
  return `<div class="flavor-icon-list">${list.map(note => `
    <span class="flavor-icon-chip"><i aria-hidden="true">${cssSafe(flavorIcon(note))}</i><b>${cssSafe(note)}</b></span>`).join('')}
  </div>`;
}

function beanUrl(bean) {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('bean', bean.slug || bean.id);
  return url.toString();
}

function row(label, raw, note = '') {
  if (!hasValue(raw)) return '';
  return `<tr><th>${cssSafe(label)}</th><td>${cssSafe(raw)}</td>${note ? `<td>${cssSafe(note)}</td>` : ''}</tr>`;
}

function table(rows, withNote = false) {
  const body = rows.filter(Boolean).join('');
  if (!body) return '';
  return `<table class="facts-table ${withNote ? 'with-note' : ''}"><tbody>${body}</tbody></table>`;
}

function section(title, content) {
  if (!content || !String(content).trim()) return '';
  const number = String(section.count++).padStart(2, '0');
  return `
    <section class="receipt-section fact-section">
      <div class="section-line"><span>${cssSafe(title)}</span><span>${number}</span></div>
      ${content}
    </section>`;
}

function renderHeroFacts(bean) {
  const items = [
    bean.country,
    bean.region,
    bean.category,
    bean.lotNumber,
    hasValue(bean.cuppingScore) ? `${bean.cuppingScore} pts` : ''
  ].filter(hasValue);
  els.heroFacts.innerHTML = items.map(item => `<span>${cssSafe(item)}</span>`).join('');
}

function renderOriginSection(bean) {
  return section('產地與基本資料', table([
    row('國家', bean.country),
    row('產區', bean.region),
    row('子產區', bean.subregion),
    row('莊園 / 合作社', bean.farm),
    row('生產者', bean.producer),
    row('品種', bean.variety),
    row('處理法', bean.process),
    row('海拔', bean.altitude),
    row('烘焙度', bean.roastLevel)
  ]));
}

function renderAuctionSection(bean) {
  return section('競賽 / 拍賣資料', table([
    row('競賽 / 拍賣名稱', bean.competitionName),
    row('主題', bean.auctionTheme),
    row('類別', bean.category),
    row('Lot 編號', bean.lotNumber),
    row('Code', bean.code),
    row('排名', bean.rank),
    row('杯測分數', bean.cuppingScore),
    row('得標價格', [bean.bidPrice, bean.priceUnit].filter(Boolean).join(' ')),
    row('得標者', bean.winningBidder),
    row('Boxes', bean.boxes),
    row('Weight', hasValue(bean.weight) ? `${bean.weight} kg` : '')
  ]));
}

function renderOfficialFlavorSection(bean) {
  const notes = toArray(bean.flavorNotes);
  const displayNotes = notes.length ? notes : toArray(bean.officialFlavor);
  const parts = [];
  if (hasValue(bean.officialFlavor)) {
    parts.push(`<p class="actual-text">${cssSafe(bean.officialFlavor)}</p>`);
  }
  if (displayNotes.length) {
    parts.push(renderFlavorIcons(displayNotes));
  }
  return section('官方風味描述 / Tasting Notes', parts.join(''));
}

function renderCuppingSection(bean) {
  const rows = [
    row('Aroma 香氣', bean.aromaScore),
    row('Acidity 酸質', bean.acidityScore),
    row('Sweetness 甜感', bean.sweetnessScore),
    row('Bitterness 苦感', bean.bitternessScore),
    row('Body 醇厚度', bean.bodyScore),
    row('Aftertaste 餘韻', bean.aftertasteScore),
    row('Fermentation 發酵感', bean.fermentationScore),
    row('Clean Cup 乾淨度', bean.cleanScore)
  ];
  return section('杯測 / 感官數據', table(rows));
}

function renderProcessSection(bean) {
  return section('處理與沖煮資訊', table([
    row('處理法說明', bean.processNote),
    row('推薦沖煮法', bean.brewMethod),
    row('粉水比', bean.brewRatio),
    row('水溫', bean.brewTemp),
    row('研磨度', bean.grind),
    row('萃取時間', bean.brewTime)
  ]));
}

function renderStorySection(bean) {
  const parts = [];
  if (hasValue(bean.storyOrigin)) parts.push(`<div class="source-block"><strong>產地背景</strong><p>${cssSafe(bean.storyOrigin)}</p></div>`);
  if (hasValue(bean.storyProducer)) parts.push(`<div class="source-block"><strong>生產者 / 莊園資料</strong><p>${cssSafe(bean.storyProducer)}</p></div>`);
  return section('來源文字補充', parts.join(''));
}

function renderMapSection(bean) {
  const lat = numericValue(bean.latitude);
  const lng = numericValue(bean.longitude);
  const parts = [];

  if (lat !== null && lng !== null) {
    const delta = 0.16;
    const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join('%2C');
    const marker = `${lat}%2C${lng}`;
    parts.push(`<div class="receipt-map"><iframe title="Origin map" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}" loading="lazy"></iframe></div>`);
    parts.push(`<p class="tiny-text">Latitude：${cssSafe(lat)}｜Longitude：${cssSafe(lng)}｜Map accuracy：${cssSafe(value(bean.mapAccuracy, '未填寫'))}</p>`);
  } else if (hasValue(bean.mapAccuracy)) {
    parts.push(`<p class="actual-text">Map accuracy：${cssSafe(bean.mapAccuracy)}。來源或後台尚未提供經緯度，因此不顯示地圖。</p>`);
  }

  return section('產地地圖', parts.join(''));
}

function renderSourceSection(bean) {
  const sources = [
    ['來源網址', bean.sourceUrl],
    ['官方資料來源', bean.sourceOfficial],
    ['杯測 / 品飲來源', bean.sourceCupping],
    ['個人品飲筆記來源', bean.sourcePersonal]
  ].filter(([, v]) => hasValue(v));
  const share = beanUrl(bean);
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(share)}`;
  const sourceTable = table(sources.map(([k, v]) => row(k, v)));
  return section('資料來源 / QR Code', `
    ${sourceTable || '<p class="actual-text">尚未填寫資料來源。</p>'}
    <div class="qr-row factual-qr">
      <img src="${qr}" alt="QR Code" />
      <a href="${cssSafe(share)}">開啟此資料卡</a>
    </div>`);
}

function renderBean(bean) {
  if (!bean) return;
  els.card.hidden = false;
  els.empty.hidden = true;

  els.name.textContent = value(bean.name, 'Untitled Coffee Bean');
  els.producer.textContent = [bean.farm, bean.producer].filter(Boolean).join('｜') || value(bean.producer, 'Producer not provided');

  if (hasValue(bean.cuppingScore)) {
    els.scorePill.hidden = false;
    els.score.textContent = bean.cuppingScore;
  } else {
    els.scorePill.hidden = true;
  }

  renderHeroFacts(bean);
  if (els.download) {
    els.download.classList.remove('disabled');
    els.download.removeAttribute('aria-disabled');
  }
  section.count = 1;
  const sections = [
    renderOriginSection(bean),
    renderAuctionSection(bean),
    renderOfficialFlavorSection(bean),
    renderCuppingSection(bean),
    renderProcessSection(bean),
    renderStorySection(bean),
    renderMapSection(bean),
    renderSourceSection(bean)
  ].filter(Boolean).join('');
  els.sections.innerHTML = sections;
}

function loadHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    script.onload = () => resolve(window.html2canvas);
    script.onerror = () => reject(new Error('圖片下載工具載入失敗，請稍後再試。'));
    document.head.appendChild(script);
  });
}

async function downloadReceiptImage(event) {
  event.preventDefault();
  const bean = beans[Number(els.select.value)] || beans[0];
  if (!bean || els.card.hidden) return;

  const originalText = els.download.textContent;
  els.download.textContent = '產生圖片中…';
  els.download.classList.add('disabled');
  els.download.setAttribute('aria-disabled', 'true');
  els.card.classList.add('is-capturing');

  try {
    const html2canvas = await loadHtml2Canvas();
    let canvas;
    try {
      canvas = await html2canvas(els.card, {
        backgroundColor: '#fffdfa',
        scale: Math.min(2.5, Math.max(2, window.devicePixelRatio || 2)),
        useCORS: true,
        ignoreElements: el => el.tagName === 'IFRAME'
      });
    } catch (firstError) {
      canvas = await html2canvas(els.card, {
        backgroundColor: '#fffdfa',
        scale: 2,
        ignoreElements: el => el.tagName === 'IFRAME' || el.tagName === 'IMG'
      });
    }
    const link = document.createElement('a');
    link.download = `${(bean.slug || bean.id || 'coffee-receipt').replace(/[^a-z0-9-_一-龥]/gi, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    console.error(error);
    alert(error.message || '圖片下載失敗。');
  } finally {
    els.card.classList.remove('is-capturing');
    els.download.textContent = originalText;
    els.download.classList.remove('disabled');
    els.download.removeAttribute('aria-disabled');
  }
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

if (els.download) {
  els.download.addEventListener('click', downloadReceiptImage);
}

initFirebase().then(loadBeans).catch(error => {
  console.error(error);
  els.status.textContent = 'Firebase 設定讀取失敗，請確認 Vercel Environment Variables。';
  els.empty.hidden = false;
  els.empty.querySelector('p').textContent = error.message;
});
