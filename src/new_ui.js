/* ---------- профиль, смены, управление ---------- */
const money = x => (Math.round((x || 0) * 100) / 100).toLocaleString("ru-RU", {maximumFractionDigits: 2});
const dur = ms => { const m = Math.max(0, Math.round(ms / 60000)); return `${Math.floor(m / 60)} ч ${m % 60} мин`; };
const dateTime = t => t ? new Date(t).toLocaleString("ru-RU", {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"}) : "—";
const numOrNull = v => { const x = num(v); return isFinite(x) && String(v).trim() !== "" ? x : null; };

// Управление: владелец или сотрудник с правом «Управление»
const isManager = () => amOwner || !!(me && me.approved && (me.roles || []).includes("manager"));
function renderMe(){
  renderObjDelete();
  const chip = $("meChip");
  const nm = me ? me.name : "";
  if (amOwner) chip.textContent = `${nm} · владелец, все права`;
  else if (me) {
    const r = me.roles || [];
    const work = r.filter(x => x !== "manager");
    chip.textContent = `${nm} · ` + (r.includes("admin") ? "все разделы" : work.length ? work.map(x => ROLE[x]).join(", ") : "только просмотр") + (r.includes("manager") ? " + управление" : "");
  }
  if (myShift) chip.textContent += " · смена открыта";
  $("navAdmin").classList.toggle("hidden", !isManager());
  $("navShift").classList.toggle("hidden", !me);
}

function myPrices(){
  const r = rates[myId] || {};
  return {cut: r.cut != null ? r.cut : (prices.cut || 0), glue: r.glue != null ? r.glue : (prices.glue || 0)};
}
// Закрытая смена считается по объёму, зафиксированному при закрытии (так оплата не меняется,
// даже если объект потом удалят); открытая — по текущим отметкам
function shiftWorkOf(s){
  if (s.end) return {cut: s.cutArea || 0, glue: s.glueArea || 0};
  return shiftWork[s.id] || {cut: s.cutArea || 0, glue: s.glueArea || 0};
}
function shiftPay(s){ const w = shiftWorkOf(s); return w.cut * (s.priceCut || 0) + w.glue * (s.priceGlue || 0); }

/* Объём работы смены считается по отметкам во всех объектах */
const typesCache = {};
async function objTypes(oid){
  if (oid === curObj && Object.keys(types).length) return types;
  if (typesCache[oid]) return typesCache[oid];
  const t = {}; (await F.getDocs(F.collection(fs, `objects/${oid}/types`))).forEach(d => { const v = d.data(); if (v && v.num) t[v.num] = v; });
  return typesCache[oid] = t;
}
async function loadShiftWork(s){
  const res = {cut: 0, glue: 0};
  for (const o of objects) {
    const q = await F.getDocs(F.query(F.collection(fs, `objects/${o.id}/log`), F.where("shift", "==", s.id)));
    if (q.empty) continue;
    const t = await objTypes(o.id);
    q.forEach(d => { const x = d.data(), tp = t[x.num]; if (tp && x.kind in res) res[x.kind] += x.q * tp.w * tp.h / 10000; });
  }
  res.cut = Math.max(0, res.cut); res.glue = Math.max(0, res.glue);
  shiftWork[s.id] = res;
  return res;
}
let swTimer = null;
function scheduleShiftWork(delay = 1500){
  if (!myShift) return;
  clearTimeout(swTimer);
  swTimer = setTimeout(async () => { try { await loadShiftWork(myShift); render(); } catch(e) {} }, delay);
}
// Для владельца: все отметки всех объектов, сгруппированные по сменам
let allWorkBusy = false;
const logWork = {};   // объём по отметкам — для сверки с тем, что записано в закрытой смене
// Сверка закрытой смены: площадь совпадает с отметками, а сумма — с «площадь × цена»
function shiftMismatch(s){
  if (!s.end) return "";
  const p = [], w = logWork[s.id];
  if (w) {
    if (Math.abs((s.cutArea || 0) - w.cut) > 0.01) p.push(`нарезка ${m2(s.cutArea || 0)} м², по отметкам ${m2(w.cut)} м²`);
    if (Math.abs((s.glueArea || 0) - w.glue) > 0.01) p.push(`оклейка ${m2(s.glueArea || 0)} м², по отметкам ${m2(w.glue)} м²`);
  }
  const calc = (s.cutArea || 0) * (s.priceCut || 0) + (s.glueArea || 0) * (s.priceGlue || 0);
  if (Math.abs((s.sum || 0) - calc) > 1) p.push(`записанная сумма ${money(s.sum)} ₽, по расчёту ${money(calc)} ₽`);
  return p.length ? "⚠ Не сходится: " + p.join("; ") + ". Проверьте смену (расхождение бывает и честным — если после закрытия удалили объект или поправили размеры окон)." : "";
}
async function loadAllWork(){
  if (!isManager() || allWorkBusy) return;
  allWorkBusy = true;
  try {
    const acc = {};
    for (const o of objects) {
      const t = await objTypes(o.id);
      (await F.getDocs(F.collection(fs, `objects/${o.id}/log`))).forEach(d => {
        const x = d.data(); if (!x.shift || !(x.kind === "cut" || x.kind === "glue")) return;
        const tp = t[x.num]; if (!tp) return;
        (acc[x.shift] = acc[x.shift] || {cut: 0, glue: 0})[x.kind] += x.q * tp.w * tp.h / 10000;
      });
    }
    for (const id of Object.keys(acc)) acc[id] = {cut: Math.max(0, acc[id].cut), glue: Math.max(0, acc[id].glue)};
    for (const s of shifts) shiftWork[s.id] = logWork[s.id] = acc[s.id] || {cut: 0, glue: 0};
    render();
  } catch(e) { toast("Не удалось загрузить объёмы работ: " + errMsg(e)); }
  allWorkBusy = false;
}

async function openShift(){
  if (myShift) return;
  if (!amOwner && !pricesLoaded) { toast("Подождите, загружаю цены…"); return; }
  const pr = myPrices();
  const ref = F.doc(F.collection(fs, "shifts"));
  const body = {uid: myId, name: me.name, start: Date.now(), end: null, priceCut: pr.cut, priceGlue: pr.glue, bonus: 0, bonusNote: "", cutArea: 0, glueArea: 0, sum: 0};
  try { await F.setDoc(ref, body); toast("Смена открыта — можно работать"); }
  catch(e) { toast(String(e.code).includes("permission") ? "Не удалось открыть смену. Возможно, владелец ещё не указал цены." : errMsg(e)); }
}
async function closeShift(){
  const s = myShift; if (!s) return;
  try {
    const w = await loadShiftWork(s);
    const sum = Math.round((w.cut * s.priceCut + w.glue * s.priceGlue) * 100) / 100;
    await F.updateDoc(F.doc(fs, "shifts/" + s.id), {end: Date.now(), cutArea: Math.round(w.cut * 10000) / 10000, glueArea: Math.round(w.glue * 10000) / 10000, sum});
    toast("Смена закрыта");
  } catch(e) { toast(errMsg(e)); }
}

function shiftStats(s){
  const w = shiftWorkOf(s);
  const pay = shiftPay(s), bonus = s.bonus || 0;
  return el("div", {className: "srow", style: "border:0;padding:0"},
    el("div", {className: "pnums"},
      el("span", {}, "Нарезка ", el("b", {textContent: `${m2(w.cut)} м²`}), ` × ${money(s.priceCut)} ₽`),
      el("span", {}, "Оклейка ", el("b", {textContent: `${m2(w.glue)} м²`}), ` × ${money(s.priceGlue)} ₽`)),
    el("div", {className: "pnums"},
      el("span", {}, "За работу ", el("b", {textContent: `${money(pay)} ₽`})),
      bonus > 0 ? el("span", {}, "Бонус ", el("b", {textContent: `+${money(bonus)} ₽`})) : "",
      bonus < 0 ? el("span", {className: "left"}, "Штраф ", el("b", {textContent: `−${money(-bonus)} ₽`})) : "",
      el("span", {className: "done"}, "Итого ", el("b", {textContent: `${money(pay + bonus)} ₽`}))),
    s.bonusNote ? el("div", {className: "empty", textContent: (bonus < 0 ? "Причина штрафа: " : "Комментарий к бонусу: ") + s.bonusNote}) : "");
}

function renderShift(){
  const box = $("tab-shift"); box.innerHTML = "";
  if (!me) return;
  const card = el("div", {className: "card"});
  if (!myShift) {
    const pr = myPrices();
    card.append(el("h2", {textContent: "Смена закрыта"}),
      el("div", {className: "empty", textContent: "Откройте смену перед началом работы. Все отметки нарезки и оклейки запишутся в неё, а при закрытии вы увидите время, объём и сумму."}),
      el("div", {className: "pnums"},
        el("span", {}, "Нарезка: ", el("b", {textContent: `${money(pr.cut)} ₽/м²`})),
        el("span", {}, "Оклейка: ", el("b", {textContent: `${money(pr.glue)} ₽/м²`}))));
    const b = el("button", {textContent: "Открыть смену"}); b.onclick = openShift;
    card.append(b);
  } else {
    card.append(el("h2", {textContent: "Смена открыта"}),
      el("div", {className: "pnums"}, el("span", {}, "Начало ", el("b", {textContent: dateTime(myShift.start)})), el("span", {}, "Идёт ", el("b", {textContent: dur(Date.now() - myShift.start)}))),
      shiftStats(myShift));
    const row = el("div", {className: "row"});
    const ref = el("button", {className: "sec", textContent: "Обновить"}); ref.onclick = () => scheduleShiftWork(0);
    const b = el("button", {textContent: "Закрыть смену"}); b.onclick = () => confirmTap(b, closeShift);
    row.append(b, ref); card.append(row);
  }
  box.append(card);

  const mine = shifts.filter(s => s.uid === myId && s.end).sort((a, b) => b.start - a.start).slice(0, 50);
  const h = el("div", {className: "card"}, el("h2", {textContent: "Мои смены"}));
  if (!mine.length) h.append(el("div", {className: "empty", textContent: "Закрытых смен пока нет."}));
  for (const s of mine) h.append(el("div", {className: "srow"},
    el("div", {className: "row"}, el("b", {textContent: dateTime(s.start)}), el("span", {className: "size", textContent: "→ " + dateTime(s.end)}), el("span", {className: "grow"}), el("span", {className: "pill", textContent: dur(s.end - s.start)})),
    shiftStats(s)));
  box.append(h);
}

/* ---------- Управление (только владелец) ---------- */
let adminPeriod = "7", adminUser = null;
function renderAdmin(){
  const box = $("tab-admin"); box.innerHTML = "";
  if (!isManager()) return;

  // цены
  const pc = el("input", {value: prices.cut || "", inputMode: "decimal", id: "prCut", placeholder: "0"});
  const pg = el("input", {value: prices.glue || "", inputMode: "decimal", id: "prGlue", placeholder: "0"});
  const ps = el("button", {textContent: "Сохранить цены"});
  ps.onclick = async () => {
    const c = numOrNull(pc.value), g = numOrNull(pg.value);
    if (c == null || g == null || c < 0 || g < 0) { toast("Введите обе цены числом"); return; }
    try { await F.setDoc(F.doc(fs, "settings/prices"), {cut: c, glue: g, updated: Date.now()}); toast("Цены сохранены. Они применятся к новым сменам."); } catch(e) { toast(errMsg(e)); }
  };
  if (pricesLoaded && !(prices.cut > 0) && !(prices.glue > 0)) box.append(el("div", {className: "notice", textContent: "Стандартные цены ещё не указаны — сотрудники не смогут открыть смену. Укажите их ниже."}));
  box.append(el("div", {className: "card"}, el("h2", {textContent: "Стандартные цены за м²"}),
    el("div", {className: "grid2"},
      el("div", {}, el("label", {htmlFor: "prCut", textContent: "Нарезка, ₽/м²"}), pc),
      el("div", {}, el("label", {htmlFor: "prGlue", textContent: "Оклейка, ₽/м²"}), pg)),
    el("div", {className: "empty", textContent: "Цена фиксируется в смене при её открытии: если поменять цену, старые смены останутся по старой."}), ps));

  // сотрудники
  const uc = el("div", {className: "card"}, el("h2", {textContent: "Сотрудники"}));
  const list = Object.entries(usersMap).filter(([id]) => id !== myId && id !== ownerUid)
    .sort((a, b) => (!!a[1].approved - !!b[1].approved) || String(a[1].name).localeCompare(String(b[1].name), "ru"));
  if (!list.length) uc.append(el("div", {className: "empty", textContent: "Пока никто не зарегистрировался. Отправьте сотрудникам ссылку на сайт — они зарегистрируются и появятся здесь."}));
  // выбор одного сотрудника из списка; ожидающие доступа — вверху списка
  if (list.length) {
    if (!list.some(([id]) => id === adminUser)) adminUser = list[0][0];
    const pend = list.filter(([, u]) => !u.approved).length;
    const sel = el("select", {id: "admUserSel"});
    for (const [id, u] of list) sel.append(el("option", {value: id, textContent: (u.name || "Без имени") + (u.approved ? "" : " — ждёт доступа")}));
    sel.value = adminUser;
    sel.onchange = () => { adminUser = sel.value; render(); };
    uc.append(el("label", {htmlFor: "admUserSel", textContent: `Выберите сотрудника (всего ${list.length}${pend ? `, ждут доступа: ${pend}` : ""})`}), sel);
  }
  for (const [id, u] of list.filter(([id]) => id === adminUser)) {
    const ref = F.doc(fs, "users/" + id);
    const upd = async patch => { try { await F.updateDoc(ref, patch); } catch(e) { toast(errMsg(e)); } };
    const ap = el("input", {type: "checkbox", checked: !!u.approved, id: `ap-${id}`}); ap.onchange = () => upd({approved: ap.checked});
    const chips = el("div", {className: "chips"});
    // старое право «Все работы» (admin) показываем как три отдельные галочки
    const cur = new Set(u.roles || []);
    if (cur.has("admin")) { cur.delete("admin"); ["measure", "cut", "glue"].forEach(k => cur.add(k)); }
    for (const key of ["measure", "cut", "glue", "manager"]) {
      const cb = el("input", {type: "checkbox", checked: cur.has(key), id: `role-${id}-${key}`});
      cb.onchange = () => { const r = new Set(cur); cb.checked ? r.add(key) : r.delete(key); upd({roles: [...r]}); };
      chips.append(el("label", {htmlFor: cb.id}, cb, ROLE[key]));
    }
    const ur = rates[id] || {};
    const rc = el("input", {value: ur.cut ?? "", inputMode: "decimal", placeholder: `стандартная ${money(prices.cut)}`, id: `rc-${id}`});
    const rg = el("input", {value: ur.glue ?? "", inputMode: "decimal", placeholder: `стандартная ${money(prices.glue)}`, id: `rg-${id}`});
    // какая ставка действует сейчас: своя или стандартная (стандартная подставляется сама, вводить её не нужно)
    const eff = (k, own) => own != null ? `${money(own)} ₽/м² (своя)` : `${money(prices[k] || 0)} ₽/м² (стандартная)`;
    const effLine = el("div", {className: "pnums"}, el("span", {}, "Сейчас считается: нарезка ", el("b", {textContent: eff("cut", ur.cut)})), el("span", {}, "оклейка ", el("b", {textContent: eff("glue", ur.glue)})));
    const back = el("button", {className: "link", textContent: "Вернуть стандартные"});
    back.classList.toggle("hidden", ur.cut == null && ur.glue == null);
    back.onclick = async () => { try { await F.deleteDoc(F.doc(fs, "rates/" + id)); toast("Теперь у сотрудника стандартные ставки"); } catch(e) { toast(errMsg(e)); } };
    const rs = el("button", {className: "sec", textContent: "Сохранить ставки"});
    // личные ставки лежат отдельно (rates/<id>): их видят только руководство и сам сотрудник
    rs.onclick = async () => { try { await F.setDoc(F.doc(fs, "rates/" + id), {cut: numOrNull(rc.value), glue: numOrNull(rg.value)}); toast("Ставки сохранены для новых смен"); } catch(e) { toast(errMsg(e)); } };
    const del = el("button", {className: "link", textContent: "Удалить сотрудника"});
    del.onclick = () => confirmTap(del, async () => { try { await F.deleteDoc(ref); toast("Сотрудник удалён"); } catch(e) { toast(errMsg(e)); } });
    uc.append(el("div", {className: "member"},
      el("div", {className: "row"}, el("b", {className: "grow", textContent: u.name || "Без имени"}),
        el("span", {className: "pill" + (u.approved ? " ok" : ""), textContent: u.approved ? "работает" : "ждёт доступа"})),
      el("div", {className: "chips"}, el("label", {htmlFor: ap.id}, ap, "Доступ разрешён")),
      el("div", {className: "empty", textContent: "Что может изменять («Управление» — доступ к этому разделу: сотрудники, цены, смены, оплата):"}), chips,
      el("div", {className: "grid2"},
        el("div", {}, el("label", {htmlFor: rc.id, textContent: "Своя ставка: нарезка"}), rc),
        el("div", {}, el("label", {htmlFor: rg.id, textContent: "Своя ставка: оклейка"}), rg)),
      effLine,
      el("div", {className: "empty", textContent: "Оставьте поле пустым — будет стандартная цена. Заполняйте, только если этому человеку нужна другая ставка."}),
      el("div", {className: "row"}, rs, back, el("span", {className: "grow"}), del)));
  }
  uc.append(el("div", {className: "empty", textContent: "Забыл пароль: удалите сотрудника здесь и в консоли Firebase (Authentication → Users → его строка → Delete account). После этого он сможет зарегистрироваться заново с тем же именем."}));
  box.append(uc);

  // смены
  const sc = el("div", {className: "card"}, el("h2", {textContent: "Смены и оплата"}));
  const per = el("select", {id: "perSel"});
  for (const [v, t] of [["1", "Сегодня"], ["7", "7 дней"], ["30", "30 дней"], ["all", "Всё время"]]) per.append(el("option", {value: v, textContent: t}));
  per.value = adminPeriod; per.onchange = () => { adminPeriod = per.value; render(); };
  const rb = el("button", {className: "sec", textContent: "Пересчитать объёмы"}); rb.onclick = loadAllWork;
  sc.append(el("div", {className: "row"}, per, rb));
  const from = adminPeriod === "all" ? 0 : (adminPeriod === "1" ? new Date().setHours(0, 0, 0, 0) : Date.now() - Number(adminPeriod) * 864e5);
  const ss = shifts.filter(s => s.start >= from).sort((a, b) => b.start - a.start);
  // итоги по людям
  const tot = {};
  for (const s of ss) {
    const w = shiftWorkOf(s), t = tot[s.uid] || (tot[s.uid] = {n: 0, ms: 0, cut: 0, glue: 0, pay: 0});
    t.n++; t.ms += (s.end || Date.now()) - s.start; t.cut += w.cut; t.glue += w.glue; t.pay += shiftPay(s) + (s.bonus || 0);
  }
  if (!ss.length) sc.append(el("div", {className: "empty", textContent: "За этот период смен нет."}));
  else {
    const tb = el("table", {}, el("thead", {}, el("tr", {}, ...["Сотрудник", "Смен", "Часы", "Нарезка м²", "Оклейка м²", "К оплате"].map((h, i) => el("th", {className: i ? "n" : "", textContent: h})))));
    const tbody = el("tbody");
    let all = 0;
    for (const [uid, t] of Object.entries(tot)) {
      all += t.pay;
      tbody.append(el("tr", {}, el("td", {textContent: (usersMap[uid] || {}).name || names[uid] || "—"}), el("td", {className: "n", textContent: t.n}),
        el("td", {className: "n", textContent: (t.ms / 36e5).toFixed(1).replace(".", ",")}), el("td", {className: "n", textContent: m2(t.cut)}),
        el("td", {className: "n", textContent: m2(t.glue)}), el("td", {className: "n money", textContent: money(t.pay) + " ₽"})));
    }
    tbody.append(el("tr", {}, el("td", {colSpan: 5, textContent: "Всего"}), el("td", {className: "n money", textContent: money(all) + " ₽"})));
    tb.append(tbody);
    sc.append(el("div", {className: "scroll"}, tb));
    const cp = el("button", {className: "sec", textContent: "Скопировать смены для Excel"});
    cp.onclick = () => copyText(["Сотрудник\tНачало\tКонец\tЧасы\tНарезка м²\tЦена нарезки\tОклейка м²\tЦена оклейки\tЗа работу\tБонус/штраф\tКомментарий\tИтого"].concat(ss.map(s => {
      const w = shiftWorkOf(s), pay = shiftPay(s);
      return [s.name, dateTime(s.start), s.end ? dateTime(s.end) : "открыта", (((s.end || Date.now()) - s.start) / 36e5).toFixed(2).replace(".", ","), m2(w.cut), money(s.priceCut), m2(w.glue), money(s.priceGlue), money(pay), money(s.bonus || 0), s.bonusNote || "", money(pay + (s.bonus || 0))].join("\t");
    })).join("\n"), "Смены скопированы — вставьте в Excel");
    sc.append(cp);
  }
  for (const s of ss) {
    const ref = F.doc(fs, "shifts/" + s.id);
    // бонус (+) или штраф (−): сумма вводится без знака, знак выбирается списком
    const bk = el("select", {id: `bk-${s.id}`});
    bk.append(el("option", {value: "plus", textContent: "Бонус +"}), el("option", {value: "minus", textContent: "Штраф −"}));
    bk.value = (s.bonus || 0) < 0 ? "minus" : "plus";
    const bn = el("input", {value: s.bonus ? Math.abs(s.bonus) : "", inputMode: "decimal", placeholder: "0", id: `bn-${s.id}`});
    const bt = el("input", {value: s.bonusNote || "", placeholder: "за что (необязательно)", id: `bt-${s.id}`});
    const bs = el("button", {className: "sec", textContent: "Сохранить"});
    bs.onclick = async () => {
      const v = Math.abs(numOrNull(bn.value) || 0), val = bk.value === "minus" ? -v : v;
      try { await F.updateDoc(ref, {bonus: val, bonusNote: bt.value.trim()}); toast(val < 0 ? "Штраф сохранён" : val > 0 ? "Бонус сохранён" : "Бонус убран"); } catch(e) { toast(errMsg(e)); }
    };
    const row = el("div", {className: "srow"},
      el("div", {className: "row"}, el("b", {textContent: s.name || "—"}), el("span", {className: "size", textContent: `${dateTime(s.start)} → ${s.end ? dateTime(s.end) : "идёт"}`}), el("span", {className: "grow"}),
        el("span", {className: "pill" + (s.end ? "" : " ok"), textContent: s.end ? dur(s.end - s.start) : "открыта"})),
      shiftStats(s),
      shiftMismatch(s) ? el("div", {className: "empty", style: "color:var(--warn);font-weight:600", textContent: shiftMismatch(s)}) : "",
      el("div", {className: "grid2"},
        el("div", {}, el("label", {htmlFor: bk.id, textContent: "Бонус или штраф"}), bk),
        el("div", {}, el("label", {htmlFor: bn.id, textContent: "Сумма, ₽"}), bn)),
      el("div", {}, el("label", {htmlFor: bt.id, textContent: "Комментарий (за что)"}), bt));
    const act = el("div", {className: "row"}, bs);
    if (!s.end) { const cl = el("button", {className: "link", textContent: "Закрыть смену сейчас"}); cl.onclick = () => confirmTap(cl, async () => {
      try { const w = await loadShiftWork(s); await F.updateDoc(ref, {end: Date.now(), cutArea: w.cut, glueArea: w.glue, sum: Math.round((w.cut * s.priceCut + w.glue * s.priceGlue) * 100) / 100}); toast("Смена закрыта"); } catch(e) { toast(errMsg(e)); } }); act.append(cl); }
    const dl = el("button", {className: "link", textContent: "Удалить"}); dl.onclick = () => confirmTap(dl, async () => { try { await F.deleteDoc(ref); } catch(e) { toast(errMsg(e)); } });
    act.append(el("span", {className: "grow"}), dl);
    row.append(act); sc.append(row);
  }
  box.append(sc);

  // резервная копия
  const bk = el("button", {className: "sec", textContent: "Скачать копию базы"});
  bk.onclick = downloadBackup;
  box.append(el("div", {className: "card"}, el("h2", {textContent: "Резервная копия"}),
    el("div", {className: "empty", textContent: "Скачивает все данные (объекты, окна, кабинеты, отметки, смены, сотрудников) одним файлом. Сохраняйте его, например, раз в неделю."}), bk));
}

async function downloadBackup(){
  toast("Собираю копию…");
  try {
    // если какой-то раздел прочитать не удалось, копия всё равно скачается, а в файле будет пометка
    const skipped = [];
    const grab = async path => { try { const r = {}; (await F.getDocs(F.collection(fs, path))).forEach(d => r[d.id] = d.data()); return r; } catch(e) { skipped.push(path); return {}; } };
    const out = {exportedAt: new Date().toISOString(), config: {owner: (await F.getDoc(F.doc(fs, "config/owner"))).data() || null}, settings: await grab("settings"), users: await grab("users"), rates: await grab("rates"), shifts: await grab("shifts"), objects: {}};
    for (const o of (await F.getDocs(F.collection(fs, "objects"))).docs)
      out.objects[o.id] = {data: o.data(), types: await grab(`objects/${o.id}/types`), rooms: await grab(`objects/${o.id}/rooms`), log: await grab(`objects/${o.id}/log`)};
    if (skipped.length) out.skipped = skipped;
    const blob = new Blob([JSON.stringify(out, null, 1)], {type: "application/json"});
    const a = el("a", {href: URL.createObjectURL(blob), download: `zamery-kopiya-${new Date().toISOString().slice(0, 10)}.json`});
    document.body.append(a); a.click(); a.remove();
    toast(skipped.length ? `Копия скачана, но без разделов: ${skipped.join(", ")} — проверьте, что вставлены последние правила в Firebase` : "Копия скачана");
  } catch(e) { toast("Не удалось собрать копию: " + errMsg(e)); }
}


/* ---------- удаление объекта (руководство с правом «Замер») ---------- */
const canDeleteObject = () => isManager() && allowed("measure");
function renderObjDelete(){
  const o = objects.find(o => o.id === curObj);
  $("objDelBtn").classList.toggle("hidden", !o || !canDeleteObject());
  if (!o) $("objDelBox").classList.add("hidden");
}
$("objDelBtn").onclick = () => {
  const o = objects.find(o => o.id === curObj); if (!o) return;
  $("objDelTitle").textContent = `Удалить объект «${o.name}»?`;
  $("objDelConfirm").value = ""; $("objDelBox").classList.remove("hidden"); $("objDelConfirm").focus();
};
$("objDelCancel").onclick = () => $("objDelBox").classList.add("hidden");
$("objDelGo").onclick = async () => {
  const o = objects.find(o => o.id === curObj); if (!o) return;
  if ($("objDelConfirm").value.trim().toLowerCase() !== String(o.name).trim().toLowerCase()) { toast("Название не совпадает — объект не удалён"); return; }
  const btn = $("objDelGo"); btn.disabled = true; toast("Удаляю…");
  try {
    // сначала всё внутри объекта, потом сам объект (пачками до 400 записей)
    const refs = [];
    for (const sub of ["log", "rooms", "types"]) (await F.getDocs(F.collection(fs, `objects/${o.id}/${sub}`))).forEach(d => refs.push(d.ref));
    for (let i = 0; i < refs.length; i += 400) { const b = F.writeBatch(fs); refs.slice(i, i + 400).forEach(r => b.delete(r)); await b.commit(); }
    await F.deleteDoc(F.doc(fs, "objects/" + o.id));
    delete typesCache[o.id];
    try { localStorage.removeItem("zamery-obj"); } catch(e) {}
    $("objDelBox").classList.add("hidden");
    toast(`Объект «${o.name}» удалён`);
    curObj = null; openObject(null);
  } catch(e) { toast("Не удалось удалить: " + errMsg(e)); }
  btn.disabled = false;
};
