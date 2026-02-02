"""
DSP-based Audio Processing for Humming Recognition
Uses pitch histogram and chroma features (exact user algorithm)
"""

import os
import numpy as np
import librosa


def extract_pitch_histogram(y, sr):
    """Extract pitch histogram using YIN algorithm."""
    f0 = librosa.yin(
        y,
        fmin=librosa.note_to_hz('C2'),
        fmax=librosa.note_to_hz('C7'),
        sr=sr,
        frame_length=2048,
        hop_length=256
    )

    f0 = f0[~np.isnan(f0)]
    if len(f0) == 0:
        return None

    midi = np.round(librosa.hz_to_midi(f0)).astype(int)
    midi = midi[(midi >= 0) & (midi <= 127)]
    if len(midi) == 0:
        return None

    # -------- weighted histogram --------
    hist = np.zeros(128)
    for m in midi:
        hist[m] += 1

    # -------- smoothing --------
    hist = np.convolve(hist, [0.25, 0.5, 0.25], mode='same')

    # -------- KEY NORMALIZATION (important) --------
    key_shift = np.argmax(hist)
    hist = np.roll(hist, 60 - key_shift)  # align to Middle C

    # normalize
    norm = np.linalg.norm(hist)
    if norm == 0:
        return hist
    return hist / norm


def extract_chroma_vector(y, sr):
    """Extract chroma feature vector."""
    S = np.abs(librosa.stft(y, n_fft=4096, hop_length=512)) ** 2
    chroma = librosa.feature.chroma_stft(S=S, sr=sr, n_chroma=12)

    # median is more robust than mean
    chroma_vec = np.median(chroma, axis=1)

    norm = np.linalg.norm(chroma_vec)
    if norm == 0:
        return chroma_vec
    return chroma_vec / norm


def get_audio_vector(path, sr=22050):
    """Get audio feature vector using DSP methods."""
    try:
        y, sr = librosa.load(path, sr=sr, mono=True)

        if np.max(np.abs(y)) < 1e-3:
            return None

        pitch_hist = extract_pitch_histogram(y, sr)
        if pitch_hist is None:
            return None

        chroma_vec = extract_chroma_vector(y, sr)

        # pitch has higher weight than chroma
        vec = np.concatenate([
            1.5 * pitch_hist,
            1.0 * chroma_vec
        ])

        norm = np.linalg.norm(vec)
        if norm == 0:
            return vec.tolist()
        return (vec / norm).tolist()

    except Exception as e:
        print(f"DSP Error processing {path}: {e}")
        return None
