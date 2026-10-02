-- 009: лимит расходов без верификации, бонусный счёт, отзывы, избранное, чат с поддержкой

-- ───────────── лимит расходов ─────────────
-- без верификации — 15 000 ₽ за период; после верификации — без лимита (null). Период — месяц с первой траты,
-- после его окончания следующая трата открывает новый.
insert into settings (key, value) values ('spend_limits', '{"unverified_kop": 1500000, "verified_kop": null}') on conflict (key) do nothing;
alter table users add column if not exists limit_since timestamptz;

create or replace function spend_state(p_user uuid, out limit_kop bigint, out spent_kop bigint, out period_start timestamptz, out resets_at timestamptz)
language plpgsql stable as $$
declare u users; s jsonb;
begin
  select * into u from users where id = p_user;
  s := coalesce((select value from settings where key = 'spend_limits'), '{}'::jsonb);
  limit_kop := case when u.kyc_status = 'approved' then (s->>'verified_kop')::bigint else (s->>'unverified_kop')::bigint end;
  spent_kop := 0;
  if u.limit_since is not null and now() < u.limit_since + interval '1 month' then
    period_start := u.limit_since;
    resets_at := u.limit_since + interval '1 month';
    spent_kop := coalesce((select sum(amount_kop) from orders where user_id = p_user and created_at >= u.limit_since and status not in ('refunded', 'canceled')), 0);
  end if;
end $$;

-- ───────────── бонусный счёт ─────────────
-- бонус (500 ₽ за верификацию) — скидка при следующей оплате; списывается целиком, остаток сгорает
insert into settings (key, value) values ('bonus', '{"kyc_kop": 50000}') on conflict (key) do nothing;
create table if not exists bonus_entries (
  id          bigserial primary key,
  user_id     uuid not null references users(id) on delete cascade,
  kind        text not null check (kind in ('grant', 'spend', 'burn', 'refund', 'adjust')),
  reason      text,                                   -- kyc — за верификацию (один раз)
  amount_kop  bigint not null,
  order_id    text references orders(id),
  note        text,
  by_admin    uuid references admins(id),
  created_at  timestamptz not null default now()
);
create index if not exists bonus_user on bonus_entries (user_id, created_at desc);
create unique index if not exists bonus_kyc_once on bonus_entries (user_id) where reason = 'kyc';
create or replace function user_bonus(p_user uuid) returns bigint language sql stable as
  $$ select coalesce(sum(amount_kop), 0)::bigint from bonus_entries where user_id = p_user $$;

alter table orders add column if not exists bonus_kop bigint not null default 0;   -- скидка бонусом; amount_kop — списано с баланса
alter table orders add column if not exists idem text;
create unique index if not exists orders_idem on orders (idem) where idem is not null;

-- place_order v4: бонус как скидка, лимит без верификации вместо запрета покупок
drop function if exists place_order(uuid, uuid, jsonb, text, int);
create or replace function place_order(p_user uuid, p_plan uuid, p_fields jsonb, p_idem text, p_amount_cents int default null, p_use_bonus boolean default true)
returns orders
language plpgsql as $$
declare
  u users; pl product_plans; pr products; o orders; st record;
  v_rate numeric; v_price int; v_charged int; v_kop bigint; v_id text; v_label text;
  v_bonus_bal bigint; v_bonus bigint := 0; v_pay bigint;
begin
  select * into o from orders where idem = p_idem;
  if found then return o; end if;
  select * into o from orders where id = (select order_id from ledger_entries where idempotency_key = 'order:' || p_idem);
  if found then return o; end if;

  select * into u from users where id = p_user for update;
  if not found then raise exception 'user_not_found'; end if;
  if u.status <> 'active' then raise exception 'user_blocked'; end if;

  select * into pl from product_plans where id = p_plan and active;
  if not found then raise exception 'plan_not_found'; end if;
  select * into pr from products where id = pl.product_id and active;
  if not found then raise exception 'product_inactive'; end if;

  v_rate := (select value::text::numeric from settings where key = 'rate_rub_per_usd');
  v_label := pl.label;

  if pl.currency = 'rub' then
    if pl.price_kop is null or pl.price_kop <= 0 then raise exception 'plan_not_purchasable'; end if;
    v_kop := round(pl.price_kop * (1 + coalesce(pr.commission_pct, 0) / 100.0));
    v_price := round(pl.price_kop / v_rate);
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
    v_kop := round(v_charged * v_rate);
  end if;

  -- бонус: скидка до полной цены
  v_bonus_bal := user_bonus(p_user);
  if p_use_bonus and v_bonus_bal > 0 then v_bonus := least(v_bonus_bal, v_kop); end if;
  v_pay := v_kop - v_bonus;

  -- лимит расходов за период (без верификации — 15 000 ₽)
  select * into st from spend_state(p_user);
  if st.limit_kop is not null and st.spent_kop + v_pay > st.limit_kop then
    raise exception 'limit_exceeded' using detail = greatest(st.limit_kop - st.spent_kop, 0) || '|' || st.limit_kop || '|' || coalesce(to_char(st.resets_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), '') || '|' || u.kyc_status;
  end if;

  if user_balance(p_user) < v_pay then
    raise exception 'insufficient_funds' using detail = (v_pay - user_balance(p_user))::text;
  end if;

  v_id := new_order_id();
  insert into orders (id, user_id, product_id, plan_id, product_name, plan_label, price_cents, charged_cents, rate, amount_kop, bonus_kop, buyer_fields, status, currency, idem)
  values (v_id, p_user, pr.id, pl.id, pr.name, v_label, v_price, v_charged, v_rate, v_pay, v_bonus, coalesce(p_fields, '{}'), 'paid', pl.currency, p_idem)
  returning * into o;
  if v_pay > 0 then
    perform ledger_post(p_user, -v_pay, 'purchase', v_id, null, null, pr.name || ' · ' || v_label, 'order:' || p_idem);
    if st.period_start is null then update users set limit_since = now() where id = p_user; end if;
  end if;
  if v_bonus > 0 then
    insert into bonus_entries (user_id, kind, amount_kop, order_id, note) values (p_user, 'spend', -v_bonus, v_id, 'Скидка по заказу ' || v_id);
    if v_bonus_bal > v_bonus then
      insert into bonus_entries (user_id, kind, amount_kop, order_id, note) values (p_user, 'burn', -(v_bonus_bal - v_bonus), v_id, 'Остаток сгорел при оплате');
    end if;
  end if;
  insert into order_events (order_id, kind, status, text) values (v_id, 'created', 'paid',
    case when v_bonus > 0 then 'Заказ оплачен: с баланса ' || to_char(v_pay / 100.0, 'FM999999990D00') || ' ₽, бонусом ' || to_char(v_bonus / 100.0, 'FM999999990D00') || ' ₽'
         else 'Заказ оплачен с баланса' end);
  return o;
end $$;

-- возврат заказа: деньги на баланс, использованный бонус — обратно на бонусный счёт
create or replace function refund_order(p_order text, p_admin uuid, p_reason text) returns orders
language plpgsql as $$
declare o orders;
begin
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status = 'refunded' then return o; end if;
  if o.amount_kop > 0 then
    perform ledger_post(o.user_id, o.amount_kop, 'refund', o.id, null, p_admin, coalesce(p_reason, 'Возврат по заказу'), 'refund:' || o.id);
  end if;
  if o.bonus_kop > 0 then
    insert into bonus_entries (user_id, kind, amount_kop, order_id, note, by_admin) values (o.user_id, 'refund', o.bonus_kop, o.id, 'Бонус вернулся после возврата заказа', p_admin);
  end if;
  update orders set status = 'refunded', updated_at = now() where id = o.id returning * into o;
  insert into order_events (order_id, kind, status, text, by_admin) values (o.id, 'refund', 'refunded', p_reason, p_admin);
  insert into notifications (user_id, title, body, link)
    values (o.user_id, 'Возврат по заказу ' || o.id, 'Деньги вернулись на баланс', '/dashboard.html#order:' || o.id);
  return o;
end $$;

-- ───────────── отзывы ─────────────
create table if not exists reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  order_id    text not null unique references orders(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  text        text not null check (length(text) between 3 and 2000),
  author      text not null,
  status      text not null default 'published' check (status in ('published', 'hidden')),
  reply       text,
  reply_at    timestamptz,
  reply_by    uuid references admins(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists reviews_product on reviews (product_id, status, created_at desc);
create index if not exists reviews_all on reviews (status, created_at desc);

-- ───────────── избранное ─────────────
create table if not exists favorites (
  user_id     uuid not null references users(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ───────────── чат с поддержкой ─────────────
-- таблицы есть с 001: ветка на заказ (order_id) и одна общая (order_id is null); счётчики unread_user / unread_admin
alter table chat_threads add column if not exists last_from text check (last_from in ('user', 'admin'));
alter table chat_threads add column if not exists answered_by uuid references admins(id);
create unique index if not exists chat_general on chat_threads (user_id) where order_id is null;
create index if not exists chat_queue on chat_threads (last_from, last_message_at desc);
