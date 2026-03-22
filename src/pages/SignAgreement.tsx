import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { DEFAULT_COVER } from "@/lib/constants";
import trakalogLogo from "@/assets/trakalog-logo.png";
import SignatureCanvas from "react-signature-canvas";
import { CheckCircle, AlertCircle, Loader2, Eraser, FileSignature } from "lucide-react";

var anonClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

interface SignatureRequest {
  id: string;
  track_id: string;
  collaborator_name: string;
  collaborator_email: string;
  role: string;
  split_share: number;
  pro: string;
  ipi: string;
  publisher: string;
  token: string;
  status: string;
  signature_data: string | null;
  signed_at: string | null;
}

interface AllSplit {
  collaborator_name: string;
  role: string;
  split_share: number;
  pro: string;
  ipi: string;
  publisher: string;
  collaborator_email: string;
}

interface TrackInfo {
  title: string;
  artist: string;
  cover_url: string | null;
}

export default function SignAgreement() {
  var { token } = useParams();
  var { t } = useTranslation();

  var [loading, setLoading] = useState<boolean>(true);
  var [error, setError] = useState<string | null>(null);
  var [request, setRequest] = useState<SignatureRequest | null>(null);
  var [trackInfo, setTrackInfo] = useState<TrackInfo | null>(null);
  var [allSplits, setAllSplits] = useState<AllSplit[]>([]);
  var [agreed, setAgreed] = useState<boolean>(false);
  var [signing, setSigning] = useState<boolean>(false);
  var [signed, setSigned] = useState<boolean>(false);
  var [sigError, setSigError] = useState<string | null>(null);
  var sigRef = useRef<SignatureCanvas>(null);

  useEffect(function () {
    async function load() {
      try {
        var { data: reqData, error: reqErr } = await anonClient
          .from("signature_requests")
          .select("*")
          .eq("token", token)
          .single();

        if (reqErr || !reqData) {
          setError(t("signature.invalidToken"));
          setLoading(false);
          return;
        }

        var req = reqData as SignatureRequest;
        setRequest(req);

        if (req.status === "signed") {
          setSigned(true);
        }

        var { data: trackData } = await anonClient
          .from("tracks")
          .select("title, artist, cover_url")
          .eq("id", req.track_id)
          .single();

        if (trackData) {
          setTrackInfo(trackData as TrackInfo);
        }

        var { data: splitsData } = await anonClient
          .from("signature_requests")
          .select("collaborator_name, role, split_share, pro, ipi, publisher, collaborator_email")
          .eq("track_id", req.track_id)
          .order("split_share", { ascending: false });

        if (splitsData) {
          setAllSplits(splitsData as AllSplit[]);
        }
      } catch (e) {
        setError(t("signature.invalidToken"));
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      load();
    }
  }, [token]);

  async function handleSign() {
    setSigError(null);

    if (!sigRef.current || sigRef.current.isEmpty()) {
      setSigError(t("signature.signatureRequired"));
      return;
    }

    if (!request) return;

    setSigning(true);

    var base64 = sigRef.current.toDataURL("image/png");

    var { error: updateErr } = await anonClient
      .from("signature_requests")
      .update({
        status: "signed",
        signature_data: base64,
        signed_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (updateErr) {
      setSigError(updateErr.message);
      setSigning(false);
      return;
    }

    setSigning(false);
    setSigned(true);
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-orange" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-lg font-semibold text-destructive text-center">{error}</p>
      </div>
    );
  }

  // Already signed (before user action)
  if (signed && request && request.status === "signed" && request.signed_at) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-4">
        <CheckCircle className="w-16 h-16 text-green-500" />
        <h1 className="text-2xl font-bold">{t("signature.alreadySigned")}</h1>
        {trackInfo && (
          <div className="flex items-center gap-4">
            <img
              src={trackInfo.cover_url || DEFAULT_COVER}
              alt={trackInfo.title}
              className="w-16 h-16 rounded-xl object-cover"
            />
            <div>
              <p className="text-lg font-bold">{trackInfo.title}</p>
              <p className="text-sm text-muted-foreground">{trackInfo.artist}</p>
            </div>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {t("signature.signedOn", { date: new Date(request.signed_at).toLocaleDateString() })}
        </p>
      </div>
    );
  }

  // Success after signing
  if (signed) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          <CheckCircle className="w-20 h-20 text-green-500" />
        </motion.div>
        <h1 className="text-2xl font-bold">{t("signature.signatureSuccess")}</h1>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {t("signature.signatureSuccessDesc")}
        </p>
      </div>
    );
  }

  // Main signing view
  return (
    <div className="min-h-screen bg-background">
      {/* Nav header */}
      <nav className="sticky top-0 z-50 glass border-b border-border/40">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <img src={trakalogLogo} alt="Trakalog" className="w-8 h-8" />
          <span className="gradient-text font-bold">TRAKALOG</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Title */}
        <div className="text-center">
          <FileSignature className="w-10 h-10 text-brand-orange mx-auto mb-3" />
          <h1 className="text-2xl font-bold">{t("signature.splitAgreement")}</h1>
        </div>

        {/* Track info card */}
        {trackInfo && (
          <div className="card-premium p-5 flex items-center gap-4">
            <img
              src={trackInfo.cover_url || DEFAULT_COVER}
              alt={trackInfo.title}
              className="w-16 h-16 rounded-xl object-cover"
            />
            <div>
              <p className="text-lg font-bold">{trackInfo.title}</p>
              <p className="text-sm text-muted-foreground">{trackInfo.artist}</p>
            </div>
          </div>
        )}

        {/* Splits table */}
        <div className="card-premium overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">{t("signature.ownershipSplits")}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-2 text-left text-xs font-medium text-muted-foreground">{t("signature.name")}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{t("signature.role")}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{t("signature.share")}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">PRO</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">IPI</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{t("signature.publisher")}</th>
                </tr>
              </thead>
              <tbody>
                {allSplits.map(function (split) {
                  var isCurrentUser = split.collaborator_email === (request ? request.collaborator_email : "");
                  return (
                    <tr
                      key={split.collaborator_email}
                      className={isCurrentUser ? "bg-brand-orange/[0.08] border-l-2 border-brand-orange" : ""}
                    >
                      <td className="px-5 py-3 text-sm font-medium">
                        {split.collaborator_name}{" "}
                        {isCurrentUser && (
                          <span className="text-brand-orange text-xs">({t("signature.you")})</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm">{split.role}</td>
                      <td className="px-3 py-3 text-sm font-bold">{split.split_share + "%"}</td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">{split.pro || "\u2014"}</td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">{split.ipi || "\u2014"}</td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">{split.publisher || "\u2014"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legal text */}
        <div className="card-premium p-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("signature.legalText", { title: trackInfo ? trackInfo.title : "" })}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-3">
            {t("signature.disagreementNote")}
          </p>
        </div>

        {/* Signature canvas */}
        <div className="card-premium p-5">
          <p className="text-sm font-medium mb-3">{t("signature.drawSignature")}</p>
          <div className="border-2 border-dashed border-border rounded-xl overflow-hidden bg-white">
            <SignatureCanvas
              ref={sigRef}
              penColor="black"
              canvasProps={{ className: "w-full", style: { height: 200 } }}
            />
          </div>
          <button
            onClick={function () {
              if (sigRef.current) {
                sigRef.current.clear();
              }
            }}
            className="mt-2 text-xs text-muted-foreground flex items-center gap-1 min-h-[44px]"
          >
            <Eraser className="w-3 h-3" /> {t("signature.clearSignature")}
          </button>
        </div>

        {/* Agree checkbox */}
        <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={function (e) {
              setAgreed(e.target.checked);
            }}
            className="accent-brand-orange w-5 h-5"
          />
          <span className="text-sm">
            {t("signature.agreeTerms", { name: request ? request.collaborator_name : "" })}
          </span>
        </label>

        {sigError && (
          <p className="text-destructive text-sm">{sigError}</p>
        )}

        {/* Sign button */}
        <button
          onClick={handleSign}
          disabled={!agreed || signing}
          className="w-full btn-brand min-h-[44px] rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {signing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileSignature className="w-4 h-4" />
          )}
          {signing ? t("signature.signing") : t("signature.signAgreement")}
        </button>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/60">
          {t("signature.preparedBy")}
        </p>
      </div>
    </div>
  );
}
