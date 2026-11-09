-- ─────────────────────────────────────────────────────────────────────────────
-- Schéma initial : games, game_players, rooms.
-- Invariant n°3 : RLS activée partout, AUCUNE policy pour anon/authenticated.
-- Seul le service role (qui contourne la RLS) accède à ces tables.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.games (
  id uuid primary key,
  mode text not null check (mode in ('solo', 'pvp')),
  theme_id text not null,
  answer_mode text not null check (answer_mode in ('ai_referee', 'classic')),
  difficulty text check (difficulty in ('easy', 'hard')),
  -- Objet `Game` du domaine. Contient les secrets : ne sort JAMAIS tel quel.
  state jsonb not null,
  -- Verrou optimiste, recopié depuis state.version à chaque sauvegarde.
  version integer not null default 0 check (version >= 0),
  -- 'waiting' : salon PvP en attente du second joueur.
  status text not null default 'playing' check (status in ('waiting', 'playing', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table public.game_players (
  game_id uuid not null references public.games (id) on delete cascade,
  slot text not null check (slot in ('A', 'B')),
  -- null = adversaire IA du mode solo.
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null,
  last_seen_at timestamptz not null default now(),
  primary key (game_id, slot),
  -- Un même utilisateur ne peut occuper qu'un siège par partie
  -- (les user_id null de l'IA ne sont pas concernés : NULLS DISTINCT par défaut).
  unique (game_id, user_id)
);

create table public.rooms (
  game_id uuid primary key references public.games (id) on delete cascade,
  -- Jamais le code en clair : uniquement son hachage salé.
  join_code_hash text not null unique,
  expires_at timestamptz not null,
  join_attempts integer not null default 0,
  created_at timestamptz not null default now()
);

-- Index utiles : nettoyage par expiration, recherche des parties d'un joueur.
create index games_expires_at_idx on public.games (expires_at);
create index games_status_idx on public.games (status);
create index game_players_user_id_idx on public.game_players (user_id);
create index rooms_expires_at_idx on public.rooms (expires_at);

-- RLS sans policy : anon et authenticated ne voient rien, n'écrivent rien.
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.rooms enable row level security;

-- Défense en profondeur : retire aussi les privilèges par défaut.
revoke all on table public.games from anon, authenticated;
revoke all on table public.game_players from anon, authenticated;
revoke all on table public.rooms from anon, authenticated;

-- updated_at automatique.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger games_set_updated_at
before update on public.games
for each row execute function public.set_updated_at();

-- Nettoyage des parties expirées (à appeler par un cron, service role).
-- game_players et rooms suivent par cascade.
create function public.cleanup_expired_games()
returns integer
language sql
security definer
set search_path = ''
as $$
  with removed as (
    delete from public.games where expires_at < now() returning id
  )
  select count(*)::integer from removed;
$$;

revoke execute on function public.cleanup_expired_games() from public, anon, authenticated;
