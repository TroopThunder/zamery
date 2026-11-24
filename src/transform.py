import re, os
from base64 import b64encode
from pathlib import Path
SRC = os.path.dirname(os.path.abspath(__file__))
s=open(os.path.join(SRC,'base.html'),encoding='utf-8').read()
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(a[:90],s.count(a)); s=s.replace(a,b)

# ---------- HTML ----------
s=re.sub(r'\n  <div class="card hidden" id="teamCard">.*?\n  </div>\n','\n',s,count=1,flags=re.S)
assert 'id="teamCard"' not in s
rep('<main>','''<div id="authView" class="authwrap hidden">
  <div class="card authcard">
    <div class="apptitle">GlixPro master</div>
    <h1 id="authTitle">Вход</h1>
    <div class="tabs" style="grid-template-columns:1fr 1fr" role="tablist">
      <button id="aLogin" role="tab" aria-selected="true">Вход</button>
      <button id="aReg" role="tab" aria-selected="false">Регистрация</button>
    </div>
    <label for="aName">Имя и фамилия</label>
    <input id="aName" autocomplete="username" placeholder="Например, Иван Петров">
    <label for="aPass">Пароль</label>
    <input id="aPass" type="password" autocomplete="current-password" placeholder="Не короче 6 символов">
    <div id="aPass2Wrap" class="hidden" style="display:flex;flex-direction:column;gap:6px">
      <label for="aPass2">Повторите пароль</label>
      <input id="aPass2" type="password" autocomplete="new-password">
    </div>
    <button id="aGo">Войти</button>
    <div class="msg" id="aMsg"></div>
    <div class="empty" id="aHint">Нет аккаунта? Откройте «Регистрация». После регистрации владелец выдаст вам доступ.</div>
  </div>
</div>
<div id="waitView" class="authwrap hidden">
  <div class="card authcard">
    <h1>Ожидает подтверждения</h1>
    <p id="waitText" style="margin:0"></p>
    <button class="sec" id="waitLogout">Выйти</button>
  </div>
</div>
<div id="loadView" class="authwrap"><div class="empty">Загрузка…</div></div>
<main id="app" class="hidden">''')
rep('''  <button class="navitem" data-tab="summary">Сводка</button>
  <div class="navsep"></div>
  <button class="navitem hidden" id="teamBtn">Команда и права</button>''','''  <button class="navitem" data-tab="summary">Сводка</button>
  <div class="navsep"></div>
  <button class="navitem hidden" data-tab="shift" id="navShift">Моя смена</button>
  <button class="navitem hidden" data-tab="admin" id="navAdmin">Управление</button>
  <div class="navsep"></div>
  <button class="navitem" id="logoutBtn">Выйти</button>''')
rep('''    <div class="card" id="summaryFloors"></div>
  </section>
</main>''','''    <div class="card" id="summaryFloors"></div>
  </section>

  <!-- ===== СМЕНА / УПРАВЛЕНИЕ ===== -->
  <section id="tab-shift" class="hidden" style="flex-direction:column;gap:12px"></section>
  <section id="tab-admin" class="hidden" style="flex-direction:column;gap:12px"></section>
  <section id="tab-settings" class="hidden" style="flex-direction:column;gap:12px">
    <div class="card">
      <h2>Тема</h2>
      <div class="chips" id="themeChips"></div>
      <h2>Главный цвет</h2>
      <div class="swatches" id="accentChips"></div>
      <h2>Эффект стекла</h2>
      <div class="glassrow"><input type="range" id="glassRange" min="0" max="100" step="5" aria-label="Сила эффекта стекла"><output id="glassVal" for="glassRange"></output></div>
      <div class="chips" id="glassChips"></div>
      <div class="empty" id="lookNote">Выбор сохраняется сам и остаётся при следующем открытии.</div>
    </div>
  </section>
</main>''')
rep('<div id="status" class="notice">Подключаюсь к общей базе…</div>','<div id="status" class="notice hidden"></div>\n  <div class="notice hidden" id="shiftWarn" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="grow"></span><button class="sec" id="shiftWarnGo">Открыть «Мою смену»</button></div>')

rep('''    <div class="row hidden" id="objNewRow">
      <input id="objNewName" class="grow" placeholder="Название, например «Школа №12»">
      <button id="objCreate">Создать</button>
    </div>''','''    <div class="row hidden" id="objNewRow">
      <input id="objNewName" class="grow" placeholder="Название, например «Школа №12»">
      <button id="objCreate">Создать</button>
    </div>
    <div class="row"><span class="grow"></span><button class="link hidden" id="objRename">Переименовать</button><button class="link hidden" id="objDelBtn">Удалить объект</button></div>
    <div class="row hidden" id="objRenameRow"><input id="objRenameInput" class="grow" autocomplete="off" aria-label="Новое название объекта"><button id="objRenameGo">Сохранить</button><button class="sec" id="objRenameCancel">Отмена</button></div>
    <div class="notice hidden" id="objDelBox" style="display:flex;flex-direction:column;gap:8px">
      <b id="objDelTitle"></b>
      <div>Удалятся все этажи, кабинеты, окна и отметки нарезки и оклейки этого объекта. Вернуть их будет нельзя — перед удалением можно скачать копию базы в «Управлении». Уже закрытые смены и суммы к оплате сохранятся.</div>
      <label for="objDelConfirm">Для подтверждения введите название объекта</label>
      <input id="objDelConfirm" autocomplete="off">
      <div class="row"><button id="objDelGo">Удалить навсегда</button><button class="sec" id="objDelCancel">Отмена</button></div>
    </div>''')
# CSS
rep('.hidden{display:none !important}','''.authwrap{min-height:100vh;display:grid;place-items:center;padding:16px}
.authcard{max-width:380px;width:100%}
.authcard input{width:100%}
.msg{color:var(--warn);font-size:14px;min-height:1.2em}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.grid2 input{width:100%}
.big{font:700 26px/1.1 var(--mono)}
.srow{display:flex;flex-direction:column;gap:6px;padding:10px 0;border-bottom:1px solid var(--line)}
.srow:last-child{border-bottom:0}
.money{font:600 15px var(--mono);color:var(--ok);white-space:nowrap}
.swatches{display:flex;gap:12px;flex-wrap:wrap}
.swatch{width:48px;height:48px;border-radius:50%;padding:0;border:3px solid var(--surface);box-shadow:0 0 0 1px var(--line)}
.swatch[aria-pressed="true"]{box-shadow:0 0 0 3px var(--ink)}
.hidden{display:none !important}
'''+open(os.path.join(SRC,'glass.css'),encoding='utf-8').read())

# ---------- приложение на телефоне (PWA) ----------
rep('<meta name="viewport" content="width=device-width, initial-scale=1">','''<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/x-icon" sizes="16x16 32x32 48x48 64x64" href="favicon.ico?v=glixpro-outline2">
<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png?v=3">
<meta name="theme-color" content="#12171d">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="GlixPro master">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<script>
'''+open(os.path.join(SRC,'look_head.js'),encoding='utf-8').read()+'''</script>''')
rep('''  <button class="navitem" id="logoutBtn">Выйти</button>''','''  <button class="navitem" data-tab="settings">Настройки</button>
  <div class="empty hidden" id="iosHint" style="padding:4px 12px 8px">Чтобы установить на iPhone: в Safari нажмите «Поделиться» → «На экран „Домой“».</div>
  <button class="navitem" id="logoutBtn">Выйти</button>''')
# ---------- SCRIPT ----------
rep('const ROLE = {measure: "Замер", cut: "Нарезка", glue: "Оклейка", admin: "Все вкладки"};','const ROLE = {measure: "Замер", cut: "Нарезка", glue: "Оклейка", admin: "Все работы", manager: "Управление"};')
rep('<script>\nconst $ = id => document.getElementById(id);','''<script type="module">
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import * as A from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import * as F from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

/* ===== НАСТРОЙКИ FIREBASE: вставляются из консоли Firebase ===== */
const FIREBASE_CONFIG = __FIREBASE_CONFIG__;

const $ = id => document.getElementById(id);''')

rep('''let user = null, myId = null, names = {};
let amOwner = false, roles = {}, members = [], rolesLoaded = false;''','''let fs = null, auth = null, myId = null, names = {};
let amOwner = false, ownerUid = null, me = null, usersMap = {}, rates = {}, prices = {cut: 0, glue: 0}, pricesLoaded = false;
let shifts = [], myShift = null, shiftWork = {};''')
rep('''function allowed(area){
  if (!canWrite) return false;
  if (amOwner) return true;
  const r = roles[myId] || [];
  return r.includes("admin") || r.includes(area);
}''','''function allowed(area){
  if (!canWrite) return false;
  if (amOwner) return true;
  if (!me || !me.approved) return false;
  const r = me.roles || [];
  return r.includes("admin") || r.includes(area);
}''')
rep('''function errMsg(e){
  if (e && e.code === "quota_exceeded") return "База заполнена — удалите лишние данные.";
  if (e && e.code === "invalid_argument") { canWrite = false; render(); return "У вас нет прав на изменение. Попросите владельца пригласить вас редактором."; }
  return "Не удалось сохранить. Проверьте интернет и повторите.";
}''','''function errMsg(e){
  const c = String(e && e.code || "");
  if (c.includes("permission-denied")) return "Нет прав на это действие. Права выдаёт владелец.";
  if (c.includes("resource-exhausted")) return "Исчерпан бесплатный лимит базы на сегодня. Попробуйте позже.";
  if (c.includes("unavailable")) return "Нет связи с базой. Проверьте интернет.";
  return "Не удалось сохранить. Проверьте интернет и повторите.";
}

/* ---------- обёртка над Firestore (тот же интерфейс, что и раньше) ---------- */
const wrapDoc = d => ({id: d.id, exists: d.exists(), data: () => d.data(), metadata: d.metadata});
const wrapQuery = q => ({docs: q.docs.map(wrapDoc), size: q.size, empty: q.empty, metadata: q.metadata});
function docApi(ref){
  return {
    id: ref.id, path: ref.path,
    get: async () => wrapDoc(await F.getDoc(ref)),
    set: d => F.setDoc(ref, d), update: d => F.updateDoc(ref, d), delete: () => F.deleteDoc(ref),
    onSnapshot: (n, e) => F.onSnapshot(ref, {includeMetadataChanges: true}, d => n(wrapDoc(d)), e),
    collection: p => colApi(F.collection(ref, p)),
  };
}
function colApi(ref){
  return {
    path: ref.path,
    doc: id => docApi(id ? F.doc(ref, id) : F.doc(ref)),
    get: async () => wrapQuery(await F.getDocs(ref)),
    onSnapshot: (n, e) => F.onSnapshot(ref, {includeMetadataChanges: true}, q => n(wrapQuery(q)), e),
  };
}
const makeDb = () => ({doc: p => docApi(F.doc(fs, p)), collection: p => colApi(F.collection(fs, p))});''')

# mark: shift required + shift id
rep('''  const ref = db.collection(objPath() + "/log").doc();
  const entry = {kind, num: Number(n), q, by: myId || "", at: Date.now()};''','''  if (q < 0 && !canResetAll()) {
    const own = doneBy(kind, opt.room || "", myId)[n] || 0;
    if (-q > own) { toast("Можно отменить только свои отметки"); return; }
  }
  if (!amOwner && q > 0 && !myShift) { toast("Сначала откройте смену: меню ☰ → «Моя смена»"); return; }
  const ref = db.collection(objPath() + "/log").doc();
  const entry = {kind, num: Number(n), q, by: myId || "", at: Date.now()};
  if (myShift) entry.shift = myShift.id;''')
rep('''  try { await ref.set(entry); if (!opt.silent)''','''  scheduleShiftWork();
  try { await ref.set(entry); if (!opt.silent)''')

rep('''async function resolveNames(){
  if (!user || !user.profiles) return;
  const ids = [...new Set(log.map(x => x.by).filter(Boolean))].filter(id => !(id in names));
  if (!ids.length) return;
  try { const ps = await user.profiles(ids); for (const id of ids) names[id] = (ps[id] && ps[id].name) || ""; render(); } catch(e) {}
}''','''function resolveNames(){ /* имена приходят из профилей сотрудников */ }''')

# createType via transaction
i=s.index('async function createType(w, h){'); j=s.index('function addToRoom(')
s=s[:i]+'''async function createType(w, h){
  // буква — по этажу текущего кабинета; номер — следующий свободный для этой буквы.
  // «Бронь» кода (types/c_B3) не даёт двум замерщикам одновременно взять один и тот же код.
  const L = floorLetter((room() || {}).floor ?? curFloor ?? "1");
  let n = Math.max(0, ...Object.keys(types).map(Number)) + 1, i = nextIndex(L);
  for (let tries = 0; tries < 30; tries++) {
    const ref = F.doc(fs, objPath() + "/types/n" + n), claim = F.doc(fs, objPath() + "/types/c_" + L + i);
    const body = {num: n, w, h, L, i, created: Date.now()};
    try {
      const r = await F.runTransaction(fs, async tx => {
        const d = await tx.get(ref), c = await tx.get(claim);
        if (d.exists()) return "n"; if (c.exists()) return "i";
        tx.set(claim, {code: L + i, n}); tx.set(ref, body); return "ok";
      });
      if (r === "n") { n++; continue; }
      if (r === "i") { i++; continue; }
    } catch(e) {
      if (String(e && e.code).includes("permission")) throw e;
      F.setDoc(ref, body).catch(() => {});   // нет связи: запишется, когда появится интернет
    }
    types[n] = {num: n, w, h, L, i};
    return n;
  }
  throw {code: "unavailable"};
}

'''+s[j:]

# replace renderMe..resolveMemberNames
i=s.index('function renderMe(){'); j=s.index('function whereList(n){')
s=s[:i]+open(os.path.join(SRC,'new_ui.js'),encoding='utf-8').read()+'\n'+open(os.path.join(SRC,'extra.js'),encoding='utf-8').read()+'\n'+s[j:]
rep('''  renderMe(); renderTeam();''','''  renderMe(); renderShift(); renderAdmin();''')

# tabs
rep('''const TAB_TITLE = {measure: "Замер", types: "Окна", cut: "Нарезка", glue: "Оклейка", summary: "Сводка"};''',
'''const TAB_TITLE = {measure: "Замер", types: "Окна", cut: "Нарезка", glue: "Оклейка", summary: "Сводка", shift: "Моя смена", admin: "Управление", settings: "Настройки"};''')
rep('''  $("teamCard").classList.add("hidden");\n''','''  if (name === "admin") loadAllWork();
  if (name === "shift") scheduleShiftWork(0);
''')
rep('''document.querySelectorAll("#drawer .navitem[data-tab]").forEach(b => b.onclick = () => { showTab(b.dataset.tab); closeMenu(); });
{ let t = "measure"; try { t = localStorage.getItem("zamery-tab") || "measure"; } catch(e) {} showTab(TAB_TITLE[t] ? t : "measure"); }''',
'''document.querySelectorAll("#drawer .navitem[data-tab]").forEach(b => b.onclick = () => { showTab(b.dataset.tab); closeMenu(); });''')
rep('''$("teamBtn").onclick = () => { closeMenu(); $("teamCard").classList.remove("hidden"); render(); window.scrollTo(0, 0); };
$("teamClose").onclick = () => $("teamCard").classList.add("hidden");
''','')

# startup
i=s.index('/* ---------- запуск ---------- */'); j=s.index('</script>', i)
s=s[:i]+open(os.path.join(SRC,'startup.js'),encoding='utf-8').read()+'\n'+s[j:]
for theme in ('light', 'dark'):
    icon = (Path(SRC) / f'brand-icon-{theme}.png').read_bytes()
    s = s.replace(f'__BRAND_ICON_{theme.upper()}__', 'data:image/png;base64,' + b64encode(icon).decode('ascii'))
# регистрация сервис-воркера и кнопка установки
s=s.replace('</script>\n</body>','''
/* ---------- установка как приложение ---------- */
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("./sw.js").catch(() => {});
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
if (!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) $("iosHint").classList.remove("hidden");
</script>\n</body>''',1)
open(os.path.join(SRC,'index_template.html'),'w',encoding='utf-8').write(s)
print('ok', len(s))
