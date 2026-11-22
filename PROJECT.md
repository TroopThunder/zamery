# Warp Pro — сайт для замеров, нарезки и оклейки окон

Сайт: https://troopthunder.github.io/zamery/ (GitHub Pages, ветка main, корень).
Свой домен warppro-master.ru куплен в Timeweb; DNS настроен (4 записи A на 185.199.108–111.153, CNAME www → troopthunder.github.io).
Домен временно отключён (файла CNAME нет) — подключить заново: создать файл CNAME с текстом `warppro-master.ru`, затем в Settings → Pages включить Enforce HTTPS.

База и вход — Firebase (проект window-5b98a): Auth (вход по имени → служебная почта uXXXX@zamery.app) и Firestore.
Правила доступа — firestore.rules; после их изменения владелец вставляет файл в Firebase → Firestore → Rules → Publish.

## Как устроен код
`index.html` в корне — собранный файл, руками не править.
Исходники в `src/`:
- `base.html` — разметка, стили и основная логика (замер, окна, нарезка, оклейка, сводка);
- `transform.py` — собирает base.html + new_ui.js + extra.js + startup.js в один файл, подменяя части под Firebase;
- `new_ui.js` — смены, оплата, «Управление», копия базы;
- `extra.js` — переименование, поиск, «Сейчас на смене», Excel, настройки темы, меню по правам;
- `startup.js` — вход/регистрация и запуск;
- `firebase_config.js` — ключи проекта Firebase (не секрет).

Сборка: `cd src && ./build.sh` → обновляет `../index.html`. Затем commit и push в main.
Также в корне: manifest.webmanifest, sw.js, иконки (установка как приложение).
