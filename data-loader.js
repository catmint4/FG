/* ============================================================
   data-loader.js — Google 試算表版
   取代原本讀 data/YYYY-MM.csv 的做法。
   對 app.js 的介面完全不變：
     loadMonthlyFolder(name)  -> { "2026-08": {data:[...]}, ... }
     loadSingleFile(path)     -> { data:[...] }
   所以 app.js 一行都不用改。
   ============================================================ */

/* ① 把這裡換成你的試算表 ID（網址 /d/ 和 /edit 中間那一段） */
const SHEET_ID = "請貼上你的試算表ID";

/* ② 分頁名稱對應。左邊是 app.js 原本呼叫的資料夾名，右邊是試算表分頁名。 */
const SHEET_MAP = {
  'gsc-page':       'gsc_page',
  'gsc-query':      'gsc_query',
  'traffic-source': 'traffic_source',
  'pageview':       'traffic_source',   // 與來源表共用，app.js 會各取所需欄位
  'utm-buttons':    'utm_buttons',
  'banner-ads':     'banner_ads',
  'ai-assistant':   'ai_assistant',
  'gsc-aio':        'gsc_aio',
  'social':         'social',
  'classification': 'classification'
};

const MONTH_COL = '年月';   // 長表的月份欄位名
const _sheetCache = {};

function sheetUrl(tab) {
  return 'https://docs.google.com/spreadsheets/d/' + SHEET_ID +
         '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(tab);
}

/* 最小 CSV 解析器：支援引號、逗號、換行、跳脫雙引號 */
function _parseCSV(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const head = rows[0].map(h => h.replace(/^\uFEFF/, '').trim());
  return rows.slice(1)
    .filter(r => r.some(v => String(v).trim() !== ''))
    .map(r => { const o = {}; head.forEach((h, i) => o[h] = (r[i] ?? '').trim()); return o; });
}

async function fetchSheet(tab) {
  if (_sheetCache[tab]) return _sheetCache[tab];
  try {
    const res = await fetch(sheetUrl(tab), { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
    const rows = _parseCSV(await res.text());
    _sheetCache[tab] = rows;
    return rows;
  } catch (e) {
    console.warn('[data-loader] 讀取分頁失敗：' + tab, e);
    _sheetCache[tab] = [];
    return [];
  }
}

/* app.js 介面①：依「年月」欄把長表拆成 {月份: {data:[...]}} */
async function loadMonthlyFolder(folderName /*, fileNameFn 已不需要 */) {
  const tab = SHEET_MAP[folderName];
  if (!tab) { console.warn('[data-loader] 未對應的分頁：' + folderName); return {}; }
  const rows = await fetchSheet(tab);
  const byMonth = {};
  rows.forEach(r => {
    const m = (r[MONTH_COL] || '').trim();
    if (!/^\d{4}-\d{2}$/.test(m)) return;
    (byMonth[m] = byMonth[m] || { data: [] }).data.push(r);
  });
  return byMonth;
}

/* app.js 介面②：分類表等單一檔案 */
async function loadSingleFile(path) {
  const tab = path.includes('classification') ? SHEET_MAP['classification']
            : (SHEET_MAP[path] || path);
  return { data: await fetchSheet(tab) };
}

/* 讀 config 分頁，讓門檻可在試算表調整而不用改程式 */
async function loadConfig() {
  const rows = await fetchSheet('config');
  const cfg = {};
  rows.forEach(r => { if (r['參數']) cfg[r['參數']] = r['值']; });
  return cfg;
}

/* 以下兩個小工具：只有在其他檔案沒定義時才補上，避免覆蓋既有實作 */
if (typeof window.normUrl !== 'function') {
  window.normUrl = function (u) {
    if (!u) return '';
    let s = String(u).trim().replace(/[\u200b\u200c\u200d\ufeff]/g, '');
    s = s.replace(/^https?:\/\/[^/]+/, '');
    if (!s.startsWith('/')) s = '/' + s;
    return s.split('?')[0].split('#')[0].replace(/\/+$/, '');
  };
}
if (typeof window.toNum !== 'function') {
  window.toNum = function (v) {
    if (v === null || v === undefined) return 0;
    const n = parseFloat(String(v).replace(/[,%\s"]/g, ''));
    return isNaN(n) ? 0 : n;
  };
}
