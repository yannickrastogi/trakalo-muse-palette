"""
Sonic DNA Profiler — audio analysis engine.

Returns a comprehensive audio fingerprint including BPM, key, energy curve,
structure, mood, spectral features, intro clearance, and tempo stability.
"""

import numpy as np
import librosa


# Krumhansl-Kessler key profiles
_MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
_KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def _detect_key(y, sr):
    """Detect key and mode using chroma CQT + Krumhansl-Kessler correlation."""
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_avg = np.mean(chroma, axis=1)

    best_corr = -2.0
    best_key = 0
    best_mode = "Major"

    for shift in range(12):
        rolled = np.roll(chroma_avg, -shift)
        corr_maj = float(np.corrcoef(rolled, _MAJOR_PROFILE)[0, 1])
        corr_min = float(np.corrcoef(rolled, _MINOR_PROFILE)[0, 1])
        if corr_maj > best_corr:
            best_corr = corr_maj
            best_key = shift
            best_mode = "Major"
        if corr_min > best_corr:
            best_corr = corr_min
            best_key = shift
            best_mode = "Minor"

    confidence = max(0.0, min(1.0, (best_corr + 1.0) / 2.0))
    return {"key": _KEY_NAMES[best_key], "mode": best_mode, "confidence": round(confidence, 3)}


def _detect_bpm(y, sr):
    """Detect BPM with double/half correction."""
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    bpm = float(np.atleast_1d(tempo)[0])

    # Double/half correction for plausible range
    if bpm > 160:
        bpm /= 2.0
    elif bpm < 70:
        bpm *= 2.0

    # Confidence from beat strength consistency
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    if len(beat_times) > 2:
        intervals = np.diff(beat_times)
        median_interval = np.median(intervals)
        if median_interval > 0:
            deviations = np.abs(intervals - median_interval) / median_interval
            confidence = max(0.0, 1.0 - float(np.mean(deviations)))
        else:
            confidence = 0.5
    else:
        confidence = 0.3

    return {"bpm": round(bpm, 1), "confidence": round(confidence, 3)}, beat_frames


def _energy_curve(y, sr):
    """RMS energy resampled to 1 value per second, normalized 0-1."""
    rms = librosa.feature.rms(y=y)[0]
    hop_length = 512
    frames_per_sec = sr / hop_length
    duration_sec = int(len(y) / sr)
    if duration_sec < 1:
        return [0.0]

    curve = []
    for s in range(duration_sec):
        start_frame = int(s * frames_per_sec)
        end_frame = int((s + 1) * frames_per_sec)
        end_frame = min(end_frame, len(rms))
        if start_frame < len(rms):
            curve.append(float(np.mean(rms[start_frame:end_frame])))
        else:
            curve.append(0.0)

    max_val = max(curve) if curve else 1.0
    if max_val > 0:
        curve = [round(v / max_val, 3) for v in curve]
    return curve


def _detect_structure(y, sr, energy_curve_data):
    """Segment detection using onset strength peaks."""
    oenv = librosa.onset.onset_strength(y=y, sr=sr)
    # Smooth the onset envelope
    oenv_smooth = np.convolve(oenv, np.ones(50) / 50, mode="same")

    duration = len(y) / sr

    # Find significant changes in energy level
    hop_length = 512
    segment_min_sec = 8.0  # minimum segment length
    segment_min_frames = int(segment_min_sec * sr / hop_length)

    boundaries = [0]
    last_boundary = 0

    for i in range(segment_min_frames, len(oenv_smooth) - 1, segment_min_frames // 2):
        if i - last_boundary < segment_min_frames:
            continue
        window = segment_min_frames // 2
        left_mean = np.mean(oenv_smooth[max(0, i - window):i])
        right_mean = np.mean(oenv_smooth[i:min(len(oenv_smooth), i + window)])
        if left_mean > 0:
            change_ratio = abs(right_mean - left_mean) / left_mean
            if change_ratio > 0.3:
                boundaries.append(i)
                last_boundary = i

    boundaries.append(len(oenv_smooth))

    # Convert to time and build segments
    segments = []
    for idx in range(len(boundaries) - 1):
        start_sec = librosa.frames_to_time(boundaries[idx], sr=sr)
        end_sec = librosa.frames_to_time(boundaries[idx + 1], sr=sr)
        end_sec = min(end_sec, duration)

        # Average energy for this segment
        start_s = int(start_sec)
        end_s = min(int(end_sec), len(energy_curve_data))
        if start_s < end_s:
            seg_energy = float(np.mean(energy_curve_data[start_s:end_s]))
        else:
            seg_energy = 0.0

        # Heuristic section type
        is_first = idx == 0
        is_last = idx == len(boundaries) - 2
        seg_duration = end_sec - start_sec

        if is_first and seg_energy < 0.4 and seg_duration < 20:
            seg_type = "intro"
        elif is_last and seg_energy < 0.4 and seg_duration < 15:
            seg_type = "outro"
        elif seg_energy > 0.7:
            seg_type = "chorus"
        elif seg_energy > 0.4:
            seg_type = "verse"
        elif seg_energy < 0.3:
            seg_type = "bridge"
        else:
            seg_type = "verse"

        segments.append({
            "type": seg_type,
            "start_sec": round(float(start_sec), 2),
            "end_sec": round(float(end_sec), 2),
            "energy_avg": round(seg_energy, 3),
        })

    return segments


def _detect_mood(y, sr, bpm, key_info):
    """Estimate valence/arousal from spectral features + key/tempo."""
    # Arousal: based on RMS energy, tempo, spectral flux
    rms_mean = float(np.mean(librosa.feature.rms(y=y)))
    arousal_energy = min(1.0, rms_mean / 0.15)  # normalize roughly
    arousal_tempo = min(1.0, max(0.0, (bpm - 60) / 120))  # 60-180 range
    spectral_flux = librosa.onset.onset_strength(y=y, sr=sr)
    arousal_flux = min(1.0, float(np.mean(spectral_flux)) / 5.0)
    arousal = 0.4 * arousal_energy + 0.35 * arousal_tempo + 0.25 * arousal_flux
    arousal = max(0.0, min(1.0, arousal))

    # Valence: based on mode, spectral centroid (brightness), harmonic ratio
    mode_val = 0.65 if key_info["mode"] == "Major" else 0.35
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
    brightness = min(1.0, float(np.mean(centroid)) / 5000.0)
    harmonic = librosa.effects.harmonic(y)
    harmonic_ratio = float(np.sum(np.abs(harmonic))) / max(float(np.sum(np.abs(y))), 1e-8)
    harmonic_ratio = min(1.0, harmonic_ratio)
    valence = 0.4 * mode_val + 0.3 * brightness + 0.3 * harmonic_ratio
    valence = max(0.0, min(1.0, valence))

    # Mood descriptors based on quadrant
    descriptors = []
    if valence > 0.55 and arousal > 0.55:
        descriptors = ["euphoric", "energetic", "uplifting"]
    elif valence > 0.55 and arousal <= 0.55:
        descriptors = ["happy", "peaceful", "warm"]
    elif valence <= 0.55 and arousal > 0.55:
        descriptors = ["dark", "intense", "aggressive"]
    else:
        descriptors = ["melancholic", "atmospheric", "introspective"]

    return {
        "valence": round(valence, 3),
        "arousal": round(arousal, 3),
        "descriptors": descriptors,
    }


def _spectral_features(y, sr):
    """Brightness, warmth, roughness."""
    # Brightness: spectral centroid normalized
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
    brightness = min(1.0, float(np.mean(centroid)) / 5000.0)

    # Warmth: ratio of low-frequency energy (<300Hz) vs total
    S = np.abs(librosa.stft(y))
    freqs = librosa.fft_frequencies(sr=sr)
    low_mask = freqs < 300
    low_energy = float(np.sum(S[low_mask, :] ** 2))
    total_energy = float(np.sum(S ** 2)) + 1e-10
    warmth = min(1.0, low_energy / total_energy)

    # Roughness: spectral flux
    flux = librosa.onset.onset_strength(y=y, sr=sr)
    roughness = min(1.0, float(np.mean(flux)) / 5.0)

    return {
        "brightness": round(brightness, 3),
        "warmth": round(warmth, 3),
        "roughness": round(roughness, 3),
    }


def _intro_clearance(y, sr):
    """Analyze first 10 seconds for sync/placement suitability."""
    samples_10s = min(len(y), sr * 10)
    y_intro = y[:samples_10s]

    # Energy
    rms = librosa.feature.rms(y=y_intro)
    energy = min(1.0, float(np.mean(rms)) / 0.15)

    # Vocal presence estimate: energy in 300Hz-3kHz band vs total
    S = np.abs(librosa.stft(y_intro))
    freqs = librosa.fft_frequencies(sr=sr)
    vocal_mask = (freqs >= 300) & (freqs <= 3000)
    vocal_energy = float(np.sum(S[vocal_mask, :] ** 2))
    total_energy = float(np.sum(S ** 2)) + 1e-10
    vocal_ratio = min(1.0, vocal_energy / total_energy)

    # Sync ready: moderate energy, not too much vocals
    sync_ready = energy > 0.1 and energy < 0.7 and vocal_ratio < 0.5

    return {
        "energy": round(energy, 3),
        "vocal_presence": round(vocal_ratio, 3),
        "sync_ready": sync_ready,
    }


def _tempo_stability(beat_frames, sr):
    """Measure how consistent the beat intervals are."""
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    if len(beat_times) < 3:
        return 0.5

    intervals = np.diff(beat_times)
    median_interval = np.median(intervals)
    if median_interval <= 0:
        return 0.5

    variance = float(np.std(intervals) / median_interval)
    stability = max(0.0, min(1.0, 1.0 - variance))
    return round(stability, 3)


def analyze(audio_path: str) -> dict:
    """Run full Sonic DNA analysis on an audio file."""
    y, sr = librosa.load(audio_path, sr=22050, mono=True)
    duration = float(len(y) / sr)

    # BPM
    bpm_result, beat_frames = _detect_bpm(y, sr)

    # Key
    key_result = _detect_key(y, sr)

    # Energy curve
    energy = _energy_curve(y, sr)

    # Structure
    structure = _detect_structure(y, sr, energy)

    # Mood
    mood = _detect_mood(y, sr, bpm_result["bpm"], key_result)

    # Spectral features
    spectral = _spectral_features(y, sr)

    # Intro clearance
    intro = _intro_clearance(y, sr)

    # Tempo stability
    stability = _tempo_stability(beat_frames, sr)

    return {
        "duration_sec": round(duration, 2),
        "bpm": bpm_result,
        "key": key_result,
        "energy_curve": energy,
        "structure": structure,
        "mood": mood,
        "spectral": spectral,
        "intro_clearance": intro,
        "tempo_stability": stability,
    }
