import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

// Square-crop-before-upload modal. Pure frontend, native <canvas>, no new deps.
// The crop region always fills the frame (min zoom = cover) so the output is never
// letterboxed. Export is a fixed-resolution square JPEG File that replaces the
// original File passed to the existing upload flow.
const OUTPUT_SIZE = 1000; // exported square resolution (px)
const MAX_ZOOM = 3;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageFile: File | null;
  onCropped: (file: File) => void;
}

export function ImageCropperModal({ open, onOpenChange, imageFile, onCropped }: Props) {
  const { t } = useTranslation();
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgElRef = useRef<HTMLImageElement | null>(null); // decoded image for canvas draw
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const [src, setSrc] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [viewport, setViewport] = useState(288); // measured square size (px)
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Load the File into an object URL + a decoded HTMLImageElement (natural size + draw source).
  useEffect(() => {
    if (!imageFile) { setSrc(null); setNat(null); imgElRef.current = null; return; }
    const url = URL.createObjectURL(imageFile);
    setSrc(url);
    const img = new Image();
    img.onload = () => { imgElRef.current = img; setNat({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.onerror = () => { onOpenChange(false); }; // undecodable → bail without cropping
    img.src = url;
    return () => { URL.revokeObjectURL(url); };
  }, [imageFile, onOpenChange]);

  // Measure the actual square size when opening / after the image is known.
  useLayoutEffect(() => {
    if (open && viewportRef.current) {
      const w = viewportRef.current.clientWidth;
      if (w > 0) setViewport(w);
    }
  }, [open, nat]);

  const coverScale = nat ? Math.max(viewport / nat.w, viewport / nat.h) : 1;
  const dispW = nat ? nat.w * coverScale * zoom : viewport;
  const dispH = nat ? nat.h * coverScale * zoom : viewport;

  // Keep the image covering the frame at all times (no empty bands).
  const clamp = useCallback(
    (x: number, y: number, w: number, h: number) => ({
      x: Math.min(0, Math.max(viewport - w, x)),
      y: Math.min(0, Math.max(viewport - h, y)),
    }),
    [viewport],
  );

  // Re-center (cover, zoom 1) whenever a new image loads or the frame is remeasured.
  useEffect(() => {
    if (!nat) return;
    const dw = nat.w * coverScale;
    const dh = nat.h * coverScale;
    setZoom(1);
    setOffset({ x: (viewport - dw) / 2, y: (viewport - dh) / 2 });
    // coverScale is derived from nat + viewport; those are the real deps.
  }, [nat, viewport]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zoom toward the frame center, then re-clamp.
  const applyZoom = useCallback(
    (z: number) => {
      if (!nat) return;
      const newZ = Math.max(1, Math.min(MAX_ZOOM, z));
      const oldDw = nat.w * coverScale * zoom;
      const oldDh = nat.h * coverScale * zoom;
      const newDw = nat.w * coverScale * newZ;
      const newDh = nat.h * coverScale * newZ;
      const cx = (viewport / 2 - offset.x) / oldDw;
      const cy = (viewport / 2 - offset.y) / oldDh;
      const c = clamp(viewport / 2 - cx * newDw, viewport / 2 - cy * newDh, newDw, newDh);
      setZoom(newZ);
      setOffset(c);
    },
    [nat, coverScale, zoom, offset, viewport, clamp],
  );

  // Non-passive wheel zoom (React onWheel is passive → can't preventDefault reliably).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !open) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); applyZoom(zoom - e.deltaY * 0.0015 * zoom); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open, applyZoom, zoom]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const c = clamp(
      dragRef.current.ox + (e.clientX - dragRef.current.sx),
      dragRef.current.oy + (e.clientY - dragRef.current.sy),
      dispW,
      dispH,
    );
    setOffset(c);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const handleSave = () => {
    const img = imgElRef.current;
    if (!img || !nat) return;
    const dispScale = coverScale * zoom; // display px per source px
    const sxSrc = -offset.x / dispScale;
    const sySrc = -offset.y / dispScale;
    const sSize = viewport / dispScale; // square region in source px
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sxSrc, sySrc, sSize, sSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const base = imageFile?.name?.replace(/\.[^.]+$/, "") || "cover";
        onCropped(new File([blob], base + ".jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("imageCropper.title")}</DialogTitle>
          <DialogDescription>{t("imageCropper.instruction")}</DialogDescription>
        </DialogHeader>

        <div className="mx-auto w-full max-w-[320px]">
          <div
            ref={viewportRef}
            className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-black/40 touch-none select-none cursor-grab active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {src && nat && (
              <img
                src={src}
                alt=""
                draggable={false}
                className="absolute max-w-none select-none pointer-events-none"
                style={{ left: offset.x, top: offset.y, width: dispW, height: dispH }}
              />
            )}
            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/40" />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="shrink-0 text-xs text-muted-foreground">{t("imageCropper.zoom")}</span>
            <Slider
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={[zoom]}
              onValueChange={(v) => applyZoom(v[0])}
              className="flex-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t("imageCropper.cancel")}</Button>
          <Button onClick={handleSave} disabled={!nat}>{t("imageCropper.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
