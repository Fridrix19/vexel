"""Генерирует web/server/db/migrations/002_catalog.sql из тех же данных, что и прототип:
каталог (search.js), тарифы (payment-flow.v2.js → static-models.json → дефолт раздела)."""
import json, os, sys
HERE=os.path.dirname(os.path.abspath(__file__)); sys.argv=[sys.argv[0]]
src=open(os.path.join(HERE,'build.py'),encoding='utf-8').read().split("if __name__=='__main__':")[0]
g={'__file__':os.path.join(HERE,'build.py')}; exec(compile(src,'build.py','exec'),g)
services,CATMAP,get_model=g['services'],g['CATMAP'],g['get_model']
def q(v):
    if v is None: return 'null'
    if isinstance(v,bool): return 'true' if v else 'false'
    if isinstance(v,(int,float)): return str(int(v))
    return "'"+str(v).replace("'","''")+"'"
out=['-- сгенерировано build/seed_catalog.py — каталог и тарифы 1:1 с исходным сайтом','begin;']
for i,(name,(cid,_)) in enumerate(CATMAP.items()):
    out.append(f"insert into categories (id,name,sort) values ({q(cid)},{q(name)},{i}) on conflict (id) do update set name=excluded.name, sort=excluded.sort;")
out.append("insert into settings (key,value) values ('rate_rub_per_usd','80.2254'), ('commission','{\"small_limit_usd\":45,\"small_add_usd\":5,\"small_mult\":1.2,\"big_mult\":1.3,\"empty_usd\":20}'), ('card_topup','{\"min_usd\":50,\"max_usd\":200,\"denoms\":[50,75,100,150,200]}'), ('offer_version','\"2.3\"') on conflict (key) do nothing;")
n_plans=0
for sort,s in enumerate(services):
    m=get_model(s['slug'],s['c'],s['n'])
    fields='[{"key":"account_email","label":"E-mail аккаунта в сервисе","type":"email","required":true}]' if s['c']!='international' else '[{"key":"link","label":"Ссылка на товар или корзину","type":"text","required":true}]'
    out.append(f"insert into products (slug,category_id,name,icon,delivery,buyer_fields,sort) values ({q(s['slug'])},{q(s['c'])},{q(s['n'])},{q('/assets/services/'+s['slug']+'.svg')},'manual',{q(fields)}::jsonb,{sort}) on conflict (slug) do nothing;")
    for j,p in enumerate(m['plans']):
        cents=None if p.get('usd') is None else round(p['usd']*100)
        out.append(f"insert into product_plans (product_id,label,price_cents,price_text,description,free,sort) select id,{q(p['label'])},{q(cents)},{q(p.get('priceText'))},{q(p.get('description') or None)},{q(bool(p.get('free')) or cents==0)},{j} from products where slug={q(s['slug'])} and not exists (select 1 from product_plans pp join products pr on pr.id=pp.product_id where pr.slug={q(s['slug'])} and pp.label={q(p['label'])});")
        n_plans+=1
out.append("commit;")
path=os.path.join(os.path.dirname(HERE),'web','server','db','migrations','002_catalog.sql')
open(path,'w',encoding='utf-8').write('\n'.join(out)+'\n'); print('products',len(services),'plans',n_plans,'->',path)
