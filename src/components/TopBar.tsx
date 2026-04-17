import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Search, Bell, Menu, X, Music, ListMusic, User, Sparkles, Radio } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UserMenu } from "./UserMenu";
import { FirstUseTooltip } from "@/components/FirstUseTooltip";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import { useTrack } from "@/contexts/TrackContext";
import { usePlaylists } from "@/contexts/PlaylistContext";
import { motion, AnimatePresence } from "framer-motion";
import trakalogLogo from "@/assets/trakalog-logo.png";

interface TopBarProps {
  onMenuClick?: () => void;
}

interface Suggestion {
  type: "track" | "artist" | "playlist";
  label: string;
  sub?: string;
  route: string;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tracks } = useTrack();
  const { playlists } = usePlaylists();
  const [searchValue, setSearchValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build suggestion list
  const suggestions = useMemo<Suggestion[]>(() => {
    const q = searchValue.toLowerCase().trim();
    if (q.length < 2) return [];

    const results: Suggestion[] = [];
    const seen = new Set<string>();

    // Tracks
    tracks.forEach((tr) => {
      if (tr.title.toLowerCase().includes(q) && !seen.has(`t-${tr.id}`)) {
        seen.add(`t-${tr.id}`);
        results.push({ type: "track", label: tr.title, sub: tr.artist, route: `/track/${tr.id}` });
      }
    });

    // Artists (deduplicated)
    tracks.forEach((tr) => {
      const key = `a-${tr.artist.toLowerCase()}`;
      if (tr.artist.toLowerCase().includes(q) && !seen.has(key)) {
        seen.add(key);
        results.push({ type: "artist", label: tr.artist, sub: `${tracks.filter((t) => t.artist === tr.artist).length} tracks`, route: `/tracks?q=${encodeURIComponent(tr.artist)}` });
      }
    });

    // Playlists
    playlists.forEach((pl) => {
      if (pl.name.toLowerCase().includes(q) && !seen.has(`p-${pl.id}`)) {
        seen.add(`p-${pl.id}`);
        results.push({ type: "playlist", label: pl.name, sub: `${pl.tracks} tracks`, route: `/playlist/${pl.id}` });
      }
    });

    return results.slice(0, 8);
  }, [searchValue, tracks, playlists]);

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
      } else if (searchValue.trim()) {
        navigate(`/tracks?q=${encodeURIComponent(searchValue.trim())}`);
        setSearchValue("");
        setShowSuggestions(false);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  }, [selectedIdx, suggestions, searchValue, navigate, handleSelect]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    setShowSuggestions(true);
    setSelectedIdx(-1);
  }, []);

  const iconMap = {
    track: Music,
    artist: User,
    playlist: ListMusic,
  };

  const typeLabel = {
    track: "Track",
    artist: "Artist",
    playlist: "Playlist",
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
            <span className="text-sm font-bold tracking-tight gradient-text">TRAKALOG</span>
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
                value={searchValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={() => searchValue.length >= 2 && setShowSuggestions(true)}
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
                  <div className="py-1">
                    {suggestions.map((s, idx) => {
                      const Icon = iconMap[s.type];
                      const isSelected = idx === selectedIdx;
                      return (
                        <button
                          key={`${s.type}-${s.label}-${idx}`}
                          onClick={() => handleSelect(s)}
                          onMouseEnter={() => setSelectedIdx(idx)}
                          className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
                            isSelected ? "bg-secondary/80" : "hover:bg-secondary/40"
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            s.type === "track" ? "bg-primary/10 text-primary" :
                            s.type === "artist" ? "bg-brand-pink/10 text-brand-pink" :
                            "bg-brand-purple/10 text-brand-purple"
                          }`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-foreground truncate">{s.label}</p>
                            {s.sub && <p className="text-[11px] text-muted-foreground truncate">{s.sub}</p>}
                          </div>
                          <span className="text-[10px] text-muted-foreground/50 font-medium uppercase tracking-wider shrink-0">
                            {typeLabel[s.type]}
                          </span>
                        </button>
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
          className="p-2 rounded-lg hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] hidden sm:flex items-center justify-center"
        >
          <Sparkles className="w-[17px] h-[17px]" />
        </button>
        <button
          onClick={() => navigate("/radio")}
          title="Radio"
          data-tour="header-radio"
          className="p-2 rounded-lg hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] hidden sm:flex items-center justify-center"
        >
          <Radio className="w-[17px] h-[17px]" />
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
