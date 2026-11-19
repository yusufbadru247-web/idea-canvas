-- Idea Canvas : à coller une fois dans Supabase > SQL Editor > New query > Run.
-- Peut être relancé sans dégât.

-- 1. Les cartes, liens et tableaux : une ligne par document, rangée par liste (« coll »).
create table if not exists public.canvas_docs (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  coll text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner, coll, id)
);
alter table public.canvas_docs enable row level security;

-- Chacun ne voit et ne modifie que ses propres lignes.
drop policy if exists "canvas own rows" on public.canvas_docs;
create policy "canvas own rows" on public.canvas_docs
  for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- Modifier quelques champs d'une carte sans réécrire la carte entière.
create or replace function public.canvas_patch(p_coll text, p_id text, p_data jsonb)
returns void language sql security invoker set search_path = public as $$
  update canvas_docs set data = data || p_data, updated_at = now()
  where owner = auth.uid() and coll = p_coll and id = p_id;
$$;

-- Temps réel : un autre appareil voit les changements sans recharger.
do $$ begin
  alter publication supabase_realtime add table public.canvas_docs;
exception when duplicate_object then null; end $$;

-- 2. Photos, vidéos et fichiers : 5 Mo au plus chacun (1 Go pour tout le projet).
-- Lecture par lien (adresse impossible à deviner), écriture et suppression par le propriétaire seulement,
-- personne ne peut lister les fichiers des autres.
insert into storage.buckets (id, name, public, file_size_limit)
values ('canvas', 'canvas', true, 5242880)
on conflict (id) do update set public = true, file_size_limit = 5242880;

drop policy if exists "canvas upload own" on storage.objects;
create policy "canvas upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'canvas' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "canvas delete own" on storage.objects;
create policy "canvas delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'canvas' and (storage.foldername(name))[1] = auth.uid()::text);

-- La suppression d'un fichier exige aussi le droit de le lire : limité à son propre dossier.
drop policy if exists "canvas read own" on storage.objects;
create policy "canvas read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'canvas' and (storage.foldername(name))[1] = auth.uid()::text);
