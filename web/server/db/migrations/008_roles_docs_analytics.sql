-- 008: старший админ, кто и когда назначил/изменил; документы с версиями и согласиями; аналитика поведения;
--      контакты сайта; Telegram пользователя; подарки

-- админы: роль «старший», кто создал и когда назначена текущая роль
alter table admins drop constraint if exists admins_role_check;
alter table admins add constraint admins_role_check check (role in ('owner','senior','operator','kyc'));
alter table admins add column if not exists created_by uuid references admins(id);
alter table admins add column if not exists role_set_at timestamptz;
alter table admins add column if not exists role_set_by uuid references admins(id);
update admins set role_set_at = coalesce(role_set_at, created_at);

-- товары: кто последним изменил
alter table products add column if not exists updated_by uuid references admins(id);

-- пользователь: Telegram для связи и уведомлений
alter table users add column if not exists telegram text;

-- контакты сайта (правит владелец в админке)
insert into settings (key, value) values ('contacts', '{"email":"support@vexel.ru","telegram":"vexel_support","max":"vexel_support"}')
  on conflict (key) do nothing;

-- документы: оферта, политика, тарифы — с версиями; действующая = последняя опубликованная
alter table files drop constraint if exists files_purpose_check;
alter table files add constraint files_purpose_check check (purpose in ('kyc','chat','product_icon','document'));
create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('offer','privacy','tariffs')),
  version       text not null,
  title         text not null,
  url           text,                          -- ссылка на статичный файл/страницу
  file_id       uuid references files(id),     -- или загруженный PDF
  note          text,                          -- что изменилось (видит пользователь)
  published_at  timestamptz not null default now(),
  published_by  uuid references admins(id),
  unique (kind, version)
);
create table if not exists user_consents (
  id           bigserial primary key,
  user_id      uuid not null references users(id) on delete cascade,
  document_id  uuid not null references documents(id),
  accepted_at  timestamptz not null default now(),
  ip           inet,
  unique (user_id, document_id)
);
insert into documents (kind, version, title, url, published_at) values
  ('offer', '2.3', 'Публичная оферта', '/legal-files/offer.pdf', '2026-09-01'),
  ('privacy', '1.4', 'Политика обработки персональных данных', '/legal-files/privacy.pdf', '2026-09-01'),
  ('tariffs', '1.0', 'Тарифы и комиссии', '/tariffs.html', '2026-09-01')
on conflict (kind, version) do nothing;
-- у уже зарегистрированных — согласие с действующими версиями на дату регистрации
insert into user_consents (user_id, document_id, accepted_at)
select u.id, d.id, u.created_at from users u cross join documents d
on conflict do nothing;

-- аналитика: просмотры страниц, время на странице, клики — и гостей, и пользователей
create table if not exists events (
  id           bigserial primary key,
  anon_id      text not null,                  -- постоянный id браузера (localStorage)
  session_id   text not null,                  -- визит: новый после 30 минут тишины
  user_id      uuid references users(id) on delete set null,
  type         text not null check (type in ('view','leave','click','action')),
  path         text not null,
  target       text,                           -- блок/кнопка/ссылка
  label        text,                           -- текст элемента
  duration_ms  int,                            -- время на странице (leave)
  scroll_pct   smallint,
  meta         jsonb,
  referrer     text,
  device       text,
  created_at   timestamptz not null default now()
);
create index if not exists events_time on events (created_at desc);
create index if not exists events_user on events (user_id, created_at desc);
create index if not exists events_anon on events (anon_id, created_at desc);
create index if not exists events_path on events (path, type, created_at);

-- привязка браузера к аккаунту (гостевые события до входа попадают в историю пользователя)
create table if not exists user_devices (
  anon_id     text not null,
  user_id     uuid not null references users(id) on delete cascade,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  primary key (anon_id, user_id)
);

-- подарок: карта для друга по почте — забирается при входе с этой почтой
alter table cards add column if not exists gift_to citext;
alter table cards add column if not exists gift_from uuid references users(id);
alter table cards add column if not exists claimed_at timestamptz;
alter table orders add column if not exists gift_to citext;
