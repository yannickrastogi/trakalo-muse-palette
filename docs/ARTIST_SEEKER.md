# TRAKALOG — Artist Seeker (Future Feature)

> **Document créé le :** 13 avril 2026
> **Objectif :** Scanner internet et réseaux sociaux pour trouver des artistes actifs, matcher avec le catalogue de l'utilisateur, maximiser les placements de chansons.
> **Statut :** Planifié — après Smart Brief Matching

---

## Vision

Le problème : les producteurs et songwriters envoient des beats et des chansons à l'aveugle via Instagram DM, sans savoir si l'artiste cherche ce type de son. C'est inefficace et frustrant.

**Artist Seeker** inverse le flow : au lieu d'attendre un brief, Trakalog va chercher proactivement les artistes qui correspondent au catalogue de l'utilisateur.

### Pipeline complet

```
User définit critères (genre, followers min/max, région, monthly listeners)
  → Agent scanne les APIs (Spotify, YouTube, socials)
    → Résultats filtrés et enrichis
      → Claude résume le profil de chaque artiste (style, tendances, besoins probables)
        → Smart Brief Matching compare le style de l'artiste avec le catalogue
          → Suggestions de tracks à pitcher à chaque artiste
            → L'utilisateur pitch directement depuis Trakalog
```

---

## Sources de données

### Spotify API (gratuite, rate limited)
- Monthly listeners
- Genres / sous-genres
- Popularité (score 0-100)
- Artistes similaires
- Dernières sorties (analyse du style récent)
- Top tracks (analyse des tempos, keys, ambiances)
- Marchés principaux (pays d'écoute)
- **Accès :** Gratuit avec Spotify Developer Account
- **Rate limit :** ~180 req/min avec token

### YouTube Data API (gratuite, quota 10 000/jour)
- Subscribers
- Vues totales et par vidéo
- Vidéos récentes (fréquence de sortie)
- Engagement (likes, commentaires)
- **Accès :** Gratuit avec Google Cloud API key

### Instagram Graph API
- Followers
- Posts récents
- Engagement rate
- Bio (contact email parfois)
- **Accès :** Nécessite Meta Business Account
- **Limite :** Comptes privés inaccessibles

### TikTok API
- Followers
- Vidéos récentes
- Sons utilisés (insight sur le style)
- **Accès :** Restrictif, nécessite approbation développeur
- **Alternative :** Scraping léger des profils publics

### Chartmetric / Songstats / Soundcharts (APIs payantes)
- Agrégation de toutes les sources ci-dessus
- Données historiques et tendances
- Contact emails parfois inclus
- Playlist tracking
- **Coût :** 500-2000$/mois selon le plan
- **Avantage :** Données fiables, pré-nettoyées, API stable

---

## Architecture technique

### Service Agent (Railway ou Edge Function)

```
POST /search-artists
Body: {
  genres: ["dancehall", "afrobeats"],
  monthly_listeners_min: 10000,
  monthly_listeners_max: 500000,
  region: "US",
  max_results: 20
}

Response: {
  artists: [
    {
      name: "Artist Name",
      spotify_id: "xxx",
      monthly_listeners: 125000,
      genres: ["dancehall", "afropop"],
      popularity: 45,
      recent_releases: [...],
      social_links: { instagram: "...", youtube: "...", tiktok: "..." },
      followers: { spotify: 80000, instagram: 45000, youtube: 12000 },
      summary: "Artiste dancehall en pleine montée, basé à Toronto...",
      style_analysis: {
        avg_bpm: 105,
        common_keys: ["C Min", "G Min"],
        mood: ["energetic", "tropical"],
        vocal_style: "female"
      },
      matching_tracks: [
        { track_id: "uuid", title: "Track Name", match_score: 87, reason: "BPM et mood alignés..." }
      ]
    }
  ]
}
```

### Flow de données

1. **Recherche Spotify** : `GET /v1/search?type=artist&genre=dancehall` → liste d'artistes
2. **Enrichissement** : pour chaque artiste → `GET /v1/artists/{id}` (stats) + `GET /v1/artists/{id}/top-tracks` (style)
3. **Analyse style** : extraire BPM moyen, keys fréquentes, mood des top tracks via les Audio Features Spotify
4. **Résumé Claude** : envoyer le profil à Claude pour un résumé humain du style et des besoins probables
5. **Smart Brief Matching** : comparer le style_analysis avec les sonic_dna du catalogue → scorer les tracks
6. **Résultat** : liste d'artistes avec tracks recommandées à pitcher

### Intégration Trakalog

- **Nouveau menu** : "Artist Seeker" dans le header (à côté de Smart A&R)
- **Interface** : filtres (genre, listeners, région) + résultats en cards
- **Chaque card artiste** : photo, nom, stats, résumé, bouton "View matching tracks"
- **Click sur artiste** : ouvre le détail avec les tracks recommandées du catalogue
- **Action** : "Pitch this track to [Artist]" → crée un pitch ou ouvre le flow de pitch

---

## Phases d'implémentation

### Phase 1 — MVP (Spotify seul) — ~2-3 semaines
- Recherche artistes via Spotify API
- Filtres : genre, monthly listeners min/max, popularité
- Stats de base : monthly listeners, genres, popularité, dernières sorties
- Résumé artiste via Claude API
- Analyse style basique (BPM moyen, keys des top tracks via Spotify Audio Features)
- Matching avec le catalogue via sonic_dna
- **Coût : ~5-20$/mois** (Claude API pour les résumés)

### Phase 2 — Enrichissement — ~2 semaines
- Ajouter YouTube stats (subscribers, vues)
- Scraper emails de contact depuis bios (Instagram, YouTube, site web)
- Historique de recherche (sauvegarder les artistes intéressants)
- "Watchlist" : suivre un artiste et être notifié de ses nouvelles sorties
- **Coût additionnel : quasi nul**

### Phase 3 — Scaling — si Trakalog décolle
- Intégration Chartmetric ou Songstats (données complètes, historiques)
- Scan automatique périodique (cron) : "Nouveaux artistes qui matchent votre catalogue"
- Notifications push : "Un artiste qui correspond à 3 de vos tracks vient de sortir un single"
- **Coût : 500-2000$/mois** (justifiable avec revenus Trakalog)

---

## Coûts estimés

### Phase 1 (MVP)

| Poste | Coût mensuel |
|-------|-------------|
| Spotify API | Gratuit |
| Claude API (résumés artistes) | ~5-20$ (selon volume) |
| Railway (service Agent) | Déjà payé (~5$/mois) |
| **Total Phase 1** | **~5-20$/mois** |

### Phase 2

| Poste | Coût mensuel |
|-------|-------------|
| YouTube Data API | Gratuit |
| Proxies (scraping léger) | ~10-20$ |
| **Total Phase 2** | **~15-40$/mois** |

### Phase 3

| Poste | Coût mensuel |
|-------|-------------|
| Chartmetric API | 500-2000$ |
| Infrastructure scaling | ~20-50$ |
| **Total Phase 3** | **~520-2050$/mois** |

---

## Le vrai avantage compétitif

Ce n'est pas la recherche d'artistes (n'importe qui peut chercher sur Spotify). C'est le **matching intelligent** entre le profil de l'artiste et le catalogue.

Savoir que "cet artiste fait du 105 BPM dancehall en mineur avec des hooks féminins, et tu as 3 tracks dans ton catalogue qui correspondent parfaitement" — ça, personne ne le fait.

C'est la combinaison **Sonic DNA + Smart Brief Matching + Artist Seeker** qui crée le moat. Chaque composant seul est utile, ensemble ils sont imbattables.

---

## Dépendances

- **Sonic DNA Profiler** ✅ (déjà implémenté)
- **Smart Brief Matching** ⏳ (prochaine priorité)
- **Spotify Developer Account** (à créer)
- **YouTube API Key** (à créer via Google Cloud)

---

## Risques et mitigations

| Risque | Mitigation |
|--------|-----------|
| Spotify rate limits | Cache agressif (24h), requêtes par batch |
| Spotify TOS (scraping interdit) | Utiliser uniquement l'API officielle |
| Données sociales incomplètes | Commencer avec Spotify seul, enrichir progressivement |
| Qualité du matching | Le Sonic DNA + user metadata rendent le matching fiable |
| Coût Chartmetric élevé | Phase 3 seulement si revenus justifient |

---

*Ce document est vivant. Il sera mis à jour au fur et à mesure du développement.*
