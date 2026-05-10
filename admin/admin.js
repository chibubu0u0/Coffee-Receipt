const $ = (selector) => document.querySelector(selector);
const editor = $('#editor');
const jsonOutput = $('#jsonOutput');
let beans = [];
let currentIndex = 0;

const arrayFields = new Set([
  'flavor.officialNotes',
  'tags.flavorFamily',
  'tags.texture',
  'tags.context'
]);

const numberFields = new Set([
  'origin.latitude',
  'origin.longitude',
  'flavor.scores.acidity',
  'flavor.scores.sweetness',
  'flavor.scores.bitterness',
  'flavor.scores.body',
  'flavor.scores.aroma',
  'flavor.scores.aftertaste',
  'flavor.scores.fermentation',
  'flavor.scores.cleanCup'
]);

async function init() {
  try {
    const response = await fetch('/data/beans.json', { cache: 'no-store' });
    beans = await response.json();
  } catch (error) {
    console.warn('Cannot load data/beans.json, starting with blank data.', error);
    beans = [createBlankBean()];
  }
  if (!Array.isArray(beans) || beans.length === 0) beans = [createBlankBean()];
  renderList();
  loadBean(0);
  bindEvents();
  updateOutput();
}

function bindEvents() {
  $('#newBeanBtn').addEventListener('click', () => {
    saveCurrentFromForm();
    beans.unshift(createBlankBean());
    currentIndex = 0;
    renderList();
    loadBean(0);
  });

  $('#duplicateBtn').addEventListener('click', () => {
    saveCurrentFromForm();
    const clone = structuredClone(beans[currentIndex]);
    clone.name = `${clone.name || 'Untitled'} Copy`;
    clone.slug = `${clone.slug || slugify(clone.name)}-copy-${Date.now().toString().slice(-4)}`;
    beans.splice(currentIndex + 1, 0, clone);
    currentIndex += 1;
    renderList();
    loadBean(currentIndex);
  });

  $('#deleteBtn').addEventListener('click', () => {
    if (beans.length <= 1) {
      alert('至少保留一筆資料。');
      return;
    }
    const ok = confirm('確定要刪除目前這筆資料嗎？');
    if (!ok) return;
    beans.splice(currentIndex, 1);
    currentIndex = Math.max(0, currentIndex - 1);
    renderList();
    loadBean(currentIndex);
  });

  $('#exportBtn').addEventListener('click', () => {
    saveCurrentFromForm();
    updateOutput();
    downloadJson();
  });

  $('#copyBtn').addEventListener('click', async () => {
    saveCurrentFromForm();
    updateOutput();
    await navigator.clipboard.writeText(jsonOutput.value);
    alert('JSON 已複製。');
  });

  $('#previewBtn').addEventListener('click', () => {
    saveCurrentFromForm();
    updateOutput();
  });

  $('#importInput').addEventListener('change', importJson);

  editor.addEventListener('submit', (event) => {
    event.preventDefault();
    saveCurrentFromForm();
    renderList();
    updateOutput();
    alert('已儲存到瀏覽器暫存資料。記得匯出 beans.json 並上傳到 GitHub。');
  });

  editor.addEventListener('input', (event) => {
    if (event.target.name === 'name' && !editor.elements.slug.value) {
      editor.elements.slug.value = slugify(event.target.value);
    }
  });
}

function createBlankBean() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    slug: `new-coffee-${Date.now().toString().slice(-6)}`,
    published: true,
    name: 'New Coffee Bean',
    subtitle: '',
    roaster: '',
    origin: {
      country: '',
      region: '',
      subregion: '',
      farm: '',
      producer: '',
      altitude: '',
      latitude: '',
      longitude: '',
      mapAccuracy: 'unknown',
      notes: ''
    },
    coffee: {
      variety: '',
      process: '',
      roastLevel: '',
      roastDate: '',
      harvestYear: '',
      lotNumber: ''
    },
    auction: {
      competition: '',
      theme: '',
      category: '',
      rank: '',
      cuppingScore: '',
      winningBid: '',
      winner: '',
      auctionDate: ''
    },
    flavor: {
      officialNotes: [],
      description: '',
      aroma: '',
      acidity: '',
      sweetness: '',
      bitterness: '',
      body: '',
      aftertaste: '',
      scores: {
        acidity: 0,
        sweetness: 0,
        bitterness: 0,
        body: 0,
        aroma: 0,
        aftertaste: 0,
        fermentation: 0,
        cleanCup: 0
      }
    },
    brew: {
      method: '',
      ratio: '',
      waterTemperature: '',
      grind: '',
      time: '',
      tools: '',
      serving: ''
    },
    story: {
      originBackground: '',
      producerStory: '',
      processingStory: '',
      systemNote: ''
    },
    sources: {
      officialSourceName: '',
      officialSourceUrl: '',
      cuppingSource: '',
      personalTasting: 'No',
      aiDerivedContent: 'No',
      lastUpdated: today
    },
    tags: {
      flavorFamily: [],
      texture: [],
      context: [],
      level: ''
    },
    personality: {
      type: '',
      basis: '',
      description: ''
    }
  };
}

function renderList() {
  $('#adminList').innerHTML = beans.map((bean, index) => `
    <button class="bean-button ${index === currentIndex ? 'active' : ''}" data-index="${index}" type="button">
      <strong>${escapeHtml(bean.name || 'Untitled')}</strong>
      <span>${escapeHtml(bean.slug || '')}${bean.published === false ? ' · hidden' : ''}</span>
    </button>
  `).join('');

  $('#adminList').querySelectorAll('.bean-button').forEach((button) => {
    button.addEventListener('click', () => {
      saveCurrentFromForm();
      currentIndex = Number(button.dataset.index);
      renderList();
      loadBean(currentIndex);
    });
  });
}

function loadBean(index) {
  currentIndex = index;
  const bean = beans[index] || createBlankBean();
  [...editor.elements].forEach((element) => {
    if (!element.name) return;
    const value = getDeep(bean, element.name);
    if (arrayFields.has(element.name)) {
      element.value = Array.isArray(value) ? value.join(', ') : value || '';
    } else if (element.name === 'published') {
      element.value = String(value !== false);
    } else {
      element.value = value ?? '';
    }
  });
  updateOutput();
}

function saveCurrentFromForm() {
  const bean = structuredClone(beans[currentIndex] || createBlankBean());
  [...editor.elements].forEach((element) => {
    if (!element.name) return;
    let value = element.value.trim();
    if (arrayFields.has(element.name)) {
      value = value.split(',').map((item) => item.trim()).filter(Boolean);
    } else if (numberFields.has(element.name)) {
      value = value === '' ? '' : Number(value);
    } else if (element.name === 'published') {
      value = value === 'true';
    }
    setDeep(bean, element.name, value);
  });
  if (!bean.slug) bean.slug = slugify(bean.name || `coffee-${Date.now()}`);
  beans[currentIndex] = bean;
}

function updateOutput() {
  jsonOutput.value = JSON.stringify(beans, null, 2);
}

function downloadJson() {
  const blob = new Blob([jsonOutput.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'beans.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('JSON 必須是陣列格式。');
    beans = data;
    currentIndex = 0;
    renderList();
    loadBean(0);
    updateOutput();
  } catch (error) {
    alert(`匯入失敗：${error.message}`);
  } finally {
    event.target.value = '';
  }
}

function getDeep(object, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], object);
}

function setDeep(object, path, value) {
  const keys = path.split('.');
  let target = object;
  keys.slice(0, -1).forEach((key) => {
    if (!target[key] || typeof target[key] !== 'object') target[key] = {};
    target = target[key];
  });
  target[keys.at(-1)] = value;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `coffee-${Date.now().toString().slice(-6)}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[char]));
}

init();
