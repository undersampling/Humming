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
        print(f"  [DSP] Loading audio: {path}")
        y, sr = librosa.load(path, sr=sr, mono=True)
        print(f"  [DSP] Loaded {len(y)} samples, sr={sr}, duration={len(y)/sr:.2f}s")

        if len(y) == 0:
            print(f"  [DSP] ERROR: Empty audio file")
            return None

        max_amp = np.max(np.abs(y))
        print(f"  [DSP] Max amplitude: {max_amp:.6f}")
        
        if max_amp < 1e-3:
            print(f"  [DSP] ERROR: Audio too quiet (max amp < 0.001)")
            return None

        print(f"  [DSP] Extracting pitch histogram...")
        pitch_hist = extract_pitch_histogram(y, sr)
        if pitch_hist is None:
            print(f"  [DSP] ERROR: Could not extract pitch histogram")
            return None
        print(f"  [DSP] Pitch histogram extracted successfully")

        print(f"  [DSP] Extracting chroma vector...")
        chroma_vec = extract_chroma_vector(y, sr)
        print(f"  [DSP] Chroma vector extracted successfully")

        # pitch has higher weight than chroma
        vec = np.concatenate([
            1.5 * pitch_hist,
            1.0 * chroma_vec
        ])

        norm = np.linalg.norm(vec)
        if norm == 0:
            print(f"  [DSP] WARNING: Zero norm vector")
            return vec.tolist()
        
        print(f"  [DSP] SUCCESS: Vector created with {len(vec)} dimensions")
        return (vec / norm).tolist()

    except Exception as e:
        import traceback
        print(f"  [DSP] EXCEPTION processing {path}:")
        traceback.print_exc()
        return None
