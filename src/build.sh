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
t=t.replace('<button class="navitem" id="logoutBtn">Выйти</button>','<button class="navitem" id="logoutBtn">Выйти</button>\n  <div class="empty" style="padding:12px;font-size:12px">Версия от '+ver+'</div>',1)
open('../index.html','w',encoding='utf-8').write(t.replace('__FIREBASE_CONFIG__',cfg))
PY
node -e "const h=require('fs').readFileSync('../index.html','utf8');let js=h.split('<script type=\"module\">')[1].split('</script>')[0].replace(/^import .*$/mg,'');new Function(js);console.log('build ok')"
