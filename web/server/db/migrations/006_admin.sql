-- 006: админка — цена в $ или ₽, своя комиссия товара, автовыдача, аккаунты админов

alter table products add column if not exists commission_pct numeric(6,2);          -- null = формула сайта
alter table product_plans add column if not exists currency text not null default 'usd'
  check (currency in ('usd','rub'));
alter table product_plans add column if not exists price_kop bigint;                  -- цена тарифа в ₽ (копейки) для currency = 'rub'
alter table orders add column if not exists currency text not null default 'usd';
alter table admins add column if not exists must_change boolean not null default false;
alter table admins add column if not exists last_login_at timestamptz;
alter table admin_sessions add column if not exists last_seen_at timestamptz not null default now();
alter table refund_requests add column if not exists order_status_before text;

create index if not exists refund_queue on refund_requests (status, created_at);
create index if not exists users_created on users (created_at desc);
create index if not exists ledger_kind_time on ledger_entries (kind, created_at);

-- place_order v3: валюта тарифа и своя комиссия товара
drop function if exists place_order(uuid, uuid, jsonb, text, int);
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

  v_rate := (select value::text::numeric from settings where key = 'rate_rub_per_usd');
  v_label := pl.label;

  if pl.currency = 'rub' then
    if pl.price_kop is null or pl.price_kop <= 0 then raise exception 'plan_not_purchasable'; end if;
    v_kop := round(pl.price_kop * (1 + coalesce(pr.commission_pct, 0) / 100.0));
    v_price := round(pl.price_kop / v_rate);                 -- справочно, в центах
    v_charged := round(v_kop / v_rate);
  else
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
    v_charged := case when pr.commission_pct is null then charged_cents(v_price)
                      else round(v_price * (1 + pr.commission_pct / 100.0)) end;
    v_kop := round(v_charged * v_rate);                        -- центы × ₽/$ = копейки
  end if;

  if user_balance(p_user) < v_kop then
    raise exception 'insufficient_funds' using detail = (v_kop - user_balance(p_user))::text;
  end if;

  v_id := new_order_id();
  insert into orders (id, user_id, product_id, plan_id, product_name, plan_label, price_cents, charged_cents, rate, amount_kop, buyer_fields, status, currency)
  values (v_id, p_user, pr.id, pl.id, pr.name, v_label, v_price, v_charged, v_rate, v_kop, coalesce(p_fields, '{}'), 'paid', pl.currency)
  returning * into o;
  perform ledger_post(p_user, -v_kop, 'purchase', v_id, null, null, pr.name || ' · ' || v_label, 'order:' || p_idem);
  insert into order_events (order_id, kind, status, text) values (v_id, 'created', 'paid', 'Заказ оплачен с баланса');
  return o;
end $$;
