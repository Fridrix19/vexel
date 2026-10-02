-- 007: логин пользователя (вход по логину или почте) и список разрешённых почтовых доменов

alter table users add column if not exists username citext;

-- существующим аккаунтам — логин из почты до @, при совпадении с числовым суффиксом
do $$
declare r record; base text; cand text; n int;
begin
  for r in select id, email from users where username is null order by created_at loop
    base := lower(regexp_replace(split_part(r.email::text, '@', 1), '[^a-zA-Z0-9_.-]', '', 'g'));
    base := regexp_replace(base, '^[._-]+', '');
    if length(base) < 3 then base := base || 'user'; end if;
    base := left(base, 28);
    cand := base; n := 1;
    while exists (select 1 from users where username = cand) loop
      n := n + 1; cand := base || n;
    end loop;
    update users set username = cand where id = r.id;
  end loop;
end $$;

alter table users alter column username set not null;
create unique index if not exists users_username on users (username);

-- почта только с этих доменов (правится в админке → Настройки)
insert into settings (key, value) values ('email_domains', '[
  "gmail.com","googlemail.com",
  "yandex.ru","ya.ru","yandex.com","yandex.by","yandex.kz","yandex.ua","narod.ru",
  "mail.ru","inbox.ru","list.ru","bk.ru","internet.ru","xmail.ru",
  "rambler.ru","lenta.ru","ro.ru","autorambler.ru","myrambler.ru",
  "icloud.com","me.com","mac.com",
  "outlook.com","hotmail.com","live.com","msn.com",
  "yahoo.com","proton.me","protonmail.com"
]'::jsonb) on conflict (key) do nothing;
