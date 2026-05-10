let beans = [];
let map;
let marker;
let circle;

const $ = (id) => document.getElementById(id);

const labels = {
  acidity: '酸質',
  sweetness: '甜感',
  bitterness: '苦感',
  body: '醇厚度',
  aroma: '香氣',
  aftertaste: '餘韻',
  fermentation: '發酵感',
  cleanCup: '乾淨度'
};

const accuracyText = {
  country: '國家層級：僅能代表國家，不代表精確產區或莊園位置。',
  region: '產區層級：標註為產區大致位置，非精確莊園座標。',
  subregion: '子產區層級：標註為較細地區位置，但仍可能不是莊園座標。',
  farm: '莊園層級：使用莊園、處理廠或合作社可查證座標。',
  unknown: '未確認：目前沒有足夠資料標示地圖位置。'
};

async function loadBeans() {
  try {
    const response = await fetch('./data/beans.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load beans.json');
    beans = await response.json();
    setupSelector();
    const fromUrl = new URLSearchParams(window.location.search).get('bean');
    const selected = beans.find((bean) => bean.slug === fromUrl) || beans[0];
    renderBean(selected);
  } catch (error) {
    console.error(error);
    $('beanName').textContent = '資料載入失敗';
    $('beanSubtitle').textContent = '請確認 data/beans.json 是否存在，且 JSON 格式正確。';
  }
}

function setupSelector() {
  const select = $('beanSelect');
  select.innerHTML = '';
  beans.forEach((bean) => {
    const option = document.createElement('option');
    option.value = bean.slug;
    option.textContent = bean.name;
    select.appendChild(option);
  });
  select.addEventListener('change', () => {
    const bean = beans.find((item) => item.slug === select.value);
    if (!bean) return;
    const url = new URL(window.location.href);
    url.searchParams.set('bean', bean.slug);
    window.history.replaceState({}, '', url);
    renderBean(bean);
  });
}

function renderBean(bean) {
  $('beanSelect').value = bean.slug;
  $('beanName').textContent = bean.name || '未命名咖啡豆';
  $('beanSubtitle').textContent = `${safe(bean.origin?.country)} · ${safe(bean.origin?.region)} · ${safe(bean.process)}`;
  $('roaster').textContent = safe(bean.roaster);
  $('process').textContent = safe(bean.process);
  $('roastLevel').textContent = safe(bean.roast?.level);
  $('altitude').textContent = safe(bean.origin?.altitude);

  renderTags('heroTags', bean.tags || []);

  $('country').textContent = safe(bean.origin?.country);
  $('region').textContent = safe(bean.origin?.region);
  $('subRegion').textContent = safe(bean.origin?.subRegion);
  $('farm').textContent = safe(bean.origin?.farm);
  $('producer').textContent = safe(bean.origin?.producer);
  $('variety').textContent = safe(bean.variety);
  $('originStory').textContent = safe(bean.story?.origin);
  $('accuracyNote').textContent = accuracyText[bean.map?.accuracy] || accuracyText.unknown;

  $('officialNotes').textContent = Array.isArray(bean.flavor?.officialNotes)
    ? bean.flavor.officialNotes.join(' / ')
    : safe(bean.flavor?.officialNotes);
  renderFlavorNotes(bean.flavor?.officialNotes || []);
  renderFlavorChart(bean.flavor?.scores || {});
  $('personaText').textContent = buildPersona(bean.flavor?.scores || {}, bean);

  $('brewMethod').textContent = safe(bean.brew?.method);
  $('brewRatio').textContent = safe(bean.brew?.ratio);
  $('brewTemp').textContent = safe(bean.brew?.temperature);
  $('brewGrind').textContent = safe(bean.brew?.grind);
  $('brewTime').textContent = safe(bean.brew?.time);
  $('brewTool').textContent = safe(bean.brew?.tool);
  $('brewNote').textContent = safe(bean.brew?.note);

  $('officialSource').textContent = safe(bean.sources?.official);
  $('tastingSource').textContent = safe(bean.sources?.tasting);
  $('aiDisclosure').textContent = bean.sources?.aiDerived ? '包含系統推導欄位，請與真實資料分開標示。' : '未標示 AI 推導內容。';
  $('lastUpdated').textContent = safe(bean.sources?.lastUpdated);

  renderMap(bean);
  renderQr(bean);
}

function renderTags(targetId, tags) {
  const target = $(targetId);
  target.innerHTML = '';
  tags.forEach((tag) => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = tag;
    target.appendChild(span);
  });
}

function renderFlavorNotes(notes) {
  const target = $('flavorNotes');
  target.innerHTML = '';
  if (!Array.isArray(notes) || notes.length === 0) {
    target.textContent = '尚未填寫風味筆記。';
    return;
  }
  notes.forEach((note) => {
    const span = document.createElement('span');
    span.className = 'flavor-note';
    span.textContent = note;
    target.appendChild(span);
  });
}

function renderFlavorChart(scores) {
  const chart = $('flavorChart');
  chart.innerHTML = '';
  Object.entries(labels).forEach(([key, label]) => {
    const value = clamp(Number(scores[key] || 0), 0, 5);
    const row = document.createElement('div');
    row.className = 'flavor-row';
    row.innerHTML = `
      <span>${label}</span>
      <div class="flavor-bar" aria-label="${label} ${value} / 5"><span style="width: ${(value / 5) * 100}%"></span></div>
      <strong>${value}/5</strong>
    `;
    chart.appendChild(row);
  });
}

function renderMap(bean) {
  const lat = Number(bean.map?.lat);
  const lng = Number(bean.map?.lng);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);
  const label = bean.map?.label || `${safe(bean.origin?.region)}, ${safe(bean.origin?.country)}`;
  $('mapLabel').textContent = hasLocation ? `📍 ${label}` : '尚未提供可標註座標';
  $('mapAccuracy').textContent = accuracyLabel(bean.map?.accuracy);

  if (!map && window.L) {
    map = L.map('map', {
      scrollWheelZoom: false,
      zoomControl: true
    }).setView([20, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
  }

  if (!map) return;

  if (marker) marker.remove();
  if (circle) circle.remove();

  if (!hasLocation) {
    map.setView([20, 0], 2);
    return;
  }

  const zoom = bean.map?.accuracy === 'farm' ? 11 : bean.map?.accuracy === 'subregion' ? 9 : 7;
  map.setView([lat, lng], zoom);
  marker = L.marker([lat, lng]).addTo(map).bindPopup(`<strong>${escapeHtml(label)}</strong><br>${escapeHtml(accuracyLabel(bean.map?.accuracy))}`);

  const radius = bean.map?.accuracy === 'farm' ? 3000 : bean.map?.accuracy === 'subregion' ? 12000 : 30000;
  circle = L.circle([lat, lng], {
    radius,
    color: '#5f3b25',
    weight: 1,
    fillColor: '#d8b98a',
    fillOpacity: 0.18
  }).addTo(map);

  setTimeout(() => map.invalidateSize(), 80);
}

function renderQr(bean) {
  const target = $('qrCode');
  target.innerHTML = '';
  const url = new URL(window.location.href);
  url.searchParams.set('bean', bean.slug);
  $('qrCaption').textContent = 'QR Code 會連到目前這張咖啡豆資料卡。部署後請用正式網址重新整理。';

  if (window.QRCode?.toCanvas) {
    const canvas = document.createElement('canvas');
    target.appendChild(canvas);
    window.QRCode.toCanvas(canvas, url.href, {
      width: 210,
      margin: 1,
      color: {
        dark: '#201812',
        light: '#fff7e9'
      }
    });
  } else {
    target.textContent = 'QR Code library not loaded';
  }
}

function buildPersona(scores, bean) {
  const acidity = Number(scores.acidity || 0);
  const aroma = Number(scores.aroma || 0);
  const body = Number(scores.body || 0);
  const fermentation = Number(scores.fermentation || 0);
  const cleanCup = Number(scores.cleanCup || 0);
  const sweetness = Number(scores.sweetness || 0);

  let type = 'Balanced Daily Type';
  let reason = '整體分數較平均，適合做為日常飲用型資料卡。';

  if (fermentation >= 4) {
    type = 'Experimental Fermentation Type';
    reason = '發酵感分數較高，系統將它歸類為實驗型風味。';
  } else if (acidity >= 4 && aroma >= 4 && cleanCup >= 4) {
    type = 'Bright Floral Type';
    reason = '酸質、香氣與乾淨度較高，系統將它歸類為明亮花果型。';
  } else if (body >= 4 && sweetness >= 4) {
    type = 'Sweet Comfort Type';
    reason = '甜感與醇厚度較高，系統將它歸類為溫潤甜感型。';
  }

  return `${type}｜${reason}（此欄位為系統根據分數推導，非官方資料。）`;
}

function accuracyLabel(value) {
  const map = {
    country: '國家層級',
    region: '產區層級',
    subregion: '子產區層級',
    farm: '莊園層級',
    unknown: '未確認'
  };
  return map[value] || map.unknown;
}

function safe(value) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(string) {
  return String(string)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

loadBeans();
