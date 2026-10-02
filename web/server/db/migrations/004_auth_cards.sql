-- 004: защита входа, тикеты на сброс пароля, виртуальная карта как товар с произвольной суммой

-- блокировка после 5 неверных паролей на 15 минут
alter table users add column if not exists failed_logins int not null default 0;
alter table users add column if not exists locked_until timestamptz;

-- тикет после подтверждённого кода: регистрация или сброс пароля
alter table signup_tickets add column if not exists purpose text not null default 'register'
  check (purpose in ('register','reset'));

-- тариф с произвольной суммой (виртуальная карта $50–$200)
alter table product_plans add column if not exists custom_min_cents int;
alter table product_plans add column if not exists custom_max_cents int;

insert into categories (id, name, sort) values ('cards', 'Виртуальные карты', -1)
  on conflict (id) do nothing;

insert into products (slug, category_id, name, description, icon, delivery, buyer_fields, sort)
values ('virtual-card', 'cards', 'Виртуальная карта',
        'Предоплаченная карта в долларах для оплаты зарубежных сервисов. Реквизиты — в кабинете и на почте.',
        null, 'card_topup', '[]'::jsonb, 0)
on conflict (slug) do nothing;

insert into product_plans (product_id, label, price_cents, price_text, sort, custom_min_cents, custom_max_cents)
select p.id, v.label, v.cents, v.txt, v.sort, v.cmin, v.cmax
from products p
cross join (values
  ('$50',   5000,  '$50',        0, null::int, null::int),
  ('$75',   7500,  '$75',        1, null, null),
  ('$100',  10000, '$100',       2, null, null),
  ('$150',  15000, '$150',       3, null, null),
  ('$200',  20000, '$200',       4, null, null),
  ('Своя сумма', null, '$50–$200', 5, 5000, 20000)
) as v(label, cents, txt, sort, cmin, cmax)
where p.slug = 'virtual-card'
  and not exists (select 1 from product_plans pp where pp.product_id = p.id and pp.label = v.label);

-- place_order: + необязательная сумма для тарифа с произвольной суммой
drop function if exists place_order(uuid, uuid, jsonb, text);
create or replace function place_order(p_user uuid, p_plan uuid, p_fields jsonb, p_idem text, p_amount_cents int default null)
returns orders
language plpgsql as $$
declare
  u users; pl product_plans; pr products; o orders;
  v_rate numeric; v_price int; v_charged int; v_kop bigint; v_id text; v_label text;
begin
  select * into o from orders where id = (select order_id from ledger_entries where idempotency_key = 'order:' || p_idem);
  if found then return o; end if;

  select * into u from users where id = p_user for update;
  if not found then raise exception 'user_not_found'; end if;
  if u.status <> 'active' then raise exception 'user_blocked'; end if;
  if u.kyc_status <> 'approved' then raise exception 'kyc_required'; end if;

  select * into pl from product_plans where id = p_plan and active;
  if not found then raise exception 'plan_not_found'; end if;
  select * into pr from products where id = pl.product_id and active;
  if not found then raise exception 'product_inactive'; end if;

  v_label := pl.label;
  if pl.custom_min_cents is not null then
    if p_amount_cents is null or p_amount_cents < pl.custom_min_cents or p_amount_cents > coalesce(pl.custom_max_cents, p_amount_cents) then
      raise exception 'amount_out_of_range' using detail = pl.custom_min_cents || '-' || coalesce(pl.custom_max_cents, 0);
    end if;
    v_price := p_amount_cents;
    v_label := '$' || trim(to_char(p_amount_cents / 100.0, 'FM999990D99'), '.');
  else
    if pl.free or pl.price_cents is null or pl.price_cents = 0 then raise exception 'plan_not_purchasable'; end if;
    v_price := pl.price_cents;
  end if;

  v_rate := (select value::text::numeric from settings where key = 'rate_rub_per_usd');
  v_charged := charged_cents(v_price);
  v_kop := round(v_charged * v_rate);            -- центы × ₽/$ = копейки

  if user_balance(p_user) < v_kop then
    raise exception 'insufficient_funds' using detail = (v_kop - user_balance(p_user))::text;
  end if;

  v_id := new_order_id();
  insert into orders (id, user_id, product_id, plan_id, product_name, plan_label, price_cents, charged_cents, rate, amount_kop, buyer_fields, status)
  values (v_id, p_user, pr.id, pl.id, pr.name, v_label, v_price, v_charged, v_rate, v_kop, coalesce(p_fields, '{}'), 'paid')
  returning * into o;
  perform ledger_post(p_user, -v_kop, 'purchase', v_id, null, null, pr.name || ' · ' || v_label, 'order:' || p_idem);
  insert into order_events (order_id, kind, status, text) values (v_id, 'created', 'paid', 'Заказ оплачен с баланса');
  return o;
end $$;
