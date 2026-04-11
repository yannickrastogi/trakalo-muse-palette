// Centralized constants used across the platform.
// Any change here automatically reflects in all menus, filters, and forms.

export const DEFAULT_COVER = "/images/default-cover.png";

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

export const KEYS = [
  "C Maj", "C Min", "C# Maj", "C# Min", "D Maj", "D Min",
  "D# Maj", "D# Min", "E Maj", "E Min", "F Maj", "F Min",
  "F# Maj", "F# Min", "G Maj", "G Min", "G# Maj", "G# Min",
  "A Maj", "A Min", "A# Maj", "A# Min", "B Maj", "B Min",
] as const;

export const MOODS = [
  "aggressive", "calm", "dark", "dreamy", "driving", "emotional", "energetic",
  "euphoric", "experimental", "happy", "hopeful", "hypnotic", "meditative",
  "nostalgic", "playful", "romantic", "smooth", "uplifting", "warm",
] as const;

export const LANGUAGES = [
  "Afrikaans", "Albanian", "Amharic", "Arabic", "Armenian", "Azerbaijani",
  "Bengali", "Bosnian", "Bulgarian", "Burmese",
  "Cantonese", "Catalan", "Chinese (Mandarin)", "Croatian", "Czech",
  "Danish", "Dutch",
  "English", "Estonian",
  "Farsi", "Filipino", "Finnish", "French",
  "Ga", "Georgian", "German", "Greek", "Guarani", "Gujarati",
  "Haitian Creole", "Hausa", "Hebrew", "Hindi", "Hungarian",
  "Icelandic", "Igbo", "Indonesian", "Instrumental", "Irish", "Italian",
  "Japanese", "Javanese",
  "Kannada", "Kazakh", "Khmer", "Korean", "Kurdish",
  "Lao", "Latin", "Latvian", "Lithuanian",
  "Macedonian", "Malay", "Malayalam", "Maltese", "Maori", "Marathi", "Mongolian",
  "Nepali", "Norwegian",
  "Pashto", "Polish", "Portuguese", "Punjabi",
  "Quechua",
  "Romanian", "Russian",
  "Samoan", "Serbian", "Shona", "Sinhala", "Slovak", "Slovenian", "Somali", "Spanish", "Swahili", "Swedish",
  "Tagalog", "Tamil", "Telugu", "Thai", "Tibetan", "Tigrinya", "Tongan", "Turkish", "Twi",
  "Ukrainian", "Urdu", "Uzbek",
  "Vietnamese",
  "Welsh", "Wolof",
  "Xhosa",
  "Yoruba",
  "Zulu",
] as const;
