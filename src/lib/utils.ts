import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalise une taille de fichier (octets) en entier >= 0 sûr à envoyer aux RPC
 * de stockage (insert_track, add_track_version…). La valeur vient TOUJOURS du
 * fichier réel (File.size), jamais d'une saisie. NaN / undefined / non-fini /
 * négatif -> 0 : en cas de doute on préfère 0 à une valeur fausse (le serveur
 * re-normalise de toute façon via GREATEST(COALESCE(v,0),0)).
 */
export function sanitizeFileSizeBytes(size: unknown): number {
  const n = typeof size === "number" ? size : Number(size);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}
