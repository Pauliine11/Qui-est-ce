-- ─────────────────────────────────────────────────────────────────────────────
-- Autorisation Realtime (Broadcast privé) : un joueur ne peut que LIRE le canal
-- `game:<id>` des parties où il figure dans game_players. Aucune policy INSERT
-- → aucune écriture possible depuis un client. Le serveur diffuse via l'API
-- REST avec la clé service role.
-- Prérequis côté projet : canaux privés imposés (Realtime Settings →
-- désactiver « Allow public access ») et auth anonyme activée.
-- ─────────────────────────────────────────────────────────────────────────────

-- Les sous-requêtes d'une policy s'exécutent avec le rôle de l'utilisateur ;
-- or game_players est sous RLS sans policy. D'où ce SECURITY DEFINER,
-- qui ne révèle qu'un booléen d'appartenance au topic demandé.
create function public.is_game_player(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.game_players gp
    where gp.user_id = (select auth.uid())
      and p_topic = 'game:' || gp.game_id::text
  );
$$;

revoke execute on function public.is_game_player(text) from public, anon;
grant execute on function public.is_game_player(text) to authenticated;

create policy "players_read_their_game_channel"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and public.is_game_player(realtime.topic())
);
