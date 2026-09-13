// app.js — 主程式（v2：日期區間＋兩期比較、逐月趨勢、分類展開、圖表尺寸修正）

const INK="#1B2430", TEAL="#2F6F5E", GOLD="#C08A3E", RUST="#B5533C", SLATE="#5C7290", PLUM="#7A5C7E", MOSS="#7A8B5A", SAND="#D8C9A3", STONE="#8C97A6";
const CAT_COLORS = {"建案頁":RUST,"生活提案(其他)":SAND,"專家文章":PLUM,"建案熱區巡禮":MOSS,"其他頁面":STONE};
const CHAN_COLORS = {"LINE":"#06C755","Paid Search/Display":GOLD,"Direct":SLATE,"Organic Social":PLUM,"Organic Search":TEAL,"Other":STONE,"Unassigned":"#C2C2C2","Referral":SAND,"Paid Social":RUST};
const BIG_COLORS = {"稅務與繼承":TEAL,"不動產交易":SLATE,"區域環境":SAND,"建築與品牌":MOSS,"居住與維護":PLUM,"市場與政策":STONE,"商用不動產":GOLD};
const SITE_ORIGIN = "https://www.farglory-realty.com.tw";

function fmt(n){ return Math.round(n||0).toLocaleString('en-US'); }
function pct(n){ return (n>0?'+':'') + n.toFixed(1) + '%'; }
function hasChart(){ return typeof Chart !== 'undefined'; }
function linkFor(url){ return SITE_ORIGIN + url; }

function chartBox(id, heightPx){
  return `<div class="chart-box" style="height:${heightPx||220}px"><canvas id="${id}"></canvas></div>`;
}
function safeChart(canvasId, config){
  if(!hasChart()){
    const el = document.getElementById(canvasId);
    if(el) el.parentElement.replaceWith(Object.assign(document.createElement('div'), {className:'chart-fallback', textContent:'圖表庫尚未載入，僅顯示表格數字'}));
    return null;
  }
  config.options = config.options || {};
  config.options.responsive = true;
  config.options.maintainAspectRatio = false;
  return new Chart(document.getElementById(canvasId), config);
}

const TABS = [
  {id:'overview', label:'① 總覽'},
  {id:'traffic', label:'② 流量與來源'},
  {id:'keywords', label:'③ 進站關鍵字'},
  {id:'seo', label:'④ SEO文章與排名成效'},
  {id:'category', label:'④b 內容分類貢獻度'},
  {id:'monitor', label:'⑤ 內容健康監控'},
  {id:'aio', label:'⑥ AIO引用監測'},
  {id:'path', label:'⑦ 內容→建案路徑'},
  {id:'conversion', label:'⑧ 轉換與留單'},
  {id:'building', label:'⑨ 建案獨立分析'},
  {id:'social', label:'⑩ 自媒體'},
  {id:'guide', label:'📋 資料說明'}
];

let DATA = {};
let CLS_MAP = {};
let ALL_MONTHS = [];
let RANGE_A = {start:null, end:null};
let RANGE_B = null;

function buildShell(){
  const tabbar = document.getElementById('tabbar');
  TABS.forEach(t=>{ const b=document.createElement('button'); b.className='tabbtn'; b.textContent=t.label; b.dataset.id=t.id; b.onclick=()=>switchTab(t.id); tabbar.appendChild(b); });
  const main = document.getElementById('mainArea');
  TABS.forEach(t=>{ const div=document.createElement('div'); div.className='panel'; div.id='panel-'+t.id; main.appendChild(div); });
  switchTab('overview');
}
function switchTab(id){
  document.querySelectorAll('.tabbtn').forEach(b=>b.classList.toggle('active', b.dataset.id===id));
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active', p.id==='panel-'+id));
}
function renderEmpty(id, title, desc, needs){
  document.getElementById('panel-'+id).innerHTML = `
    <div class="panel-head"><h2>${title}</h2></div>
    <div class="empty-state"><div class="icon">🔲</div><h4>${desc}</h4>
    ${(needs||[]).map(n=>`<span class="need-tag">${n}</span>`).join('')}</div>`;
}
function panelHead(title, purpose, source, note){
  return `<div class="panel-head"><h2>${title}</h2>
    <div class="panel-q">目的：${purpose}</div>
    <div class="panel-desc">資料來源：${source}${note ? '　｜　'+note : ''}</div></div>`;
}
function monthsInRange(start, end){
  return ALL_MONTHS.filter(m => m >= start && m <= end);
}
function monthLabel(m){ return m.slice(2).replace('-','/'); }

function buildRangeBar(){
  const bar = document.getElementById('rangebar');
  if(!ALL_MONTHS.length){ bar.style.display='none'; return; }
  RANGE_A = { start: ALL_MONTHS[0], end: ALL_MONTHS[ALL_MONTHS.length-1] };
  const opts = ALL_MONTHS.map(m=>`<option value="${m}">${m}</option>`).join('');
  bar.innerHTML = `
    <div class="rangebar-group">
      <label>檢視期間</label>
      <select id="rangeAStart">${opts}</select><span>至</span><select id="rangeAEnd">${opts}</select>
    </div>
    <div class="rangebar-group">
      <label><input type="checkbox" id="compareToggle"> 比較另一段期間</label>
      <select id="rangeBStart" disabled>${opts}</select><span>至</span><select id="rangeBEnd" disabled>${opts}</select>
    </div>
    <button id="applyRangeBtn" class="apply-btn">套用</button>
  `;
  document.getElementById('rangeAEnd').value = ALL_MONTHS[ALL_MONTHS.length-1];
  document.getElementById('rangeBStart').value = ALL_MONTHS[0];
  document.getElementById('rangeBEnd').value = ALL_MONTHS[Math.max(0,Math.floor(ALL_MONTHS.length/2)-1)];
  document.getElementById('compareToggle').addEventListener('change', e=>{
    document.getElementById('rangeBStart').disabled = !e.target.checked;
    document.getElementById('rangeBEnd').disabled = !e.target.checked;
  });
  document.getElementById('applyRangeBtn').addEventListener('click', applyRange);
}
function applyRange(){
  RANGE_A = { start: document.getElementById('rangeAStart').value, end: document.getElementById('rangeAEnd').value };
  const compareOn = document.getElementById('compareToggle').checked;
  RANGE_B = compareOn ? { start: document.getElementById('rangeBStart').value, end: document.getElementById('rangeBEnd').value } : null;
  renderAll();
}

async function main(){
  buildShell();
  const [pageviewByMonth, trafficByMonth, gscQueryByMonth, gscPageByMonth, aiAssistByMonth,
         aioPagesByMonth, aioDailyByMonth, utmByMonth, bannerAdsByMonth, classificationRaw] = await Promise.all([
    loadMonthlyFolder('pageview'), loadMonthlyFolder('traffic-source'), loadMonthlyFolder('gsc-query'),
    loadMonthlyFolder('gsc-page'), loadMonthlyFolder('ai-assistant'),
    loadMonthlyFolder('gsc-aio', m => `${m}-pages.csv`), loadMonthlyFolder('gsc-aio', m => `${m}-daily.csv`),
    loadMonthlyFolder('utm-buttons'), loadMonthlyFolder('banner-ads'), loadSingleFile('data/classification/latest.csv')
  ]);
  DATA = { pageview:pageviewByMonth, traffic:trafficByMonth, kw:gscQueryByMonth, seo:gscPageByMonth,
            ai:aiAssistByMonth, aioPages:aioPagesByMonth, aioDaily:aioDailyByMonth, utm:utmByMonth, bannerAds:bannerAdsByMonth };
  CLS_MAP = buildClassificationMap(classificationRaw);

  const monthSet = new Set();
  Object.values(DATA).forEach(byMonth => Object.keys(byMonth).forEach(m=>monthSet.add(m)));
  ALL_MONTHS = Array.from(monthSet).sort();

  if(!ALL_MONTHS.length){
    document.getElementById('mainArea').innerHTML = `<div class="empty-state" style="margin-top:40px;"><div class="icon">📂</div><h4>data/ 資料夾內還沒有任何資料</h4></div>`;
    return;
  }
  buildRangeBar();
  renderAll();
}

function renderAll(){
  const mA = monthsInRange(RANGE_A.start, RANGE_A.end);
  const mB = RANGE_B ? monthsInRange(RANGE_B.start, RANGE_B.end) : null;
  renderOverview(mA, mB);
  renderTraffic(mA, mB);
  renderKeywords(mA, mB);
  renderSEO(mA, mB);
  renderCategoryTrend(mA);
  renderMonitor();
  renderAIO(mA, mB);
  renderPath(mA);
  renderConversion(mA, mB);
  renderBuilding(mA);
  renderSocial();
  renderGuide();
}

function buildClassificationMap(raw){
  const map = {};
  if(!raw) return map;
  const cleanStr = s => String(s||'').replace(/[\u200b\u200c\u200d\ufeff]/g,'').trim();
  raw.data.forEach(row=>{
    let url = normUrl(row['官網連結']);
    if(!url) return;
    const big = cleanStr(row['大分類']);
    const mid = cleanStr(row['中分類']) === '遺產與贈與稅' ? '遺產與贈與' : cleanStr(row['中分類']);
    const title = cleanStr(row['標題']);
    if(big) map[url] = { big, mid, title };
  });
  return map;
}

function aggTraffic(months){
  let chanTotals={}, catTotals={}, organicByCat={}, total=0;
  months.forEach(m=>{
    const tr = DATA.traffic[m]; if(!tr) return;
    tr.data.forEach(row=>{
      const users = toNum(row['所有使用者']);
      const chan = classifyChannel(row['來源/媒介']);
      const cat = classifyPage(row['網頁路徑'], row['網頁標題']);
      total += users; chanTotals[chan]=(chanTotals[chan]||0)+users; catTotals[cat]=(catTotals[cat]||0)+users;
      if(chan==='Organic Search') organicByCat[cat]=(organicByCat[cat]||0)+users;
    });
  });
  return {chanTotals, catTotals, organicByCat, total};
}
function trafficMonthlySeries(months){
  return months.map(m=>{
    const tr = DATA.traffic[m]; let total=0, organic=0;
    if(tr) tr.data.forEach(row=>{ const u=toNum(row['所有使用者']); total+=u; if(classifyChannel(row['來源/媒介'])==='Organic Search') organic+=u; });
    return {month:m, total, organic};
  });
}
function aggKeywords(months){
  let catTotals={}, totalClicks=0, allRows=[];
  months.forEach(m=>{
    const kw = DATA.kw[m]; if(!kw) return;
    kw.data.forEach(r=>{
      const clicks = toNum(r['Google自然搜尋點擊次數']);
      const cat = classifyKeyword(r['Google自然搜尋關鍵字']);
      catTotals[cat]=(catTotals[cat]||0)+clicks; totalClicks+=clicks;
      allRows.push({ keyword:r['Google自然搜尋關鍵字'], clicks, impressions:toNum(r['Google自然搜尋曝光次數']), ctr:toNum(r['Google自然搜尋點擊率']), position:toNum(r['Google自然搜尋平均排名']) });
    });
  });
  const merged = {};
  allRows.forEach(r=>{
    if(!merged[r.keyword]) merged[r.keyword] = {keyword:r.keyword, clicks:0, impressions:0, position:0, ctr:0, n:0};
    merged[r.keyword].clicks += r.clicks; merged[r.keyword].impressions += r.impressions;
    merged[r.keyword].position += r.position; merged[r.keyword].ctr += r.ctr; merged[r.keyword].n++;
  });
  const rows = Object.values(merged).map(r=>({...r, position:r.position/r.n, ctr:r.ctr/r.n}));
  return {catTotals, totalClicks, rows};
}
function keywordMonthlySeries(months){
  return months.map(m=>{
    const kw = DATA.kw[m]; let total=0;
    if(kw) kw.data.forEach(r=>{ total += toNum(r['Google自然搜尋點擊次數']); });
    return {month:m, total};
  });
}
function aggSEO(months){
  const merged = {};
  months.forEach(m=>{
    const seo = DATA.seo[m]; if(!seo) return;
    seo.data.forEach(r=>{
      const url = normUrl(r['到達網頁'] || Object.values(r)[0]);
      const clicks = toNum(r['Google自然搜尋點擊次數']||r['clicks']);
      if(!merged[url]) merged[url] = { url, clicks:0, impressions:0, position:0, ctr:0, n:0 };
      merged[url].clicks += clicks;
      merged[url].impressions += toNum(r['Google自然搜尋曝光次數']||r['impressions']);
      merged[url].position += toNum(r['Google自然搜尋平均排名']||r['position']);
      merged[url].ctr += toNum(r['Google自然搜尋點擊率']||r['ctr']);
      merged[url].n++;
    });
  });
  const rows = Object.values(merged).map(r=>({...r, position:r.position/r.n, ctr:r.ctr/r.n, cat:classifyPage(r.url)}));
  return rows;
}
function seoMonthlySeries(months){
  return months.map(m=>{
    const seo = DATA.seo[m]; let total=0;
    if(seo) seo.data.forEach(r=>{ total += toNum(r['Google自然搜尋點擊次數']); });
    return {month:m, total};
  });
}
function aggConversion(months){
  const byCat = {};
  months.forEach(m=>{
    const pv = DATA.pageview[m]; if(!pv) return;
    pv.data.forEach(r=>{
      const url = normUrl(r['到達網頁']); const title = r['網頁標題'];
      const cat = classifyPage(url, title);
      byCat[cat] = byCat[cat] || { users:0, appts:0, click_line:0, click_cs:0, click_phone:0, click_price:0, click_nav:0 };
      byCat[cat].users += toNum(r['所有使用者']); byCat[cat].appts += toNum(r['點擊預約賞屋']);
      byCat[cat].click_line += toNum(r['點擊Line']); byCat[cat].click_cs += toNum(r['點擊客服Omi']);
      byCat[cat].click_phone += toNum(r['點擊來電0800']); byCat[cat].click_price += toNum(r['點擊實價']); byCat[cat].click_nav += toNum(r['點擊導航']);
    });
  });
  return byCat;
}
function conversionMonthlySeries(months){
  return months.map(m=>{
    const pv = DATA.pageview[m]; let users=0, appts=0;
    if(pv) pv.data.forEach(r=>{ users+=toNum(r['所有使用者']); appts+=toNum(r['點擊預約賞屋']); });
    return {month:m, cvr: users? appts/users*100 : 0};
  });
}

function renderOverview(mA, mB){
  const p = document.getElementById('panel-overview');
  const A = aggTraffic(mA);
  const kwA = aggKeywords(mA);
  let aioImpr = 0; mA.forEach(m=>{ const d=DATA.aioDaily[m]; if(d) d.data.forEach(r=>aioImpr+=toNum(r['曝光'])); });
  const rangeLabel = mA.length ? `${mA[0]} ~ ${mA[mA.length-1]}` : '—';
  let compareBlock = '';
  if(mB && mB.length){
    compareBlock = `
      <div class="card" style="margin-bottom:18px;"><h3>期間比較</h3><div class="cap">A：${mA[0]}~${mA[mA.length-1]}　vs　B：${mB[0]}~${mB[mB.length-1]}</div>
      ${chartBox('cmpChart', 220)}</div>`;
  }
  p.innerHTML = `
    ${panelHead('總覽', '一眼看懂網站整體表現', 'GA4到達頁面／Google Search Console', `檢視期間：${rangeLabel}`)}
    <div class="stat-row">
      <div class="stat-chip"><div class="n">${fmt(A.total)}</div><div class="l">全站使用者總數</div></div>
      <div class="stat-chip"><div class="n">${fmt(A.chanTotals['Organic Search']||0)}</div><div class="l">自然搜尋使用者</div></div>
      <div class="stat-chip"><div class="n">${fmt(kwA.totalClicks)}</div><div class="l">Google搜尋點擊總數</div></div>
      <div class="stat-chip"><div class="n">${fmt(aioImpr)}</div><div class="l">AI摘要曝光總次數</div></div>
    </div>
    ${compareBlock}
    <div class="grid2">
      <div class="card"><h3>頁面類別佔比（全通路）</h3>${chartBox('ovDonut1',200)}</div>
      <div class="card"><h3>流量管道佔比</h3>${chartBox('ovDonut2',200)}</div>
    </div>
  `;
  const cats = Object.keys(A.catTotals);
  safeChart('ovDonut1', { type:'doughnut', data:{labels:cats, datasets:[{data:cats.map(c=>A.catTotals[c]), backgroundColor:cats.map(c=>CAT_COLORS[c]||STONE)}]}, options:{plugins:{legend:{position:'bottom',labels:{boxWidth:9,font:{size:10}}}}, cutout:'58%'} });
  const chans = Object.keys(A.chanTotals);
  safeChart('ovDonut2', { type:'doughnut', data:{labels:chans, datasets:[{data:chans.map(c=>A.chanTotals[c]), backgroundColor:chans.map(c=>CHAN_COLORS[c]||STONE)}]}, options:{plugins:{legend:{position:'bottom',labels:{boxWidth:9,font:{size:9.5}}}}, cutout:'58%'} });
  if(mB && mB.length){
    const B = aggTraffic(mB); const kwB = aggKeywords(mB);
    safeChart('cmpChart', { type:'bar', data:{ labels:['全站使用者','自然搜尋使用者','Google搜尋點擊'],
      datasets:[ {label:'期間A', data:[A.total, A.chanTotals['Organic Search']||0, kwA.totalClicks], backgroundColor:TEAL},
                 {label:'期間B', data:[B.total, B.chanTotals['Organic Search']||0, kwB.totalClicks], backgroundColor:GOLD} ] },
      options:{ plugins:{legend:{position:'bottom'}} } });
  }
}

function renderTraffic(mA, mB){
  const p = document.getElementById('panel-traffic');
  if(!mA.length){ renderEmpty('traffic','流量與來源','此期間尚無資料',['data/traffic-source/YYYY-MM.csv']); return; }
  const A = aggTraffic(mA);
  const rows = Object.keys(A.chanTotals).map(c=>({name:c, users:A.chanTotals[c], share:A.chanTotals[c]/A.total*100})).sort((a,b)=>b.users-a.users);
  const series = trafficMonthlySeries(mA);
  p.innerHTML = `
    ${panelHead('流量與來源', '了解訪客從哪些管道進站，自然搜尋的重要性有多高', 'GA4到達頁面（依來源/媒介重建管道分類）')}
    <div class="card" style="margin-bottom:18px;"><h3>逐月流量趨勢</h3><div class="cap">全站使用者 vs 自然搜尋使用者</div>${chartBox('trTrend',220)}</div>
    <div class="grid2">
      <div class="card"><h3>流量管道佔比</h3>${chartBox('trChart',220)}</div>
      <div class="card"><h3>各管道使用者數</h3><table><thead><tr><th>管道</th><th class="num">使用者數</th><th class="num">佔比</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td>${r.name}</td><td class="num">${fmt(r.users)}</td><td class="num">${r.share.toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="card"><h3>自然搜尋流量：依頁面類別分布</h3>${chartBox('trOrganicBreak',180)}</div>
  `;
  safeChart('trTrend', { type:'line', data:{ labels:series.map(s=>monthLabel(s.month)), datasets:[
    {label:'全站使用者', data:series.map(s=>s.total), borderColor:SLATE, backgroundColor:SLATE, tension:.3},
    {label:'自然搜尋使用者', data:series.map(s=>s.organic), borderColor:TEAL, backgroundColor:TEAL, tension:.3}
  ]}, options:{ plugins:{legend:{position:'bottom'}} } });
  safeChart('trChart', { type:'bar', data:{labels:rows.map(r=>r.name), datasets:[{label:'使用者數', data:rows.map(r=>r.users), backgroundColor:rows.map(r=>CHAN_COLORS[r.name]||STONE)}]}, options:{plugins:{legend:{display:false}}, indexAxis:'y'} });
  const obCats = Object.keys(A.organicByCat);
  safeChart('trOrganicBreak', { type:'bar', data:{labels:obCats, datasets:[{label:'自然搜尋使用者數', data:obCats.map(c=>A.organicByCat[c]), backgroundColor:obCats.map(c=>CAT_COLORS[c]||STONE)}]}, options:{plugins:{legend:{display:false}}} });
}

function renderKeywords(mA, mB){
  const p = document.getElementById('panel-keywords');
  if(!mA.length){ renderEmpty('keywords','進站關鍵字','此期間尚無資料',['data/gsc-query/YYYY-MM.csv']); return; }
  const A = aggKeywords(mA);
  const catArr = Object.entries(A.catTotals).sort((a,b)=>b[1]-a[1]);
  const top15 = A.rows.slice().sort((a,b)=>b.clicks-a.clicks).slice(0,15);
  const series = keywordMonthlySeries(mA);
  p.innerHTML = `
    ${panelHead('進站關鍵字', '了解大家用什麼字搜尋進站，背後的搜尋意圖是什麼', 'Google Search Console')}
    <div class="card" style="margin-bottom:18px;"><h3>逐月點擊趨勢</h3>${chartBox('kwTrend',200)}</div>
    <div class="grid2">
      <div class="card"><h3>搜尋意圖10大類佔比</h3>${chartBox('kwDonut',220)}</div>
      <div class="card"><h3>類別清單</h3><table><thead><tr><th>分類</th><th class="num">點擊</th><th class="num">佔比</th></tr></thead>
      <tbody>${catArr.map(([c,v])=>`<tr><td>${c}</td><td class="num">${fmt(v)}</td><td class="num">${(v/A.totalClicks*100).toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="card"><h3>搜尋量前15名關鍵字</h3><table><thead><tr><th>關鍵字</th><th class="num">點擊</th><th class="num">曝光</th><th class="num">點閱率</th><th class="num">平均排名</th></tr></thead>
    <tbody>${top15.map(r=>`<tr><td>${r.keyword}</td><td class="num">${fmt(r.clicks)}</td><td class="num">${fmt(r.impressions)}</td><td class="num">${(r.ctr*100).toFixed(1)}%</td><td class="num">${r.position.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>
  `;
  safeChart('kwTrend', { type:'line', data:{labels:series.map(s=>monthLabel(s.month)), datasets:[{label:'點擊', data:series.map(s=>s.total), borderColor:TEAL, backgroundColor:TEAL, tension:.3}]}, options:{plugins:{legend:{display:false}}} });
  const palette=[RUST,TEAL,GOLD,SLATE,PLUM,MOSS,SAND,STONE,"#4A5568","#BFAF9B"];
  safeChart('kwDonut', { type:'doughnut', data:{labels:catArr.map(c=>c[0]), datasets:[{data:catArr.map(c=>c[1]), backgroundColor:palette}]}, options:{plugins:{legend:{position:'bottom',labels:{boxWidth:9,font:{size:9.5}}}}, cutout:'55%'} });
}

function renderSEO(mA, mB){
  const p = document.getElementById('panel-seo');
  if(!mA.length){ renderEmpty('seo','大家都在看什麼文章','此期間尚無資料',['data/gsc-page/YYYY-MM.csv']); return; }
  const rows = aggSEO(mA);
  const nonbuild = rows.filter(r=>r.cat!=='建案頁');
  const top20 = nonbuild.slice().sort((a,b)=>b.clicks-a.clicks).slice(0,20);
  const top20Sum = top20.reduce((s,r)=>s+r.clicks,0);
  const nbTotal = nonbuild.reduce((s,r)=>s+r.clicks,0);
  const grandTotal = rows.reduce((s,r)=>s+r.clicks,0);
  let bigTotals={}, coveredClicks=0;
  nonbuild.forEach(r=>{ const c = CLS_MAP[r.url]; if(c && c.big){ bigTotals[c.big]=(bigTotals[c.big]||0)+r.clicks; coveredClicks += r.clicks; } });
  const bigArr = Object.entries(bigTotals).sort((a,b)=>b[1]-a[1]);
  const coverage = nbTotal ? (coveredClicks/nbTotal*100) : 0;
  const series = seoMonthlySeries(mA);

  p.innerHTML = `
    ${panelHead('大家都在看什麼文章', '了解進站後大家都看什麼文章、排名與點閱表現如何', 'Google Search Console')}
    <div class="stat-row">
      <div class="stat-chip"><div class="n">${fmt(top20Sum)}</div><div class="l">TOP20頁面合計點擊</div></div>
      <div class="stat-chip"><div class="n">${nbTotal?(top20Sum/nbTotal*100).toFixed(1):0}%</div><div class="l">佔非建案內容比重</div></div>
      <div class="stat-chip"><div class="n">${grandTotal?(top20Sum/grandTotal*100).toFixed(1):0}%</div><div class="l">佔全站比重</div></div>
      <div class="stat-chip"><div class="n">${coverage.toFixed(1)}%</div><div class="l">官方分類表收錄率</div></div>
    </div>
    <div class="card" style="margin-bottom:18px;"><h3>逐月點擊趨勢（不含建案頁）</h3>${chartBox('seoTrend',200)}</div>
    <div class="grid2">
      <div class="card"><h3>官方大分類佔比</h3>${chartBox('seoBigDonut',220)}</div>
      <div class="card"><h3>TOP20文章（點標題開新視窗）</h3><table><thead><tr><th>#</th><th>文章</th><th class="num">點擊</th><th class="num">排名</th><th class="num">點閱率</th></tr></thead>
      <tbody>${top20.slice(0,12).map((a,i)=>`<tr><td>${i+1}</td><td><a href="${linkFor(a.url)}" target="_blank" rel="noopener">${a.url}</a></td><td class="num">${fmt(a.clicks)}</td><td class="num">${a.position.toFixed(1)}</td><td class="num">${(a.ctr*100).toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>
    </div>
  `;
  safeChart('seoTrend', { type:'line', data:{ labels:series.map(s=>monthLabel(s.month)), datasets:[{label:'點擊', data:series.map(s=>s.total), borderColor:TEAL, backgroundColor:TEAL, tension:.3}] }, options:{plugins:{legend:{display:false}}} });
  safeChart('seoBigDonut', { type:'doughnut', data:{labels:bigArr.map(c=>c[0]), datasets:[{data:bigArr.map(c=>c[1]), backgroundColor:[TEAL,SLATE,GOLD,PLUM,MOSS,SAND,STONE]}]}, options:{plugins:{legend:{position:'bottom',labels:{boxWidth:9,font:{size:10}}}}, cutout:'55%'} });
}

function renderCategoryTrend(mA){
  const p = document.getElementById('panel-category');
  if(!mA.length){ renderEmpty('category','哪個內容主題最值得投入','此期間尚無資料',['data/gsc-page/YYYY-MM.csv']); return; }
  const bigMonthly = {};
  const structure = {};
  mA.forEach(m=>{
    const seo = DATA.seo[m]; if(!seo) return;
    seo.data.forEach(r=>{
      const url = normUrl(r['到達網頁'] || Object.values(r)[0]);
      const clicks = toNum(r['Google自然搜尋點擊次數']);
      const c = CLS_MAP[url]; if(!c || !c.big) return;
      bigMonthly[c.big] = bigMonthly[c.big] || {};
      bigMonthly[c.big][m] = (bigMonthly[c.big][m]||0) + clicks;
      structure[c.big] = structure[c.big] || {};
      structure[c.big][c.mid] = structure[c.big][c.mid] || {};
      structure[c.big][c.mid][url] = structure[c.big][c.mid][url] || { title: c.title||url, clicks:0 };
      structure[c.big][c.mid][url].clicks += clicks;
    });
  });
  const bigCats = Object.keys(bigMonthly);
  const bigTotals = {}; bigCats.forEach(c=>{ bigTotals[c] = Object.values(bigMonthly[c]).reduce((s,v)=>s+v,0); });
  const grandTotal = Object.values(bigTotals).reduce((s,v)=>s+v,0);
  const bigOrder = bigCats.sort((a,b)=>bigTotals[b]-bigTotals[a]);

  p.innerHTML = `
    ${panelHead('哪個內容主題最值得投入', '從主題層級（而非單篇文章）看哪個內容領域該優先投入資源', '遠房官網文章對應分類表 ＋ Google Search Console')}
    <div class="card" style="margin-bottom:18px;"><h3>大分類逐月趨勢</h3>${chartBox('bigTrendChart',260)}</div>
    <div class="card"><h3>點大分類展開中分類，再點中分類展開文章清單</h3>
      <div id="drilldown"></div>
    </div>
  `;
  safeChart('bigTrendChart', { type:'line', data:{ labels: mA.map(monthLabel), datasets: bigOrder.map(c=>({label:c, data: mA.map(m=>bigMonthly[c][m]||0), borderColor:BIG_COLORS[c]||STONE, backgroundColor:BIG_COLORS[c]||STONE, tension:.3})) },
    options:{ plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10}}}} } });

  const dd = document.getElementById('drilldown');
  dd.innerHTML = bigOrder.map(big=>{
    const share = (bigTotals[big]/grandTotal*100).toFixed(1);
    return `<div class="tree-row tree-big" data-big="${big}">
      <span class="tree-toggle">▸</span> <b>${big}</b>
      <span class="tree-meta">${fmt(bigTotals[big])} 次點擊　·　${share}%</span>
    </div>
    <div class="tree-children" id="mid-${cssId(big)}" style="display:none"></div>`;
  }).join('');

  bigOrder.forEach(big=>{
    const row = dd.querySelector(`.tree-row[data-big="${CSS.escape(big)}"]`);
    row.addEventListener('click', ()=>{
      const container = document.getElementById('mid-'+cssId(big));
      const isOpen = container.style.display !== 'none';
      container.style.display = isOpen ? 'none' : 'block';
      row.querySelector('.tree-toggle').textContent = isOpen ? '▸' : '▾';
      if(!isOpen && !container.dataset.built){
        const mids = structure[big];
        const midTotals = Object.keys(mids).map(mid=>({mid, total: Object.values(mids[mid]).reduce((s,a)=>s+a.clicks,0)})).sort((a,b)=>b.total-a.total);
        container.innerHTML = midTotals.map(({mid,total})=>`
          <div class="tree-row tree-mid" data-big="${big}" data-mid="${mid}">
            <span class="tree-toggle">▸</span> ${mid} <span class="tree-meta">${fmt(total)} 次點擊</span>
          </div>
          <div class="tree-children" id="art-${cssId(big)}-${cssId(mid)}" style="display:none"></div>
        `).join('');
        container.dataset.built = '1';
        midTotals.forEach(({mid})=>{
          const midRow = container.querySelector(`.tree-row[data-mid="${CSS.escape(mid)}"]`);
          midRow.addEventListener('click', (ev)=>{
            ev.stopPropagation();
            const artContainer = document.getElementById(`art-${cssId(big)}-${cssId(mid)}`);
            const artOpen = artContainer.style.display !== 'none';
            artContainer.style.display = artOpen ? 'none' : 'block';
            midRow.querySelector('.tree-toggle').textContent = artOpen ? '▸' : '▾';
            if(!artOpen && !artContainer.dataset.built){
              const articles = Object.entries(structure[big][mid]).map(([url,d])=>({url, ...d})).sort((a,b)=>b.clicks-a.clicks);
              artContainer.innerHTML = `<table><thead><tr><th>文章</th><th class="num">點擊</th></tr></thead><tbody>
                ${articles.map(a=>`<tr><td><a href="${linkFor(a.url)}" target="_blank" rel="noopener">${a.title}</a></td><td class="num">${fmt(a.clicks)}</td></tr>`).join('')}
              </tbody></table>`;
              artContainer.dataset.built = '1';
            }
          });
        });
      }
    });
  });
}
function cssId(s){ return String(s).replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g,'_'); }

function renderMonitor(){
  const p = document.getElementById('panel-monitor');
  const months = sortedMonths(DATA.seo);
  if(months.length < 2){ renderEmpty('monitor','哪些文章需要優先改版','至少需要2個月資料才能計算趨勢',['data/gsc-page/YYYY-MM.csv（多個月份）']); return; }
  const seriesMap = {};
  months.forEach(m=>{
    const seo = DATA.seo[m];
    seo.data.forEach(r=>{
      const url = normUrl(r['到達網頁'] || Object.values(r)[0]);
      if(classifyPage(url)==='建案頁') return;
      seriesMap[url] = seriesMap[url] || { clicks:{}, position:{}, ctr:{} };
      seriesMap[url].clicks[m] = toNum(r['Google自然搜尋點擊次數']);
      seriesMap[url].position[m] = toNum(r['Google自然搜尋平均排名']);
      seriesMap[url].ctr[m] = toNum(r['Google自然搜尋點擊率'])*100;
    });
  });
  const latest = months[months.length-1];
  const urls = Object.keys(seriesMap).sort((a,b)=>(seriesMap[b].clicks[latest]||0)-(seriesMap[a].clicks[latest]||0)).slice(0,20);
  const articles = urls.map(u=>({ url:u, clicks: months.map(m=>seriesMap[u].clicks[m] ?? null), position: months.map(m=>seriesMap[u].position[m] ?? null), ctr: months.map(m=>seriesMap[u].ctr[m] ?? null) }));

  p.innerHTML = `
    ${panelHead('哪些文章需要優先改版', '找出正在退燒、需要優先改版的文章', 'Google Search Console', `${months.length}個月趨勢（${months[0]} ~ ${latest}），本分頁固定使用全部歷史月份，不受上方檢視期間影響`)}
    <div class="stat-row" id="mStatStrip"></div>
    <div class="controls">
      <div class="ctrl-group"><label>🔴 緊急：距歷史高峰下滑超過</label><div class="row"><input type="range" id="redSlider" min="15" max="70" value="40"><span class="ctrl-val" id="redVal">40%</span></div></div>
      <div class="ctrl-group"><label>🟠 觀察：距歷史高峰下滑超過</label><div class="row"><input type="range" id="orangeSlider" min="10" max="50" value="25"><span class="ctrl-val" id="orangeVal">25%</span></div></div>
      <div class="ctrl-group"><label>🟡 標題優化：點閱率相對衰退超過</label><div class="row"><input type="range" id="yellowSlider" min="10" max="50" value="25"><span class="ctrl-val" id="yellowVal">25%</span></div></div>
      <div class="ctrl-group"><label>排序依據</label><select id="sortSelect"><option value="alert">警示等級</option><option value="clicks">最新月流量</option><option value="peak">距高峰跌幅</option></select></div>
    </div>
    <table><thead><tr><th style="width:20px"></th><th>文章</th><th class="num">最新月流量</th><th class="num">MoM</th><th class="num">距高峰跌幅</th><th class="num">平均排名</th><th class="num">點閱率</th><th>狀態</th></tr></thead>
    <tbody id="mTableBody"></tbody></table>
  `;
  function lastValid(arr){ for(let i=arr.length-1;i>=0;i--){ if(arr[i]!=null) return {v:arr[i], i}; } return {v:null,i:-1}; }
  function prevValid(arr, idx){ for(let i=idx-1;i>=0;i--){ if(arr[i]!=null) return arr[i]; } return null; }
  function computeMetrics(a){
    const clicks=a.clicks; const {v:latestV,i:latestIdx}=lastValid(clicks); const prev=prevValid(clicks,latestIdx);
    const mom=(prev&&prev>0)?(latestV-prev)/prev*100:0;
    const nz=clicks.filter(v=>v!=null); const peak=nz.length?Math.max(...nz):0; const peakDrop=peak>0?(peak-latestV)/peak*100:0;
    const pos=a.position.filter(x=>x!=null);
    const avgPosRecent=pos.slice(-3).reduce((s,v)=>s+v,0)/Math.max(1,pos.slice(-3).length);
    const avgPosEarly=pos.slice(0,3).reduce((s,v)=>s+v,0)/Math.max(1,pos.slice(0,3).length);
    const posWorsen=avgPosRecent-avgPosEarly;
    const ctrArr=a.ctr.filter(x=>x!=null);
    const ctrRecent=ctrArr.slice(-3).reduce((s,v)=>s+v,0)/Math.max(1,ctrArr.slice(-3).length);
    const ctrEarly=ctrArr.slice(0,3).reduce((s,v)=>s+v,0)/Math.max(1,ctrArr.slice(0,3).length);
    const ctrDecline=ctrEarly>0?(ctrEarly-ctrRecent)/ctrEarly*100:0;
    return {latest:latestV,mom,peak,peakDrop,avgPosRecent,posWorsen,ctrRecent,ctrDecline};
  }
  function classify(m,th){
    if(m.peakDrop>=th.red && m.mom<0) return 'red';
    if(m.peakDrop>=th.orange || m.posWorsen>=2) return 'orange';
    if(m.ctrDecline>=th.yellow && m.posWorsen<1.5) return 'yellow';
    return 'green';
  }
  const badgeText={red:'🔴 緊急改版',orange:'🟠 排入觀察',yellow:'🟡 標題優化',green:'🟢 正常'};
  let sortMode='alert', th={red:40,orange:25,yellow:25};
  function render(){
    const scored = articles.map(a=>{ const m=computeMetrics(a); return {a,m,status:classify(m,th)}; });
    const counts={red:0,orange:0,yellow:0,green:0}; scored.forEach(s=>counts[s.status]++);
    document.getElementById('mStatStrip').innerHTML = ['red','orange','yellow','green'].map(k=>
      `<div class="stat-chip"><div class="n" style="color:${{red:RUST,orange:GOLD,yellow:'#8A7A1E',green:TEAL}[k]}">${counts[k]}</div><div class="l">${badgeText[k]}</div></div>`).join('');
    const order={red:0,orange:1,yellow:2,green:3};
    let sorted=scored.slice();
    if(sortMode==='alert') sorted.sort((x,y)=>order[x.status]-order[y.status]||y.m.peakDrop-x.m.peakDrop);
    else if(sortMode==='clicks') sorted.sort((x,y)=>y.m.latest-x.m.latest);
    else if(sortMode==='peak') sorted.sort((x,y)=>y.m.peakDrop-x.m.peakDrop);
    document.getElementById('mTableBody').innerHTML = sorted.map(({a,m,status})=>{
      const momArrow = m.mom>=0 ? `<span style="color:${TEAL}">▲${m.mom.toFixed(1)}%</span>` : `<span style="color:${RUST}">▼${Math.abs(m.mom).toFixed(1)}%</span>`;
      return `<tr onclick='openMonitorModal(${JSON.stringify(a.url)})'>
        <td><span class="dot ${status}"></span></td><td><b>${a.url}</b></td>
        <td class="num">${fmt(m.latest)}</td><td class="num">${momArrow}</td><td class="num">${m.peakDrop.toFixed(0)}%</td>
        <td class="num">${m.avgPosRecent?m.avgPosRecent.toFixed(1):'—'}</td><td class="num">${m.ctrRecent?m.ctrRecent.toFixed(1)+'%':'—'}</td>
        <td><span class="badge ${status}">${badgeText[status]}</span></td></tr>`;
    }).join('');
  }
  window.openMonitorModal = function(url){
    const a = articles.find(x=>x.url===url); const m = computeMetrics(a); const status = classify(m, th);
    const actionMap = {red:'建議：全文重寫＋更新數據/法規＋補充當年度新規定，2週內排入改版排程。',orange:'建議：檢查標題與內容時效性，觀察下月是否持續惡化。',yellow:'建議：排名尚可但點閱率下滑，優先改寫標題與meta描述。',green:'目前表現穩定，維持現狀。'};
    document.getElementById('modalContent').innerHTML = `
      <div class="modal-head"><div><h2><a href="${linkFor(a.url)}" target="_blank" rel="noopener">${a.url}</a></h2><div class="modal-meta">${months.length}個月點擊/排名趨勢</div></div>
      <button class="modal-close" onclick="document.getElementById('overlay').classList.remove('show')">&times;</button></div>
      ${chartBox('trendChart', 240)}
      <div class="action-box"><b>${badgeText[status]}：</b>${actionMap[status]}</div>`;
    document.getElementById('overlay').classList.add('show');
    setTimeout(()=>{
      safeChart('trendChart', { type:'line', data:{ labels: months.map(monthLabel), datasets:[
        {label:'點擊', data:a.clicks, borderColor:TEAL, backgroundColor:TEAL, tension:.3, yAxisID:'y', spanGaps:true},
        {label:'平均排名', data:a.position, borderColor:GOLD, backgroundColor:GOLD, tension:.3, yAxisID:'y1', borderDash:[4,3], spanGaps:true}
      ]}, options:{ plugins:{legend:{position:'bottom'}}, scales:{ y:{title:{display:true,text:'點擊'}}, y1:{position:'right', reverse:true, title:{display:true,text:'平均排名'}, grid:{drawOnChartArea:false}} } } });
    },30);
  };
  document.getElementById('overlay').addEventListener('click', e=>{ if(e.target.id==='overlay') e.target.classList.remove('show'); });
  ['red','orange','yellow'].forEach(k=>{ document.getElementById(k+'Slider').addEventListener('input', e=>{ th[k]=+e.target.value; document.getElementById(k+'Val').textContent=th[k]+'%'; render(); }); });
  document.getElementById('sortSelect').addEventListener('change', e=>{ sortMode=e.target.value; render(); });
  render();
}

function renderAIO(mA, mB){
  const p = document.getElementById('panel-aio');
  const hasAI = mA.some(m=>DATA.ai[m]);
  const hasAIOd = mA.some(m=>DATA.aioDaily[m]);
  if(!hasAI && !hasAIOd){ renderEmpty('aio','內容有沒有被AI引用','此期間尚無資料',['data/ai-assistant/YYYY-MM.csv','data/gsc-aio/YYYY-MM-*.csv']); return; }
  let chanTotals={}, totalSessions=0, aiSessions=0;
  mA.forEach(m=>{ const ai=DATA.ai[m]; if(!ai) return; ai.data.forEach(r=>{
    const sessions = toNum(r['工作階段']||r['Sessions']);
    const chan = r['預設頻道群組']||r['Session default channel group']||r['頻道']||Object.values(r)[0];
    chanTotals[chan]=(chanTotals[chan]||0)+sessions; totalSessions+=sessions;
    if(String(chan).includes('AI Assistant')) aiSessions += sessions;
  });});
  let aioTotal=0, aioTopPages=[];
  mA.forEach(m=>{ const d=DATA.aioDaily[m]; if(d) d.data.forEach(r=>aioTotal+=toNum(r['曝光'])); });
  const latestAIOp = [...mA].reverse().find(m=>DATA.aioPages[m]);
  if(latestAIOp) aioTopPages = DATA.aioPages[latestAIOp].data.slice(0,10).map(r=>({url:String(r['熱門網頁']||Object.values(r)[0]).replace(SITE_ORIGIN,''), impressions:toNum(r['曝光'])}));

  p.innerHTML = `
    ${panelHead('內容有沒有被AI引用', '了解內容有沒有被AI引用、AI有沒有帶來流量', 'GA4 AI Assistant ＋ Google Search Console（生成式AI報告）')}
    <div class="stat-row">
      <div class="stat-chip"><div class="n">${fmt(aiSessions)}</div><div class="l">AI帶來的工作階段(ChatGPT/Gemini/DeepSeek/Copilot/Grok)</div></div>
      <div class="stat-chip"><div class="n">${totalSessions?(aiSessions/totalSessions*100).toFixed(2):0}%</div><div class="l">佔全站工作階段比例</div></div>
      <div class="stat-chip"><div class="n">${fmt(aioTotal)}</div><div class="l">AI摘要曝光總數</div></div>
    </div>
    <div class="grid2">
      <div class="card"><h3>流量管道分布（含AI Assistant）</h3>${chartBox('aioChan',220)}</div>
      <div class="card"><h3>被AI引用曝光最高的頁面</h3><table><thead><tr><th>頁面</th><th class="num">曝光</th></tr></thead>
      <tbody>${aioTopPages.map(r=>`<tr><td><a href="${linkFor(r.url)}" target="_blank" rel="noopener">${r.url}</a></td><td class="num">${fmt(r.impressions)}</td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="note-box">兩個資料來源單位不同（工作階段 vs 曝光次數），僅能分別看趨勢，不可相加。Perplexity目前兩個資料源都涵蓋不到。</div>
  `;
  const chans = Object.keys(chanTotals);
  safeChart('aioChan', { type:'bar', data:{labels:chans, datasets:[{label:'工作階段', data:chans.map(c=>chanTotals[c]), backgroundColor: chans.map(c=>String(c).includes('AI Assistant')?GOLD:SLATE)}]}, options:{plugins:{legend:{display:false}}, indexAxis:'y'} });
}

function renderPath(mA){
  const p = document.getElementById('panel-path');
  const utmMonths = mA.filter(m=>DATA.utm[m]);
  const bannerMonths = mA.filter(m=>DATA.bannerAds[m]);
  if(!utmMonths.length && !bannerMonths.length){ renderEmpty('path','什麼內容會導去看建案','此期間尚無資料',['data/utm-buttons/YYYY-MM.csv','data/banner-ads/YYYY-MM.csv','GA4漏斗探索匯出表格(待補)']); return; }

  // 文章按鈕UTM
  let destByMonth = {}, destTotals = {}, campaignTotals = {};
  utmMonths.forEach(m=>{
    DATA.utm[m].data.forEach(r=>{
      const url = r['網頁路徑']||r['url']; const users = toNum(r['所有使用者']); const dest = classifyDest(url);
      destByMonth[dest] = destByMonth[dest] || {}; destByMonth[dest][m] = (destByMonth[dest][m]||0) + users;
      destTotals[dest] = (destTotals[dest]||0) + users;
      const camp = r['廣告活動']||'—'; campaignTotals[camp] = (campaignTotals[camp]||0) + users;
    });
  });
  const destTypes = Object.keys(destTotals);
  const campArr = Object.entries(campaignTotals).sort((a,b)=>b[1]-a[1]).slice(0,8);

  // 內文廣告（橫幅）
  let bannerMonthlyImpr = {}, bannerMonthlyClicks = {}, bannerDestTotals = {}, bannerTotalImpr=0, bannerTotalClicks=0;
  bannerMonths.forEach(m=>{
    DATA.bannerAds[m].data.forEach(r=>{
      const impr = toNum(r['曝光']), clicks = toNum(r['點擊']);
      const dest = extractBannerDest(r['圖片名稱']);
      bannerMonthlyImpr[m] = (bannerMonthlyImpr[m]||0) + impr;
      bannerMonthlyClicks[m] = (bannerMonthlyClicks[m]||0) + clicks;
      bannerDestTotals[dest] = bannerDestTotals[dest] || {impr:0, clicks:0};
      bannerDestTotals[dest].impr += impr; bannerDestTotals[dest].clicks += clicks;
      bannerTotalImpr += impr; bannerTotalClicks += clicks;
    });
  });
  const bannerDestArr = Object.entries(bannerDestTotals).sort((a,b)=>b[1].impr-a[1].impr).slice(0,12);
  const bannerCTR = bannerTotalImpr ? (bannerTotalClicks/bannerTotalImpr*100) : 0;

  p.innerHTML = `
    ${panelHead('什麼內容會導去看建案', '了解站內導流工具（文章按鈕、內文廣告橫幅）有沒有把讀者帶去建案頁', '站內按鈕UTM點擊 ＋ 內文廣告橫幅曝光/點擊', `「廣告活動」欄位是目的地代碼而非來源文章，只能看到「導去哪裡」`)}

    <h3 class="section-label">Ⓐ 文章內按鈕點擊</h3>
    ${utmMonths.length ? `
    <div class="card" style="margin-bottom:18px;"><h3>站內按鈕點擊：目的地類型逐月趨勢</h3>${chartBox('pathTrend',220)}</div>
    <div class="grid2">
      <div class="card"><h3>目的地類型合計</h3><table><thead><tr><th>類型</th><th class="num">使用者數</th></tr></thead>
      <tbody>${destTypes.sort((a,b)=>destTotals[b]-destTotals[a]).map(d=>`<tr><td>${d}</td><td class="num">${fmt(destTotals[d])}</td></tr>`).join('')}</tbody></table></div>
      <div class="card"><h3>依廣告活動代碼（目的地）</h3><table><thead><tr><th>代碼</th><th class="num">使用者數</th></tr></thead>
      <tbody>${campArr.map(([c,v])=>`<tr><td>${c}</td><td class="num">${fmt(v)}</td></tr>`).join('')}</tbody></table></div>
    </div>` : `<div class="empty-state"><div class="icon">🔲</div><h4>此期間尚無按鈕UTM資料</h4><span class="need-tag">data/utm-buttons/YYYY-MM.csv</span></div>`}

    <h3 class="section-label">Ⓑ 內文廣告橫幅（文章內Banner）</h3>
    ${bannerMonths.length ? `
    <div class="stat-row">
      <div class="stat-chip"><div class="n">${fmt(bannerTotalImpr)}</div><div class="l">橫幅曝光總數</div></div>
      <div class="stat-chip"><div class="n">${fmt(bannerTotalClicks)}</div><div class="l">橫幅點擊總數</div></div>
      <div class="stat-chip"><div class="n">${bannerCTR.toFixed(3)}%</div><div class="l">整體點閱率</div></div>
    </div>
    <div class="card" style="margin-bottom:18px;"><h3>內文廣告逐月曝光/點擊趨勢</h3>${chartBox('bannerTrend',220)}</div>
    <div class="card"><h3>依目的地建案代碼（點擊圖片名稱解析）</h3><table><thead><tr><th>目的地代碼</th><th class="num">曝光</th><th class="num">點擊</th><th class="num">點閱率</th></tr></thead>
    <tbody>${bannerDestArr.map(([d,v])=>`<tr><td>${d}</td><td class="num">${fmt(v.impr)}</td><td class="num">${fmt(v.clicks)}</td><td class="num">${v.impr?(v.clicks/v.impr*100).toFixed(2):0}%</td></tr>`).join('')}</tbody></table></div>
    <div class="note-box">內文廣告整體點閱率偏低（多數月份低於0.1%），代表這個版位的曝光量雖大，但實際帶來的點擊非常有限，建議評估版位設計或改用其他導流方式。</div>
    ` : `<div class="empty-state"><div class="icon">🔲</div><h4>此期間尚無內文廣告資料</h4><span class="need-tag">data/banner-ads/YYYY-MM.csv</span></div>`}

    <div class="empty-state" style="margin-top:18px;"><div class="icon">🔲</div><h4>GA4漏斗探索資料待補</h4>
    <p>「看過生活提案→看過建案頁（自然流量）」的漏斗步驟人數/轉換率，設定完成後匯出表格即可補上。</p>
    <span class="need-tag">GA4漏斗探索匯出表格</span></div>
  `;
  if(utmMonths.length){
    safeChart('pathTrend', { type:'bar', data:{ labels: utmMonths.map(monthLabel), datasets: destTypes.map((d,i)=>({label:d, data:utmMonths.map(m=>destByMonth[d][m]||0), backgroundColor:[RUST,GOLD,TEAL,SLATE,PLUM,STONE][i%6]})) },
      options:{ plugins:{legend:{position:'bottom'}}, scales:{x:{stacked:true},y:{stacked:true}} } });
  }
  if(bannerMonths.length){
    safeChart('bannerTrend', { type:'bar', data:{
      labels: bannerMonths.map(monthLabel),
      datasets:[
        {type:'bar', label:'曝光', data: bannerMonths.map(m=>bannerMonthlyImpr[m]||0), backgroundColor:SAND, yAxisID:'y'},
        {type:'line', label:'點擊', data: bannerMonths.map(m=>bannerMonthlyClicks[m]||0), borderColor:RUST, backgroundColor:RUST, yAxisID:'y1', tension:.3}
      ]},
      options:{ plugins:{legend:{position:'bottom'}}, scales:{ y:{title:{display:true,text:'曝光'}}, y1:{position:'right', title:{display:true,text:'點擊'}, grid:{drawOnChartArea:false}} } } });
  }
}

function renderConversion(mA, mB){
  const p = document.getElementById('panel-conversion');
  if(!mA.some(m=>DATA.pageview[m])){ renderEmpty('conversion','流量有沒有變成名單','此期間尚無資料',['data/pageview/YYYY-MM.csv']); return; }
  const byCat = aggConversion(mA);
  let notfoundUsers=0, notfoundAppts=0;
  mA.forEach(m=>{ const pv=DATA.pageview[m]; if(!pv) return; pv.data.forEach(r=>{ if(String(r['網頁標題']).includes('找不到頁面')){ notfoundUsers+=toNum(r['所有使用者']); notfoundAppts+=toNum(r['點擊預約賞屋']); } }); });
  const catArr = Object.entries(byCat).sort((a,b)=>b[1].users-a[1].users);
  const build = byCat['建案頁'] || {users:0,appts:0,click_line:0,click_cs:0,click_phone:0,click_price:0,click_nav:0};
  const series = conversionMonthlySeries(mA);
  p.innerHTML = `
    ${panelHead('流量有沒有變成名單', '了解流量最後有沒有變成名單，哪裡在浪費流量', 'GA4到達頁面')}
    <div class="card" style="margin-bottom:18px;"><h3>建案頁轉換率逐月趨勢</h3>${chartBox('cvTrend',200)}</div>
    <div class="grid2">
      <div class="card"><h3>各類別預約賞屋轉換率</h3>${chartBox('cvChart',220)}</div>
      <div class="card"><h3>各類型點擊數（建案頁）</h3><table><thead><tr><th>類型</th><th class="num">點擊數</th></tr></thead>
      <tbody><tr><td>預約賞屋</td><td class="num">${fmt(build.appts)}</td></tr><tr><td>點擊LINE</td><td class="num">${fmt(build.click_line)}</td></tr>
      <tr><td>點擊客服Omi</td><td class="num">${fmt(build.click_cs)}</td></tr><tr><td>點擊來電0800</td><td class="num">${fmt(build.click_phone)}</td></tr>
      <tr><td>點擊實價</td><td class="num">${fmt(build.click_price)}</td></tr><tr><td>點擊導航</td><td class="num">${fmt(build.click_nav)}</td></tr></tbody></table></div>
    </div>
    <div class="card"><h3>404流失清單</h3><div class="stat-row" style="margin-top:10px;">
      <div class="stat-chip"><div class="n" style="color:${RUST}">${fmt(notfoundUsers)}</div><div class="l">404頁面訪問人次</div></div>
      <div class="stat-chip"><div class="n" style="color:${RUST}">${fmt(notfoundAppts)}</div><div class="l">其中轉換數</div></div></div></div>
    <div class="empty-state"><div class="icon">🔲</div><h4>第一次接觸到成交歷程 — 目前資料無法回答</h4>
    <p>需要銷售系統的成交名單反查造訪紀錄，或GA4事件層級明細＋使用者ID才能建立。</p>
    <span class="need-tag">銷售成交名單</span><span class="need-tag">GA4事件層級明細</span></div>
  `;
  safeChart('cvTrend', { type:'line', data:{labels:series.map(s=>monthLabel(s.month)), datasets:[{label:'建案頁轉換率(%)', data:series.map(s=>s.cvr), borderColor:RUST, backgroundColor:RUST, tension:.3}]}, options:{plugins:{legend:{display:false}}} });
  safeChart('cvChart', { type:'bar', data:{labels:catArr.map(x=>x[0]), datasets:[{label:'轉換率(%)', data:catArr.map(x=>x[1].users?x[1].appts/x[1].users*100:0), backgroundColor:catArr.map(x=>CAT_COLORS[x[0]]||SLATE)}]}, options:{plugins:{legend:{display:false}}} });
}

function renderBuilding(mA){
  const p = document.getElementById('panel-building');
  const months = mA.filter(m=>DATA.pageview[m]);
  if(!months.length){ renderEmpty('building','單一建案表現','此期間尚無資料',['同⑧']); return; }
  const buildings = {}; const buildingsMonthly = {};
  months.forEach(m=>{
    DATA.pageview[m].data.forEach(r=>{
      const url = normUrl(r['到達網頁']); if(!url.includes('buildings')) return;
      buildings[url] = buildings[url] || { title:r['網頁標題'], users:0, appts:0 };
      buildings[url].users += toNum(r['所有使用者']); buildings[url].appts += toNum(r['點擊預約賞屋']);
      buildingsMonthly[url] = buildingsMonthly[url] || {};
      buildingsMonthly[url][m] = (buildingsMonthly[url][m]||0) + toNum(r['所有使用者']);
    });
  });
  const list = Object.entries(buildings).sort((a,b)=>b[1].users-a[1].users);
  p.innerHTML = `
    ${panelHead('單一建案表現', '檢視單一建案自己的表現，不與其他建案混在一起看', 'GA4到達頁面')}
    <div class="controls"><div class="ctrl-group"><label>選擇建案</label><select id="buildingSelect">
      ${list.map(([u,d])=>`<option value="${u}">${d.title}</option>`).join('')}
    </select></div></div>
    <div id="buildingDetail"></div>
  `;
  function showBuilding(url){
    const d = buildings[url];
    document.getElementById('buildingDetail').innerHTML = `
      <div class="stat-row"><div class="stat-chip"><div class="n">${fmt(d.users)}</div><div class="l">使用者數</div></div>
      <div class="stat-chip"><div class="n">${fmt(d.appts)}</div><div class="l">預約賞屋點擊</div></div>
      <div class="stat-chip"><div class="n">${d.users?(d.appts/d.users*100).toFixed(2):0}%</div><div class="l">轉換率</div></div></div>
      <div class="card"><h3>逐月流量趨勢</h3>${chartBox('buildingTrend',200)}</div>`;
    safeChart('buildingTrend', { type:'line', data:{ labels: months.map(monthLabel), datasets:[{label:'使用者數', data: months.map(m=>buildingsMonthly[url][m]||0), borderColor:RUST, backgroundColor:RUST, tension:.3}] }, options:{plugins:{legend:{display:false}}} });
  }
  document.getElementById('buildingSelect').addEventListener('change', e=>showBuilding(e.target.value));
  if(list.length) showBuilding(list[0][0]);
}

function renderSocial(){
  renderEmpty('social','FB/IG/YT/TikTok經營成效','待每月人工填表（觸及/互動/完播率/受眾池新增/導站外數/廣告花費/廣告轉換）',['data/social/YYYY-MM.csv（人工填寫）']);
}

function renderGuide(){
  const p = document.getElementById('panel-guide');
  const stat = (obj, label) => { const ms = sortedMonths(obj); return `<tr><td>${label}</td><td>${ms.length? ms.join(', ') : '<i>尚無資料</i>'}</td></tr>`; };
  p.innerHTML = `
    <div class="panel-head"><h2>資料說明</h2></div>
    <div class="card"><h3>目前已偵測到的資料月份</h3>
      <table class="req-table"><thead><tr><th>資料夾</th><th>已有的月份</th></tr></thead><tbody>
        ${stat(DATA.pageview,'data/pageview/')}${stat(DATA.traffic,'data/traffic-source/')}${stat(DATA.kw,'data/gsc-query/')}
        ${stat(DATA.seo,'data/gsc-page/')}${stat(DATA.ai,'data/ai-assistant/')}${stat(DATA.utm,'data/utm-buttons/')}${stat(DATA.bannerAds,'data/banner-ads/')}
        <tr><td>data/classification/latest.csv</td><td>${Object.keys(CLS_MAP).length ? ('已載入，'+Object.keys(CLS_MAP).length+'筆') : '<i>尚無資料</i>'}</td></tr>
      </tbody></table>
    </div>
    <div class="card" style="margin-top:16px;"><h3>怎麼加新月份資料</h3>
      <ol style="font-size:12.5px;color:var(--ink-soft);line-height:1.9;">
        <li>每月匯出時維持相同欄位格式（跟現有檔案一致）</li>
        <li>檔名存成 <code>YYYY-MM.csv</code>，丟進對應的 <code>data/</code> 子資料夾</li>
        <li>commit並push到GitHub，重新整理網頁即可看到新月份自動出現在上方的檢視期間選單裡</li>
        <li>分類表只有新增文章時才需要更新，直接覆蓋 <code>data/classification/latest.csv</code></li>
      </ol>
    </div>
  `;
}

main();
