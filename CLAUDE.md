# Qui est-ce ? : règles du projet

Application web du jeu « Qui est-ce ? » avec thèmes multiples, mode solo (contre une IA) et mode joueur contre joueur en temps réel.

## Stack

- Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4
- Zod 4 pour toute validation aux frontières (requêtes, env, sortie LLM, thèmes)
- Supabase : Postgres (source de vérité), Realtime (Broadcast privé), Anonymous Auth
- Upstash Redis : rate limiting, cache des analyses LLM, budget quotidien
- Vercel AI SDK pour le LLM (fournisseur interchangeable via variable d'env)
- Cloudflare Turnstile (anti-bot à la création et à l'entrée d'un salon)
- Vitest pour les tests, shadcn/ui + Radix pour les composants accessibles

Avant d'utiliser une API d'une de ces bibliothèques, vérifie sa documentation actuelle (version installée dans `package.json`). Ne te fie pas à ta mémoire pour les signatures.

## Architecture

```
src/
├── domain/          Cœur métier PUR (aucune I/O, aucun import Next/Supabase/Redis)
│   ├── theme.types.ts, theme.schema.ts, analysis.ts, engine.ts, sanitize.ts
│   └── game/        game.ts (machine à états), ai-opponent.ts (IA du solo)
├── themes/          Un dossier par thème + registry.ts
├── server/          Tout ce qui touche l'infra, `import "server-only"` obligatoire
│   ├── env.ts, supabase/, redis/, llm/, security/, games/
└── app/             Routes et UI
```

Le dossier `domain/` existe déjà et est testé. Ne modifie son comportement que si c'est nécessaire, et mets à jour ses tests dans ce cas.

## Invariants de sécurité (non négociables)

1. **Le LLM ne voit JAMAIS un personnage secret.** Il traduit seulement une question en analyse structurée (`Analysis`). C'est `domain/engine.ts` qui calcule OUI / NON / JE_NE_SAIS_PAS.
2. **Aucune clé ni aucun secret côté client.** Les modules serveur importent `server-only`. Aucune variable sensible n'est préfixée `NEXT_PUBLIC_`.
3. **Le client ne fait que lire.** Toute écriture passe par un Route Handler. Les tables Supabase ont la RLS activée et aucune policy d'écriture pour `anon` ou `authenticated`. Le serveur utilise la clé service role.
4. **Aucun secret dans les événements Realtime ni dans les réponses HTTP** avant la fin de partie. Le client ne reçoit que `toPlayerView()` et les `PublicEvent`.
5. **Toute entrée est validée par Zod**, et toute question passe par `sanitizeQuestion()`. La sortie du LLM est re-validée par `parseAnalysis()`. En cas d'échec, elle devient `{ type: "unanswerable" }` et n'est jamais propagée telle quelle.
6. **Concurrence :** toute action envoie `expectedVersion`. La sauvegarde se fait en `UPDATE … WHERE version = expected`. Si aucune ligne n'est modifiée, réponse `409`.
7. **Rate limiting et budget** vérifiés AVANT tout appel LLM.
8. Pas de `dangerouslySetInnerHTML` (règle ESLint). CSP stricte avec nonce. Vérification de l'en-tête `Origin` sur toutes les routes POST.
9. Les tirages aléatoires côté serveur utilisent `crypto.randomInt`, jamais `Math.random`.

## Règles de jeu validées

- Mode de réponse par défaut : **Arbitre IA**. Mode **classique** (l'adversaire humain répond) en option.
- Mauvaise tentative de deviner : **perte du tour**. Un même personnage ne peut pas être retenté.
- « C'est X ? » posé comme question compte comme une tentative.
- 30 questions max par joueur.
- Solo : duel contre l'IA algorithmique (`ai-opponent.ts`, sans LLM), niveaux facile et difficile.
- V1 : **salons privés uniquement** (code ou lien), pas de matchmaking public.

## Conventions

- Identifiants du code en anglais, commentaires et textes d'interface en français.
- Pas de `any`. Préférer les unions discriminées et `satisfies`.
- Erreurs d'API au format `{ error: { code: string, message: string } }` avec le bon statut HTTP. Ne jamais renvoyer de stack trace ni de message interne au client.
- Accessibilité : navigation clavier complète, `alt` sur toutes les images, contrastes AA, `aria-live` pour les réponses du jeu.
- Logs serveur sans données personnelles. Les IP sont hachées avec un sel avant tout stockage.

## Méthode de travail

- Commence par un plan court, puis attends ma validation avant toute phase qui touche à plusieurs fichiers.
- Petits commits atomiques (Conventional Commits, en français).
- Après chaque modification : `npm run check` (typecheck + lint + tests) doit passer.
- Écris les tests en même temps que le code, surtout pour la sécurité.
- Si une consigne est ambiguë ou contredit ces règles, demande-moi au lieu de deviner.

## Commandes

```bash
npm run dev          # serveur de dev
npm run check        # typecheck + lint + tests (doit toujours passer)
npm run test:watch
```