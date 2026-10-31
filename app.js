// 생활 가계부 — 수입·지출·저축·대출·고정 항목·예산
var ROOT = 'ledger';
var LOCAL_KEY = 'gagyebu-local-v1';
var MODE_KEY = 'gagyebu-mode';
var DEFAULT_SETTINGS = {
  incomeCats: ['급여', '상여금', '부수입', '이자·배당', '환급', '용돈·지원', '기타 수입'],
  expenseCats: ['식비', '외식·카페', '주거·관리비', '공과금', '통신비', '교통·차량', '보험료', '의료·건강', '교육', '생활용품', '의류·미용', '경조사', '헌금·후원', '문화·여가', '여행', '세금', '기타 지출'],
  methods: ['현금', '체크카드', '신용카드', '계좌이체', '자동이체']
};
var SAVING_KINDS = ['적금', '예금', '자유입출금', '청약', '연금', '투자', '비상금', '기타'];
var LOAN_METHODS = { equal: '원리금균등', principal: '원금균등', bullet: '만기일시' };
var LOAN_KINDS = ['주택담보대출', '전세자금대출', '신용대출', '마이너스통장', '학자금대출', '자동차 할부', '보험약관대출', '기타'];
var RATE_TYPES = { fixed: '고정금리', variable: '변동금리', mixed: '혼합형' };
var TYPE_NAME = { income: '수입', expense: '지출', saving: '저축', loan: '대출상환' };
var TYPE_IC = { income: '수입', expense: '지출', saving: '저축', loan: '대출' };
var WEEK = ['일', '월', '화', '수', '목', '금', '토'];

var _mode, _db, _me, _ref;
var D = {};
var cur = today().slice(0, 7);
var listType = '';
var curTab = 'home';
var F = null; // 입력 창 상태

/* ---------- 공통 ---------- */
function $(id) { return document.getElementById(id); }
function show(id) {
  ['setupScreen', 'loginScreen', 'deniedScreen', 'appScreen'].forEach(function (s) { $(s).classList.toggle('hidden', s !== id); });
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function lc(s) { return String(s || '').toLowerCase(); }
function num(n) { return Number(n) || 0; }
function won(n) { return Math.round(num(n)).toLocaleString('ko-KR') + '원'; }
function comma(n) { return Math.round(num(n)).toLocaleString('ko-KR'); }
function pad(n) { return String(n).padStart(2, '0'); }
function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function addMonth(m, k) { var d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + k, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
function daysIn(m) { return new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate(); }
function monthLabel(m) { return m.slice(0, 4) + '년 ' + (+m.slice(5, 7)) + '월'; }
function dayLabel(d) { var x = new Date(d + 'T00:00:00'); return (x.getMonth() + 1) + '월 ' + x.getDate() + '일 (' + WEEK[x.getDay()] + ')'; }
function monthsBetween(a, b) { return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)); }
function arr(x) { return x ? (Array.isArray(x) ? x : Object.keys(x).map(function (k) { return x[k]; })).filter(function (v) { return v != null; }) : []; }
function items(obj) { return Object.keys(obj || {}).map(function (k) { var v = Object.assign({}, obj[k]); v.id = k; return v; }); }
function keyOf(s) { return String(s).replace(/[.#$\[\]\/]/g, '_'); }
function toast(msg) {
  var t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 1800);
}
function applyTitle() {
  var t = (typeof APP_TITLE !== 'undefined' && APP_TITLE) || '생활 가계부';
  document.querySelectorAll('.app-title').forEach(function (el) { el.textContent = t; });
  document.title = t;
}
function moneyVal(el) { return num(String(el.value).replace(/[^\d]/g, '')); }
function moneyInput(el) {
  var v = String(el.value).replace(/[^\d]/g, '');
  el.value = v ? Number(v).toLocaleString('ko-KR') : '';
}
function download(name, text, type) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: type }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------- 데이터 ---------- */
function setts() {
  var s = D.settings || {};
  return {
    incomeCats: arr(s.incomeCats).length ? arr(s.incomeCats) : DEFAULT_SETTINGS.incomeCats,
    expenseCats: arr(s.expenseCats).length ? arr(s.expenseCats) : DEFAULT_SETTINGS.expenseCats,
    methods: arr(s.methods).length ? arr(s.methods) : DEFAULT_SETTINGS.methods
  };
}
function txs() { return items(D.tx); }
function savings() { return items(D.savings).sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'ko'); }); }
function loans() { return items(D.loans).sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'ko'); }); }
function recurs() { return items(D.recurring).sort(function (a, b) { return num(a.day) - num(b.day); }); }
function budgetOf(cat) { var b = (D.budget || {})[keyOf(cat)]; return b ? num(b.amount) : 0; }
function savingName(id) { var s = (D.savings || {})[id]; return s ? s.name : '(삭제된 저축)'; }
function loanName(id) { var l = (D.loans || {})[id]; return l ? l.name : '(삭제된 대출)'; }

// 저장: path 는 ledger 아래 경로, val 이 null 이면 삭제
function save(path, val) {
  var up = {}; up[path] = val;
  return saveMany(up);
}
function saveMany(up) {
  if (_mode === 'fb') return _db.ref(ROOT).update(up).catch(function (e) { alert('저장하지 못했습니다: ' + e.message); throw e; });
  Object.keys(up).forEach(function (p) { setIn(D, p.split('/'), up[p] == null ? null : JSON.parse(JSON.stringify(up[p]))); });
  persistLocal(); renderAll();
  return Promise.resolve();
}
function setIn(o, parts, v) {
  var k = parts.shift();
  if (!parts.length) { if (v == null) delete o[k]; else o[k] = v; return; }
  if (typeof o[k] !== 'object' || o[k] == null) o[k] = {};
  setIn(o[k], parts, v);
}
function persistLocal() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(D)); } catch (e) { alert('이 기기에 저장하지 못했습니다.'); } }
function newId() { return _mode === 'fb' ? _db.ref().push().key : Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ---------- 계산 ---------- */
function monthTx(m) { return txs().filter(function (t) { return String(t.date).slice(0, 7) === m; }); }
function sums(list) {
  var s = { income: 0, expense: 0, saving: 0, loan: 0 };
  list.forEach(function (t) {
    if (t.type === 'saving') s.saving += t.dir === 'out' ? -num(t.amount) : num(t.amount);
    else if (s[t.type] != null) s[t.type] += num(t.amount);
  });
  s.left = s.income - s.expense - s.saving - s.loan;
  return s;
}
function savingBalance(s) {
  var b = num(s.initial);
  txs().forEach(function (t) { if (t.type === 'saving' && t.savingId === s.id) b += t.dir === 'out' ? -num(t.amount) : num(t.amount); });
  return b;
}
function loanPaid(l) {
  var p = 0, i = 0;
  txs().forEach(function (t) { if (t.type === 'loan' && t.loanId === l.id) { p += num(t.principal); i += num(t.interest); } });
  return { principal: p, interest: i };
}
function loanBalance(l) { return Math.max(0, num(l.principal) - loanPaid(l).principal); }
function loanRate(l) { return num(l.rate) / 100 / 12; }
function loanStartM(l) { return String(l.start || today()).slice(0, 7); }
// m 월이 몇 회차인지 (시작한 다음 달이 1회차)
function loanPeriod(l, m) { return monthsBetween(loanStartM(l), m); }
function loanPayDay(l) { return num(l.payDay) || num(String(l.start || '').slice(8, 10)) || 1; }
function loanDue(l, m) { return m + '-' + pad(Math.min(loanPayDay(l), daysIn(m))); }
// 잔액 bal 에서 m 월에 낼 예상 원금/이자. 남은 회차로 다시 계산하므로 중도상환하면 이후 금액이 줄어듦
function loanSplitAt(l, bal, m) {
  var r = loanRate(l), n = num(l.months), k = loanPeriod(l, m), R = n - k + 1;
  if (bal <= 0) return { principal: 0, interest: 0 };
  var interest = Math.round(bal * r), principal = 0;
  if (!n) principal = 0;                       // 기간 없음(마이너스통장 등): 이자만
  else if (R <= 1) principal = bal;            // 마지막 회차 또는 만기 지남
  else if (k <= num(l.grace)) principal = 0;   // 거치기간: 이자만
  else if (l.method === 'principal') principal = Math.round(bal / R);
  else if (l.method === 'equal') principal = Math.round(r ? bal * r / (1 - Math.pow(1 + r, -R)) : bal / R) - interest;
  principal = Math.max(0, Math.min(bal, principal));
  return { principal: principal, interest: interest };
}
function loanSplit(l, m) { return loanSplitAt(l, loanBalance(l), m || today().slice(0, 7)); }
function loanEnd(l) {
  if (!l.start || !num(l.months)) return '';
  return addMonth(l.start.slice(0, 7), num(l.months)) + l.start.slice(7);
}
function loanTxIn(l, m) { return monthTx(m).filter(function (t) { return t.type === 'loan' && t.loanId === l.id; }); }
// m 월 상환 상태: paid(완료) / due(예정) / late(상환일 지남) / none(해당 없음) / done(상환 끝)
function loanStatus(l, m) {
  var paid = loanTxIn(l, m);
  if (paid.length) return { st: 'paid', tx: paid, amount: paid.reduce(function (a, t) { return a + num(t.amount); }, 0) };
  if (loanBalance(l) <= 0) return { st: 'done' };
  var k = loanPeriod(l, m);
  if (k < 1 || (num(l.months) && k > num(l.months) && m > today().slice(0, 7))) return { st: 'none' };
  var due = loanDue(l, m), s = loanSplit(l, m);
  return { st: due < today() ? 'late' : 'due', due: due, amount: s.principal + s.interest, split: s };
}
// 앞으로의 상환 스케줄 (이번 달을 이미 냈으면 다음 달부터)
function loanSchedule(l) {
  var bal = loanBalance(l), m = today().slice(0, 7), rows = [], end = loanEnd(l).slice(0, 7);
  if (loanTxIn(l, m).length) m = addMonth(m, 1);
  if (loanPeriod(l, m) < 1) m = addMonth(loanStartM(l), 1);
  while (bal > 0 && rows.length < 480) {
    if (!num(l.months) && rows.length >= 12) break;
    var s = loanSplitAt(l, bal, m);
    bal -= s.principal;
    rows.push({ k: loanPeriod(l, m), date: loanDue(l, m), principal: s.principal, interest: s.interest, bal: bal });
    if (end && m >= end) break;
    m = addMonth(m, 1);
  }
  return rows;
}
function pendingRecurs(m) {
  var done = {};
  monthTx(m).forEach(function (t) { if (t.recId) done[t.recId] = 1; });
  return recurs().filter(function (r) { return !done[r.id]; });
}
function recurAmount(r) {
  if (r.type === 'loan' && !num(r.amount)) { var l = (D.loans || {})[r.loanId]; if (l) { l = Object.assign({ id: r.loanId }, l); var s = loanSplit(l, cur); return s.principal + s.interest; } }
  return num(r.amount);
}

/* ---------- 시작 ---------- */
function init() {
  applyTitle();
  if (/KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent)) $('inappNotice').classList.remove('hidden');
  var hasFb = typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG.apiKey;
  if (!hasFb) {
    var m = null; try { m = localStorage.getItem(MODE_KEY); } catch (e) {}
    if (m === 'local') startLocal(); else show('setupScreen');
    return;
  }
  firebase.initializeApp(FIREBASE_CONFIG);
  _db = firebase.database();
  firebase.auth().onAuthStateChanged(function (u) {
    if (_ref) { _ref.off(); _ref = null; }
    D = {};
    if (!u) { show('loginScreen'); return; }
    _me = u; _mode = 'fb';
    function deny() { $('deniedEmail').textContent = u.email; show('deniedScreen'); }
    if (lc(u.email) !== lc(OWNER_EMAIL)) { deny(); return; }
    var first = true;
    _ref = _db.ref(ROOT);
    _ref.on('value', function (s) {
      D = s.val() || {};
      if (first) { first = false; enterApp(); } else renderAll();
    }, deny);
  });
}
function startLocal() {
  _mode = 'local';
  try { localStorage.setItem(MODE_KEY, 'local'); D = JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}; } catch (e) { D = {}; }
  enterApp();
}
function signIn() {
  var p = new firebase.auth.GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  firebase.auth().signInWithPopup(p).catch(function (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') firebase.auth().signInWithRedirect(p);
    else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') alert('로그인에 실패했습니다: ' + e.message);
  });
}
function logout() {
  if (_mode === 'fb') { firebase.auth().signOut(); return; }
  try { localStorage.removeItem(MODE_KEY); } catch (e) {}
  show('setupScreen');
}
function enterApp() {
  show('appScreen');
  $('whoami').textContent = _mode === 'fb' ? _me.email + ' (클라우드 저장)' : '이 기기에만 저장 중입니다.';
  $('logoutBtn').textContent = _mode === 'fb' ? '로그아웃' : '처음 화면으로';
  document.querySelectorAll('.tabbar button').forEach(function (b) { b.onclick = function () { setTab(b.getAttribute('data-tab')); }; });
  document.querySelectorAll('#typeChips button').forEach(function (b) {
    b.onclick = function () {
      listType = b.getAttribute('data-t');
      document.querySelectorAll('#typeChips button').forEach(function (x) { x.classList.toggle('on', x === b); });
      renderList();
    };
  });
  fillSettingsForm();
  renderAll();
}
function setTab(t) {
  curTab = t;
  ['home', 'list', 'assets', 'loan', 'plan', 'set'].forEach(function (x) { $('tab-' + x).classList.toggle('hidden', x !== t); });
  document.querySelectorAll('.tabbar button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === t); });
  $('monthNav').style.visibility = (t === 'home' || t === 'list' || t === 'loan') ? 'visible' : 'hidden';
  if (t === 'set') fillSettingsForm();
  if (t === 'plan') renderBudgetForm();
  window.scrollTo(0, 0);
}
function moveMonth(k) { cur = addMonth(cur, k); renderAll(); }

/* ---------- 화면 그리기 ---------- */
function renderAll() {
  $('monthLabel').textContent = monthLabel(cur);
  renderHome(); renderList(); renderAssets(); renderLoans(); renderPlan();
}

function renderHome() {
  var s = sums(monthTx(cur));
  $('sumLeft').textContent = won(s.left);
  $('sumLeft').className = s.left < 0 ? 'c-expense' : '';
  $('sumIncome').textContent = won(s.income);
  $('sumExpense').textContent = won(s.expense);
  $('sumSaving').textContent = won(s.saving);
  $('sumLoan').textContent = won(s.loan);

  // 고정 항목 미반영 알림
  var pend = pendingRecurs(cur);
  if (pend.length) {
    var tot = pend.reduce(function (a, r) { return a + recurAmount(r); }, 0);
    $('recurNotice').innerHTML = '<span>' + monthLabel(cur) + ' 고정 항목 <b>' + pend.length + '건</b>(' + won(tot) + ')이 아직 내역에 없습니다.</span>' +
      '<button class="btn sm primary" onclick="applyRecurs()">반영하기</button>';
    $('recurNotice').classList.remove('hidden');
  } else $('recurNotice').classList.add('hidden');

  // 자산
  var sv = savings().reduce(function (a, x) { return a + savingBalance(x); }, 0);
  var ln = loans().reduce(function (a, x) { return a + loanBalance(x); }, 0);
  $('assetSaving').textContent = won(sv);
  $('assetLoan').textContent = won(ln);
  $('assetNet').textContent = won(sv - ln);
  $('assetNet').className = sv - ln < 0 ? 'c-expense' : '';

  // 분류별 지출 + 예산
  var by = {};
  monthTx(cur).forEach(function (t) { if (t.type === 'expense') by[t.cat || '미분류'] = (by[t.cat || '미분류'] || 0) + num(t.amount); });
  setts().expenseCats.forEach(function (c) { if (budgetOf(c) && by[c] == null) by[c] = 0; });
  var cats = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; });
  var max = Math.max.apply(null, cats.map(function (c) { return by[c]; }).concat([1]));
  var bTot = setts().expenseCats.reduce(function (a, c) { return a + budgetOf(c); }, 0);
  $('budgetTotalLabel').textContent = bTot ? '예산 ' + won(bTot) + ' 중 ' + Math.round(s.expense / bTot * 100) + '% 사용' : '';
  $('catBars').innerHTML = cats.length ? cats.map(function (c) {
    var b = budgetOf(c), v = by[c];
    var w = b ? Math.min(100, v / b * 100) : v / max * 100;
    var over = b && v > b;
    var sub = b ? (over ? '<small class="over-txt">예산 ' + won(v - b) + ' 초과</small>' : '<small>예산 ' + won(b) + ' · 남은 ' + won(b - v) + '</small>') : '';
    return '<li><div class="bl"><span>' + esc(c) + ' ' + sub + '</span><b>' + won(v) + '</b></div>' +
      '<div class="track"><i class="' + (b ? (over ? 'over' : 'ok') : '') + '" style="width:' + w.toFixed(1) + '%"></i></div></li>';
  }).join('') : '<li class="empty">이번 달 지출 내역이 없습니다.</li>';

  // 최근 6개월
  var ms = [], i;
  for (i = 5; i >= 0; i--) ms.push(addMonth(cur, -i));
  var data = ms.map(function (m) { var x = sums(monthTx(m)); return { m: m, income: x.income, expense: x.expense, saving: Math.max(0, x.saving) }; });
  var tmax = Math.max.apply(null, data.map(function (d) { return Math.max(d.income, d.expense, d.saving); }).concat([1]));
  $('trend').innerHTML = data.map(function (d) {
    function col(k) { return '<i class="' + k + '" style="height:' + (d[k] / tmax * 100).toFixed(1) + '%" title="' + TYPE_NAME[k] + ' ' + won(d[k]) + '"></i>'; }
    return '<div class="m' + (d.m === cur ? ' cur' : '') + '"><div class="cols">' + col('income') + col('expense') + col('saving') + '</div><div class="lb">' + (+d.m.slice(5)) + '월</div></div>';
  }).join('');
}

function txSub(t) {
  if (t.type === 'saving') return esc(savingName(t.savingId)) + ' · ' + (t.dir === 'out' ? '출금' : '입금');
  if (t.type === 'loan') return esc(loanName(t.loanId)) + ' · 원금 ' + comma(t.principal) + ' / 이자 ' + comma(t.interest);
  return esc(t.cat || '미분류') + (t.method ? ' · ' + esc(t.method) : '');
}
function txRow(t) {
  var sign = t.type === 'income' || (t.type === 'saving' && t.dir === 'out') ? '+' : '−';
  var title = t.memo || (t.type === 'saving' ? savingName(t.savingId) : t.type === 'loan' ? loanName(t.loanId) : t.cat) || TYPE_NAME[t.type];
  return '<li class="tx" onclick="openTx(\'' + t.id + '\')"><span class="ic ' + t.type + '">' + TYPE_IC[t.type] + '</span>' +
    '<span class="tt"><b>' + esc(title) + '</b><small>' + txSub(t) + (t.recId ? ' · 고정' : '') + '</small></span>' +
    '<span class="am c-' + t.type + '">' + sign + comma(t.amount) + '</span></li>';
}
function renderList() {
  var q = lc($('listSearch').value).trim();
  var list = monthTx(cur).filter(function (t) {
    if (listType && t.type !== listType) return false;
    if (!q) return true;
    var hay = [t.memo, t.cat, t.method, t.savingId && savingName(t.savingId), t.loanId && loanName(t.loanId)].join(' ');
    return lc(hay).indexOf(q) >= 0;
  }).sort(function (a, b) { return String(b.date).localeCompare(a.date) || num(b.ts) - num(a.ts); });
  var s = sums(list);
  $('listSum').innerHTML = list.length ? ['income', 'expense', 'saving', 'loan'].filter(function (k) { return s[k]; }).map(function (k) {
    return '<span>' + TYPE_NAME[k] + ' <b class="c-' + k + '">' + won(s[k]) + '</b></span>';
  }).join('') + '<span>' + list.length + '건</span>' : '';
  if (!list.length) { $('txList').innerHTML = '<div class="card empty">' + monthLabel(cur) + ' 내역이 없습니다.<br>오른쪽 아래 + 버튼으로 추가하세요.</div>'; return; }
  var html = '', day = null, buf = [];
  function flush() {
    if (!buf.length) return;
    html += '<div class="day-hd"><span>' + dayLabel(day) + '</span></div><div class="card" style="padding:4px 12px"><ul class="list">' + buf.join('') + '</ul></div>';
    buf = [];
  }
  list.forEach(function (t) { if (t.date !== day) { flush(); day = t.date; } buf.push(txRow(t)); });
  flush();
  $('txList').innerHTML = html;
}

function renderAssets() {
  var sv = savings();
  $('savingList').innerHTML = sv.length ? sv.map(function (s) {
    var b = savingBalance(s), tg = num(s.target);
    var bar = tg ? '<div class="track" style="margin-top:6px"><i class="sv" style="width:' + Math.min(100, b / tg * 100).toFixed(1) + '%"></i></div>' : '';
    return '<li class="tx" onclick="openSaving(\'' + s.id + '\')"><span class="ic saving">' + esc(String(s.kind || '저축').slice(0, 2)) + '</span>' +
      '<span class="tt"><b>' + esc(s.name) + '</b><small>' + esc([s.bank, num(s.monthly) ? '매달 ' + comma(s.monthly) : '', tg ? '목표 ' + won(tg) + ' (' + Math.floor(b / tg * 100) + '%)' : '', s.maturity ? '만기 ' + s.maturity : ''].filter(Boolean).join(' · ')) + '</small>' + bar + '</span>' +
      '<span class="am c-saving">' + won(b) + '</span></li>';
  }).join('') : '<li class="empty">등록된 저축 통장이 없습니다.</li>';
}

/* ---------- 대출 대시보드 ---------- */
var ST_NAME = { paid: '완료', due: '예정', late: '상환일 지남' };
function rateText(l) { return (RATE_TYPES[l.rateType] || '고정금리') + ' ' + num(l.rate) + '%'; }
function renderLoans() {
  var ls = loans(), m = cur, yr = cur.slice(0, 4);
  var P = 0, bal = 0, plan = 0, paidAmt = 0, nPaid = 0, nAll = 0, yInt = 0, yPrin = 0;
  var rows = [];
  ls.forEach(function (l) {
    P += num(l.principal); bal += loanBalance(l);
    var s = loanStatus(l, m);
    if (s.st === 'paid' || s.st === 'due' || s.st === 'late') {
      nAll++; plan += s.amount;
      if (s.st === 'paid') { nPaid++; paidAmt += s.amount; }
      rows.push({ l: l, s: s });
    }
  });
  txs().forEach(function (t) { if (t.type === 'loan' && String(t.date).slice(0, 4) === yr) { yInt += num(t.interest); yPrin += num(t.principal); } });
  var pct = P ? (P - bal) / P * 100 : 0;
  $('loanSumBal').textContent = won(bal);
  $('loanSumPct').innerHTML = P ? '빌린 원금 ' + won(P) + ' 중 <b>' + pct.toFixed(1) + '%</b> 상환' : '';
  $('loanSumBar').style.width = pct.toFixed(1) + '%';
  $('loanSumPlan').textContent = won(plan);
  $('loanSumPaid').textContent = nAll ? nPaid + ' / ' + nAll + '건' : '-';
  $('loanSumYInt').textContent = won(yInt);
  $('loanSumYPrin').textContent = won(yPrin);
  $('loanYearLabel').textContent = yr + '년';
  $('loanYearLabel2').textContent = yr + '년';

  // 이번 달 상환 체크
  rows.sort(function (a, b) { return loanPayDay(a.l) - loanPayDay(b.l); });
  var alerts = ls.filter(function (l) {
    if (!l.rateReset || loanBalance(l) <= 0) return false;
    var d = (new Date(l.rateReset + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 864e5;
    return d >= -7 && d <= 45;
  }).map(function (l) { return '<div class="alert">' + esc(l.name) + ' 금리 변동일 ' + l.rateReset + ' — 바뀐 금리를 대출 정보에 고쳐 넣으세요.</div>'; }).join('');
  $('loanCheckTitle').textContent = monthLabel(m) + ' 상환 체크';
  $('loanCheck').innerHTML = alerts + (rows.length ? '<ul class="list">' + rows.map(function (x) {
    var l = x.l, s = x.s;
    var click = s.st === 'paid' ? 'openTx(\'' + s.tx[0].id + '\')' : 'payLoan(\'' + l.id + '\',\'' + m + '\')';
    var sub = s.st === 'paid' ? s.tx.map(function (t) { return (+t.date.slice(8)) + '일 원금 ' + comma(t.principal) + ' / 이자 ' + comma(t.interest); }).join(', ')
      : '매달 ' + loanPayDay(l) + '일 · 예상 원금 ' + comma(s.split.principal) + ' / 이자 ' + comma(s.split.interest);
    return '<li class="tx" onclick="' + click + '"><span class="st ' + s.st + '">' + ST_NAME[s.st] + '</span>' +
      '<span class="tt"><b>' + esc(l.name) + '</b><small>' + sub + '</small></span>' +
      '<span class="am c-loan">' + comma(s.amount) + (s.st !== 'paid' ? '<small>기록하기 ›</small>' : '') + '</span></li>';
  }).join('') + '</ul>' : '<div class="empty">' + monthLabel(m) + '에 상환할 대출이 없습니다.</div>');

  // 대출 목록
  $('loanList').innerHTML = ls.length ? ls.map(function (l) {
    var b = loanBalance(l), Pl = num(l.principal), p = Pl ? (Pl - b) / Pl * 100 : 0;
    var k = loanPeriod(l, today().slice(0, 7)), n = num(l.months), end = loanEnd(l), sp = loanSplit(l);
    var chips = [l.kind || '기타', rateText(l), LOAN_METHODS[l.method] || ''].concat(num(l.grace) ? ['거치 ' + num(l.grace) + '개월'] : []);
    var lines = b ? [
      ['월 상환 (예상)', won(sp.principal + sp.interest) + ' <small>원금 ' + comma(sp.principal) + ' + 이자 ' + comma(sp.interest) + '</small>'],
      ['기간', (l.start || '') + (end ? ' ~ ' + end : '') + (n ? ' <small>' + Math.max(0, Math.min(k, n)) + ' / ' + n + '회</small>' : '')],
      ['상환일 · 계좌', '매달 ' + loanPayDay(l) + '일' + (l.account ? ' · ' + esc(l.account) : '')]
    ] : [['상태', '상환 완료']];
    return '<div class="loan-card" onclick="openLoan(\'' + l.id + '\')">' +
      '<div class="lc-hd"><div><b>' + esc(l.name) + '</b><small>' + esc(l.lender || '') + '</small></div><div class="lc-bal">' + won(b) + '<small>남은 원금</small></div></div>' +
      '<div class="chips2">' + chips.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div>' +
      '<div class="track"><i class="ln" style="width:' + p.toFixed(1) + '%"></i></div><div class="lc-pct">' + p.toFixed(1) + '% 상환 · 빌린 원금 ' + won(Pl) + '</div>' +
      lines.map(function (x) { return '<div class="asset-row"><span class="muted">' + x[0] + '</span><span>' + x[1] + '</span></div>'; }).join('') + '</div>';
  }).join('') : '<div class="empty">등록된 대출이 없습니다.<br>위의 + 대출 추가 버튼으로 등록하세요.</div>';
}
function payLoan(id, m) {
  openTx(null, { type: 'loan', loanId: id, date: loanDue(Object.assign({ id: id }, D.loans[id]), m) });
}

function recurDesc(r) {
  if (r.type === 'saving') return savingName(r.savingId);
  if (r.type === 'loan') return loanName(r.loanId) + (num(r.amount) ? '' : ' · 금액 자동 계산');
  return (r.cat || '') + (r.method ? ' · ' + r.method : '');
}
function renderPlan() {
  var rs = recurs();
  $('recurList').innerHTML = rs.length ? rs.map(function (r) {
    return '<li class="tx" onclick="openRecur(\'' + r.id + '\')"><span class="ic ' + r.type + '">' + num(r.day) + '일</span>' +
      '<span class="tt"><b>' + esc(r.name) + '</b><small>' + TYPE_NAME[r.type] + ' · ' + esc(recurDesc(r)) + '</small></span>' +
      '<span class="am c-' + r.type + '">' + comma(recurAmount(r)) + '</span></li>';
  }).join('') : '<li class="empty">등록된 고정 항목이 없습니다.</li>';
  var inc = 0, out = 0;
  rs.forEach(function (r) { if (r.type === 'income') inc += recurAmount(r); else out += recurAmount(r); });
  $('recurSum').innerHTML = rs.length ? '<span>고정 수입 ' + won(inc) + ' / 고정 지출·저축·상환 ' + won(out) + '</span><b class="' + (inc - out < 0 ? 'c-expense' : '') + '">' + won(inc - out) + '</b>' : '';
}
function renderBudgetForm() {
  $('budgetForm').innerHTML = setts().expenseCats.map(function (c) {
    var b = budgetOf(c);
    return '<div class="budget-row"><span>' + esc(c) + '</span><input class="input" inputmode="numeric" data-cat="' + esc(c) + '" value="' + (b ? comma(b) : '') + '" placeholder="0" oninput="moneyInput(this)"></div>';
  }).join('');
}
function saveBudget() {
  var b = {};
  document.querySelectorAll('#budgetForm input').forEach(function (el) {
    var v = moneyVal(el);
    if (v) b[keyOf(el.getAttribute('data-cat'))] = { cat: el.getAttribute('data-cat'), amount: v };
  });
  save('budget', b).then(function () { toast('예산을 저장했습니다'); });
}

/* ---------- 입력 창 ---------- */
function openSheet(title, html) {
  $('sheetTitle').textContent = title;
  $('sheetBody').innerHTML = html;
  $('sheetBody').querySelectorAll('select').forEach(prettySelect);
  $('sheetBg').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeSheet() { $('sheetBg').classList.add('hidden'); document.body.style.overflow = ''; F = null; }
$('sheetBg').onclick = function (e) { if (e.target === $('sheetBg')) closeSheet(); };
function opts(list, sel, empty) {
  return (empty ? '<option value="">' + esc(empty) + '</option>' : '') + list.map(function (o) {
    var v = typeof o === 'object' ? o.v : o, t = typeof o === 'object' ? o.t : o;
    return '<option value="' + esc(v) + '"' + (String(v) === String(sel == null ? '' : sel) ? ' selected' : '') + '>' + esc(t) + '</option>';
  }).join('');
}
// 선택 칸: 휴대폰 기본 선택 창 대신 앱 디자인의 선택 창. 원래 <select>는 숨겨 두고 값 저장용으로 그대로 사용
function prettySelect(sel) {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'input pick';
  sel.parentNode.insertBefore(btn, sel);
  sel.classList.add('hidden');
  function sync() { var o = sel.options[sel.selectedIndex]; btn.textContent = o ? o.text : ''; btn.classList.toggle('empty', !sel.value); }
  btn.onclick = function () { openPicker(sel, sync); };
  sync();
}
function openPicker(sel, sync) {
  if (!$('pickBg')) {
    var el = document.createElement('div');
    el.id = 'pickBg'; el.className = 'pick-bg hidden';
    el.innerHTML = '<div class="pick-sheet"><div class="sheet-hd"><h3 id="pickTitle"></h3><button class="icon-btn" aria-label="닫기">×</button></div><ul id="pickList"></ul></div>';
    el.onclick = function (e) { if (e.target === el || e.target.classList.contains('icon-btn')) el.classList.add('hidden'); };
    document.body.appendChild(el);
  }
  var lb = sel.closest('.field') && sel.closest('.field').querySelector('label');
  $('pickTitle').textContent = lb ? lb.childNodes[0].textContent.trim() + ' 선택' : '선택';
  $('pickList').innerHTML = Array.prototype.map.call(sel.options, function (o, i) {
    return '<li data-i="' + i + '" class="' + (i === sel.selectedIndex ? 'on' : '') + (o.value ? '' : ' none') + '"><span>' + esc(o.text) + '</span>' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></li>';
  }).join('');
  Array.prototype.forEach.call($('pickList').children, function (li) {
    li.onclick = function () {
      sel.selectedIndex = +li.getAttribute('data-i');
      sync();
      $('pickBg').classList.add('hidden');
      sel.dispatchEvent(new Event('change'));
    };
  });
  $('pickBg').classList.remove('hidden');
  var on = $('pickList').querySelector('.on');
  if (on) on.scrollIntoView({ block: 'center' });
}
function segHtml(id, list, val) {
  return '<div class="seg" id="' + id + '">' + list.map(function (o) { return '<button type="button" data-v="' + o[0] + '" class="' + (o[0] === val ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>';
}
function bindSeg(id, cb) {
  document.querySelectorAll('#' + id + ' button').forEach(function (b) { b.onclick = function () { cb(b.getAttribute('data-v')); }; });
}
function moneyField(id, label, v, hint) {
  return '<div class="field"><label>' + label + '</label><input id="' + id + '" class="input money" inputmode="numeric" placeholder="0" value="' + (num(v) ? comma(v) : '') + '" oninput="moneyInput(this)">' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
}
function textField(id, label, v, type, ph) {
  return '<div class="field"><label>' + label + '</label><input id="' + id + '" class="input" type="' + (type || 'text') + '" value="' + esc(v == null ? '' : v) + '" placeholder="' + esc(ph || '') + '"></div>';
}

// 수입·지출·저축·대출상환 내역
function openTx(id, preset) {
  var t = id ? Object.assign({ id: id }, D.tx[id]) : Object.assign({ type: 'expense', date: cur === today().slice(0, 7) ? today() : cur + '-01' }, preset || {});
  F = t;
  if (!id && t.type === 'loan' && t.loanId) fillLoanSplit();
  drawTx();
}
function readTx() {
  if (!F || !$('txAmount')) return;
  F.amount = moneyVal($('txAmount'));
  F.date = $('txDate').value;
  F.memo = $('txMemo').value;
  if ($('txCat')) F.cat = $('txCat').value;
  if ($('txMethod')) F.method = $('txMethod').value;
  if ($('txSaving')) F.savingId = $('txSaving').value;
  if ($('txLoan')) F.loanId = $('txLoan').value;
  if ($('txPrin')) { F.principal = moneyVal($('txPrin')); F.interest = moneyVal($('txInt')); }
}
function fillLoanSplit() {
  var l = (D.loans || {})[F.loanId];
  if (!l) return;
  var s = loanSplit(Object.assign({ id: F.loanId }, l), String(F.date || today()).slice(0, 7));
  F.principal = s.principal; F.interest = s.interest; F.amount = s.principal + s.interest;
}
function drawTx() {
  var t = F, st = setts(), h = '';
  h += segHtml('txType', [['expense', '지출'], ['income', '수입'], ['saving', '저축'], ['loan', '대출상환']], t.type);
  if (t.type === 'loan') {
    var lsel = loans().filter(function (l) { return loanBalance(l) > 0 || l.id === t.loanId; });
    if (!lsel.length) h += '<p class="notice">먼저 대출 탭에서 대출을 추가해 주세요.</p>';
    h += '<div class="field"><label>대출</label><select id="txLoan" class="input">' + opts(lsel.map(function (l) { return { v: l.id, t: l.name + ' (잔액 ' + won(loanBalance(l)) + ')' }; }), t.loanId, '대출 선택') + '</select></div>';
    h += '<div class="row2">' + moneyField('txPrin', '원금', t.principal) + moneyField('txInt', '이자', t.interest) + '</div>';
    h += moneyField('txAmount', '합계 (자동 계산)', t.amount);
  } else {
    h += moneyField('txAmount', '금액', t.amount);
  }
  h += textField('txDate', '날짜', t.date, 'date');
  if (t.type === 'income') h += '<div class="field"><label>분류</label><select id="txCat" class="input">' + opts(st.incomeCats, t.cat) + '</select></div>';
  if (t.type === 'expense') {
    h += '<div class="row2"><div class="field"><label>분류</label><select id="txCat" class="input">' + opts(st.expenseCats, t.cat) + '</select></div>' +
      '<div class="field"><label>결제 수단</label><select id="txMethod" class="input">' + opts(st.methods, t.method, '선택 안 함') + '</select></div></div>';
  }
  if (t.type === 'saving') {
    var sv = savings();
    if (!sv.length) h += '<p class="notice">먼저 저축 탭에서 저축 통장을 추가해 주세요.</p>';
    h += segHtml('txDir', [['in', '입금 (저축)'], ['out', '출금 (꺼내 씀)']], t.dir === 'out' ? 'out' : 'in');
    h += '<div class="field"><label>저축 통장</label><select id="txSaving" class="input">' + opts(sv.map(function (s) { return { v: s.id, t: s.name + ' (' + won(savingBalance(s)) + ')' }; }), t.savingId, '통장 선택') + '</select></div>';
  }
  h += textField('txMemo', '메모', t.memo, 'text', t.type === 'expense' ? '예: 마트 장보기' : '');
  h += '<div class="btns">' + (t.id ? '<button class="btn red" onclick="delTx()">삭제</button>' : '') + '<button class="btn primary" onclick="saveTx()">저장</button></div>';
  openSheet(t.id ? '내역 수정' : '내역 추가', h);

  bindSeg('txType', function (v) { readTx(); F.type = v; if (v === 'loan') fillLoanSplit(); drawTx(); });
  if ($('txDir')) bindSeg('txDir', function (v) { F.dir = v; document.querySelectorAll('#txDir button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === v); }); });
  if ($('txLoan')) {
    $('txLoan').onchange = function () { readTx(); fillLoanSplit(); drawTx(); };
    var sync = function () { $('txAmount').value = comma(moneyVal($('txPrin')) + moneyVal($('txInt'))); };
    $('txPrin').addEventListener('input', sync);
    $('txInt').addEventListener('input', sync);
    $('txAmount').readOnly = true;
  }
  if (!t.id) setTimeout(function () { $('txAmount').focus(); }, 50);
}
function saveTx() {
  readTx();
  var t = F;
  if (!t.amount) { alert('금액을 입력해 주세요.'); return; }
  if (!t.date) { alert('날짜를 입력해 주세요.'); return; }
  if (t.type === 'saving' && !t.savingId) { alert('저축 통장을 선택해 주세요.'); return; }
  if (t.type === 'loan' && !t.loanId) { alert('대출을 선택해 주세요.'); return; }
  var o = { type: t.type, date: t.date, amount: t.amount, memo: t.memo || '', ts: t.ts || Date.now() };
  if (t.recId) o.recId = t.recId;
  if (t.type === 'income') o.cat = t.cat || '';
  if (t.type === 'expense') { o.cat = t.cat || ''; o.method = t.method || ''; }
  if (t.type === 'saving') { o.savingId = t.savingId; o.dir = t.dir === 'out' ? 'out' : 'in'; }
  if (t.type === 'loan') { o.loanId = t.loanId; o.principal = t.principal || 0; o.interest = t.interest || 0; }
  var id = t.id || newId();
  save('tx/' + id, o).then(function () { closeSheet(); toast('저장했습니다'); });
}
function delTx() {
  if (!confirm('이 내역을 삭제할까요?')) return;
  save('tx/' + F.id, null).then(function () { closeSheet(); toast('삭제했습니다'); });
}

// 저축 통장
function openSaving(id) {
  var s = id ? Object.assign({ id: id }, D.savings[id]) : { kind: '적금' };
  var h = '';
  if (id) {
    var hist = txs().filter(function (t) { return t.type === 'saving' && t.savingId === id; }).sort(function (a, b) { return String(b.date).localeCompare(a.date); });
    var inSum = 0, outSum = 0;
    hist.forEach(function (t) { if (t.dir === 'out') outSum += num(t.amount); else inSum += num(t.amount); });
    h += '<div class="detail"><div class="asset-row total" style="margin:0;border:0;padding-top:4px"><span>현재 잔액</span><b class="c-saving">' + won(savingBalance(s)) + '</b></div>' +
      '<div class="asset-row"><span>시작 잔액</span><span>' + won(s.initial) + '</span></div>' +
      '<div class="asset-row"><span>입금 합계</span><span>' + won(inSum) + '</span></div>' +
      '<div class="asset-row"><span>출금 합계</span><span>' + won(outSum) + '</span></div></div>';
    h += '<button class="btn block primary" style="margin:0 0 14px" onclick="closeSheet();openTx(null,{type:\'saving\',savingId:\'' + id + '\',amount:' + num(s.monthly) + '})">입금·출금 기록하기</button>';
    if (hist.length) h += '<div class="field"><label>최근 기록</label><ul class="list">' + hist.slice(0, 8).map(txRow).join('') + '</ul></div>';
  }
  h += textField('svName', '이름', s.name, 'text', '예: 주택청약, 비상금 통장');
  h += '<div class="row2"><div class="field"><label>종류</label><select id="svKind" class="input">' + opts(SAVING_KINDS, s.kind) + '</select></div>' + textField('svBank', '은행·기관', s.bank) + '</div>';
  h += moneyField('svInitial', '시작 잔액', s.initial, '이 앱을 쓰기 시작할 때 통장에 이미 있던 금액');
  h += '<div class="row2">' + moneyField('svMonthly', '매달 넣는 금액', s.monthly) + moneyField('svTarget', '목표 금액', s.target) + '</div>';
  h += textField('svMaturity', '만기일', s.maturity, 'date');
  h += textField('svMemo', '메모', s.memo);
  h += '<div class="btns">' + (id ? '<button class="btn red" onclick="delSaving(\'' + id + '\')">삭제</button>' : '') + '<button class="btn primary" onclick="saveSaving(\'' + (id || '') + '\')">저장</button></div>';
  openSheet(id ? s.name : '저축 통장 추가', h);
}
function saveSaving(id) {
  var o = { name: $('svName').value.trim(), kind: $('svKind').value, bank: $('svBank').value.trim(), initial: moneyVal($('svInitial')),
    monthly: moneyVal($('svMonthly')), target: moneyVal($('svTarget')), maturity: $('svMaturity').value, memo: $('svMemo').value.trim() };
  if (!o.name) { alert('이름을 입력해 주세요.'); return; }
  save('savings/' + (id || newId()), o).then(function () { closeSheet(); toast('저장했습니다'); });
}
function delSaving(id) {
  var n = txs().filter(function (t) { return t.savingId === id; }).length;
  if (!confirm('이 저축 통장을 삭제할까요?' + (n ? '\n입출금 기록 ' + n + '건은 내역에 그대로 남습니다.' : ''))) return;
  save('savings/' + id, null).then(function () { closeSheet(); toast('삭제했습니다'); });
}

// 대출: 상세 보기 (정보 · 상환 스케줄 · 상환 이력 · 금리 변경 이력)
function openLoan(id) {
  if (!id) { editLoan(); return; }
  var l = Object.assign({ id: id }, D.loans[id]);
  var paid = loanPaid(l), bal = loanBalance(l), n = num(l.months), end = loanEnd(l);
  var k = Math.max(0, Math.min(loanPeriod(l, today().slice(0, 7)), n || 9999));
  var sched = bal ? loanSchedule(l) : [];
  var futInt = sched.reduce(function (a, x) { return a + x.interest; }, 0);
  function row(a, b) { return '<div class="asset-row"><span>' + a + '</span><span>' + b + '</span></div>'; }
  var h = '<div class="detail"><div class="asset-row total" style="margin:0;border:0;padding-top:4px"><span>남은 원금</span><b class="c-loan">' + won(bal) + '</b></div>' +
    '<div class="track" style="margin:6px 0 8px"><i class="ln" style="width:' + (num(l.principal) ? ((num(l.principal) - bal) / num(l.principal) * 100).toFixed(1) : 0) + '%"></i></div>' +
    row('빌린 원금', won(l.principal)) + row('갚은 원금', won(paid.principal)) + row('지금까지 낸 이자', won(paid.interest)) +
    (bal && sched.length ? row('앞으로 낼 이자 (예상)', won(futInt)) : '') + '</div>';
  h += '<div class="detail">' +
    row('대출 유형', esc(l.kind || '기타')) + row('은행·기관', esc(l.lender || '-')) +
    row('금리', rateText(l) + (l.rateBase ? ' <small class="muted">(' + esc(l.rateBase) + ')</small>' : '')) +
    (l.rateReset ? row('다음 금리 변동일', l.rateReset) : '') +
    row('상환 방식', (LOAN_METHODS[l.method] || '-') + (num(l.grace) ? ' · 거치 ' + num(l.grace) + '개월' : '')) +
    row('기간', (l.start || '-') + (end ? ' ~ ' + end : '') + (n ? ' (' + n + '개월)' : '')) +
    (n ? row('진행', k + ' / ' + n + '회차' + (bal ? ' · 남은 상환 ' + sched.length + '회' : '')) : '') +
    row('상환일', '매달 ' + loanPayDay(l) + '일') +
    (l.account ? row('출금 계좌', esc(l.account)) : '') +
    (l.earlyFee ? row('중도상환수수료', esc(l.earlyFee)) : '') +
    (l.memo ? row('메모', esc(l.memo)) : '') + '</div>';
  h += '<div class="btns" style="margin:0 0 16px">' + (bal ? '<button class="btn primary" onclick="closeSheet();payLoan(\'' + id + '\',\'' + today().slice(0, 7) + '\')">상환 기록하기</button>' : '') +
    '<button class="btn" onclick="editLoan(\'' + id + '\')">정보 수정</button></div>';

  if (sched.length) {
    h += '<h4 class="sec">앞으로의 상환 스케줄 <small class="muted">' + sched.length + '회</small></h4>' +
      '<div class="tbl-wrap' + (sched.length > 12 ? ' fold' : '') + '" id="schedWrap"><table class="tbl"><thead><tr><th>회차</th><th>상환일</th><th>원금</th><th>이자</th><th>남은 원금</th></tr></thead><tbody>' +
      sched.map(function (x) { return '<tr><td>' + x.k + '</td><td>' + x.date.slice(2).replace(/-/g, '.') + '</td><td>' + comma(x.principal) + '</td><td>' + comma(x.interest) + '</td><td>' + comma(x.bal) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' +
      (sched.length > 12 ? '<button class="btn block sm" onclick="$(\'schedWrap\').classList.remove(\'fold\');this.remove()">전체 ' + sched.length + '회 보기</button>' : '') +
      '<p class="hint">남은 원금 × 연 이자율 ÷ 12 로 계산한 예상치입니다. 변동금리는 금리가 바뀌면 대출 정보의 금리를 고치면 다시 계산됩니다.</p>';
  }
  var hist = txs().filter(function (t) { return t.type === 'loan' && t.loanId === id; }).sort(function (a, b) { return String(b.date).localeCompare(a.date); });
  h += '<h4 class="sec">상환 이력 <small class="muted">' + hist.length + '건</small></h4>' +
    (hist.length ? '<ul class="list">' + hist.map(txRow).join('') + '</ul>' : '<div class="empty">아직 상환 기록이 없습니다.</div>');
  var log = items(l.rateLog).sort(function (a, b) { return String(b.date).localeCompare(a.date); });
  if (log.length) h += '<h4 class="sec">금리 변경 이력</h4>' + log.map(function (x) { return row(x.date, num(x.from) + '% → <b>' + num(x.to) + '%</b>'); }).join('');
  openSheet(l.name, h);
}
// 대출: 정보 입력·수정
function editLoan(id) {
  var l = id ? Object.assign({ id: id }, D.loans[id]) : { method: 'equal', rateType: 'fixed', kind: '주택담보대출', start: today() };
  var h = '';
  h += textField('lnName', '이름', l.name, 'text', '예: 아파트 주택담보대출');
  h += '<div class="row2"><div class="field"><label>대출 유형</label><select id="lnKind" class="input">' + opts(LOAN_KINDS, l.kind || '기타') + '</select></div>' + textField('lnLender', '은행·기관', l.lender) + '</div>';
  h += moneyField('lnPrincipal', '빌린 원금', l.principal, '이미 일부 갚은 대출은, 앱을 쓰기 시작하는 시점의 남은 원금을 넣고 시작일·기간도 그 시점 기준으로 넣으면 됩니다.');
  h += '<h4 class="sec">금리</h4>';
  h += '<div class="row2"><div class="field"><label>금리 방식</label><select id="lnRateType" class="input">' +
    opts(Object.keys(RATE_TYPES).map(function (k) { return { v: k, t: RATE_TYPES[k] }; }), l.rateType || 'fixed') + '</select></div>' +
    textField('lnRate', '현재 연 이자율 (%)', l.rate, 'number', '예: 4.2') + '</div>';
  h += '<div class="row2">' + textField('lnRateBase', '기준금리·가산금리', l.rateBase, 'text', '예: COFIX 6개월 + 1.3%') + textField('lnRateReset', '다음 금리 변동일', l.rateReset, 'date') + '</div>';
  h += '<h4 class="sec">기간 · 상환</h4>';
  h += '<div class="row2">' + textField('lnStart', '대출 시작일', l.start, 'date') + textField('lnMonths', '기간 (개월)', l.months, 'number', '예: 360') + '</div>';
  h += '<div class="row2"><div class="field"><label>상환 방식</label><select id="lnMethod" class="input">' +
    opts(Object.keys(LOAN_METHODS).map(function (k) { return { v: k, t: LOAN_METHODS[k] }; }), l.method) + '</select></div>' +
    textField('lnGrace', '거치기간 (개월)', l.grace, 'number', '없으면 비움') + '</div>';
  h += '<div class="row2"><div class="field"><label>매달 상환일</label><select id="lnPayDay" class="input">' +
    opts(Array.apply(null, Array(31)).map(function (_, i) { return { v: i + 1, t: (i + 1) + '일' }; }), loanPayDay(l)) + '</select></div>' +
    textField('lnAccount', '출금 계좌', l.account, 'text', '예: 국민 급여통장') + '</div>';
  h += textField('lnEarlyFee', '중도상환수수료', l.earlyFee, 'text', '예: 1.2% (3년 이내)');
  h += textField('lnMemo', '메모', l.memo);
  h += '<p class="hint">기간이 없는 대출(마이너스통장 등)은 기간을 비워 두면 매달 이자만 계산합니다.</p>';
  h += '<div class="btns">' + (id ? '<button class="btn red" onclick="delLoan(\'' + id + '\')">삭제</button>' : '') + '<button class="btn primary" onclick="saveLoan(\'' + (id || '') + '\')">저장</button></div>';
  openSheet(id ? l.name + ' 정보 수정' : '대출 추가', h);
}
function saveLoan(id) {
  var o = { name: $('lnName').value.trim(), kind: $('lnKind').value, lender: $('lnLender').value.trim(), principal: moneyVal($('lnPrincipal')),
    rateType: $('lnRateType').value, rate: num($('lnRate').value), rateBase: $('lnRateBase').value.trim(), rateReset: $('lnRateReset').value,
    start: $('lnStart').value, months: Math.round(num($('lnMonths').value)), method: $('lnMethod').value, grace: Math.round(num($('lnGrace').value)),
    payDay: num($('lnPayDay').value), account: $('lnAccount').value.trim(), earlyFee: $('lnEarlyFee').value.trim(), memo: $('lnMemo').value.trim() };
  if (!o.name) { alert('이름을 입력해 주세요.'); return; }
  if (!o.principal) { alert('원금을 입력해 주세요.'); return; }
  var old = id ? D.loans[id] : null;
  o.rateLog = (old && old.rateLog) || {};
  if (old && num(old.rate) !== o.rate) o.rateLog[newId()] = { date: today(), from: num(old.rate), to: o.rate };
  var nid = id || newId();
  save('loans/' + nid, o).then(function () { toast('저장했습니다'); if (id) openLoan(id); else closeSheet(); });
}
function delLoan(id) {
  var n = txs().filter(function (t) { return t.loanId === id; }).length;
  if (!confirm('이 대출을 삭제할까요?' + (n ? '\n상환 기록 ' + n + '건은 내역에 그대로 남습니다.' : ''))) return;
  save('loans/' + id, null).then(function () { closeSheet(); toast('삭제했습니다'); });
}

// 매달 고정 항목
function openRecur(id) {
  var r = id ? Object.assign({ id: id }, D.recurring[id]) : { type: 'expense', day: 25 };
  F = r;
  drawRecur();
}
function readRecur() {
  if (!F || !$('rcName')) return;
  F.name = $('rcName').value; F.amount = moneyVal($('rcAmount')); F.day = $('rcDay').value;
  if ($('rcCat')) F.cat = $('rcCat').value;
  if ($('rcMethod')) F.method = $('rcMethod').value;
  if ($('rcSaving')) F.savingId = $('rcSaving').value;
  if ($('rcLoan')) F.loanId = $('rcLoan').value;
}
function drawRecur() {
  var r = F, st = setts(), h = '';
  h += segHtml('rcType', [['expense', '지출'], ['income', '수입'], ['saving', '저축'], ['loan', '대출상환']], r.type);
  h += textField('rcName', '이름', r.name, 'text', r.type === 'income' ? '예: 월급' : '예: 아파트 관리비');
  h += '<div class="row2">' + moneyField('rcAmount', '금액', r.amount, r.type === 'loan' ? '비워 두면 매달 남은 원금으로 자동 계산' : '') +
    '<div class="field"><label>매달 날짜</label><select id="rcDay" class="input">' + opts(Array.apply(null, Array(31)).map(function (_, i) { return { v: i + 1, t: (i + 1) + '일' + (i === 30 ? ' (말일)' : '') }; }), r.day) + '</select></div></div>';
  if (r.type === 'income') h += '<div class="field"><label>분류</label><select id="rcCat" class="input">' + opts(st.incomeCats, r.cat) + '</select></div>';
  if (r.type === 'expense') h += '<div class="row2"><div class="field"><label>분류</label><select id="rcCat" class="input">' + opts(st.expenseCats, r.cat) + '</select></div>' +
    '<div class="field"><label>결제 수단</label><select id="rcMethod" class="input">' + opts(st.methods, r.method, '선택 안 함') + '</select></div></div>';
  if (r.type === 'saving') h += '<div class="field"><label>저축 통장</label><select id="rcSaving" class="input">' + opts(savings().map(function (s) { return { v: s.id, t: s.name }; }), r.savingId, '통장 선택') + '</select></div>';
  if (r.type === 'loan') h += '<div class="field"><label>대출</label><select id="rcLoan" class="input">' + opts(loans().map(function (l) { return { v: l.id, t: l.name }; }), r.loanId, '대출 선택') + '</select></div>';
  h += '<div class="btns">' + (r.id ? '<button class="btn red" onclick="delRecur()">삭제</button>' : '') + '<button class="btn primary" onclick="saveRecur()">저장</button></div>';
  openSheet(r.id ? '고정 항목 수정' : '고정 항목 추가', h);
  bindSeg('rcType', function (v) { readRecur(); F.type = v; drawRecur(); });
}
function saveRecur() {
  readRecur();
  var r = F;
  if (!String(r.name || '').trim()) { alert('이름을 입력해 주세요.'); return; }
  if (r.type === 'saving' && !r.savingId) { alert('저축 통장을 선택해 주세요.'); return; }
  if (r.type === 'loan' && !r.loanId) { alert('대출을 선택해 주세요.'); return; }
  if (r.type !== 'loan' && !r.amount) { alert('금액을 입력해 주세요.'); return; }
  var o = { name: r.name.trim(), type: r.type, amount: r.amount || 0, day: num(r.day) || 1 };
  if (r.type === 'income' || r.type === 'expense') o.cat = r.cat || '';
  if (r.type === 'expense') o.method = r.method || '';
  if (r.type === 'saving') o.savingId = r.savingId;
  if (r.type === 'loan') o.loanId = r.loanId;
  save('recurring/' + (r.id || newId()), o).then(function () { closeSheet(); toast('저장했습니다'); });
}
function delRecur() {
  if (!confirm('이 고정 항목을 삭제할까요?\n이미 반영된 내역은 그대로 남습니다.')) return;
  save('recurring/' + F.id, null).then(function () { closeSheet(); toast('삭제했습니다'); });
}
function applyRecurs() {
  var pend = pendingRecurs(cur);
  if (!pend.length) return;
  if (!confirm(monthLabel(cur) + ' 고정 항목 ' + pend.length + '건을 내역에 추가할까요?\n추가한 뒤에도 하나씩 고칠 수 있습니다.')) return;
  var up = {}, ts = Date.now();
  pend.forEach(function (r, i) {
    var o = { type: r.type, date: cur + '-' + pad(Math.min(num(r.day) || 1, daysIn(cur))), amount: num(r.amount), memo: r.name, recId: r.id, ts: ts + i };
    if (r.type === 'income' || r.type === 'expense') o.cat = r.cat || '';
    if (r.type === 'expense') o.method = r.method || '';
    if (r.type === 'saving') { o.savingId = r.savingId; o.dir = 'in'; }
    if (r.type === 'loan') {
      var l = (D.loans || {})[r.loanId];
      if (!l) return;
      var s = loanSplit(Object.assign({ id: r.loanId }, l), cur);
      if (num(r.amount)) { o.interest = Math.min(s.interest, num(r.amount)); o.principal = num(r.amount) - o.interest; }
      else { o.principal = s.principal; o.interest = s.interest; o.amount = s.principal + s.interest; }
      o.loanId = r.loanId;
    }
    if (o.amount) up['tx/' + newId()] = o;
  });
  saveMany(up).then(function () { toast(Object.keys(up).length + '건을 반영했습니다'); });
}

/* ---------- 설정 ---------- */
function fillSettingsForm() {
  var s = setts();
  $('setIncomeCats').value = s.incomeCats.join('\n');
  $('setExpenseCats').value = s.expenseCats.join('\n');
  $('setMethods').value = s.methods.join('\n');
}
function lines(id) {
  var seen = {};
  return $(id).value.split('\n').map(function (x) { return x.trim(); }).filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; });
}
function saveSettings() {
  var o = { incomeCats: lines('setIncomeCats'), expenseCats: lines('setExpenseCats'), methods: lines('setMethods') };
  if (!o.incomeCats.length || !o.expenseCats.length) { alert('수입·지출 분류는 하나 이상 있어야 합니다.'); return; }
  save('settings', o).then(function () { fillSettingsForm(); toast('분류를 저장했습니다'); });
}
function csvCell(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function exportCSV() {
  var rows = [['날짜', '구분', '분류', '금액', '결제수단', '저축통장', '입출금', '대출', '원금', '이자', '메모']];
  txs().sort(function (a, b) { return String(a.date).localeCompare(b.date); }).forEach(function (t) {
    rows.push([t.date, TYPE_NAME[t.type], t.cat || '', num(t.amount), t.method || '', t.savingId ? savingName(t.savingId) : '', t.type === 'saving' ? (t.dir === 'out' ? '출금' : '입금') : '',
      t.loanId ? loanName(t.loanId) : '', t.type === 'loan' ? num(t.principal) : '', t.type === 'loan' ? num(t.interest) : '', t.memo || '']);
  });
  download('가계부_내역_' + today() + '.csv', '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'), 'text/csv;charset=utf-8');
}
function exportJSON() {
  download('가계부_백업_' + today() + '.json', JSON.stringify(D, null, 1), 'application/json');
}
function restoreJSON(input) {
  var f = input.files[0]; input.value = '';
  if (!f) return;
  var rd = new FileReader();
  rd.onload = function () {
    var o;
    try { o = JSON.parse(rd.result); } catch (e) { alert('백업 파일을 읽을 수 없습니다.'); return; }
    if (!o || typeof o !== 'object') { alert('백업 파일 형식이 아닙니다.'); return; }
    var n = Object.keys(o.tx || {}).length;
    if (!confirm('백업 파일(내역 ' + n + '건)로 복원할까요?\n지금 저장된 내용은 모두 바뀝니다.')) return;
    if (_mode === 'fb') _db.ref(ROOT).set(o).then(function () { toast('복원했습니다'); fillSettingsForm(); });
    else { D = o; persistLocal(); renderAll(); fillSettingsForm(); toast('복원했습니다'); }
  };
  rd.readAsText(f);
}

init();
