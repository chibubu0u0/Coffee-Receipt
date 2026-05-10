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
  downloadTemplateBtn: document.getElementById('downloadTemplateBtn')
};

let beans = [];
let activeId = '';

const fields = [
  'name','slug','country','region','subregion','farm','producer','variety','process','altitude','roastLevel','cuppingScore','published',
  'competitionName','category','lotNumber','rank','bidPrice','winningBidder',
  'officialFlavor','flavorNotes','tags',
  'acidityScore','sweetnessScore','bitternessScore','bodyScore','aromaScore','aftertasteScore','fermentationScore','cleanScore',
  'latitude','longitude','mapAccuracy',
  'brewMethod','brewRatio','brewTemp','grind','brewTime',
  'storyOrigin','storyProducer','processNote','sourceOfficial','sourceCupping','sourcePersonal'
];

const numericFields = new Set(['cuppingScore','acidityScore','sweetnessScore','bitternessScore','bodyScore','aromaScore','aftertasteScore','fermentationScore','cleanScore','latitude','longitude']);
const arrayFields = new Set(['flavorNotes','tags']);

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
      const n = Number(value);
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
    const key = header.trim();
    if (!key) return;
    const raw = row[index] ?? '';
    if (key === 'published') {
      bean.published = toBool(raw);
    } else if (arrayFields.has(key)) {
      bean[key] = String(raw || '').split(/[|;]/).map(item => item.trim()).filter(Boolean);
    } else if (numericFields.has(key)) {
      if (String(raw).trim() === '') return;
      const n = Number(raw);
      if (Number.isFinite(n)) bean[key] = n;
    } else {
      const value = String(raw || '').trim();
      if (value !== '') bean[key] = value;
    }
  });
  if (!bean.slug && bean.name) bean.slug = slugify(bean.name);
  return bean;
}

async function importCSV() {
  const file = els.csvFile.files?.[0];
  if (!file) {
    els.importLog.textContent = '請先選擇 CSV 檔案。';
    return;
  }
  try {
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error('CSV 至少需要標題列與一筆資料。');
    const headers = rows[0];
    let count = 0;
    els.importLog.textContent = '匯入中…\n';
    for (const row of rows.slice(1)) {
      const bean = rowToBean(headers, row);
      if (!bean.name) {
        els.importLog.textContent += '跳過一筆：沒有 name。\n';
        continue;
      }
      await addDoc(collection(db, collectionName), {
        ...bean,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      count += 1;
      els.importLog.textContent += `已匯入：${bean.name}\n`;
    }
    els.importLog.textContent += `完成，共匯入 ${count} 筆。`;
    await loadBeans();
  } catch (error) {
    console.error(error);
    els.importLog.textContent = `匯入失敗：${error.message}`;
  }
}

function downloadCSVTemplate() {
  const headers = [
    'name','slug','country','region','farm','producer','variety','process','altitude','roastLevel','officialFlavor','flavorNotes','cuppingScore','latitude','longitude','mapAccuracy','published','sourceOfficial'
  ];
  const sample = [
    'Panama Geisha Demo','panama-geisha-demo','Panama','Boquete','Demo Farm','Demo Producer','Geisha','Washed','1600-1800m','Light','Jasmine, bergamot, honey','jasmine|bergamot|honey','90','8.779','-82.433','region','true','Best of Panama / Roaster info'
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
