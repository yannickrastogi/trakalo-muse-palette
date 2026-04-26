export const INSTRUMENTS = [
  "Bass", "Synth", "Drums", "Acoustic Guitar", "Electric Guitar", "Piano",
  "Keys", "Strings", "Brass", "Woodwinds", "Percussion", "Vocals",
  "Pad", "Lead Synth", "808", "Sub Bass", "Hi-Hat", "Snare", "Kick",
  "Cymbals", "Bell", "Choir", "Organ", "Harp",
];

export const LYRIC_THEMES = [
  "Love", "Heartbreak", "Freedom", "Party", "Empowerment", "Money",
  "Faith", "Politics", "Nostalgia", "Friendship", "Family", "Loss",
  "Hope", "Struggle", "Success", "Loyalty", "Betrayal", "Self-Doubt",
  "Confidence", "Romance", "Sex", "Travel", "Identity", "Spirituality",
];

export const MOOD_FEEL = [
  "Confident", "Moody", "Uplifting", "Aggressive", "Sensual",
  "Melancholic", "Triumphant", "Chill", "Hype", "Dark", "Bright",
  "Sad", "Happy", "Angry", "Romantic", "Mysterious", "Playful",
  "Tense", "Peaceful", "Powerful", "Dreamy", "Edgy", "Smooth", "Raw",
];

export const TEMPO_DESCRIPTORS = ["Slow", "Mid", "Fast"];

export const SYNC_TAGS = [
  "Trailer", "Workout", "Wedding", "Drama", "Comedy", "Action",
  "Documentary", "Lifestyle", "Sport", "Travel", "Fashion", "Tech",
  "Automotive", "Food", "Beauty", "Corporate", "Holiday", "Summer",
  "Winter", "Nightlife", "Party", "Romantic Scene", "Tense Scene",
  "Inspirational", "Comedic Moment", "Emotional Climax", "Opening Credits",
  "End Credits", "Montage", "Chase Scene",
];

export type TagCategory = "instruments" | "lyric_themes" | "mood_feel" | "tempo_descriptor" | "sync_tags" | "custom";

export interface TrackTags {
  instruments?: string[];
  lyric_themes?: string[];
  mood_feel?: string[];
  tempo_descriptor?: string | null;
  sync_tags?: string[];
  custom?: string[];
}
