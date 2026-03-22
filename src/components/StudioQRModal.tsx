import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Download, QrCode, Users } from "lucide-react";
import QRCode from "react-qr-code";
import { supabase } from "@/integrations/supabase/client";

interface StudioQRModalProps {
  open: boolean;
  onClose: () => void;
  trackId: string;
  trackTitle: string;
  trackArtist: string;
}

export function StudioQRModal({ open, onClose, trackId, trackTitle, trackArtist }: StudioQRModalProps) {
  const { t } = useTranslation();
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(function () {
    if (!open || !trackId) return;
    setLoading(true);

    // Check if track already has a qr_token, if not generate one
    supabase
      .from("tracks")
      .select("qr_token")
      .eq("id", trackId)
      .single()
      .then(function (res) {
        if (res.data && res.data.qr_token) {
          setQrToken(res.data.qr_token);
          fetchSubmissions(trackId);
        } else {
          // Generate new token
          var token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").substring(0, 8);
          supabase
            .from("tracks")
            .update({ qr_token: token })
            .eq("id", trackId)
            .then(function (updateRes) {
              if (!updateRes.error) {
                setQrToken(token);
              }
              setLoading(false);
            });
        }
      });
  }, [open, trackId]);

  var fetchSubmissions = useCallback(function (tId: string) {
    supabase
      .from("studio_submissions")
      .select("id", { count: "exact" })
      .eq("track_id", tId)
      .then(function (res) {
        setSubmissionCount(res.count || 0);
        setLoading(false);
      });
  }, []);

  var studioUrl = qrToken ? window.location.origin + "/studio/" + qrToken : "";

  var handleCopy = useCallback(function () {
    if (studioUrl) {
      navigator.clipboard.writeText(studioUrl);
      setCopied(true);
      setTimeout(function () { setCopied(false); }, 2000);
    }
  }, [studioUrl]);

  var handleDownload = useCallback(function () {
    if (!qrRef.current) return;
    var svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    var canvas = document.createElement("canvas");
    var size = 512;
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    var svgData = new XMLSerializer().serializeToString(svg);
    var img = new Image();
    img.onload = function () {
      ctx.drawImage(img, 0, 0, size, size);
      var link = document.createElement("a");
      link.download = trackTitle.replace(/[^a-zA-Z0-9]/g, "_") + "_studio_qr.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }, [trackTitle]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center p-0 md:p-4"
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="relative z-10 w-full md:max-w-md bg-card border border-border rounded-t-2xl md:rounded-2xl overflow-hidden max-h-[95dvh] md:max-h-[90vh] flex flex-col"
            style={{ boxShadow: "var(--shadow-elevated)" }}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-brand-orange" />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{t("studioQr.title")}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{trackTitle} — {trackArtist}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <p className="text-xs text-muted-foreground text-center">{t("studioQr.description")}</p>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : qrToken ? (
                <>
                  {/* QR Code */}
                  <div ref={qrRef} className="flex items-center justify-center p-6 bg-white rounded-xl">
                    <QRCode value={studioUrl} size={200} level="H" />
                  </div>

                  {/* URL */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground font-mono truncate">
                      {studioUrl}
                    </div>
                    <button
                      onClick={handleCopy}
                      className="shrink-0 px-3 py-2.5 rounded-lg text-xs font-semibold btn-brand flex items-center gap-1.5 min-h-[44px]"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? t("studioQr.copied") : t("studioQr.copyLink")}
                    </button>
                  </div>

                  {/* Download QR */}
                  <button
                    onClick={handleDownload}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors min-h-[44px]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t("studioQr.downloadQr")}
                  </button>

                  {/* Submission count */}
                  <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary/50 border border-border">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">
                      {submissionCount > 0
                        ? t("studioQr.submissions", { count: submissionCount, total: submissionCount })
                        : t("studioQr.noSubmissions")}
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
