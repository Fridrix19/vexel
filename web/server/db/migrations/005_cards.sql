-- 005: виртуальные карты (бета: карта выпускается сразу после оплаты заказа, реквизиты тестовые и зашифрованы)

create table if not exists cards (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id),
  order_id       text references orders(id),          -- заказ на выпуск
  brand          text not null default 'Visa',
  last4          text not null,
  exp            text not null,                        -- MM/YY
  pan_enc        text not null,                        -- AES-GCM, ключ из NUXT_SECRET
  cvv_enc        text not null,
  holder         text not null default 'VEXEL CARDHOLDER',
  balance_cents  int not null default 0 check (balance_cents >= 0),
  status         text not null default 'active' check (status in ('active','frozen','closed')),
  test           boolean not null default true,        -- бета: реквизиты не настоящие
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists cards_user on cards (user_id, created_at);

-- пополнения карт (история по карте)
create table if not exists card_topups (
  id            bigserial primary key,
  card_id       uuid not null references cards(id),
  order_id      text references orders(id) unique,     -- один заказ — одно зачисление
  amount_cents  int not null check (amount_cents > 0),
  created_at    timestamptz not null default now()
);

-- код для показа реквизитов
alter table email_codes drop constraint if exists email_codes_purpose_check;
alter table email_codes add constraint email_codes_purpose_check
  check (purpose in ('register','login','reset','change_email','reveal'));
