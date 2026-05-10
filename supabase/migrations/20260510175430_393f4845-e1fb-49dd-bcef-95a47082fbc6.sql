
insert into storage.buckets (id, name, public)
values ('dish-images', 'dish-images', true)
on conflict (id) do nothing;

create policy "Public read dish images"
on storage.objects for select
using (bucket_id = 'dish-images');
