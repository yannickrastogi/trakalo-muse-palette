import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Search, Bell, HelpCircle, Menu, X, Music, ListMusic, User, Sparkles, Radio, Users, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UserMenu } from "./UserMenu";
import { FirstUseTooltip } from "@/components/FirstUseTooltip";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import { useTrack } from "@/contexts/TrackContext";
import { usePlaylists } from "@/contexts/PlaylistContext";
import { useContacts } from "@/contexts/ContactsContext";
import { usePitches } from "@/contexts/PitchContext";
import { FEATURES } from "@/config/features";
import { motion, AnimatePresence } from "framer-motion";
import trakalogLogo from "@/assets/trakalog-logo.png";

interface TopBarProps {
  onMenuClick?: () => void;
}

type SuggestionType = "contact_view" | "contact_tracks" | "track" | "playlist" | "pitch";
type SuggestionSection = "people" | "tracks" | "playlists" | "pitches";

interface Suggestion {
  type: SuggestionType;
  section: SuggestionSection;
  label: string;
  sub?: string;
  route: string;
}

const SECTION_ORDER: SuggestionSection[] = ["people", "tracks", "playlists", "pitches"];
const SECTION_TITLE: Record<SuggestionSection, string> = {
  people: "People",
  tracks: "Tracks",
  playlists: "Playlists",
  pitches: "Pitches",
};
const SECTION_CAP: Record<SuggestionSection, number> = { people: 6, tracks: 5, playlists: 5, pitches: 5 };

export function TopBar({ onMenuClick }: TopBarProps) {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tracks } = useTrack();
  const { playlists } = usePlaylists();
  const { contacts } = useContacts();
  const { pitches } = usePitches();
  const [searchValue, setSearchValue] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build suggestion list — multi-entity catch-all (People + Tracks + Playlists + Pitches)
  const suggestions = useMemo<Suggestion[]>(() => {
    const q = searchValue.toLowerCase().trim();
    if (q.length < 2) return [];

    const bySection: Record<SuggestionSection, Suggestion[]> = {
      people: [],
      tracks: [],
      playlists: [],
      pitches: [],
    };
    const seenContact = new Set<string>();
    const seenTrack = new Set<string>();

    // People (Contacts) → 2 shortcuts per match: "See contact" + "See all tracks with"
    for (const c of contacts) {
      const first = (c.firstName || "").toLowerCase();
      const last = (c.lastName || "").toLowerCase();
      const stage = (c.stageName || "").toLowerCase();
      const full = (first + " " + last).trim();
      if (!full && !stage) continue;
      if (!(first.includes(q) || last.includes(q) || stage.includes(q) || full.includes(q))) continue;
      const displayName = ((c.firstName || "") + " " + (c.lastName || "")).trim() || c.stageName || c.email;
      const key = (displayName || c.id).toLowerCase();
      if (seenContact.has(key)) continue;
      seenContact.add(key);
      bySection.people.push({
        type: "contact_view",
        section: "people",
        label: "See contact: " + displayName,
        sub: c.stageName && c.stageName.toLowerCase() !== displayName.toLowerCase() ? c.stageName : (c.email || c.organization || undefined),
        route: "/contacts?focus=" + encodeURIComponent(c.id),
      });
      bySection.people.push({
        type: "contact_tracks",
        section: "people",
        label: "See all tracks with " + displayName,
        sub: "Songwriter · Producer · Artist · Musician",
        route: "/tracks?person=" + encodeURIComponent(displayName),
      });
      if (bySection.people.length >= SECTION_CAP.people) break;
    }

    // Tracks → match title, artist, splits[].name, splits[].stage_name
    for (const tr of tracks) {
      if (!tr.uuid) continue;
      if (seenTrack.has(tr.uuid)) continue;
      const title = (tr.title || "").toLowerCase();
      const artist = (tr.artist || "").toLowerCase();
      let matched = title.includes(q) || artist.includes(q);
      if (!matched && Array.isArray(tr.splits)) {
        matched = tr.splits.some((s) => {
          const n = (s?.name || "").toLowerCase();
          const sn = (s?.stage_name || "").toLowerCase();
          return n.includes(q) || sn.includes(q);
        });
      }
      if (!matched && tr.credits && typeof tr.credits === "object") {
        // credits = Record<string, string[]> (e.g. vocalsBy, drumsBy, synthsBy…)
        matched = Object.values(tr.credits).some((names) =>
          Array.isArray(names) && names.some((n) => (n || "").toLowerCase().includes(q))
        );
      }
      if (!matched) continue;
      seenTrack.add(tr.uuid);
      bySection.tracks.push({
        type: "track",
        section: "tracks",
        label: tr.title,
        sub: tr.artist,
        route: "/track/" + tr.uuid,
      });
      if (bySection.tracks.length >= SECTION_CAP.tracks) break;
    }

    // Playlists → match name
    for (const pl of playlists) {
      if (!(pl.name || "").toLowerCase().includes(q)) continue;
      bySection.playlists.push({
        type: "playlist",
        section: "playlists",
        label: pl.name,
        sub: pl.tracks + " tracks",
        route: "/playlist/" + pl.id,
      });
      if (bySection.playlists.length >= SECTION_CAP.playlists) break;
    }

    // Pitches → match recipient name/email/company + subject (itemName)
    if (FEATURES.PITCH_ENABLED) for (const p of pitches) {
      const rn = (p.recipientName || "").toLowerCase();
      const re = (p.recipientEmail || "").toLowerCase();
      const rc = (p.recipientCompany || "").toLowerCase();
      const subj = (p.itemName || "").toLowerCase();
      if (!(rn.includes(q) || re.includes(q) || rc.includes(q) || subj.includes(q))) continue;
      const niceLabel = p.itemName || p.recipientName || "Pitch";
      const niceSub = [p.recipientName, p.recipientCompany].filter(Boolean).join(" · ") || p.recipientEmail || undefined;
      bySection.pitches.push({
        type: "pitch",
        section: "pitches",
        label: niceLabel,
        sub: niceSub,
        route: "/pitch?focus=" + encodeURIComponent(p.id),
      });
      if (bySection.pitches.length >= SECTION_CAP.pitches) break;
    }

    return SECTION_ORDER.flatMap((s) => bySection[s]);
  }, [searchValue, tracks, playlists, contacts, pitches]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = useCallback((suggestion: Suggestion) => {
    setSearchValue("");
    setSearchInput("");
    clearTimeout(searchTimerRef.current);
    setShowSuggestions(false);
    setSelectedIdx(-1);
    navigate(suggestion.route);
  }, [navigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      if (selectedIdx >= 0 && suggestions[selectedIdx]) {
        handleSelect(suggestions[selectedIdx]);
      } else if (searchInput.trim()) {
        navigate(`/tracks?q=${encodeURIComponent(searchInput.trim())}`);
        setSearchValue("");
        setSearchInput("");
        clearTimeout(searchTimerRef.current);
        setShowSuggestions(false);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  }, [selectedIdx, suggestions, searchInput, navigate, handleSelect]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setShowSuggestions(true);
    setSelectedIdx(-1);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setSearchValue(e.target.value), 300);
  }, []);

  const iconMap: Record<SuggestionType, typeof Music> = {
    contact_view: User,
    contact_tracks: Music,
    track: Music,
    playlist: ListMusic,
    pitch: Target,
  };

  const sectionIcon: Record<SuggestionSection, typeof Music> = {
    people: Users,
    tracks: Music,
    playlists: ListMusic,
    pitches: Target,
  };

  const tone: Record<SuggestionSection, string> = {
    people: "bg-brand-pink/10 text-brand-pink",
    tracks: "bg-primary/10 text-primary",
    playlists: "bg-brand-purple/10 text-brand-purple",
    pitches: "bg-brand-orange/10 text-brand-orange",
  };

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <header className="h-14 flex items-center justify-between px-3 sm:px-6 glass sticky top-0 z-20" style={{ borderBottom: '1px solid transparent', borderImage: 'linear-gradient(90deg, hsl(24 100% 55% / 0.15), hsl(330 80% 60% / 0.1), hsl(270 70% 55% / 0.05), transparent) 1' }}>
      {/* Left: Logo (mobile) or Search (desktop) */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Mobile logo */}
        {isMobile && !mobileSearchOpen && (
          <div className="flex items-center gap-2 shrink-0">
            <img src={trakalogLogo} alt="Trakalog" className="w-8 h-8 rounded-lg object-contain" />
            <span className="text-sm font-bold tracking-tight text-white">TRAKALOG</span>
          </div>
        )}

        {/* Search — always visible on desktop, expandable on mobile */}
        {(!isMobile || mobileSearchOpen) && (
          <FirstUseTooltip id="search-bar" message="Search tracks, artists, and playlists instantly" position="bottom">
          <div className={"relative " + (isMobile ? "w-full" : "w-full max-w-md")} ref={wrapperRef} data-tour="search-bar">
            <div className="flex items-center gap-2.5 bg-secondary/50 rounded-lg px-3.5 py-2 w-full border border-border/50 focus-within:border-primary/30 transition-all">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchInput}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={() => searchInput.length >= 2 && setShowSuggestions(true)}
                placeholder={isMobile ? t("topbar.searchShort") : t("topbar.search")}
                className="bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none w-full font-medium"
                autoFocus={isMobile && mobileSearchOpen}
              />
              {searchValue ? (
                <button onClick={() => { setSearchValue(""); setShowSuggestions(false); }} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : isMobile ? (
                <button onClick={() => { setMobileSearchOpen(false); setSearchValue(""); setShowSuggestions(false); }} className="text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex text-2xs text-muted-foreground/40 bg-muted/40 px-1.5 py-0.5 rounded font-mono leading-none border border-border/50">
                  ⌘K
                </kbd>
              )}
            </div>

            {/* Suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 top-full mt-1.5 bg-card border border-border rounded-xl overflow-hidden z-50"
                  style={{ boxShadow: "var(--shadow-elevated, 0 8px 30px -8px rgba(0,0,0,0.5))" }}
                >
                  <div className="py-1 max-h-[420px] overflow-y-auto">
                    {SECTION_ORDER.map((section) => {
                      const items = suggestions.filter((s) => s.section === section);
                      if (items.length === 0) return null;
                      const SectionIcon = sectionIcon[section];
                      return (
                        <div key={section}>
                          <div className="flex items-center gap-1.5 px-3.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                            <SectionIcon className="w-3 h-3" />
                            {SECTION_TITLE[section]}
                          </div>
                          {items.map((s) => {
                            const idx = suggestions.indexOf(s);
                            const Icon = iconMap[s.type];
                            const isSelected = idx === selectedIdx;
                            return (
                              <button
                                key={`${s.section}-${s.type}-${s.route}-${idx}`}
                                onClick={() => handleSelect(s)}
                                onMouseEnter={() => setSelectedIdx(idx)}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
                                  isSelected ? "bg-secondary/80" : "hover:bg-secondary/40"
                                }`}
                              >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tone[s.section]}`}>
                                  <Icon className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-medium text-foreground truncate">{s.label}</p>
                                  {s.sub && <p className="text-[11px] text-muted-foreground truncate">{s.sub}</p>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-3.5 py-2 border-t border-border/50 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      <kbd className="px-1 py-0.5 rounded bg-muted/40 border border-border/50 font-mono text-[9px] mr-1">↑↓</kbd>
                      navigate
                      <kbd className="px-1 py-0.5 rounded bg-muted/40 border border-border/50 font-mono text-[9px] mx-1">↵</kbd>
                      select
                    </span>
                    <span className="text-[10px] text-muted-foreground">{suggestions.length} result{suggestions.length !== 1 ? "s" : ""}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          </FirstUseTooltip>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 ml-2 sm:ml-4">
        {/* Mobile search trigger */}
        {isMobile && !mobileSearchOpen && (
          <button
            onClick={() => setMobileSearchOpen(true)}
            className="p-2 rounded-lg hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Search className="w-[17px] h-[17px]" />
          </button>
        )}
        <button
          onClick={() => navigate("/smart-ar")}
          title="Smart A&R"
          data-tour="header-smart-ar"
          className="p-2 rounded-lg hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] hidden sm:flex items-center justify-center gap-1"
        >
          <Sparkles className="w-[17px] h-[17px] shrink-0" />
          <span className="hidden md:inline text-xs">Smart A&R</span>
        </button>
        <button
          onClick={() => navigate("/radio")}
          title="Radio"
          data-tour="header-radio"
          className="p-2 rounded-lg hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] hidden sm:flex items-center justify-center gap-1"
        >
          <Radio className="w-[17px] h-[17px] shrink-0" />
          <span className="hidden md:inline text-xs">Radio</span>
        </button>
        <button
          onClick={() => navigate("/guide")}
          title="Help & Guide"
          className="p-2 rounded-lg hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] hidden sm:flex items-center justify-center"
        >
          <HelpCircle className="w-[17px] h-[17px]" />
        </button>
        <button
          onClick={() => navigate("/notifications")}
          data-tour="header-notifications"
          className="relative p-2 rounded-lg hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <Bell className="w-[17px] h-[17px]" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full ring-2 ring-background" style={{ background: 'var(--gradient-brand-horizontal)' }} />
        </button>
        <div className="hidden sm:block">
          <LanguageSwitcher />
        </div>
        <div className="w-px h-6 bg-border/60 mx-0.5 sm:mx-1 hidden sm:block" />
        <UserMenu />
      </div>
    </header>
  );
}
