const $ = (selector) => document.querySelector(selector);
const toArray = (value) => Array.isArray(value) ? value : String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
const text = (value, fallback = '未提供') => value || fallback;

let beans = [];
let currentBean = null;
let mapInstance = null;
let mapMarker = null;

const accuracyLabels = {
  country: '國家層級',
  region: '產區層級',
  subregion: '子產區層級',
  farm: '莊園層級',
  unknown: '未確認'
};

const scoreLabels = {
  acidity: '酸質',
  sweetness: '甜感',
  bitterness: '苦感',
  body: '醇厚度',
  aroma: '香氣強度',
  aftertaste: '餘韻長度',
  fermentation: '發酵感',
  cleanCup: '乾淨度'
};

async function init() {
  try {
    const response = await fetch('/data/beans.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Cannot load beans.json');
    beans = (await response.json()).filter((bean) => bean.published !== false);
    renderBeanList();
    const slug = new URLSearchParams(window.location.search).get('bean');
    const initialBean = beans.find((bean) => bean.slug === slug) || beans[0];
    if (initialBean) renderBean(initialBean);
    else showEmptyState();
  } catch (error) {
    console.error(error);
    showEmptyState();
  }
}

function showEmptyState() {
  $('#emptyState').hidden = false;
  $('#beanCard').hidden = true;
}

function renderBeanList() {
  $('#beanCount').textContent = beans.length;
  $('#beanList').innerHTML = beans.map((bean, index) => `
    <button class="bean-button" data-index="${index}" type="button">
      <strong>${escapeHtml(bean.name)}</strong>
      <span>${escapeHtml([bean.origin?.country, bean.origin?.region, bean.coffee?.process].filter(Boolean).join(' · '))}</span>
    </button>
  `).join('');
  $('#beanList').addEventListener('click', (event) => {
    const button = event.target.closest('.bean-button');
    if (!button) return;
    const bean = beans[Number(button.dataset.index)];
    renderBean(bean, true);
  });
}

function renderBean(bean, pushState = false) {
  currentBean = bean;
  $('#emptyState').hidden = true;
  $('#beanCard').hidden = false;

  document.title = `${bean.name}｜Coffee Origin Card`;
  if (pushState) {
    const url = new URL(window.location.href);
    url.searchParams.set('bean', bean.slug);
    window.history.pushState({}, '', url);
  }

  document.querySelectorAll('.bean-button').forEach((button, index) => {
    button.classList.toggle('active', beans[index].slug === bean.slug);
  });

  $('#competitionLabel').textContent = bean.auction?.competition || 'Origin Card';
  $('#beanName').textContent = bean.name;
  $('#beanSubtitle').textContent = bean.subtitle || '';

  renderMeta('#heroMeta', [
    ['Country', bean.origin?.country],
    ['Region', bean.origin?.region],
    ['Process', bean.coffee?.process],
    ['Variety', bean.coffee?.variety],
    ['Score', bean.auction?.cuppingScore],
    ['Map', accuracyLabels[bean.origin?.mapAccuracy] || bean.origin?.mapAccuracy]
  ]);

  $('#originTitle').textContent = [bean.origin?.farm, bean.origin?.region, bean.origin?.country].filter(Boolean).join(', ');
  $('#originNotes').textContent = bean.origin?.notes || '';
  $('#mapAccuracy').textContent = `Map accuracy｜${accuracyLabels[bean.origin?.mapAccuracy] || '未確認'}${bean.sources?.officialSourceName ? `　Source｜${bean.sources.officialSourceName}` : ''}`;
  renderMap(bean);
  renderQr(bean);

  renderFacts('#coffeeFacts', [
    ['烘豆品牌 / 店家', bean.roaster],
    ['莊園 / 合作社', bean.origin?.farm],
    ['生產者', bean.origin?.producer],
    ['海拔', bean.origin?.altitude],
    ['品種', bean.coffee?.variety],
    ['處理法', bean.coffee?.process],
    ['烘焙度', bean.coffee?.roastLevel],
    ['採收年份', bean.coffee?.harvestYear],
    ['Lot 編號', bean.coffee?.lotNumber || bean.auction?.lotNumber],
    ['競賽 / 拍賣', bean.auction?.competition],
    ['類別', bean.auction?.category],
    ['排名', bean.auction?.rank]
  ]);

  renderTags('#flavorTags', bean.flavor?.officialNotes || []);
  $('#flavorDescription').textContent = bean.flavor?.description || '';
  renderFacts('#flavorFacts', [
    ['香氣', bean.flavor?.aroma],
    ['酸質', bean.flavor?.acidity],
    ['甜感', bean.flavor?.sweetness],
    ['苦感', bean.flavor?.bitterness],
    ['醇厚度', bean.flavor?.body],
    ['餘韻', bean.flavor?.aftertaste]
  ]);
  renderScores(bean.flavor?.scores || {});

  renderFacts('#brewFacts', [
    ['推薦沖煮方式', bean.brew?.method],
    ['粉水比', bean.brew?.ratio],
    ['水溫', bean.brew?.waterTemperature],
    ['研磨度', bean.brew?.grind],
    ['萃取時間', bean.brew?.time],
    ['推薦器具', bean.brew?.tools],
    ['適合飲用方式', bean.brew?.serving]
  ]);

  renderStory(bean.story || {});
  renderFacts('#sourceFacts', [
    ['官方資料來源', sourceLink(bean.sources?.officialSourceName, bean.sources?.officialSourceUrl)],
    ['杯測 / 品飲來源', bean.sources?.cuppingSource],
    ['是否包含個人品飲筆記', bean.sources?.personalTasting],
    ['是否包含 AI 推導內容', bean.sources?.aiDerivedContent],
    ['最後更新時間', bean.sources?.lastUpdated],
    ['人格分類依據', bean.personality?.basis]
  ], true);
}

function renderMap(bean) {
  const lat = Number(bean.origin?.latitude);
  const lng = Number(bean.origin?.longitude);
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);
  if (!mapInstance) {
    mapInstance = L.map('map', { scrollWheelZoom: false, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstance);
  }
  if (!hasCoordinates) {
    mapInstance.setView([0, 0], 2);
    if (mapMarker) mapMarker.remove();
    return;
  }
  const zoom = bean.origin?.mapAccuracy === 'farm' ? 12 : bean.origin?.mapAccuracy === 'country' ? 5 : 9;
  mapInstance.setView([lat, lng], zoom);
  if (mapMarker) mapMarker.remove();
  mapMarker = L.marker([lat, lng]).addTo(mapInstance).bindPopup(`<strong>${escapeHtml(bean.name)}</strong><br>${escapeHtml($('#originTitle').textContent)}`);
  setTimeout(() => mapInstance.invalidateSize(), 120);
}

function renderQr(bean) {
  const qrTarget = $('#qrCode');
  qrTarget.innerHTML = '';
  const url = new URL(window.location.href);
  url.searchParams.set('bean', bean.slug);
  if (window.QRCode) {
    new QRCode(qrTarget, {
      text: url.toString(),
      width: 140,
      height: 140,
      colorDark: '#2f241b',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    qrTarget.textContent = url.toString();
  }
}

function renderMeta(selector, rows) {
  const filtered = rows.filter(([, value]) => value);
  $(selector).innerHTML = filtered.map(([label, value]) => `
    <div class="meta-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
  `).join('');
}

function renderFacts(selector, rows, allowHtml = false) {
  const filtered = rows.filter(([, value]) => value !== undefined && value !== null && value !== '');
  $(selector).innerHTML = filtered.map(([label, value]) => `
    <div><dt>${escapeHtml(label)}</dt><dd>${allowHtml ? value : escapeHtml(value)}</dd></div>
  `).join('');
}

function renderTags(selector, tags) {
  $(selector).innerHTML = toArray(tags).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
}

function renderScores(scores) {
  $('#scoreBars').innerHTML = Object.entries(scoreLabels).map(([key, label]) => {
    const raw = Number(scores[key] || 0);
    const score = Math.min(5, Math.max(0, raw));
    return `
      <div class="score-item">
        <div class="score-label"><span>${label}</span><span>${score}/5</span></div>
        <div class="score-track"><div class="score-fill" style="width: ${(score / 5) * 100}%"></div></div>
      </div>
    `;
  }).join('');
}

function renderStory(story) {
  const rows = [
    ['產地背景', story.originBackground],
    ['莊園 / 生產者故事', story.producerStory],
    ['處理法說明', story.processingStory],
    ['系統推導說明', story.systemNote]
  ].filter(([, value]) => value);
  $('#storyBlocks').innerHTML = rows.map(([title, body]) => `
    <div class="story-block"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(body)}</p></div>
  `).join('');
}

function sourceLink(name, url) {
  if (!name && !url) return '';
  if (!url) return escapeHtml(name);
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(name || url)}</a>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[char]));
}

init();
