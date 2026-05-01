insert into storage.buckets (id, name, public)
values ('vision-board', 'vision-board', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('designs', 'designs', true)
on conflict (id) do nothing;

