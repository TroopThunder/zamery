#!/bin/sh
# Сборка сайта: шаблон + ключи Firebase -> ../index.html
set -e
cd "$(dirname "$0")"
python3 transform.py >/dev/null
python3 - <<'PY'
t=open('index_template.html',encoding='utf-8').read()
cfg=open('firebase_config.js',encoding='utf-8').read().strip()
import datetime
ver=(datetime.datetime.utcnow()+datetime.timedelta(hours=3)).strftime('%d.%m.%Y %H:%M')
# номер версии — внизу экрана «Настройки», под карточкой внешнего вида
anchor='<div class="empty" id="lookNote">Выбор сохраняется сам и остаётся при следующем открытии.</div>\n    </div>'
assert anchor in t, 'не найден экран настроек'
t=t.replace(anchor,anchor+'\n    <div class="empty" id="appVersion" style="text-align:center;font-size:12px;padding:4px 0">Версия от '+ver+'</div>',1)
open('../index.html','w',encoding='utf-8').write(t.replace('__FIREBASE_CONFIG__',cfg))
PY
node -e "const h=require('fs').readFileSync('../index.html','utf8');let js=h.split('<script type=\"module\">')[1].split('</script>')[0].replace(/^import .*$/mg,'');new Function(js);console.log('build ok')"
