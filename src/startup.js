/* ---------- вход и регистрация ---------- */
// SHA-256 без crypto.subtle: браузер даёт crypto.subtle только на https, а сайт могут открыть и по http
function sha256Bytes(bytes){
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const l = bytes.length, withPad = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(withPad);
  m.set(bytes); m[l] = 0x80;
  const dv = new DataView(m.buffer); dv.setUint32(withPad - 4, l * 8); dv.setUint32(withPad - 8, Math.floor(l / 0x20000000));
  const w = new Uint32Array(64), r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < withPad; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const s0 = r(w[i-15], 7) ^ r(w[i-15], 18) ^ (w[i-15] >>> 3), s1 = r(w[i-2], 17) ^ r(w[i-2], 19) ^ (w[i-2] >>> 10); w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(32), odv = new DataView(out.buffer); H.forEach((v, i) => odv.setUint32(i * 4, v)); return out;
}
async function nameToEmail(name){
  const n = name.trim().replace(/\s+/g, " ").toLowerCase().replace(/ё/g, "е");
  const data = new TextEncoder().encode(n);
  const h = (window.crypto && crypto.subtle) ? new Uint8Array(await crypto.subtle.digest("SHA-256", data)) : sha256Bytes(data);
  return "u" + [...h.slice(0, 16)].map(b => b.toString(16).padStart(2, "0")).join("") + "@zamery.app";
}
const isLegacyEmail = email => /@zamery\.app$/i.test(email || "");
const isRealEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !isLegacyEmail(email);
function authError(e, action){
  const c = String(e && e.code || "");
  if (c.includes("email-already-in-use")) return "Этот email уже используется. Введите другой адрес или войдите.";
  if (c.includes("invalid-email")) return "Проверьте адрес почты.";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found") || c.includes("invalid-login")) {
    return action === "link" ? "Неверный текущий пароль." : "Неверное имя, email или пароль.";
  }
  if (c.includes("weak-password")) return "Пароль должен быть не короче 6 символов.";
  if (c.includes("network")) return "Нет интернета. Проверьте связь и повторите.";
  if (c.includes("too-many-requests")) return "Слишком много попыток. Подождите пару минут.";
  if (c.includes("operation-not-allowed")) return "Вход по паролю не включён в Firebase (Authentication → Sign-in method → Email/Password).";
  return "Не удалось выполнить действие. Повторите попытку.";
}
// Для временной остановки регистрации и привязки выключите флаг и пересоберите сайт.
const emailEnrollmentEnabled = true;
let authMode = "login";
let registrationDraft;
const registrationKey = "glixpro-email-registration";
try { registrationDraft = JSON.parse(sessionStorage.getItem(registrationKey)); } catch(e) {}
function saveRegistrationDraft(draft){
  registrationDraft = draft;
  try {
    if (draft) sessionStorage.setItem(registrationKey, JSON.stringify(draft));
    else sessionStorage.removeItem(registrationKey);
  } catch(e) {}
}
function setAuthMode(m){
  if (m === "reg" && !emailEnrollmentEnabled) m = "login";
  const reset = m === "reset", reg = m === "reg";
  authMode = m;
  $("aLogin").setAttribute("aria-selected", m === "login"); $("aReg").setAttribute("aria-selected", m === "reg");
  $("authTitle").textContent = reset ? "Восстановление пароля" : reg ? "Регистрация" : "Вход";
  $("aGo").textContent = reset ? "Отправить ссылку" : reg ? "Зарегистрироваться" : "Войти";
  $("aNameLabel").textContent = reset ? "Привязанный email" : reg ? "Имя и фамилия" : "Имя и фамилия или email";
  $("aName").type = reset ? "email" : "text";
  $("aName").autocomplete = reset ? "email" : reg ? "name" : "username";
  $("aName").placeholder = reset ? "ivan@example.com" : reg ? "Например, Иван Петров" : "";
  $("aTabs").classList.toggle("hidden", reset || !emailEnrollmentEnabled);
  $("aEmailWrap").classList.toggle("hidden", !reg);
  $("aPassWrap").classList.toggle("hidden", reset);
  $("aPass2Wrap").classList.toggle("hidden", !reg);
  $("aReset").classList.toggle("hidden", m !== "login");
  $("aBack").classList.toggle("hidden", !reset);
  $("aPass").autocomplete = reg ? "new-password" : "current-password";
  $("aPass").value = $("aPass2").value = "";
  $("aHint").textContent = reset ? "Если почта ещё не привязана, обратитесь к администратору." :
    reg ? "Подтвердите email, затем дождитесь доступа от руководителя. Пароль — от 6 символов." :
      "После привязки почты входите по email. Для аккаунта без почты используйте имя и фамилию.";
  $("aMsg").textContent = "";
}
$("aLogin").onclick = () => setAuthMode("login");
$("aReg").onclick = () => setAuthMode("reg");
$("aReset").onclick = () => {
  const email = $("aName").value.trim();
  $("aName").value = isRealEmail(email) ? email : "";
  setAuthMode("reset");
  $("aName").focus();
};
$("aBack").onclick = () => { setAuthMode("login"); $("aName").focus(); };
$("aForm").onsubmit = async e => {
  e.preventDefault();
  const mode = authMode, pass = $("aPass").value;
  const entered = $("aName").value.trim(), name = entered.replace(/\s+/g, " ");
  const email = (mode === "reg" ? $("aEmail").value.trim() : entered).toLowerCase();
  const msg = $("aMsg"); msg.textContent = "";
  if (mode === "reg" && (name.length < 2 || name.length > 60)) { msg.textContent = "Введите имя и фамилию (от 2 до 60 символов)."; return; }
  if (mode !== "login" && !isRealEmail(email)) { msg.textContent = "Введите полный адрес почты."; return; }
  if (mode === "login" && !entered) { msg.textContent = "Введите имя и фамилию или email."; return; }
  if (mode !== "reset" && pass.length < 6) { msg.textContent = "Пароль должен быть не короче 6 символов."; return; }
  if (mode === "reg" && pass !== $("aPass2").value) { msg.textContent = "Пароли не совпадают."; return; }
  const controls = ["aGo", "aLogin", "aReg", "aReset", "aBack"].map($);
  if ($("aGo").disabled) return;
  controls.forEach(button => { button.disabled = true; });
  try {
    if (mode === "reset") {
      try { await A.sendPasswordResetEmail(auth, email); }
      catch(error) { if (error.code !== "auth/user-not-found") throw error; }
      msg.textContent = "Если к этому адресу привязан аккаунт, на почту придёт ссылка для сброса пароля.";
    } else if (mode === "login") {
      await A.signInWithEmailAndPassword(auth, isRealEmail(email) ? email : await nameToEmail(name), pass);
    } else {
      const cred = await A.createUserWithEmailAndPassword(auth, email, pass);
      saveRegistrationDraft({uid: cred.user.uid, name});
      await createRegistrationProfile(cred.user);
    }
  } catch(error) { msg.textContent = authError(error); }
  finally { controls.forEach(button => { button.disabled = false; }); }
};

function showAccountMessage(id, message){
  $(id).textContent = message;
  $(id).classList.toggle("hidden", !message);
}
let creatingProfile = false;
async function createRegistrationProfile(user){
  if (!user || creatingProfile || registrationDraft?.uid !== user.uid) return;
  creatingProfile = true;
  $("waitRetryProfile").disabled = true;
  showAccountMessage("waitMsg", "");
  try {
    const ref = F.doc(fs, "users", user.uid);
    const name = registrationDraft.name;
    await F.runTransaction(fs, async tx => {
      if (!(await tx.get(ref)).exists()) {
        tx.set(ref, {name, roles: [], approved: false, created: Date.now(), emailPending: true});
      }
    });
    saveRegistrationDraft(null);
    try {
      if (!user.emailVerified) await A.sendEmailVerification(user);
    } catch(e) {
      showAccountMessage("waitMsg", "Не удалось отправить письмо. Нажмите «Отправить письмо ещё раз».");
    }
  } catch(e) {
    showAccountMessage("waitMsg", "Не удалось сохранить профиль. Нажмите «Завершить регистрацию», чтобы повторить.");
  } finally {
    creatingProfile = false;
    $("waitRetryProfile").disabled = false;
    if (!me && registrationDraft?.uid === user.uid) gate();
  }
}
$("waitRetryProfile").onclick = () => createRegistrationProfile(auth.currentUser);

async function confirmRegistrationEmail(user){
  await A.reload(user);
  if (!user.emailVerified || !isRealEmail(user.email || "")) {
    showAccountMessage("waitMsg", "Откройте ссылку из письма и нажмите «Я подтвердил почту» ещё раз.");
    return;
  }
  await A.getIdToken(user, true);
  const profileRef = F.doc(fs, "users", user.uid), ownerRef = F.doc(fs, "config/owner");
  await F.runTransaction(fs, async tx => {
    const profile = await tx.get(profileRef);
    if (profile.data()?.emailPending !== true) return;
    const owner = await tx.get(ownerRef);
    if (!owner.exists()) tx.set(ownerRef, {uid: user.uid, at: Date.now()});
    tx.update(profileRef, {emailPending: false});
  });
}
async function runEmailCheck(action){
  const user = auth.currentUser;
  if (!user || $("waitCheckEmail").disabled) return;
  $("waitCheckEmail").disabled = $("waitResendEmail").disabled = true;
  showAccountMessage("waitMsg", "");
  try { await action(user); }
  catch(e) { showAccountMessage("waitMsg", authError(e)); }
  finally { $("waitCheckEmail").disabled = $("waitResendEmail").disabled = false; }
}
$("waitCheckEmail").onclick = () => runEmailCheck(confirmRegistrationEmail);
$("waitResendEmail").onclick = () => runEmailCheck(async user => {
  await A.sendEmailVerification(user);
  showAccountMessage("waitMsg", "Письмо отправлено. Проверьте также папку «Спам».");
});

$("editName").onclick = () => {
  $("newName").value = me?.name || "";
  $("nameForm").classList.remove("hidden");
  $("newName").focus();
};
$("cancelName").onclick = () => $("nameForm").classList.add("hidden");
$("nameForm").onsubmit = async e => {
  e.preventDefault();
  const name = $("newName").value.trim();
  if (!name) { $("newName").focus(); return; }
  try {
    await F.updateDoc(F.doc(fs, "users", myId), {name});
    $("nameForm").classList.add("hidden");
    showAccountMessage("profileMsg", isLegacyEmail(auth.currentUser.email) ? "Имя сохранено. Для входа используйте прежний логин." : "Имя сохранено.");
  } catch(e) { showAccountMessage("profileMsg", "Не удалось сохранить имя. " + errMsg(e)); }
};
$("editAvatar").onclick = $("avatarPick").onclick = () => $("avatarFile").click();
$("avatarFile").onchange = async () => {
  const file = $("avatarFile").files[0], uid = myId;
  $("avatarFile").value = "";
  if (!file) return;
  const url = URL.createObjectURL(file);
  $("editAvatar").disabled = $("avatarPick").disabled = true;
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 192;
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    canvas.getContext("2d").drawImage(img, (img.naturalWidth-side)/2, (img.naturalHeight-side)/2, side, side, 0, 0, 192, 192);
    await F.setDoc(F.doc(fs, "prefs", uid), {avatar:canvas.toDataURL("image/jpeg", 0.86)}, {merge:true});
    showAccountMessage("profileMsg", "Фото сохранено.");
  } catch(e) { showAccountMessage("profileMsg", "Не удалось сохранить фото. Попробуйте JPG или PNG."); }
  finally { URL.revokeObjectURL(url); $("editAvatar").disabled = $("avatarPick").disabled = false; }
};
function renderAccountEmail(user){
  const legacy = isLegacyEmail(user.email);
  $("accountEmail").textContent = legacy ? "Почта для входа и восстановления пароля пока не привязана." : "Email для входа: " + user.email;
  $("accountLink").classList.toggle("hidden", !emailEnrollmentEnabled);
  $("accountLink").textContent = legacy ? "Привязать почту" : "Изменить почту";
  if (!legacy) {
    $("accountForm").classList.add("hidden");
    showAccountMessage("accountMsg", "");
  }
}
$("accountLink").onclick = () => {
  const open = $("accountForm").classList.toggle("hidden") === false;
  $("accountLink").setAttribute("aria-expanded", open);
  if (open) $("accountNewEmail").focus();
  else $("accountPass").value = "";
};
$("accountForm").onsubmit = async e => {
  e.preventDefault();
  const user = auth.currentUser, button = $("accountSend");
  if (!emailEnrollmentEnabled || !user || button.disabled) return;
  const email = $("accountNewEmail").value.trim().toLowerCase();
  const pass = $("accountPass").value;
  if (!isRealEmail(email)) { showAccountMessage("accountMsg", "Введите полный адрес почты."); return; }
  if (email === user.email.toLowerCase()) { showAccountMessage("accountMsg", "Введите новый адрес почты."); return; }
  if (!pass) { showAccountMessage("accountMsg", "Введите текущий пароль."); return; }
  button.disabled = true;
  showAccountMessage("accountMsg", "");
  try {
    await A.reauthenticateWithCredential(user, A.EmailAuthProvider.credential(user.email, pass));
    await A.verifyBeforeUpdateEmail(user, email);
    $("accountPass").value = "";
    $("accountForm").classList.add("hidden");
    $("accountLink").setAttribute("aria-expanded", "false");
    showAccountMessage("accountMsg", "Письмо отправлено. Подтвердите адрес по ссылке, затем входите по email с текущим паролем.");
  } catch(error) { showAccountMessage("accountMsg", authError(error, "link")); }
  finally { $("accountPass").value = ""; button.disabled = false; }
};
$("accountPassword").onclick = () => {
  const open = !$("passwordForm").classList.toggle("hidden");
  $("accountPassword").setAttribute("aria-expanded", open);
  for (const id of ["passwordCurrent", "passwordNew", "passwordRepeat"]) $(id).value = "";
  showAccountMessage("passwordMsg", "");
  if (open) $("passwordCurrent").focus();
};
$("passwordForm").onsubmit = async e => {
  e.preventDefault();
  const user = auth.currentUser, button = $("passwordSave");
  if (!user || button.disabled) return;
  const current = $("passwordCurrent").value, password = $("passwordNew").value;
  if (!current) { showAccountMessage("passwordMsg", "Введите текущий пароль."); return; }
  if (password.length < 6) { showAccountMessage("passwordMsg", "Пароль должен быть не короче 6 символов."); return; }
  if (password !== $("passwordRepeat").value) { showAccountMessage("passwordMsg", "Пароли не совпадают."); return; }
  button.disabled = true;
  showAccountMessage("passwordMsg", "");
  try {
    await A.reauthenticateWithCredential(user, A.EmailAuthProvider.credential(user.email, current));
    await A.updatePassword(user, password);
    $("passwordForm").classList.add("hidden");
    $("accountPassword").setAttribute("aria-expanded", "false");
    showAccountMessage("passwordMsg", "Пароль изменён. Используйте его при следующем входе.");
  } catch(error) { showAccountMessage("passwordMsg", authError(error, "link")); }
  finally {
    for (const id of ["passwordCurrent", "passwordNew", "passwordRepeat"]) $(id).value = "";
    button.disabled = false;
  }
};
const logout = async () => { try { await A.signOut(auth); } catch(e) {} location.reload(); };
$("logoutBtn").onclick = logout; $("waitLogout").onclick = logout;

/* ---------- запуск ---------- */
function view(name){ window.watchAppLoad(name === "loadView"); for (const v of ["loadView", "authView", "waitView", "app"]) $(v).classList.toggle("hidden", v !== name); }
let gsubs = [], dataStarted = false, ownerKnown = false, meKnown = false, startedAsManager = false, emailCheckStarted = false;

function gate(){
  if (!ownerKnown || !meKnown) return;
  const user = auth.currentUser;
  if (!user) return;
  if (me?.emailPending === true || (!me && registrationDraft?.uid === user.uid)) {
    view("waitView");
    const pendingEmail = me?.emailPending === true;
    $("waitTitle").textContent = pendingEmail ? "Подтвердите почту" : "Завершение регистрации";
    $("waitText").textContent = pendingEmail ? "Откройте ссылку из письма, затем вернитесь сюда и нажмите «Я подтвердил почту»." :
      creatingProfile ? "Сохраняем данные для регистрации." : "Завершите создание профиля, чтобы получить письмо.";
    $("waitEmailControls").classList.toggle("hidden", !pendingEmail);
    $("waitRetryProfile").classList.toggle("hidden", pendingEmail || creatingProfile);
    if (pendingEmail && user.emailVerified && !emailCheckStarted) {
      emailCheckStarted = true;
      runEmailCheck(confirmRegistrationEmail);
    }
  } else if (amOwner || (me && me.approved)) {
    view("app");
    if (!dataStarted) startData();
    render();
  } else {
    view("waitView");
    $("waitTitle").textContent = me ? "Ожидает подтверждения" : "Профиль не найден";
    $("waitEmailControls").classList.add("hidden");
    $("waitRetryProfile").classList.add("hidden");
    showAccountMessage("waitMsg", "");
    $("waitText").textContent = me
      ? `${me.name}, вы зарегистрированы. Владелец должен подтвердить ваш доступ — после этого страница откроется сама.`
      : "Профиль не найден. Возможно, владелец удалил вашу учётную запись. Выйдите и зарегистрируйтесь заново.";
  }
}

function startData(){
  dataStarted = true;
  db = makeDb();
  let t = "measure"; try { t = localStorage.getItem("zamery-tab") || "measure"; } catch(e) {}
  if (!TAB_TITLE[t] || (t === "admin" && !isManager())) t = "measure";
  showTab(t);
  // цены, сотрудники, смены
  gsubs.push(F.onSnapshot(F.doc(fs, "settings/prices"), d => { prices = d.exists() ? d.data() : {cut: 0, glue: 0}; pricesLoaded = true; render(); }, () => { pricesLoaded = true; }));
  gsubs.push(F.onSnapshot(F.collection(fs, "users"), q => {
    usersMap = {}; q.forEach(d => { usersMap[d.id] = d.data(); names[d.id] = d.data().name || ""; }); render();
  }, () => {}));
  startedAsManager = isManager();
  const sq = startedAsManager ? F.collection(fs, "shifts") : F.query(F.collection(fs, "shifts"), F.where("uid", "==", myId));
  // личные ставки: руководство видит все, сотрудник — только свою
  if (startedAsManager) gsubs.push(F.onSnapshot(F.collection(fs, "rates"), q => { rates = {}; q.forEach(d => rates[d.id] = d.data()); render(); }, () => {}));
  else gsubs.push(F.onSnapshot(F.doc(fs, "rates/" + myId), d => { rates = d.exists() ? {[myId]: d.data()} : {}; render(); }, () => {}));
  gsubs.push(F.onSnapshot(sq, q => {
    shifts = q.docs.map(d => ({id: d.id, ...d.data()}));
    const was = myShift && myShift.id;
    myShift = shifts.find(s => s.uid === myId && !s.end) || null;
    if (myShift && myShift.id !== was) scheduleShiftWork(0);
    render();
  }, e => toast("Не удалось загрузить смены: " + errMsg(e))));
  // объекты
  const timer = setTimeout(() => status("База пока не отвечает — проверьте интернет. Внесённые данные сохранятся, когда связь появится."), 10000);
  gsubs.push(F.onSnapshot(F.collection(fs, "objects"), {includeMetadataChanges: true}, q => {
    objects = q.docs.map(d => ({id: d.id, ...d.data()})).sort((a, b) => (b.created || 0) - (a.created || 0));
    if (!q.metadata.fromCache) { clearTimeout(timer); status(objects.length ? "" : (allowed("measure") ? "Создайте первый объект кнопкой «Новый»." : "Объектов пока нет.")); }
    if (!curObj || !objects.find(o => o.id === curObj)) {
      let saved = null; try { saved = localStorage.getItem("zamery-obj"); } catch(e) {}
      const pick = objects.find(o => o.id === saved) || objects[0];
      if (pick && pick.id !== curObj) { openObject(pick.id); return; }
    }
    render();
  }, e => { clearTimeout(timer); status("Не удалось подключиться к базе: " + errMsg(e)); }));
  // пока смена открыта, раз в минуту обновляем время на экране
  setInterval(() => { if (myShift && !$("tab-shift").classList.contains("hidden")) render(); }, 60000);
}

if (String(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey || "").length < 10) {
  view("loadView"); $("loadMessage").textContent = "Сайт ещё не подключён к Firebase: не указаны ключи проекта.";
} else {
  const fapp = initializeApp(FIREBASE_CONFIG);
  auth = A.getAuth(fapp);
  auth.languageCode = "ru";
  try { fs = F.initializeFirestore(fapp, {localCache: F.persistentLocalCache({tabManager: F.persistentMultipleTabManager()})}); }
  catch(e) { fs = F.getFirestore(fapp); }
  let userSubs = [];
  A.onAuthStateChanged(auth, u => {
    userSubs.forEach(f => f()); userSubs = [];
    if (!u) { myId = null; me = null; view("authView"); setAuthMode("login"); return; }
    if (dataStarted && myId && myId !== u.uid) { location.reload(); return; }
    myId = u.uid; ownerKnown = meKnown = false;
    emailCheckStarted = false;
    renderAccountEmail(u);
    $("avatarImage").removeAttribute("src");
    $("avatarImage").classList.add("hidden");
    $("avatarInitial").classList.remove("hidden");
    userSubs.push(F.onSnapshot(F.doc(fs, "prefs", u.uid), snap => {
      const avatar = snap.data()?.avatar;
      const valid = typeof avatar === "string" && avatar.startsWith("data:image/jpeg;base64,");
      if (valid) $("avatarImage").src = avatar;
      $("avatarImage").classList.toggle("hidden", !valid);
      $("avatarInitial").classList.toggle("hidden", valid);
    }, () => {}));
    loadLookFromAccount();
    view("loadView");
    userSubs.push(F.onSnapshot(F.doc(fs, "config/owner"), d => { ownerUid = d.exists() ? d.data().uid : null; amOwner = ownerUid === myId; ownerKnown = true; gate(); },
      () => { ownerKnown = true; gate(); }));
    userSubs.push(F.onSnapshot(F.doc(fs, "users/" + myId), d => {
      me = d.exists() ? {id: d.id, ...d.data()} : null; meKnown = true;
      $("profileName").textContent = me?.name || "";
      $("avatarInitial").textContent = (me?.name || "").trim().slice(0,1).toUpperCase();
      if (dataStarted && !amOwner && me && !me.approved) { location.reload(); return; }
      if (dataStarted && isManager() !== startedAsManager) { location.reload(); return; }   // выдали или забрали «Управление»
      gate();
    }, () => { meKnown = true; gate(); }));
  });
}
