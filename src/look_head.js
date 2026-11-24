/* Внешний вид: тема, главный цвет и эффект стекла.
   Этот код стоит в <head> и срабатывает до показа страницы,
   поэтому сохранённый цвет виден сразу, без мигания. */
(function(){
  var KEY = "windows-look";
  var ACCENTS = {
    sky:    {name: "Голубой", light: ["#177bac", "#dff2fc"], dark: ["#48b5e8", "#162e3b"]},
    orange: {name: "Оранжевый", light: ["#e2590f", "#fde9dc"], dark: ["#ff7a33", "#3a2416"]},
    blue:   {name: "Синий",     light: ["#1f6feb", "#dbe8fd"], dark: ["#4c9aff", "#16263d"]},
    green:  {name: "Зелёный",   light: ["#1a8a4a", "#daf1e3"], dark: ["#3fcf7f", "#15301f"]},
    teal:   {name: "Бирюзовый", light: ["#0f8b8d", "#d6f0f0"], dark: ["#33c3c5", "#12302f"]},
    purple: {name: "Фиолетовый", light: ["#7a3fd1", "#ece2fb"], dark: ["#a77bff", "#2a2140"]},
    red:    {name: "Красный",   light: ["#d0342c", "#fbe0de"], dark: ["#ff6b61", "#3a1d1b"]},
    pink:   {name: "Розовый",   light: ["#d6336c", "#fbe0ea"], dark: ["#ff6b9e", "#3a1b28"]}
  };
  var DEF = {theme: "auto", accent: "sky", glass: 50, t: 0};
  var darkMq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : {matches: false};
  function clean(o){
    var l = {theme: DEF.theme, accent: DEF.accent, glass: DEF.glass, t: 0};
    if (o && typeof o === "object") {
      if (o.theme === "auto" || o.theme === "light" || o.theme === "dark") l.theme = o.theme;
      if (ACCENTS[o.accent]) l.accent = o.accent;
      var g = Number(o.glass); if (isFinite(g)) l.glass = Math.max(0, Math.min(100, Math.round(g)));
      var t = Number(o.t); if (isFinite(t) && t > 0) l.t = t;
    }
    return l;
  }
  function load(){ try { return clean(JSON.parse(localStorage.getItem(KEY) || "{}")); } catch(e) { return clean(null); } }
  function store(l){ try { localStorage.setItem(KEY, JSON.stringify(l)); return true; } catch(e) { return false; } }
  function isDark(l){ return l.theme === "dark" || (l.theme === "auto" && darkMq.matches); }
  function rgb(hex){ var n = parseInt(hex.slice(1), 16); return ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255); }
  function apply(l){
    var root = document.documentElement, dark = isDark(l);
    if (l.theme === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", l.theme);
    var a = ACCENTS[l.accent] || ACCENTS[DEF.accent], c = dark ? a.dark : a.light;
    root.style.setProperty("--accent", c[0]);
    root.style.setProperty("--accent-soft", c[1]);
    root.style.setProperty("--accent-ink", dark ? "#14100c" : "#ffffff");
    root.style.setProperty("--accent-rgb", rgb(c[0]));
    // стекло: 0 — выключено, 100 — самое прозрачное и размытое
    var g = l.glass;
    root.classList.toggle("glass", g > 0);
    root.style.setProperty("--glass-alpha", (0.9 - g * 0.006).toFixed(3));   // 0.9 … 0.3
    root.style.setProperty("--glass-blur", Math.round(6 + g * 0.22) + "px");  // 6 … 28 px
    root.style.setProperty("--glass-glow", (0.12 + g * 0.0028).toFixed(3));   // яркость цветных пятен фона
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = c[0];
  }
  window.LOOK = {ACCENTS: ACCENTS, darkMq: darkMq, load: load, store: store, clean: clean, apply: apply, isDark: isDark};
  apply(load());
})();
