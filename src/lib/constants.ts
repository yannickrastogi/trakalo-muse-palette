// Centralized constants used across the platform.
// Any change here automatically reflects in all menus, filters, and forms.

import { getNames } from "country-list";

/** ISO 3166-1 country names, alphabetically sorted, sourced from the country-list npm package. */
export const COUNTRIES: readonly string[] = (getNames() as string[]).slice().sort((a, b) => a.localeCompare(b));

export const DEFAULT_COVER = "/images/default-cover.png";

// Industry-reference primary genres (alphabetical). Niche sub-genres / styles
// (Bouyon, Shatta, Compas, Zouk, …) stay available as user CUSTOM values via
// GenreMultiSelect — existing track genres outside this list are preserved,
// displayed, and editable; they are never stripped.
export const GENRES = [
  "Afrobeats", "Alternative", "Amapiano", "Ambient",
  "Blues",
  "Classical", "Country",
  "Dance / EDM", "Dancehall", "Disco", "Drum & Bass", "Dubstep",
  "Electronic",
  "Folk", "Funk",
  "Gospel",
  "Hip-Hop / Rap", "House",
  "Indie",
  "Jazz",
  "K-Pop",
  "Latin", "Lo-Fi",
  "Metal",
  "Pop", "Punk",
  "R&B / Soul", "Reggae", "Reggaeton", "Rock",
  "Soca", "Soundtrack / Score",
  "Techno", "Trance", "Trap",
  "World",
] as const;

export const STEM_TYPES = [
  "kick", "snare", "bass", "guitar", "vocal", "synth", "drums",
  "background vocal", "fx", "other",
] as const;

export type StemType = typeof STEM_TYPES[number];

export const TRACK_TYPES = ["Instrumental", "Sample", "Acapella", "Song"] as const;

export const STATUSES = ["Available", "On Hold", "Released"] as const;

export const PRODUCTION_STAGES = [
  { value: "work_in_progress", label: "Work in Progress" },
  { value: "finished", label: "Finished" },
] as const;

export type ProductionStage = "work_in_progress" | "finished";

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

export const SPLIT_ROLES = [
  "Songwriter", "Producer", "Artist", "Musician",
] as const;

export const INDUSTRY_ROLES = [
  "Songwriter", "Producer", "Artist", "A&R", "Manager", "Musician",
  "Recording Engineer", "Mix Engineer", "Mastering Engineer", "Publisher", "DJ",
  "Label Representative", "Booking Agent", "Music Director",
  "Music Supervisor", "PR", "Assistant", "Lawyer", "Photographer", "Videographer",
] as const;

export const PROS = [
  "ABRAMUS (Brazil)", "ACDAM (Cuba)", "ACUM (Israel)", "AEPI (Greece)", "AGADU (Uruguay)",
  "AKKA/LAA (Latvia)", "AKM (Austria)", "APDAYC (Peru)", "APRA AMCOS (Australia/NZ)",
  "ARTISJUS (Hungary)", "ASCAP (USA)", "BMI (USA)", "BUMA/STEMRA (Netherlands)",
  "CAPASSO (South Africa)", "CASH (Hong Kong)", "COMPASS (Singapore)", "COSCAP (Barbados)",
  "COSON (Nigeria)", "COSOTA (Tanzania)", "EAÜ (Estonia)", "ECAD/UBC (Brazil)",
  "FILSCAP (Philippines)", "GEMA (Germany)", "GHAMRO (Ghana)", "GMR (USA)",
  "HDS-ZAMP (Croatia)", "IMRO (Ireland)", "IPRS (India)", "JACAP (Jamaica)",
  "JASRAC (Japan)", "KODA (Denmark)", "KOMCA (South Korea)", "LATGA (Lithuania)",
  "MACP (Malaysia)", "MCT (Thailand)", "MCSK (Kenya)", "MESAM (Turkey)", "MSG (Turkey)",
  "MUST (Taiwan)", "MUSICAUTOR (Bulgaria)", "OSA (Czech Republic)", "PPRS (Pakistan)",
  "PRS for Music (UK)", "SACM (Mexico)", "SACERAU (Egypt)", "SACVEN (Venezuela)",
  "SADAIC (Argentina)", "SAMRO (South Africa)", "SABAM (Belgium)", "SACEM (France)",
  "SAYCO (Colombia)", "SAZAS (Slovenia)", "SCD (Chile)", "SESAC (USA)", "SGAE (Spain)",
  "SGACEDOM (Dominican Republic)", "SIAE (Italy)", "SOCAN (Canada)", "SODAV (Senegal)",
  "SOKOJ (Serbia)", "SOZA (Slovakia)", "SPA (Portugal)", "STIM (Sweden)",
  "SUISA (Switzerland)", "TEOSTO (Finland)", "TONO (Norway)", "TTCSI (Trinidad & Tobago)",
  "UCMR-ADA (Romania)", "UPRS (Uganda)", "VCPMC (Vietnam)", "ZAIKS (Poland)",
  "ZAMCOPS (Zambia)", "ZIMURA (Zimbabwe)", "N/A",
] as const;
