# Sonic DNA Profiler Skill — Emotional Audio Intelligence

## Vision
Chaque track uploadée sur Trakalog reçoit une "empreinte sonore" — un profil multidimensionnel qui capture non seulement le BPM/key/genre mais l'ÉMOTION, la TEXTURE, la NARRATIVE du morceau. C'est le "PageRank musical" de Trakalog.

## Niveau 1 — Ce qu'on a déjà (Essentia.js)
- BPM (tempo)
- Key + Scale (tonalité)
- Genre (heuristique basée sur tempo/énergie/brightness)
- Mood tags (calm, energetic, dark, happy — heuristique)
- Durée, structure (chapters)

Limitations : les heuristiques sont basiques. "Dark" ne capture pas la différence entre "dark cinematic" et "dark trap".

## Niveau 2 — Essentia TensorFlow Models (prochaine étape)
Modèles pré-entraînés à ajouter pour chaque track :

### Mood/Emotion (multi-label)
- happy, sad, aggressive, relaxed, dramatic, tender, dark, bright, epic, intimate, melancholic, euphoric, anxious, peaceful, mysterious, playful
- Modèle : mood_happy, mood_sad, mood_aggressive, mood_relaxed (Essentia)

### Caractéristiques audio avancées
- Danceability (0-1) : à quel point ça donne envie de danser
- Energy (0-1) : intensité perçue
- Valence (0-1) : positivité émotionnelle
- Acousticness (0-1) : acoustique vs électronique
- Speechiness (0-1) : présence de paroles vs instrumental
- Liveness (0-1) : son live vs studio
- Instrumentalness (0-1) : instrumental vs vocal

### Structure narrative
- Build-up / drop / climax detection
- Énergie seconde par seconde (courbe d'énergie)
- "Est-ce que le track raconte une montée ? une chute ? un cycle ?"

### Clearance sonore des premières secondes
- Les 8 premières secondes sont cruciales pour le sync
- Analyser séparément : vocal/instrumental, énergie, mood des 0-8s
- "Ce track a un intro instrumental clean de 12 secondes — parfait pour du sync"

Implémentation : Essentia.js avec les modèles TensorFlow pré-entraînés, exécutés côté client au moment de l'upload (comme le BPM/key actuel)

## Niveau 3 — CLAP Embeddings (game changer)
CLAP = Contrastive Language-Audio Pretraining (Microsoft/LAION)

### Concept
- Chaque track est convertie en un vecteur de 512 dimensions (embedding)
- Chaque description textuelle est aussi convertie en vecteur de 512 dimensions
- Le matching se fait par cosine similarity entre les vecteurs
- Plus besoin de tags — le matching est SÉMANTIQUE

### Cas d'usage
Brief : "warm Sunday morning, organic, sense of hope but not cheesy"
→ Convertir en vecteur CLAP
→ Comparer avec les vecteurs de chaque track du catalogue
→ Les tracks les plus proches dans l'espace vectoriel = les meilleurs matchs
→ Résultat 10x plus pertinent que du matching par tags

### Implémentation
- Modèle CLAP : LAION-AI/CLAP (open source, gratuit)
- Taille : ~600MB (trop gros pour le navigateur)
- Doit tourner côté serveur : Vercel Serverless Function (timeout 60s) ou serveur dédié
- OU utiliser un service hébergé : Replicate.com (pay-per-use, ~$0.01 par track)
- Stocker les embeddings dans pgvector (extension PostgreSQL) ou Pinecone

### Pipeline CLAP
1. À l'upload : extraire l'embedding audio (512 dimensions)
2. Stocker dans tracks.sonic_embedding (vector type via pgvector)
3. À chaque brief Smart A&R / Sync Agent :
   a. Convertir le texte du brief en embedding CLAP
   b. SELECT * FROM tracks ORDER BY sonic_embedding <=> brief_embedding LIMIT 10
   c. Résultat : les 10 tracks les plus proches sémantiquement

### Base vectorielle
Option A : pgvector (extension PostgreSQL sur Supabase)
- Gratuit si Supabase le supporte
- SQL : CREATE EXTENSION vector; ALTER TABLE tracks ADD COLUMN sonic_embedding vector(512);
- Query : SELECT * FROM tracks ORDER BY sonic_embedding <=> '[0.1, 0.2, ...]' LIMIT 10

Option B : Pinecone / Weaviate (service externe)
- Plus performant à grande échelle (100K+ tracks)
- Coût : ~$70/mois pour 1M vecteurs

## Niveau 4 — Comparaison avec des placements réels (long-terme)
- Constituer une base de données de tracks qui ont été effectivement placées (sync TV, pub, film)
- Extraire leurs embeddings CLAP
- Pour chaque nouvelle track : "ce track ressemble à 87% à ce qui a été placé dans Stranger Things S4"
- Donne une prédiction de "sync-ability"

## Roadmap d'implémentation

### Phase 1 (maintenant) — Essentia.js amélioré
- Ajouter les modèles TensorFlow mood (happy, sad, aggressive, relaxed)
- Ajouter danceability, energy, valence
- Analyser les 8 premières secondes séparément
- Stocker dans tracks.sonic_profile (jsonb)
- Temps : 1-2 jours

### Phase 2 (1-2 mois) — CLAP embeddings
- Activer pgvector sur Supabase
- Créer une Edge Function ou API endpoint pour l'extraction CLAP
- Utiliser Replicate.com pour l'inférence (~$0.01/track)
- Stocker les embeddings dans tracks.sonic_embedding
- Modifier Smart A&R et Sync Agents pour utiliser le matching vectoriel
- Temps : 1 semaine

### Phase 3 (3-6 mois) — Sonic DNA complet
- Courbe d'énergie seconde par seconde
- Détection de structure narrative
- Comparaison avec placements réels
- Dashboard "Sonic DNA" par track (visualisation radar)
- Temps : 2-4 semaines

## Impact sur les agents Sync
- Agent B (Matcher) utilise les CLAP embeddings au lieu des tags pour matcher
- Résultat : le matching passe de "même genre + même mood" à "même feeling, même énergie, même texture"
- Un brief vague comme "something cinematic but modern" donne des résultats pertinents
- Le matching s'améliore avec chaque track ajoutée (plus de points de comparaison dans l'espace vectoriel)

## Données stockées par track
```json
{
  "sonic_profile": {
    "bpm": 120,
    "key": "C Min",
    "genre": "Electronic",
    "moods": ["dark", "cinematic", "mysterious"],
    "danceability": 0.72,
    "energy": 0.85,
    "valence": 0.35,
    "acousticness": 0.12,
    "speechiness": 0.45,
    "instrumentalness": 0.55,
    "intro_type": "instrumental_clean",
    "intro_duration_sec": 12,
    "narrative_shape": "build_and_release",
    "energy_curve": [0.2, 0.3, 0.5, 0.8, 0.9, 0.7, 0.4]
  },
  "sonic_embedding": [0.123, -0.456, 0.789, ...] // 512 dimensions CLAP
}
```
