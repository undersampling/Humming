"""
AI Model-based Audio Processing for Humming Recognition
Uses Basic Pitch for note detection (exact user algorithm)
"""

import numpy as np


def get_audio_vector(audio_path):
    """
    Get audio feature vector using Basic Pitch AI model.
    Returns None if basic_pitch is not installed.
    """
    try:
        from basic_pitch.inference import predict
        from basic_pitch import ICASSP_2022_MODEL_PATH
        from basic_pitch.note_creation import model_output_to_notes
        
        # 1. AI predicts notes
        model_output, _, _ = predict(audio_path, ICASSP_2022_MODEL_PATH)
        midi, _ = model_output_to_notes(
            output=model_output,
            onset_thresh=0.5,
            frame_thresh=0.3,
            min_note_len=11,
            min_freq=1,
            max_freq=3500,
            midi_tempo=120
        )

        # 2. Extract pitches
        pitches = []
        for instrument in midi.instruments:
            for note in instrument.notes:
                pitches.append(note.pitch)

        if not pitches:
            return None

        # 3. Normalize
        histogram, _ = np.histogram(pitches, bins=np.arange(0, 129))
        norm = np.linalg.norm(histogram)
        if norm == 0:
            return histogram.tolist()
        return (histogram / norm).tolist()

    except ImportError as e:
        print(f"basic_pitch not installed: {e}")
        print("To install: pip install basic-pitch")
        return None
    except Exception as e:
        print(f"AI Error on {audio_path}: {e}")
        return None


def is_available():
    """Check if basic_pitch is installed and available."""
    try:
        from basic_pitch.inference import predict
        from basic_pitch import ICASSP_2022_MODEL_PATH
        return True
    except ImportError:
        return False
