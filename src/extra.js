/* ---------- удобства: переименование, поиск, смена, Excel ---------- */
// Размеры уже записанных окон меняет и удаляет только руководство; замерщик только добавляет
const canEditTypes = () => isManager();
let renameTarget = null, roomQuery = "";

function afterRender(){
  applyTabAccess();
  const m = allowed("measure");
  // без права «Замер» не показываем поля ввода и кнопки, которые всё равно не работают
  $("inW").closest(".row").classList.toggle("hidden", !m);
  $("copyFrom").closest(".row").classList.toggle("hidden", !m);
  $("typeButtons").closest(".card").classList.toggle("hidden", !m);
  if (!m) document.querySelectorAll("#roomItems .qty button").forEach(b => b.remove());
  $("roomRename").classList.toggle("hidden", !m || !room());
  $("objRename").classList.toggle("hidden", !m || !curObj);
  $("floorTools").classList.toggle("hidden", !m || curFloor === null);
  renderRoomSearch();
  // заработок за текущую смену прямо во вкладках нарезки и оклейки
  if (myShift) for (const kind of ["cut", "glue"]) $("tab-" + kind).prepend(shiftBanner());
  // напоминание о долгой смене
  const warn = $("shiftWarn"), long = myShift && Date.now() - myShift.start > 12 * 3600e3;
  warn.classList.toggle("hidden", !long);
  if (long) warn.firstElementChild.textContent = `Смена открыта уже ${dur(Date.now() - myShift.start)}. Не забудьте закрыть её в разделе «Моя смена».`;
  // руководство: кто сейчас на смене (вверху «Управления») и выгрузка в Excel
  if (isManager()) { syncLive(); $("tab-admin").prepend(liveCard()); }
  if (isManager()) {
    const box = $("tab-admin"), last = box.lastElementChild;
    const b = el("button", {textContent: "Скачать Excel"}); b.onclick = () => downloadExcel(b);
    const card = el("div", {className: "card"}, el("h2", {textContent: "Выгрузка в Excel"}),
      el("div", {className: "empty", textContent: "Один файл с листами: замеры по кабинетам всех объектов, окна (сколько нужно, нарезано, наклеено), смены и итоги по сотрудникам за период, выбранный в «Сменах и оплате»."}), b);
    last ? box.insertBefore(card, last) : box.append(card);
  }
}

function shiftBanner(){
  const w = shiftWorkOf(myShift), pay = shiftPay(myShift);
  return el("div", {className: "notice"}, el("div", {className: "pnums"},
    el("span", {}, "Ваша смена ", el("b", {textContent: dur(Date.now() - myShift.start)})),
    el("span", {}, "нарезка ", el("b", {textContent: `${m2(w.cut)} м²`})),
    el("span", {}, "оклейка ", el("b", {textContent: `${m2(w.glue)} м²`})),
    el("span", {className: "done"}, "заработано ", el("b", {textContent: `${money(pay)} ₽`}))));
}
$("shiftWarnGo").onclick = () => showTab("shift");

/* поиск кабинета по номеру на всех этажах */
function renderRoomSearch(){
  const res = $("roomSearchRes"); res.innerHTML = "";
  const q = roomQuery.trim().toLowerCase(); if (!q) return;
  const found = rooms.filter(r => r.name.toLowerCase().includes(q)).sort((a, b) => byNum(a.floor, b.floor) || byNum(a.name, b.name)).slice(0, 20);
  if (!found.length) { res.append(el("div", {className: "empty", textContent: "Кабинет не найден"})); return; }
  for (const r of found) {
    const b = el("button", {className: "chip", textContent: `${r.name} · ${r.floor} эт.`});
    b.onclick = () => { curFloor = r.floor; curRoomId = r.id; roomQuery = ""; $("roomSearch").value = ""; hideMatch(); render(); $("roomCard").scrollIntoView({block: "start"}); };
    res.append(b);
  }
}
$("roomSearch").addEventListener("input", e => { roomQuery = e.target.value; renderRoomSearch(); });

/* переименование объекта, этажа, кабинета */
$("objRename").onclick = () => {
  const o = objects.find(o => o.id === curObj); if (!o) return;
  $("objRenameInput").value = o.name || ""; $("objRenameRow").classList.remove("hidden"); $("objRenameInput").focus();
};
$("objRenameCancel").onclick = () => $("objRenameRow").classList.add("hidden");
$("objRenameGo").onclick = async () => {
  const name = $("objRenameInput").value.trim(); if (!name) { toast("Введите название"); return; }
  try { await db.doc(objPath()).update({name}); $("objRenameRow").classList.add("hidden"); toast("Объект переименован"); } catch(e) { toast(errMsg(e)); }
};
$("objRenameInput").addEventListener("keydown", e => { if (e.key === "Enter") $("objRenameGo").click(); });

function openRename(kind){
  const r = room();
  if (kind === "room" && !r) return;
  renameTarget = kind;
  $("renameLabel").textContent = kind === "floor" ? `Новое название этажа (сейчас «${curFloor}»)` : `Новый номер кабинета (сейчас «${r.name}», ${r.floor} этаж)`;
  $("renameInput").value = kind === "floor" ? curFloor : r.name;
  $("renameBox").classList.remove("hidden"); $("renameInput").focus(); $("renameInput").select();
}
$("floorRename").onclick = () => openRename("floor");
$("roomRename").onclick = () => { openRename("room"); $("renameBox").scrollIntoView({block: "center"}); };
$("renameCancel").onclick = () => $("renameBox").classList.add("hidden");
$("renameInput").addEventListener("keydown", e => { if (e.key === "Enter") $("renameGo").click(); });
$("renameGo").onclick = async () => {
  const val = $("renameInput").value.trim(); if (!val) { toast("Введите название"); return; }
  const o = objects.find(o => o.id === curObj); if (!o) return;
  if (renameTarget === "floor") {
    const old = curFloor;
    if (val === old) { $("renameBox").classList.add("hidden"); return; }
    if (floors().includes(val)) { toast("Такой этаж уже есть"); return; }
    const fl = (o.floors || []).map(f => f === old ? val : f); if (!fl.includes(val)) fl.push(val);
    try {
      const b = F.writeBatch(fs);
      b.update(F.doc(fs, objPath()), {floors: fl});
      for (const r of rooms.filter(r => r.floor === old)) b.update(F.doc(fs, roomPath(r.id)), {floor: val});
      await b.commit();
      o.floors = fl; rooms.filter(r => r.floor === old).forEach(r => r.floor = val); curFloor = val;
      $("renameBox").classList.add("hidden"); toast("Этаж переименован"); render();
    } catch(e) { toast(errMsg(e)); }
  } else {
    const r = room(); if (!r) return;
    if (rooms.some(x => x.id !== r.id && x.floor === r.floor && x.name === val)) { toast("Такой кабинет на этаже уже есть"); return; }
    r.name = val; saveRoom(r); $("renameBox").classList.add("hidden"); toast("Кабинет переименован"); render();
  }
};
$("floorDel").onclick = function(){
  const btn = this;
  if (rooms.some(r => r.floor === curFloor)) { toast("На этаже есть кабинеты — сначала удалите их"); return; }
  confirmTap(btn, async () => {
    const o = objects.find(o => o.id === curObj); if (!o) return;
    const fl = (o.floors || []).filter(f => f !== curFloor);
    try { await db.doc(objPath()).update({floors: fl}); o.floors = fl; curFloor = null; curRoomId = null; toast("Этаж удалён"); render(); } catch(e) { toast(errMsg(e)); }
  });
};

/* выгрузка в Excel */
let xlsxLoading = null;
function loadXLSX(){
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return xlsxLoading || (xlsxLoading = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => res(window.XLSX); s.onerror = () => { xlsxLoading = null; rej(new Error("xlsx-load")); };
    document.head.append(s);
  }));
}
const r4 = x => Math.round(x * 10000) / 10000, r2 = x => Math.round(x * 100) / 100;
async function downloadExcel(btn){
  btn.disabled = true; toast("Готовлю Excel…");
  try {
    const X = await loadXLSX();
    const zam = [["Объект", "Этаж", "Кабинет", "Код", "Ширина, см", "Высота, см", "Кол-во", "Площадь, м²"]];
    const win = [["Объект", "Код", "Ширина, см", "Высота, см", "Площадь 1 шт, м²", "Нужно, шт", "Площадь всего, м²", "Нарезано, шт", "Наклеено, шт"]];
    for (const o of objects) {
      delete typesCache[o.id];
      const t = await objTypes(o.id);
      const rs = (await F.getDocs(F.collection(fs, `objects/${o.id}/rooms`))).docs.map(d => d.data())
        .sort((a, b) => byNum(String(a.floor), String(b.floor)) || byNum(String(a.name), String(b.name)));
      const lg = (await F.getDocs(F.collection(fs, `objects/${o.id}/log`))).docs.map(d => d.data());
      const need = {}, cut = {}, glue = {};
      const lc = legacyMap(t, rs), cd = k => code(k, t, lc), bc = (a, b) => { const x = codeParts(a, t, lc), y = codeParts(b, t, lc); return x.L.localeCompare(y.L) || x.i - y.i; };
      for (const r of rs) for (const k of Object.keys(r.items || {}).sort(bc)) {
        const q = r.items[k]; if (!(q > 0)) continue;
        const tp = t[k] || {w: 0, h: 0};
        zam.push([o.name, r.floor, r.name, cd(k), tp.w, tp.h, q, r4(tp.w * tp.h / 10000 * q)]);
        need[k] = (need[k] || 0) + q;
      }
      for (const x of lg) { const d = x.kind === "cut" ? cut : x.kind === "glue" ? glue : null; if (d) d[x.num] = (d[x.num] || 0) + x.q; }
      for (const tp of Object.values(t).sort((a, b) => bc(a.num, b.num))) {
        const a = tp.w * tp.h / 10000, n = need[tp.num] || 0;
        win.push([o.name, cd(tp.num), tp.w, tp.h, r4(a), n, r4(a * n), cut[tp.num] || 0, glue[tp.num] || 0]);
      }
    }
    const from = adminPeriod === "all" ? 0 : (adminPeriod === "1" ? new Date().setHours(0, 0, 0, 0) : Date.now() - Number(adminPeriod) * 864e5);
    const ss = shifts.filter(s => s.start >= from).sort((a, b) => a.start - b.start);
    const sh = [["Сотрудник", "Начало", "Конец", "Часы", "Нарезка, м²", "Цена нарезки, ₽/м²", "Оклейка, м²", "Цена оклейки, ₽/м²", "За работу, ₽", "Бонус/штраф, ₽", "Комментарий", "Итого, ₽"]];
    const tot = {};
    for (const s of ss) {
      const w = shiftWorkOf(s), pay = shiftPay(s), hrs = ((s.end || Date.now()) - s.start) / 36e5, bonus = s.bonus || 0;
      sh.push([s.name, dateTime(s.start), s.end ? dateTime(s.end) : "открыта", r2(hrs), r4(w.cut), s.priceCut, r4(w.glue), s.priceGlue, r2(pay), bonus, s.bonusNote || "", r2(pay + bonus)]);
      const t = tot[s.uid] || (tot[s.uid] = {name: s.name, n: 0, h: 0, cut: 0, glue: 0, pay: 0, bonus: 0});
      t.n++; t.h += hrs; t.cut += w.cut; t.glue += w.glue; t.pay += pay; t.bonus += bonus;
    }
    const it = [["Сотрудник", "Смен", "Часы", "Нарезка, м²", "Оклейка, м²", "За работу, ₽", "Бонусы/штрафы, ₽", "К оплате, ₽"]];
    for (const t of Object.values(tot)) it.push([t.name, t.n, r2(t.h), r4(t.cut), r4(t.glue), r2(t.pay), r2(t.bonus), r2(t.pay + t.bonus)]);

    const wb = X.utils.book_new();
    const add = (rows, name, widths) => { const ws = X.utils.aoa_to_sheet(rows); ws["!cols"] = widths.map(w => ({wch: w})); X.utils.book_append_sheet(wb, ws, name); };
    add(zam, "Замеры", [18, 8, 10, 7, 11, 11, 8, 12]);
    add(win, "Окна", [18, 7, 11, 11, 15, 10, 17, 13, 13]);
    add(sh, "Смены", [18, 15, 15, 7, 12, 17, 12, 17, 13, 15, 22, 11]);
    add(it, "Итоги", [18, 7, 8, 12, 12, 13, 16, 12]);
    const per = {"1": "сегодня", "7": "7-дней", "30": "30-дней", "all": "всё-время"}[adminPeriod] || adminPeriod;
    X.writeFile(wb, `windows-${new Date().toISOString().slice(0, 10)}-${per}.xlsx`);
    toast("Excel скачан");
  } catch(e) { toast(String(e && e.message) === "xlsx-load" ? "Не удалось загрузить модуль Excel — проверьте интернет" : "Не удалось сделать Excel: " + errMsg(e)); }
  btn.disabled = false;
}

/* ---------- «Сейчас на смене» для руководства: обновляется само ---------- */
let liveSubs = [], liveKey = "", liveLogs = {}, liveInfo = {};
function syncLive(){
  if (!fs || !isManager()) return;
  const open = shifts.filter(s => !s.end).map(s => s.id).sort().slice(0, 30);
  const key = open.join(",") + "|" + objects.map(o => o.id).join(",");
  if (key === liveKey) return;
  liveKey = key; liveSubs.forEach(u => u()); liveSubs = []; liveLogs = {};
  if (!open.length) { liveInfo = {}; return; }
  // слушаем только отметки открытых смен — дёшево и сразу видно новые
  for (const o of objects)
    liveSubs.push(F.onSnapshot(F.query(F.collection(fs, `objects/${o.id}/log`), F.where("shift", "in", open)),
      q => { liveLogs[o.id] = q.docs.map(d => d.data()); computeLive(); }, () => {}));
}
let liveBusy = false, liveAgain = false;
async function computeLive(){
  if (liveBusy) { liveAgain = true; return; }
  liveBusy = true;
  try {
    const acc = {};
    for (const [oid, arr] of Object.entries(liveLogs)) {
      let t = await objTypes(oid);
      if (arr.some(x => !t[x.num])) { delete typesCache[oid]; t = await objTypes(oid); }   // появились новые окна
      for (const x of arr) {
        const a = acc[x.shift] || (acc[x.shift] = {cut: 0, glue: 0, cutN: 0, glueN: 0, last: 0});
        const tp = t[x.num]; if (!tp || !(x.kind === "cut" || x.kind === "glue")) continue;
        a[x.kind] += x.q * tp.w * tp.h / 10000; a[x.kind + "N"] += x.q; a.last = Math.max(a.last, x.at || 0);
      }
    }
    liveInfo = acc;
    for (const s of shifts.filter(s => !s.end)) { const a = acc[s.id]; shiftWork[s.id] = {cut: Math.max(0, a ? a.cut : 0), glue: Math.max(0, a ? a.glue : 0)}; }
    render();
  } catch(e) {}
  liveBusy = false;
  if (liveAgain) { liveAgain = false; computeLive(); }
}
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "только что" : m < 60 ? `${m} мин назад` : `${Math.floor(m / 60)} ч ${m % 60} мин назад`; };
function liveCard(){
  const open = shifts.filter(s => !s.end).sort((a, b) => a.start - b.start);
  const card = el("div", {className: "card"}, el("div", {className: "row"}, el("h2", {className: "grow", textContent: "Сейчас на смене"}),
    el("span", {className: "pill" + (open.length ? " ok" : ""), textContent: open.length ? `${open.length} чел.` : "никого"})));
  if (!open.length) { card.append(el("div", {className: "empty", textContent: "Сейчас никто не на смене."})); return card; }
  let sum = 0;
  for (const s of open) {
    const a = liveInfo[s.id] || {cutN: 0, glueN: 0, last: 0}, w = shiftWorkOf(s), pay = shiftPay(s);
    sum += pay;
    const stale = a.last && Date.now() - a.last > 2 * 3600e3;
    card.append(el("div", {className: "srow"},
      el("div", {className: "row"}, el("b", {className: "grow", textContent: s.name || "—"}), el("span", {className: "money", textContent: `${money(pay)} ₽`})),
      el("div", {className: "pnums"},
        el("span", {}, "Идёт ", el("b", {textContent: dur(Date.now() - s.start)})),
        el("span", {}, "Нарезка ", el("b", {textContent: `${a.cutN} шт · ${m2(w.cut)} м²`})),
        el("span", {}, "Оклейка ", el("b", {textContent: `${a.glueN} шт · ${m2(w.glue)} м²`}))),
      el("div", {className: stale ? "where" : "empty", style: stale ? "color:var(--warn)" : "", textContent: a.last ? `Последняя отметка: ${ago(a.last)}` : "Отметок за смену ещё нет"})));
  }
  if (open.length > 1) card.append(el("div", {className: "pnums"}, el("span", {className: "done"}, "Всего заработано за открытые смены ", el("b", {textContent: `${money(sum)} ₽`}))));
  return card;
}
// раз в минуту обновляем «идёт …» и «… мин назад», пока открыто «Управление»
setInterval(() => { if (!$("tab-admin").classList.contains("hidden") && isManager()) render(); }, 60000);

/* ---------- настройки внешнего вида: тема, главный цвет, стекло ----------
   Сам выбор применяется ещё в <head> (look_head.js), здесь — экран настроек.
   Сохраняется на устройстве сразу и в аккаунте (prefs/<uid>), чтобы цвет
   был тем же и на другом телефоне, и после переустановки приложения. */
const ACCENTS = LOOK.ACCENTS, darkMq = LOOK.darkMq;
const THEMES = {auto: "Как в телефоне", light: "Светлая", dark: "Тёмная"};
const GLASS = {0: "Выкл", 30: "Лёгкое", 60: "Среднее", 90: "Сильное"};
let look = LOOK.load();
const applyLook = () => LOOK.apply(look);
let lookPushT = null;
function pushLook(){
  clearTimeout(lookPushT);
  if (!fs || !myId) return;
  lookPushT = setTimeout(() => { F.setDoc(F.doc(fs, "prefs/" + myId), {look, updated: Date.now()}).catch(() => {}); }, 700);
}
function saveLook(){ look.t = Date.now(); LOOK.store(look); applyLook(); renderSettings(); pushLook(); }
// при входе: берём из аккаунта, если там выбор новее, чем на этом устройстве
async function loadLookFromAccount(){
  if (!fs || !myId) return;
  try {
    const d = await F.getDoc(F.doc(fs, "prefs/" + myId));
    const remote = d.exists() && d.data().look ? LOOK.clean(d.data().look) : null;
    if (remote && remote.t > (look.t || 0)) { look = remote; LOOK.store(look); applyLook(); renderSettings(); }
    else if (look.t && (!remote || look.t > remote.t)) pushLook();
  } catch(e) { /* нет связи или правила ещё не обновлены — остаётся выбор с устройства */ }
}
function glassLabel(g){ return g === 0 ? "выкл" : g + "%"; }
function renderSettings(){
  const tc = $("themeChips"); tc.innerHTML = "";
  for (const [k, t] of Object.entries(THEMES)) { const b = el("button", {className: "chip", textContent: t}); b.setAttribute("aria-pressed", look.theme === k); b.onclick = () => { look.theme = k; saveLook(); }; tc.append(b); }
  const ac = $("accentChips"); ac.innerHTML = "";
  const isDark = LOOK.isDark(look);
  for (const [k, a] of Object.entries(ACCENTS)) {
    const b = el("button", {className: "swatch", title: a.name, ariaLabel: a.name, style: `background:${(isDark ? a.dark : a.light)[0]}`});
    b.setAttribute("aria-pressed", look.accent === k); b.onclick = () => { look.accent = k; saveLook(); }; ac.append(b);
  }
  const r = $("glassRange"); if (document.activeElement !== r) r.value = look.glass;
  $("glassVal").textContent = glassLabel(look.glass);
  const gc = $("glassChips"); gc.innerHTML = "";
  for (const [v, t] of Object.entries(GLASS)) { const b = el("button", {className: "chip", textContent: t}); b.setAttribute("aria-pressed", look.glass === +v); b.onclick = () => { look.glass = +v; saveLook(); }; gc.append(b); }
}
// ползунок: пока двигают — сразу показываем, сохраняем, когда отпустили
$("glassRange").addEventListener("input", e => { look.glass = +e.target.value; applyLook(); $("glassVal").textContent = glassLabel(look.glass); });
$("glassRange").addEventListener("change", () => saveLook());
// старые iPhone (iOS 13 и раньше) знают только addListener
const onScheme = () => { applyLook(); renderSettings(); };
if (darkMq.addEventListener) darkMq.addEventListener("change", onScheme); else if (darkMq.addListener) darkMq.addListener(onScheme);
// выбор, сделанный в другой вкладке, сразу применяется и здесь
addEventListener("storage", e => { if (e.key === "windows-look") { look = LOOK.load(); applyLook(); renderSettings(); } });
applyLook(); renderSettings();

/* ---------- в меню только те разделы, которые человеку разрешены ---------- */
function hasRole(area){
  if (amOwner) return true;
  const r = (me && me.approved && me.roles) || [];
  return r.includes("admin") || r.includes(area);
}
function visibleTabs(){
  const m = hasRole("measure"), c = hasRole("cut"), g = hasRole("glue"), mg = isManager();
  return {
    measure: m, types: m,            // замеры и список окон — замерщикам
    cut: c, glue: g,                 // нарезка и оклейка — по своим правам
    summary: m || mg,                // сводка по объекту — замерщикам и руководству
    shift: c || g || amOwner,        // смены и заработок — тем, кто режет или клеит
    admin: mg,                       // управление — владельцу и руководству
    settings: true,                  // тема и цвет — всем
  };
}
let tabGuard = false;
function applyTabAccess(){
  if (!me && !amOwner) return;
  const vis = visibleTabs();
  document.querySelectorAll("#drawer .navitem[data-tab]").forEach(b => b.classList.toggle("hidden", !vis[b.dataset.tab]));
  // если открыт раздел, к которому нет доступа, — переходим на первый доступный
  const cur = Object.keys(TAB_TITLE).find(t => !$("tab-" + t).classList.contains("hidden"));
  if (cur && !vis[cur] && !tabGuard) {
    const first = ["measure", "cut", "glue", "shift", "summary", "admin", "settings"].find(t => vis[t]) || "settings";
    tabGuard = true; showTab(first); tabGuard = false;
  }
  const none = !["measure", "cut", "glue", "admin"].some(t => vis[t]);
  $("objCard").classList.toggle("hidden", !(vis.measure || vis.cut || vis.glue || vis.summary));
  let note = $("noAccessNote");
  if (none && !note) { note = el("div", {className: "notice", id: "noAccessNote", textContent: "Вам пока не выданы разделы для работы. Попросите владельца отметить ваши права в «Управлении». Сейчас доступны только настройки."}); $("meRow").after(note); }
  if (!none && note) note.remove();
}
