// classify.js — 頁面分類、關鍵字分類、頻道分組邏輯（從Python版本移植）

const PROJECT_MARKERS = ['合雅','合雄','禾雅','若水秧翠','若水央翠','若水泱翠','一靚','ㄧ靚','明玥','明月','泱玥','泱月','峰蘊','天母蒔麗','天母時麗','大河商爵',
  '夏沐','夏綠地','夏綠蒂','山禾','綠禾','星呈','沐蘊','洄山行','回山行','迴山行','琉蘊','流韻','琢蘊','綠美','藏萃',
  '蘊合','蘴靚','豐靚','豐尚','幸福城','幸福成','辛福城','敦富','丰尚','風尚','齊興','村泉','遠創力','接待中心','和雅','威帝',
  '東御苑','藝舍','秧悅','水湳建案','聯上智科','遠雄THE ONE','遠雄the one','遠雄MetaLink','遠雄metalink'];

function titleIsBuilding(title) {
  const t = String(title || '');
  if (t.includes('實價登錄')) return true;
  return PROJECT_MARKERS.some(m => t.includes(m));
}

// 頁面五大分類：建案頁／專家文章／建案熱區巡禮／生活提案(其他)／其他頁面
function classifyPage(url, title) {
  url = String(url || ''); title = String(title || '');
  if (url.includes('buildings')) return '建案頁';
  if (url.includes('life-proposal')) {
    if (url.includes('expert')) return '專家文章';
    if (url.includes('area')) return '建案熱區巡禮';
    return '生活提案(其他)';
  }
  if (titleIsBuilding(title)) return '建案頁';
  return '其他頁面';
}

// GSC查詢字 10大分類
function classifyKeyword(kw) {
  const k = String(kw || '').trim();
  if (/合雅|合雄|禾雅|若水秧翠|若水央翠|一靚|ㄧ靚|明玥|明月|峰蘊|天母蒔麗|天母時麗|大河商爵|夏沐|夏綠地|夏綠蒂|山禾|星呈|星鑽|沐蘊|泱玥|洄山行|琉蘊|琢蘊|綠美|藏萃|蘊合|蘴靚|豐靚|府中|幸福城|幸福成|敦富|丰尚|信義[Cc][Ee][Nn][Tt][Ee][Rr]|[Ee][Hh]6|[Aa][Hh]1|[Tt][Hh][Ee] ?[Oo][Nn][Ee]|[Mm]eta[Ll]ink|樂元|齊興|村泉|遠創力|接待中心|基地|格局|開價|和雅|威帝|楠梓建案|樂園/.test(k)) return '建案字';
  if (/^遠雄$|^遠雄房地產$|^遠雄建設$|^遠雄新建案$|^遠雄建案$|遠雄房地產官網|遠雄房地產發展股份有限公司|遠雄房屋|遠雄不動產|遠雄代銷|遠雄官網/.test(k)) return '品牌總稱';
  if (/青安|清安|房貸|對保/.test(k)) return '房貸/新青安';
  if (/稅|税|遺產|遗产|遺贈|免稅額|實物抵繳|擬制遺產|房地比|設籍滿6年|夫妻|空戶|空屋認定|自住事實|非屬贈與財產|贈與|赠与|買賣移轉棟數|審閱期/.test(k)) return '稅務規劃';
  if (/交屋|遷戶籍|遷戶口|驗屋|點交|過戶|戶籍遷入/.test(k)) return '交屋過戶/戶籍';
  if (/婚前買房|婚後買房|自用住宅|合資買房|養生村/.test(k)) return '人生階段購屋';
  if (/[Aa]7|北士科|大灣重劃區|高大特區|星鑽特區|亞灣205|205兵工廠|高雄建案|高雄預售屋|台中新建案|台中預售屋|預售屋|重劃區|台中七期|新莊副都心|梧棲|南科|中和工業區|亞洲新灣區|亞灣區|遠東通訊園區|永康公園|高雄新建案|新建案/.test(k)) return '區域/重劃區';
  if (/房市|空屋率|台股|劉佩真|李同榮|房地產|打房政策|房價/.test(k)) return '房市趨勢/總經';
  if (/清水模|玻璃清潔|擦玻璃|冷氣保養|雨遮法規|權狀|法定空地|停車場管理辦法|社區垃圾管理辦法|擔保債權確定期日|合法地政士查詢|地面師|代書|授信|梯廳|管理辦法|陽台法規|樓板厚度|停車位管理|包租代管|銀髮住宅/.test(k)) return '房產知識/法規/生活';
  return '其他/長尾';
}

// 依「來源/媒介」重建頻道分組
function classifyChannel(sourceMedium) {
  const sm = String(sourceMedium || '').toLowerCase().trim();
  if (sm === '(direct) / (none)') return 'Direct';
  if (sm === '(not set)') return 'Unassigned';
  if (/^(google|bing|yahoo|tw\.search\.yahoo\.com)\s*\/\s*organic/.test(sm)) return 'Organic Search';
  if (sm.includes('organic')) return 'Organic Search';
  if (/^google\s*\/\s*cpc/.test(sm) || sm.includes('google_kw') || sm.startsWith('gdn')) return 'Paid Search/Display';
  if (sm.startsWith('fb') || sm.startsWith('ig') || sm.includes('facebook') || sm.includes('instagram')) {
    return (sm.includes('paid') || /\/[a-z0-9]{2,5}$/.test(sm)) ? 'Paid Social' : 'Organic Social';
  }
  if (sm.startsWith('line') || sm.includes('liff.line')) return 'LINE';
  if (sm.includes('referral')) return 'Referral';
  return 'Other';
}

// UTM按鈕點擊：依到達頁面判斷目的地類型
function classifyDest(url) {
  const u = String(url || '');
  if (u.includes('/buildings/')) return '建案頁';
  if (u.includes('make_appointment') || u.includes('reservation')) return '預約賞屋頁';
  if (u.includes('/case/search')) return '建案總覽/搜尋頁';
  if (u.includes('/life-proposal') || u.includes('/life_proposal')) return '生活提案內容';
  if (u.replace(/\//g, '') === '') return '首頁';
  return '其他';
}

function normUrl(url) {
  let u = String(url || '').trim();
  u = u.replace(/^https?:\/\/[^/]+/, '');
  u = u.replace(/\/+$/, '');
  if (u && !u.startsWith('/')) u = '/' + u;
  return u;
}
