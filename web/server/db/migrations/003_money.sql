-- Деньги: все движения по балансу проходят только через эти функции.
-- Каждая берёт блокировку строки пользователя (for update), поэтому два параллельных
-- списания не могут увести баланс в минус, а idempotency_key не даёт провести одну операцию дважды.

-- баланс пользователя (копейки)
create or replace function user_balance(p_user uuid) returns bigint
language sql stable as $$
  select coalesce((select balance_after from ledger_entries where user_id = p_user order by id desc limit 1), 0)
$$;

-- базовая проводка
create or replace function ledger_post(
  p_user uuid, p_amount bigint, p_kind text,
  p_order text default null, p_payment uuid default null, p_admin uuid default null,
  p_comment text default null, p_idem text default null
) returns ledger_entries
language plpgsql as $$
declare
  v_bal bigint;
  v_row ledger_entries;
begin
  if p_idem is not null then
    select * into v_row from ledger_entries where idempotency_key = p_idem;
    if found then return v_row; end if;
  end if;
  perform 1 from users where id = p_user for update;
  if not found then raise exception 'user_not_found'; end if;
  v_bal := user_balance(p_user) + p_amount;
  if v_bal < 0 then
    raise exception 'insufficient_funds' using detail = (user_balance(p_user))::text;
  end if;
  insert into ledger_entries (user_id, amount_kop, kind, balance_after, order_id, payment_id, admin_id, comment, idempotency_key)
  values (p_user, p_amount, p_kind, v_bal, p_order, p_payment, p_admin, p_comment, p_idem)
  returning * into v_row;
  return v_row;
end $$;

-- номер заказа: VX- + 8 символов без похожих (0/O, 1/I/L)
create or replace function new_order_id() returns text
language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v text;
  b bytea;
begin
  loop
    b := gen_random_bytes(8);
    v := 'VX-';
    for i in 0..7 loop
      v := v || substr(alphabet, (get_byte(b, i) % length(alphabet)) + 1, 1);
    end loop;
    exit when not exists (select 1 from orders where id = v);
  end loop;
  return v;
end $$;

-- комиссия сайта (computeChargedUsd из payment-flow.v2.js), в центах
create or replace function charged_cents(p_cents int) returns int
language plpgsql immutable as $$
declare c jsonb; u numeric;
begin
  u := coalesce(nullif(p_cents, 0), 2000) / 100.0;
  if u <= 45 then return round((u + 5) * 1.2 * 100); end if;
  return round(u * 1.3 * 100);
end $$;

-- пополнение подтверждено провайдером (вебхук); повторный вебхук ничего не меняет
create or replace function payment_succeeded(p_payment uuid) returns ledger_entries
language plpgsql as $$
declare p payments; r ledger_entries;
begin
  select * into p from payments where id = p_payment for update;
  if not found then raise exception 'payment_not_found'; end if;
  if p.status = 'succeeded' then
    select * into r from ledger_entries where idempotency_key = 'topup:' || p.id; return r;
  end if;
  if p.status <> 'pending' then raise exception 'payment_not_pending'; end if;
  update payments set status = 'succeeded', paid_at = now() where id = p.id;
  r := ledger_post(p.user_id, p.amount_kop, 'topup', null, p.id, null, 'Пополнение баланса', 'topup:' || p.id);
  insert into notifications (user_id, title, body, link)
    values (p.user_id, 'Баланс пополнен', to_char(p.amount_kop / 100.0, 'FM999G999G990D00') || ' ₽', '/dashboard.html#payments');
  return r;
end $$;

-- покупка: проверяет KYC, фиксирует цену и курс, создаёт заказ и списывает деньги одной транзакцией
create or replace function place_order(p_user uuid, p_plan uuid, p_fields jsonb, p_idem text) returns orders
language plpgsql as $$
declare
  u users; pl product_plans; pr products; o orders;
  v_rate numeric; v_charged int; v_kop bigint; v_id text;
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
  if pl.free or pl.price_cents is null or pl.price_cents = 0 then raise exception 'plan_not_purchasable'; end if;

  v_rate := (select value::text::numeric from settings where key = 'rate_rub_per_usd');
  v_charged := charged_cents(pl.price_cents);
  v_kop := round(v_charged * v_rate);            -- центы × ₽/$ = копейки

  if user_balance(p_user) < v_kop then
    raise exception 'insufficient_funds' using detail = (v_kop - user_balance(p_user))::text;
  end if;

  v_id := new_order_id();
  insert into orders (id, user_id, product_id, plan_id, product_name, plan_label, price_cents, charged_cents, rate, amount_kop, buyer_fields, status)
  values (v_id, p_user, pr.id, pl.id, pr.name, pl.label, pl.price_cents, v_charged, v_rate, v_kop, coalesce(p_fields, '{}'), 'paid')
  returning * into o;
  perform ledger_post(p_user, -v_kop, 'purchase', v_id, null, null, pr.name || ' · ' || pl.label, 'order:' || p_idem);
  insert into order_events (order_id, kind, status, text) values (v_id, 'created', 'paid', 'Заказ оплачен с баланса');
  return o;
end $$;

-- возврат заказа на баланс (админ)
create or replace function refund_order(p_order text, p_admin uuid, p_reason text) returns orders
language plpgsql as $$
declare o orders;
begin
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status = 'refunded' then return o; end if;
  perform ledger_post(o.user_id, o.amount_kop, 'refund', o.id, null, p_admin, coalesce(p_reason, 'Возврат по заказу'), 'refund:' || o.id);
  update orders set status = 'refunded', updated_at = now() where id = o.id returning * into o;
  insert into order_events (order_id, kind, status, text, by_admin) values (o.id, 'refund', 'refunded', p_reason, p_admin);
  insert into notifications (user_id, title, body, link)
    values (o.user_id, 'Возврат по заказу ' || o.id, 'Деньги вернулись на баланс', '/dashboard.html#order:' || o.id);
  return o;
end $$;
