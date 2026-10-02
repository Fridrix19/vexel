import base64, json, re, subprocess, os, sys
# пути: build/ лежит в корне репозитория; исходный сайт — source-site/, сборка — _proto/
HERE=os.path.dirname(os.path.abspath(__file__)); REPO=os.path.dirname(HERE)
ROOT=os.environ.get('MC_SOURCE', REPO+'/source-site'); A=ROOT+'/assets'; B=os.environ.get('MC_SRC', REPO+'/src')
OUT=os.environ.get('MC_OUT', REPO+'/_proto'); TMP=os.environ.get('TMPDIR','/tmp')
DOCTYPE='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
try: NODE_PATH=subprocess.run(['npm','root','-g'],capture_output=True,text=True).stdout.strip()
except Exception: NODE_PATH=''
def emit(rel,out,label=None):
    path=os.path.join(OUT,rel); os.makedirs(os.path.dirname(path),exist_ok=True)
    open(path,'w',encoding='utf-8').write(DOCTYPE+out+'\n</html>'); print(label or rel, len(out.encode())); return path
def svg_uri(p):
    s=re.sub(r'\s+',' ',re.sub(r'<\?xml[^>]*>','',open(p,encoding='utf-8').read()).strip())
    return 'data:image/svg+xml;base64,'+base64.b64encode(s.encode()).decode()
def png_uri(p,size=96):
    out=os.path.join(TMP,'_mc_icon.png')
    subprocess.run(['node','-e',f"const sharp=require('sharp');sharp('{p}',{{density:300}}).resize({size},{size},{{fit:'contain',background:{{r:0,g:0,b:0,alpha:0}}}}).png().toFile('{out}').then(()=>0);"],check=True,capture_output=True,env=dict(os.environ,NODE_PATH=NODE_PATH))
    return 'data:image/png;base64,'+base64.b64encode(open(out,'rb').read()).decode()
def icon(slug):
    p=f'{A}/services/{slug}.svg'
    return png_uri(p) if os.path.getsize(p)>20000 else svg_uri(p)

# --- каталог ---
_src=open(ROOT+'/search.js',encoding='utf-8').read()
DATA=json.loads(re.search(r'MARS_SEARCH_DATA\s*=\s*(\[.*?\]);',_src,re.S).group(1))
CATMAP={'Нейросети':('ai','ai'),'Дизайн':('design','design'),'Развлечения':('entertainment','entertainment'),'Игры':('games','games'),'Зарубежные покупки':('international','global'),'Для работы':('work','work')}
LUM=json.load(open(f'{HERE}/icon-lum.json'))
_icon_cache={}
def cached_icon(slug):
    if slug not in _icon_cache: _icon_cache[slug]=icon(slug)
    return _icon_cache[slug]
services=[]
for x in DATA:
    if x['n']=='Виртуальная карта': continue
    slug=x['l'].split('/')[-1][:-4]
    services.append({'n':x['n'],'l':cached_icon(slug),'h':x['h'],'c':CATMAP[x['c']][0],'d':1 if LUM.get(slug,0.5)>0.62 else 0,'slug':slug})
categories=[{'id':cid,'name':name,'icon':svg_uri(f'{A}/category-icons/{ic}.svg'),'count':sum(1 for s in services if s['c']==cid)} for name,(cid,ic) in CATMAP.items()]
CATALOG={'categories':categories,'services':[{k:v for k,v in s.items() if k!='slug'} for s in services],'allIcon':svg_uri(f'{A}/category-icons/all.svg'),'catName':{c['id']:c['name'] for c in categories}}
CAT_JSON=json.dumps(CATALOG,ensure_ascii=False)

# --- планы сервисов из payment-flow.v2.js ---
_pf=open(ROOT+'/payment-flow.v2.js',encoding='utf-8').read()
def service_plans(slug):
    j=_pf.find(f'"{slug}":{{"service"')
    if j<0: return None
    k=j+len(f'"{slug}":'); depth=0
    for idx in range(k,len(_pf)):
        if _pf[idx]=='{': depth+=1
        elif _pf[idx]=='}':
            depth-=1
            if depth==0: break
    return json.loads(_pf[k:idx+1])

def read(p): return open(f'{B}/{p}',encoding='utf-8').read()
COMMON=read('base/pricefmt.js')+'\n'+read('base/common.js').replace('/*__CATALOG__*/',CAT_JSON)
LOGO=svg_uri(HERE+'/brand/logo.svg')
ART=svg_uri(HERE+'/brand/hero-art.svg')

def assemble(title, body, page_js, nav='vc', showcase=None, after=None, extra_css='', libs=None, pre_js='', m_cy='0.355', m_size='1.35', galaxy=None, m_cx='0.5', base=''):
    head=read('base/head.html').replace('{{TITLE}}',title)
    css=read('base/base.css')+'\n'+read('base/lib.css')+('\n'+extra_css if extra_css else '')
    top=read('base/shell-top.html').replace('{{CUR_CATALOG}}','aria-current="page"' if nav=='catalog' else '').replace('{{CUR_VC}}','aria-current="page"' if nav=='vc' else '').replace('{{CUR_HOW}}','aria-current="page"' if nav=='how' else '').replace('{{CUR_SUPPORT}}','aria-current="page"' if nav=='support' else '').replace('{{CUR_FAQ}}','aria-current="page"' if nav=='faq' else '').replace('{{M_CY}}',m_cy).replace('{{M_CX}}',m_cx).replace('{{M_SIZE}}',m_size)
    g=dict({'cx':'0.56','cy':'0.74','dx':'400','dy':'-100','size':'1'}, **(galaxy or {}))
    for k,v in g.items(): top=top.replace('{{D_'+k.upper()+'}}',v)
    sc=read('base/showcase.html')
    for k,v in (showcase or {}).items(): sc=sc.replace('{{'+k+'}}',v)
    af=read('base/after.html')
    for k,v in (after or {}).items(): af=af.replace('{{'+k+'}}',v)
    body=body.replace('{{SHOWCASE}}',sc).replace('{{AFTER}}',af)
    if 'class="config"' in body: body+='\n'+read('base/paybar.html')
    libtags=''.join(f'<script src="{u}"></script>\n' for u in (libs or []))
    foot=read('base/footer.html').replace('{{CUR_CATALOG}}','aria-current="page"' if nav=='catalog' else '').replace('{{CUR_VC}}','aria-current="page"' if nav=='vc' else '').replace('{{CUR_HOW}}','aria-current="page"' if nav=='how' else '').replace('{{CUR_SUPPORT}}','aria-current="page"' if nav=='support' else '')
    out=head+'<style>\n'+css+'</style>\n\n'+top+'\n'+body+'\n'+foot+libtags+'<script>window.MC_BASE='+json.dumps(base)+';</script>\n<script>\n'+COMMON+'\n</script>\n'+(('<script>\n'+pre_js+'\n</script>\n') if pre_js else '')+'<script>\n'+page_js+'\n</script>\n'
    out=out.replace('{{BASE}}',base)
    return out.replace('{{LOGO}}',LOGO).replace('{{ART}}',ART)

def build_vc():
    out=assemble('Виртуальная карта Vexel', read('pages/virtual-card.html'), read('pages/virtual-card.js'), nav='vc',
        showcase={'SHOWCASE_TITLE':'Где работает карта','SHOWCASE_TEXT':'139 сервисов. У каждого — инструкция по привязке.'},
        after={'TL3_TITLE':'Привязка к сервису','TL3_TEXT':'Шаги для вашего сервиса, адрес и индекс для формы оплаты.'})
    emit('virtual-card.html',out)

SVC_META={
  'cursor': {'short':'Cursor','lead':'AI-редактор кода: агенты, frontier-модели, MCP и cloud agents. Оплатите подписку виртуальной картой — реквизиты и инструкция по привязке придут на почту.',
             'groups':[('Cursor',['Hobby','Pro','Pro+','Ultra','Teams','Enterprise']),('Bugbot',['Bugbot Pro','Bugbot Teams','Bugbot Enterprise'])]},
}
SECTION_ITEMS={}
def section_items(cid):
    if cid not in SECTION_ITEMS:
        f=f'{B}/pages/section-{cid}.json'
        SECTION_ITEMS[cid]=json.load(open(f,encoding='utf-8')) if os.path.exists(f) else {'subcats':[],'items':{}}
    return SECTION_ITEMS[cid]

# ——— модель цены сервиса: 1:1 с payment-flow.v2.js → getModel() ———
STATIC_MODELS=json.load(open(f'{B}/pages/static-models.json',encoding='utf-8'))
SECTION_DEFAULTS={'ai':20,'work':15,'design':15,'entertainment':12,'games':20,'international':50}
WB_ALIAS={'magic':'magicstudio','nightmare':'nightmare-ai','opusclip':'opus','weshop':'weshop-ai'}  # ключи workbook, не совпадающие со slug страницы
def _fmt_usd(u): return '$%d'%u if abs(u-round(u))<1e-9 else '$%.2f'%u
def get_model(slug,cid,name):
    wb=service_plans(slug) or (service_plans(WB_ALIAS[slug]) if slug in WB_ALIAS else None)
    if wb and wb.get('plans'):
        plans=[]
        for i,pl in enumerate(wb['plans']):
            u=pl.get('usd'); num=isinstance(u,(int,float))
            plans.append({'label':pl.get('label') or f'План {i+1}','usd':u if num else None,
                          'priceText':pl.get('priceText') or ('Free' if u==0 else (_fmt_usd(u) if num else 'Уточняется')),
                          'description':pl.get('description',''),'features':pl.get('features',''),'billingNote':pl.get('billingNote','')})
        ref=all(p['usd'] is None for p in plans)
        return {'type':'reference' if ref else 'plans','source':'workbook','plans':plans}
    st=STATIC_MODELS.get(slug)
    if st:
        if st['type']=='free':
            return {'type':'free','source':'static','plans':[{'label':st.get('label','Бесплатно'),'usd':0,'free':True,'priceText':'Free','description':f'{name} доступен бесплатно — платный сценарий не требуется.','features':''}]}
        plans=[]
        for pl in st['plans']:
            lab=pl['label']; pt=pl['priceText']
            if any(w in lab for w in ('Номинал','Покупка','credits','Кредиты')): d=f'{lab} — сумма зачисляется на виртуальную карту, оплата на стороне {name}.'
            else: d=f'Тариф {name} «{lab}» — {pt}. Цена с сайта {name}; итог в рублях считается автоматически.'
            plans.append({'label':lab,'usd':pl['usd'],'priceText':pt,'description':d,'features':''})
        return {'type':'plans','source':'static','plans':plans}
    if cid=='international':
        return {'type':'plans','source':'default','plans':[{'label':'Покупка 50$','usd':50,'priceText':'$50','description':f'Базовая сумма для покупки в {name} — $50. Нужна другая — напишите в поддержку, пересчитаем.','features':''}]}
    u=SECTION_DEFAULTS.get(cid,20)
    return {'type':'plans','source':'default','plans':[{'label':name,'usd':u,'priceText':_fmt_usd(u),'description':f'Базовая сумма для оплаты {name} — {_fmt_usd(u)} (сценарий раздела). Точный тариф уточняется; при необходимости пересчитаем по запросу.','features':''}]}
def model_min(model):
    paid=[p['usd'] for p in model['plans'] if isinstance(p.get('usd'),(int,float)) and p['usd']>0]
    monthly=any(re.search(r'month|/mo\b|мес',str(p.get('priceText',''))) for p in model['plans'])
    return ({'v':'%g'%min(paid),'m':monthly} if paid else None)

def build_service(slug, base='../../'):
    entry=next(x for x in DATA if x['l'].endswith('/'+slug+'.svg'))
    meta=dict(SVC_META.get(slug,{}))
    name=entry['n']; short=meta.get('short',name); cid,ic=CATMAP[entry['c']]
    cat=next(c for c in categories if c['id']==cid)
    desc=section_items(cid)['items'].get(name,['',''])[1]
    model=get_model(slug,cid,name); plans={'plans':model['plans']}
    amount_mode=model['source']=='static' and all(any(w in p['label'] for w in ('Номинал','Покупка','credits','Кредиты')) for p in model['plans'])
    if not meta.get('lead'):
        meta['lead']=(desc+' ' if desc else '')+('Пополните баланс' if amount_mode else 'Оплатите подписку')+f' виртуальной картой через СБП — реквизиты и инструкция по привязке к {short} придут на почту.'
    bylabel={p['label']:p for p in plans['plans']}
    if meta.get('groups'):
        groups=[{'name':g,'plans':[bylabel[l] for l in labels if l in bylabel]} for g,labels in meta['groups']]
    else:
        groups=[{'name':name,'plans':plans['plans']}]
    paid=[p['usd'] for p in plans['plans'] if isinstance(p.get('usd'),(int,float)) and p['usd']>0]
    svc={'name':name,'short':short,'cat':cid,'href':entry['h'],'groups':groups}
    body=read('pages/service.html')
    for k,v in {'SVC_NAME':name,'SVC_SHORT':short,'SVC_LEAD':meta.get('lead',''),'CAT_ICON':cat['icon'],'CAT_NAME':cat['name'],'CAT_ID':cid,
                'ORDER_TITLE':(f'Выберите сумму для {short}' if amount_mode else (f'Оплата {short}' if model['source']=='default' else f'Выберите план {short}')),
                'STEP1_TITLE':('Сумма' if amount_mode else ('Сценарий оплаты' if model['source']=='default' else 'План подписки')),
                'ORDER_LEAD':(f'Выберите номинал и укажите почту — итог в рублях считается сразу. Карта придёт на почту с инструкцией по оплате в {short}.' if amount_mode else f'Выберите план и укажите почту — итог в рублях считается сразу. Карта придёт на почту с инструкцией по привязке к {short}.'),
                'ROW_PLAN_LABEL':('Сумма' if amount_mode else 'Стоимость подписки'),
                'STEP1_HINT':(f'Сумма в долларах, которая будет на карте для оплаты в {short}.' if amount_mode else (f'Базовая сумма сценария раздела «{cat["name"]}». Нужен другой тариф — напишите, пересчитаем.' if model['source']=='default' else f'Цены — с сайта {short}. Если план помечен «по запросу», посчитаем вручную.')),
                'SVC_ICON':cached_icon(slug),'LOGO_CLASS':'on-dark' if LUM.get(slug,0.5)>0.62 else '',
                'FACT1_B':('от $%g' % min(paid)) if paid else ('бесплатно' if model['type']=='free' else 'по запросу'),
                'FACT1_S':('оплата не требуется' if model['type']=='free' else 'цена уточняется' if model['type']=='reference' else 'минимальная сумма' if amount_mode else ('в месяц' if (model_min(model) or {}).get('m') else 'базовая сумма')),
                'FACT3_B':(str(len(plans['plans']))+' '+plural(len(plans['plans']),['вариант','варианта','вариантов']) if len(plans['plans'])>1 else '1 сценарий'),
                'FACT3_S':('суммы на выбор' if amount_mode else ('тарифы с сайта сервиса' if model['source'] in ('workbook','static') else 'уточним другой по запросу'))}.items():
        body=body.replace('{{'+k+'}}',v)
    js=read('pages/service.js').replace('/*__SERVICE__*/',json.dumps(svc,ensure_ascii=False))
    others=cat['count']-1
    out=assemble(f'{name} — Vexel', body, js, nav='catalog', m_cy='0.21', m_size='0.9', galaxy={'cx':'0.66','cy':'0.42','dx':'0','dy':'0','size':'2.4'}, base=base,
        showcase={'SHOWCASE_TITLE':f'Другие сервисы в разделе «{cat["name"]}»','SHOWCASE_TEXT':f'Ещё {others} в этой категории и {len(services)-cat["count"]} в остальном каталоге — все оплачиваются той же картой.'},
        after={'TL3_TITLE':f'Привязка к {short}','TL3_TEXT':f'Где ввести карту в {short}, какой адрес и индекс указать.'})
    return emit(f'service/{slug}/index.html',out)

def build_service_template():
    # общая страница для товаров, добавленных в админке: тексты и тарифы подставляет service.js из API
    cat=categories[0]
    body=read('pages/service.html')
    for k,v in {'SVC_NAME':'Сервис','SVC_SHORT':'сервису','SVC_LEAD':'Загружаем описание…','CAT_ICON':cat['icon'],'CAT_NAME':cat['name'],'CAT_ID':cat['id'],
                'ORDER_TITLE':'Выберите тариф Сервис','STEP1_TITLE':'Тариф','ORDER_LEAD':'Выберите тариф и укажите почту — итог в рублях считается сразу.',
                'ROW_PLAN_LABEL':'Стоимость','STEP1_HINT':'Цены и тарифы — актуальные, из каталога Vexel.','SVC_ICON':'','LOGO_CLASS':'',
                'FACT1_B':'—','FACT1_S':'минимальная цена','FACT3_B':'—','FACT3_S':'тарифы на выбор'}.items():
        body=body.replace('{{'+k+'}}',v)
    js=read('pages/service.js').replace('/*__SERVICE__*/','null')
    out=assemble('Сервис — Vexel', body, js, nav='catalog', m_cy='0.21', m_size='0.9', galaxy={'cx':'0.66','cy':'0.42','dx':'0','dy':'0','size':'2.4'}, base='../../',
        showcase={'SHOWCASE_TITLE':'Другие сервисы','SHOWCASE_TEXT':'Все оплачиваются той же картой.'},
        after={'TL3_TITLE':'Привязка к сервису','TL3_TEXT':'Где ввести карту, какой адрес и индекс указать.'})
    return emit('service/_new/index.html',out)



HOME_CATS={
  'ai':{'text':'ChatGPT, Claude, Midjourney, Cursor и другие подписки.','tags':['ChatGPT','Claude','Cursor']},
  'design':{'text':'Figma, Adobe, Canva и стоки.','tags':['Figma','Adobe','Canva']},
  'entertainment':{'text':'Стриминг, музыка и кино.','tags':['Netflix','Spotify','YouTube']},
  'games':{'text':'Пополнение аккаунтов и игровые платформы.','tags':['Steam','PlayStation','Xbox']},
  'international':{'text':'Товары в зарубежных магазинах.','tags':['Amazon','eBay','Etsy']},
  'work':{'text':'Инструменты для работы и команд.','tags':['Notion','Google','Microsoft']},
}
HOME_POPULAR=[
  {'n':'ChatGPT Plus','text':'Текст, анализ, автоматизация.','price':'от <b>$20</b> / мес'},
  {'n':'Cursor AI','text':'AI-редактор кода с агентами.','price':'от <b>$20</b> / мес'},
  {'n':'Claude','text':'Тексты, документы, аналитика.','price':'от <b>$20</b> / мес'},
  {'n':'Midjourney','text':'Генерация изображений.','price':'от <b>$10</b> / мес'},
  {'n':'Netflix','text':'Кино и сериалы без ограничений.','price':'от <b>$7.99</b> / мес'},
  {'n':'Spotify','text':'Музыка и подкасты.','price':'от <b>$11.99</b> / мес'},
  {'n':'Steam','text':'Игры и пополнение кошелька.','price':'любая сумма от <b>$5</b>'},
  {'n':'Canva','text':'Презентации и визуалы.','price':'от <b>$15</b> / мес'},
]
SECTION_META={
  'games':{'lead':'Steam, PlayStation, Xbox, Nintendo и ещё 9 платформ — пополнение кошельков и подписки виртуальной картой через СБП.','popular':[]},
  'entertainment':{'lead':'Netflix, Spotify, Discord Nitro и ещё 12 сервисов — кино, музыка и общение без ограничений по региону.','popular':[]},
  'design':{'lead':'Figma, Adobe, Canva, Midjourney и стоки — инструменты и ассеты для дизайнеров одной картой.','popular':[]},
  'work':{'lead':'Notion, Microsoft 365, JetBrains, Zoom и ещё 23 инструмента для работы и команд.','popular':[]},
  'international':{'lead':'Amazon, eBay, Etsy — покупки в зарубежных магазинах виртуальной картой в долларах.','popular':[]},
  'ai':{'lead':'ChatGPT, Claude, Cursor, Midjourney и ещё 60 подписок — оплата виртуальной картой через СБП.',
        'popular':[
          {'n':'ChatGPT Plus','text':'Текст, анализ, автоматизация.','price':'от <b>$20</b> / мес'},
          {'n':'Cursor AI','text':'AI-редактор кода с агентами.','price':'от <b>$20</b> / мес'},
          {'n':'Claude','text':'Тексты, документы, аналитика.','price':'от <b>$20</b> / мес'},
          {'n':'Gemini','text':'Модели Google, Workspace, NotebookLM.','price':'от <b>$20</b> / мес'},
          {'n':'ElevenLabs','text':'Синтез и клонирование голоса.','price':'от <b>$5</b> / мес'},
          {'n':'Perplexity','text':'Поиск с источниками и агентами.','price':'от <b>$20</b> / мес'},
        ]},
}
def all_prices():
    out={}
    for s in services:
        m=model_min(get_model(s['slug'],s['c'],s['n']))
        if m: out[s['n']]=m
    return out
def plural(n,forms):
    return forms[0] if n%10==1 and n%100!=11 else forms[1] if 2<=n%10<=4 and not 12<=n%100<=14 else forms[2]
def build_section(cid):
    cat=next(c for c in categories if c['id']==cid); meta=SECTION_META.get(cid,{'lead':'','popular':[]})
    prices=all_prices(); mine=[float(v['v']) for s in services if s['c']==cid for v in [prices.get(s['n'])] if v]
    body=read('pages/section.html')
    for k,v in {'CAT_NAME':cat['name'],'CAT_ICON':cat['icon'],'CAT_LEAD':meta['lead'],'CAT_COUNT':str(cat['count']),
                'CAT_COUNT_WORD':plural(cat['count'],['сервис','сервиса','сервисов']),'CAT_FROM':('от $%g' % min(mine)) if mine else '—',
                'CAT_LOGOS':''.join('<a href="{{BASE}}%s" title="%s"%s><img alt="%s" src="%s"></a>' % (s['h'],s['n'],' class="on-dark"' if s['d'] else '',s['n'],s['l']) for s in [x for x in services if x['c']==cid][:30])}.items():
        body=body.replace('{{'+k+'}}',v)
    sub=json.load(open(f'{B}/pages/section-{cid}.json',encoding='utf-8')) if os.path.exists(f'{B}/pages/section-{cid}.json') else {'subcats':[],'items':{}}
    js=read('pages/section.js').replace('/*__SECTION__*/',json.dumps({'cat':cid,'prices':prices,'subcats':sub['subcats'],'items':sub['items']},ensure_ascii=False))
    out=assemble(f'{cat["name"]} — Vexel', body, js, nav='catalog', m_cy='0.21', m_size='0.9', galaxy={'cx':'0.66','cy':'0.42','dx':'0','dy':'0','size':'2.4'}, base='../../',
        after={'TL3_TITLE':'Привязка к сервису','TL3_TEXT':'Шаги для вашего сервиса, адрес и индекс для формы оплаты.'}, extra_css=read('pages/index.css')+'\n'+read('pages/section.css'))
    emit(f'section/{cid}/index.html',out)

def build_index():
    body=read('pages/index.html').replace('{{SVC_COUNT}}',str(len(services)-4)).replace('{{SVC_TOTAL}}',str(len(services)))
    prices=all_prices(); pop=[]
    for it in HOME_POPULAR:
        m=prices.get(it['n']); pop.append(dict(it, price=(('от <b>$'+m['v']+'</b>'+(' / мес' if m['m'] else '')) if m else 'по запросу')))
    js=read('pages/index.js').replace('/*__HOME__*/',json.dumps({'cats':cat_meta(),'popular':pop},ensure_ascii=False))
    out=assemble('Vexel — оплата зарубежных сервисов через СБП', body, js, nav='home', extra_css=read('pages/index.css'))
    emit('index.html',out)

def build_how():
    body=read('pages/how.html')
    out=assemble('Как это работает — Vexel', body, read('pages/how.js'), nav='how', m_cy='0.21', m_size='0.9', galaxy={'cx':'0.66','cy':'0.42','dx':'0','dy':'0','size':'2.4'},
        after={'TL3_TITLE':'Привязка к сервису','TL3_TEXT':'Шаги для вашего сервиса, адрес и индекс для формы оплаты.'}, extra_css=read('pages/index.css')+'\n'+read('pages/how.css'))
    emit('how-it-works.html',out)

def build_support():
    out=assemble('Поддержка — Vexel', read('pages/support.html'), read('pages/support.js'), nav='support', m_cy='0.21', m_size='0.9', galaxy={'cx':'0.66','cy':'0.42','dx':'0','dy':'0','size':'2.4'},
        extra_css=read('pages/index.css')+'\n'+read('pages/support.css'))
    emit('support.html',out)

def build_faq():
    import re as _re
    n=len(_re.findall(r"\{ id:'", read('pages/faq.js')))
    out=assemble('Частые вопросы — Vexel', read('pages/faq.html').replace('{{FAQ_COUNT}}',str(n)), read('pages/faq.js'), nav='faq', m_cy='0.21', m_size='0.9', galaxy={'cx':'0.66','cy':'0.42','dx':'0','dy':'0','size':'2.4'},
        extra_css=read('pages/index.css')+'\n'+read('pages/faq.css'))
    emit('faq.html',out)

LEGAL={'LEGAL_NAME':'ИП / ООО — уточнить','LEGAL_INN':'—','LEGAL_OGRN':'—'}
def build_contacts():
    body=read('pages/contacts.html')
    for k,v in LEGAL.items(): body=body.replace('{{'+k+'}}',v)
    out=assemble('Контакты — Vexel', body, read('pages/contacts.js'), nav='support', m_cy='0.21', m_size='0.9', galaxy={'cx':'0.66','cy':'0.42','dx':'0','dy':'0','size':'2.4'},
        extra_css=read('pages/index.css')+'\n'+read('pages/contacts.css'))
    emit('contacts.html',out)

CATALOG_META={
  'ai':{'text':'ChatGPT, Claude, Midjourney, Cursor и другие подписки.','top':['ChatGPT Plus','Claude','Cursor AI','Gemini','Perplexity']},
  'design':{'text':'Figma, Adobe, Canva, генерация и стоки.','top':['Figma','Adobe','Canva','Midjourney','Envato']},
  'entertainment':{'text':'Кино, музыка, стриминг и общение.','top':['Netflix','Spotify','Discord Nitro','Twitch','App Store']},
  'games':{'text':'Пополнение кошельков и подписки платформ.','top':['Steam','PlayStation','Xbox','Nintendo eShop','Epic Games']},
  'international':{'text':'Товары в зарубежных магазинах.','top':['Amazon','eBay','Etsy']},
  'work':{'text':'Офис, разработка и инструменты для команд.','top':['Notion','Microsoft 365','JetBrains','Zoom','Replit']},
}
def cat_meta():
    prices=all_prices(); meta={}
    for cid,m in CATALOG_META.items():
        mine=[float(v['v']) for s in services if s['c']==cid for v in [prices.get(s['n'])] if v]
        meta[cid]=dict(m, **{'from':('%g' % min(mine)) if mine else None,'monthly':any(v['m'] for s in services if s['c']==cid for v in [prices.get(s['n'])] if v and float(v['v'])==min(mine))})
    return meta

def build_catalog():
    meta=cat_meta()
    body=read('pages/catalog.html').replace('{{SVC_TOTAL}}',str(len(services)))
    js=read('pages/catalog.js').replace('/*__CATALOG_META__*/',json.dumps({'cats':meta},ensure_ascii=False))
    out=assemble('Каталог — Vexel', body, js, nav='catalog', m_cy='0.21', m_size='0.9', galaxy={'cx':'0.66','cy':'0.42','dx':'0','dy':'0','size':'2.4'},
        extra_css=read('pages/index.css')+'\n'+read('pages/catalog.css'))
    emit('catalog.html',out)

def build_tariffs():
    out=assemble('Тарифы и комиссии — Vexel', read('pages/tariffs.html'), read('pages/tariffs.js'), nav='none', m_cy='0.21', m_size='0.9', galaxy={'cx':'0.66','cy':'0.42','dx':'0','dy':'0','size':'2.4'},
        extra_css=read('pages/index.css')+'\n'+read('pages/faq.css')+'\n.tf-note{margin-block-start:14px; color:var(--text-4); font-size:14px}')
    emit('tariffs.html',out)

def build_login():
    out=assemble('Вход и регистрация — Vexel', read('pages/login.html'), read('pages/login.js'), nav='none', m_cy='0.17', m_size='0.8', galaxy={'cx':'0.33','cy':'0.9','dx':'0','dy':'0','size':'2'},
        extra_css=read('pages/login.css'))
    emit('login.html',out)

def build_dashboard():
    out=assemble('Личный кабинет — Vexel', read('pages/dashboard.html'), read('pages/dashboard.js'), nav='none', m_cy='0.12', m_size='0.7', galaxy={'cx':'0.1','cy':'0.82','dx':'0','dy':'0','size':'1.3'},
        extra_css=read('pages/login.css')+'\n'+read('pages/dashboard.css'))
    emit('dashboard.html',out)


if __name__=='__main__':
    # python3 build.py            — все страницы кроме сервисов
    # python3 build.py all        — всё, включая 139 страниц сервисов
    # python3 build.py cursor …   — только указанные сервисы (без остальных страниц)
    if sys.argv[1:] and sys.argv[1:]!=['all']:
        for slug in sys.argv[1:]: build_service(slug)
        sys.exit()
    build_vc()
    build_index()
    for cid in ['ai','games','entertainment','design','work','international']: build_section(cid)
    build_catalog()
    build_service_template()
    build_how()
    build_support()
    build_faq()
    build_contacts()
    build_tariffs()
    build_login()
    build_dashboard()
    if sys.argv[1:]==['all']:
        for s_ in services: build_service(s_['slug'])
