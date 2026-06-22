import { useState, useEffect, type ComponentType } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Pencil, Send, Trash2, Mail, MapPin, Briefcase, Music2, Activity, ChevronRight, ChevronDown, ChevronUp, Download } from "lucide-react";
import type { Contact } from "@/contexts/ContactsContext";

const COLLAB_PREVIEW_LIMIT = 5;

export interface ContactTrackPreview {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string;
}

interface ContactDetailSheetProps {
  contact: Contact | null;
  onClose: () => void;
  onEdit: (contact: Contact) => void;
  onPitch: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  onDownload: (contact: Contact, displayRoles: string[]) => void;
  isAdmin: boolean;
  contactTracks: ContactTrackPreview[];
  displayRoles: string[];
  onTrackClick: (trackId: string) => void;
  formatLastInteraction: (iso: string) => string;
}

function Initials({ firstName, lastName }: { firstName: string; lastName: string }) {
  const a = (firstName?.[0] || "?").toUpperCase();
  const b = (lastName?.[0] || "").toUpperCase();
  return (
    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center text-base font-bold text-white shrink-0">
      {a}{b}
    </div>
  );
}

function SectionHeader({ icon: Icon, label }: { icon: ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground break-words">{children}</span>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span key={i} className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-foreground">
          {i}
        </span>
      ))}
    </div>
  );
}

export function ContactDetailSheet({
  contact, onClose, onEdit, onPitch, onDelete, onDownload, isAdmin,
  contactTracks, displayRoles, onTrackClick, formatLastInteraction,
}: ContactDetailSheetProps) {
  const [showAllTracks, setShowAllTracks] = useState(false);
  const contactId = contact?.id ?? "";
  useEffect(() => { setShowAllTracks(false); }, [contactId]);

  if (!contact) {
    return (
      <Sheet open={false} onOpenChange={() => onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-md" />
      </Sheet>
    );
  }
  const c = contact;
  const publisherChips = (c.publisher || "").split(",").map((s) => s.trim()).filter(Boolean);
  const proChips = (c.pro || "").split(",").map((s) => s.trim()).filter(Boolean);
  const locationStr = [c.city?.trim(), c.country?.trim()].filter(Boolean).join(", ");
  const hasIndustry = displayRoles.length > 0 || !!c.organization || publisherChips.length > 0 || !!c.ipi?.trim() || proChips.length > 0;

  return (
    <Sheet open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="!max-w-md w-full p-0 overflow-y-auto">
        {/* Header (shadcn Sheet auto-injects a close X in the top-right corner) */}
        <div className="p-5 border-b border-border/40">
          <div className="flex items-start gap-3 pr-8">
            <Initials firstName={c.firstName} lastName={c.lastName} />
            <div className="flex-1 min-w-0 pt-1">
              <h2 className="text-lg font-bold text-foreground truncate">{c.firstName} {c.lastName}</h2>
              {c.stageName?.trim() && (
                <p className="text-sm text-muted-foreground truncate">{c.stageName}</p>
              )}
            </div>
          </div>
        </div>

        {/* Contact section */}
        <div className="p-5 border-b border-border/40 space-y-3">
          <SectionHeader icon={Mail} label="Contact" />
          {c.email && <Row label="Email">{c.email}</Row>}
          {c.phone?.trim() && <Row label="Phone"><span className="font-mono">{c.phone}</span></Row>}
          {locationStr && <Row label="Location"><span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-muted-foreground" />{locationStr}</span></Row>}
        </div>

        {/* Industry section — only if at least one industry field is set */}
        {hasIndustry && (
          <div className="p-5 border-b border-border/40 space-y-3">
            <SectionHeader icon={Briefcase} label="Industry" />
            {displayRoles.length > 0 && <Row label="Roles"><Chips items={displayRoles} /></Row>}
            {c.organization && <Row label="Organization">{c.organization}</Row>}
            {publisherChips.length > 0 && <Row label="Publisher"><Chips items={publisherChips} /></Row>}
            {c.ipi?.trim() && <Row label="IPI"><span className="font-mono">{c.ipi}</span></Row>}
            {proChips.length > 0 && <Row label="PROs"><Chips items={proChips} /></Row>}
          </div>
        )}

        {/* Collaborations section */}
        <div className="p-5 border-b border-border/40 space-y-3">
          <SectionHeader icon={Music2} label={`Collaborations (${contactTracks.length})`} />
          {contactTracks.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No catalog appearances yet.</p>
          ) : (() => {
            const needsCollapse = contactTracks.length > COLLAB_PREVIEW_LIMIT;
            const visible = needsCollapse && !showAllTracks
              ? contactTracks.slice(0, COLLAB_PREVIEW_LIMIT)
              : contactTracks;
            const listClass = showAllTracks && needsCollapse
              ? "space-y-1.5 max-h-80 overflow-y-auto pr-1"
              : "space-y-1.5";
            return (
              <>
                <div className={listClass}>
                  {visible.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onTrackClick(t.id)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors text-left group"
                    >
                      {t.coverUrl ? (
                        <img src={t.coverUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-brand-orange via-brand-pink to-brand-purple shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                        {t.artist && <p className="text-xs text-muted-foreground truncate">{t.artist}</p>}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
                {needsCollapse && (
                  <button
                    onClick={() => setShowAllTracks((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs text-brand-orange hover:underline mt-2"
                  >
                    {showAllTracks ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        View all {contactTracks.length} tracks
                      </>
                    )}
                  </button>
                )}
              </>
            );
          })()}
        </div>

        {/* Engagement section */}
        <div className="p-5 border-b border-border/40 space-y-2">
          <SectionHeader icon={Activity} label="Engagement" />
          <p className="text-sm text-foreground">
            {c.tracksEngaged} {c.tracksEngaged === 1 ? "track" : "tracks"} · {c.totalDownloads} {c.totalDownloads === 1 ? "download" : "downloads"}
          </p>
          {c.lastInteraction && (
            <p className="text-xs text-muted-foreground">Last interaction: {formatLastInteraction(c.lastInteraction)}</p>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-5 flex items-center flex-wrap gap-2 sticky bottom-0 bg-background border-t border-border/40">
          <button
            onClick={() => onDownload(c, displayRoles)}
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            aria-label="Download contact card"
            title="Download contact card (PDF)"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(c)}
            className="flex-1 min-w-[90px] inline-flex items-center justify-center gap-1.5 h-10 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            onClick={() => onPitch(c)}
            className="flex-1 min-w-[130px] inline-flex items-center justify-center gap-1.5 h-10 rounded-lg text-sm font-semibold btn-brand"
          >
            <Send className="w-3.5 h-3.5" />
            Send Pitch
          </button>
          {isAdmin && (
            <button
              onClick={() => onDelete(c)}
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Delete contact"
              title="Delete contact"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
