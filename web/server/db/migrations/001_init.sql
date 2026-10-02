-- Vexel — схема базы, версия 1
-- Деньги храним целыми: рубли в копейках (*_kop), доллары в центах (*_cents). Курс — numeric.
-- Баланс пользователя НЕ хранится полем: это сумма проводок в ledger_entries.

create extension if not exists citext;
create extension if not exists pgcrypto;

-- ───────────── пользователи и доступ ─────────────
create table users (
  id              uuid primary key default gen_random_uuid(),
  email           citext not null unique,
  password_hash   text not null,
  name            text,
  phone           text,
  status          text not null default 'active' check (status in ('active','blocked')),
  kyc_status      text not null default 'none' check (kyc_status in ('none','pending','approved','rejected')),
  kyc_reason      text,                       -- причина последнего отказа
  consent_offer   text,                       -- версия принятой оферты
  consent_news    boolean not null default false,
  created_at      timestamptz not null default now(),
  last_login_at   timestamptz
);

-- одноразовые коды на почту: регистрация / вход по коду / сброс пароля / смена почты
create table email_codes (
  id           bigserial primary key,
  email        citext not null,
  purpose      text not null check (purpose in ('register','login','reset','change_email')),
  code_hash    text not null,
  attempts     int not null default 0,
  expires_at   timestamptz not null,
  consumed_at  timestamptz,
  ip           inet,
  created_at   timestamptz not null default now()
);
create index email_codes_lookup on email_codes (email, purpose, created_at desc);

-- подтверждённая почта, ожидающая пароля (шаг между кодом и созданием аккаунта)
create table signup_tickets (
  token_hash   text primary key,
  email        citext not null,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);

create table sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  token_hash    text not null unique,
  ip            inet,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  expires_at    timestamptz not null
);
create index sessions_user on sessions (user_id);

create table admins (
  id             uuid primary key default gen_random_uuid(),
  login          citext not null unique,
  password_hash  text not null,
  name           text not null,
  role           text not null default 'owner' check (role in ('owner','operator','kyc')),
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table admin_sessions (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid not null references admins(id) on delete cascade,
  token_hash   text not null unique,
  ip           inet,
  user_agent   text,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null
);

-- ───────────── файлы ─────────────
-- на тестовом этапе байты лежат в базе (data); в бою — в закрытом S3 (storage_key)
create table files (
  id           uuid primary key default gen_random_uuid(),
  owner_user   uuid references users(id) on delete set null,
  owner_admin  uuid references admins(id) on delete set null,
  purpose      text not null check (purpose in ('kyc','chat','product_icon')),
  mime         text not null,
  size_bytes   int not null,
  name         text,
  data         bytea,
  storage_key  text,
  created_at   timestamptz not null default now()
);

-- ───────────── каталог ─────────────
create table settings (
  key    text primary key,
  value  jsonb not null
);

create table categories (
  id     text primary key,            -- ai, games, entertainment, design, work, international
  name   text not null,
  sort   int not null default 0
);

create table products (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  category_id    text not null references categories(id),
  name           text not null,
  description    text,
  icon           text,                -- data: URI или ссылка
  delivery       text not null default 'manual' check (delivery in ('manual','auto','card_topup')),
  buyer_fields   jsonb not null default '[]',   -- [{key,label,type,required,placeholder}]
  active         boolean not null default true,
  sort           int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index products_cat on products (category_id, sort);

create table product_plans (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id) on delete cascade,
  label         text not null,
  price_cents   int,                  -- цена сервиса в центах; null = по запросу
  price_text    text,                 -- как показывать тариф ("$20/month")
  description   text,
  free          boolean not null default false,
  active        boolean not null default true,
  sort          int not null default 0
);
create index plans_product on product_plans (product_id, sort);

-- пул ключей/кодов для автовыдачи; secret зашифрован на уровне приложения
create table product_keys (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references products(id) on delete cascade,
  plan_id      uuid references product_plans(id) on delete set null,
  secret_enc   text not null,
  status       text not null default 'free' check (status in ('free','sold','revoked')),
  order_id     text,
  added_by     uuid references admins(id),
  created_at   timestamptz not null default now(),
  sold_at      timestamptz
);
create index keys_free on product_keys (product_id, plan_id) where status = 'free';

-- ───────────── заказы ─────────────
create table orders (
  id              text primary key,             -- VX-XXXXXXXX
  user_id         uuid not null references users(id),
  product_id      uuid references products(id),
  plan_id         uuid references product_plans(id),
  product_name    text not null,                -- снимок на момент заказа
  plan_label      text,
  price_cents     int not null,                 -- номинал
  charged_cents   int not null,                 -- номинал с комиссией
  rate            numeric(12,4) not null,       -- ₽ за $ на момент заказа
  amount_kop      bigint not null,              -- списано с баланса
  buyer_fields    jsonb not null default '{}',
  status          text not null default 'paid'
                  check (status in ('paid','in_work','need_info','done','canceled','refunded')),
  delivery_enc    text,                         -- выданные данные, зашифрованы
  delivered_at    timestamptz,
  assigned_admin  uuid references admins(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index orders_user on orders (user_id, created_at desc);
create index orders_status on orders (status, created_at desc);

create table order_events (
  id          bigserial primary key,
  order_id    text not null references orders(id) on delete cascade,
  kind        text not null,        -- created, status, delivered, note, refund
  status      text,
  text        text,
  by_admin    uuid references admins(id),
  created_at  timestamptz not null default now()
);
create index order_events_order on order_events (order_id, id);

-- ───────────── деньги ─────────────
-- пополнения через платёжного провайдера
create table payments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id),
  amount_kop     bigint not null check (amount_kop > 0),
  provider       text not null,                 -- test, yookassa, cloudpayments, …
  provider_id    text,
  status         text not null default 'pending' check (status in ('pending','succeeded','canceled','refunded')),
  for_order      jsonb,                         -- «пополнить на недостающее»: какой заказ оформить после оплаты
  created_at     timestamptz not null default now(),
  paid_at        timestamptz,
  unique (provider, provider_id)
);
create index payments_user on payments (user_id, created_at desc);

-- журнал операций по балансу; сумма amount_kop по пользователю = баланс
create table ledger_entries (
  id               bigserial primary key,
  user_id          uuid not null references users(id),
  amount_kop       bigint not null check (amount_kop <> 0),
  kind             text not null check (kind in ('topup','purchase','refund','adjust','payout')),
  balance_after    bigint not null check (balance_after >= 0),
  order_id         text references orders(id),
  payment_id       uuid references payments(id),
  admin_id         uuid references admins(id),
  comment          text,
  idempotency_key  text unique,
  created_at       timestamptz not null default now()
);
create index ledger_user on ledger_entries (user_id, id desc);

-- заявки на возврат на карту (вывод баланса обратно на способ оплаты)
create table refund_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id),
  order_id      text references orders(id),
  payment_id    uuid references payments(id),
  amount_kop    bigint not null check (amount_kop > 0),
  destination   text not null default 'balance' check (destination in ('balance','card')),
  reason        text,
  status        text not null default 'new' check (status in ('new','approved','rejected','done')),
  admin_id      uuid references admins(id),
  admin_note    text,
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);

-- ───────────── KYC ─────────────
create table kyc_submissions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id),
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  file_ids      uuid[] not null,
  birth_date    date,                     -- заполняет админ при проверке
  reason        text,
  reviewed_by   uuid references admins(id),
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz
);
create index kyc_queue on kyc_submissions (status, created_at);

-- ───────────── чаты ─────────────
create table chat_threads (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id),
  order_id         text references orders(id),       -- null = общий чат с поддержкой
  subject          text,
  status           text not null default 'open' check (status in ('open','closed')),
  unread_user      int not null default 0,
  unread_admin     int not null default 0,
  last_message_at  timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create unique index chat_one_per_order on chat_threads (order_id) where order_id is not null;
create index chat_user on chat_threads (user_id, last_message_at desc);
create index chat_admin_queue on chat_threads (unread_admin, last_message_at desc);

create table chat_messages (
  id          bigserial primary key,
  thread_id   uuid not null references chat_threads(id) on delete cascade,
  author      text not null check (author in ('user','admin','system')),
  admin_id    uuid references admins(id),
  body        text,
  file_id     uuid references files(id),
  created_at  timestamptz not null default now()
);
create index chat_messages_thread on chat_messages (thread_id, id);

-- ───────────── уведомления и аудит ─────────────
create table notifications (
  id          bigserial primary key,
  user_id     uuid not null references users(id) on delete cascade,
  title       text not null,
  body        text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notif_user on notifications (user_id, id desc);

create table audit_log (
  id          bigserial primary key,
  admin_id    uuid references admins(id),
  action      text not null,          -- price.update, order.refund, kyc.approve, balance.adjust, …
  target      text,
  data        jsonb,
  ip          inet,
  created_at  timestamptz not null default now()
);
create index audit_time on audit_log (created_at desc);

create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now());
