// Centralized constants used across the platform.
// Any change here automatically reflects in all menus, filters, and forms.

export const GENRES = [
  "Afrobeats", "Afrohouse", "Ambient", "Blues", "Bouyon", "Caribbean", "Classical",
  "Country", "Dance", "Disco-Funk", "DnB", "Dubstep", "Electronic",
  "Film", "Folk", "Hip-Hop", "House", "I-Pop", "Indie", "Jazz",
  "K-Pop", "Kompa", "Latin", "Lo-fi", "Lounge", "Pop", "Progressive",
  "R&B", "Reggae-Dancehall", "Rock", "Shatta", "Soca", "Soul",
  "World", "Zouk",
] as const;

export const STEM_TYPES = [
  "kick", "snare", "bass", "guitar", "vocal", "synth", "drums",
  "background vocal", "fx", "other",
] as const;

export type StemType = typeof STEM_TYPES[number];

export const TRACK_TYPES = ["Instrumental", "Sample", "Acapella", "Song"] as const;

export const STATUSES = ["Available", "On Hold", "Released"] as const;

export const GENDERS = ["Male", "Female", "Duet", "N/A"] as const;

export const MOODS = [
  "aggressive", "calm", "dark", "dreamy", "driving", "emotional", "energetic",
  "euphoric", "experimental", "happy", "hopeful", "hypnotic", "meditative",
  "nostalgic", "playful", "romantic", "smooth", "uplifting", "warm",
] as const;
