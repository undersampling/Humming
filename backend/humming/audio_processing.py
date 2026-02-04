"""
Audio Processing Module for Humming Recognition
Main module that coordinates DSP and AI processing with JSON file caching.
"""

import os
import tempfile
import json
import numpy as np
from pathlib import Path

# Import processing modules
from . import dsp_processing
from . import ai_processing

# ============================================
# CONFIGURATION
# ============================================

# JSON cache file location (in backend folder)
CACHE_FILE = Path(__file__).resolve().parent.parent / 'song_database.json'


# ============================================
# SHARED UTILITIES
# ============================================

def cosine_similarity(a, b):
    """Calculate cosine similarity between two vectors."""
    if a is None or b is None:
        return 0.0
    a = np.array(a)
    b = np.array(b)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def parse_song_name(filename):
    """Extract artist and title from filename."""
    clean_name = os.path.splitext(filename)[0]
    if '-' in clean_name:
        parts = clean_name.split('-', 1)
        return parts[0].strip(), parts[1].strip()
    elif '_' in clean_name:
        parts = clean_name.rsplit('_', 1)
        return parts[0].replace('_', ' ').strip(), parts[1].strip()
    return "Unknown Artist", clean_name.strip()


# ============================================
# JSON DATABASE FUNCTIONS
# ============================================

def load_json_database():
    """Load song database from JSON file."""
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading JSON database: {e}")
    return {'dsp': [], 'ai': [], 'files': {}}


def save_json_database(data):
    """Save song database to JSON file."""
    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Database saved to {CACHE_FILE}")
    except Exception as e:
        print(f"Error saving JSON database: {e}")


def get_file_info(filepath):
    """Get file modification time for cache invalidation."""
    try:
        return os.path.getmtime(filepath)
    except:
        return None


def load_song_database(dataset_dir, method='dsp'):
    """Load and vectorize all songs with JSON caching."""
    db = load_json_database()
    
    # Get list of audio files
    try:
        files = [f for f in os.listdir(dataset_dir) 
                 if f.lower().endswith(('.mp3', '.wav', '.flac','.mp4', '.m4a', '.ogg'))]
    except FileNotFoundError:
        print(f"Dataset folder not found: {dataset_dir}")
        return []
    
    # Check which files need processing
    song_db = []
    needs_save = False
    current_keys = set()  # Track current file keys for cleanup
    
    for filename in files:
        filepath = os.path.join(dataset_dir, filename)
        file_mtime = get_file_info(filepath)
        cache_key = f"{filename}_{method}"
        current_keys.add(cache_key)  # Track this key
        
        # Check if file is already cached and not modified
        # Use tolerance for mtime comparison to handle float precision issues from JSON
        cached_info = db.get('files', {}).get(cache_key)
        cached_mtime = cached_info.get('mtime', 0) if cached_info else 0
        if cached_info and abs(cached_mtime - file_mtime) < 1:  # 1 second tolerance
            # Use cached vector
            song_db.append({
                'filename': filename,
                'title': cached_info['title'],
                'vector': cached_info['vector']
            })
            print(f"  [CACHED] {filename}")
        else:
            # Process file
            print(f"  [PROCESSING] {filename}...")
            
            if method == 'dsp':
                vec = dsp_processing.get_audio_vector(filepath)
            else:
                vec = ai_processing.get_audio_vector(filepath)
            
            if vec is not None:
                artist, title = parse_song_name(filename)
                song_db.append({
                    'filename': filename,
                    'title': title,
                    'vector': vec
                })
                
                # Update cache
                if 'files' not in db:
                    db['files'] = {}
                db['files'][cache_key] = {
                    'mtime': file_mtime,
                    'title': title,
                    'vector': vec
                }
                needs_save = True
            else:
                print(f"  [SKIPPED] {filename} - no vector extracted")
    
    # Clean up stale cache entries (files that no longer exist)
    if 'files' in db:
        stale_keys = [k for k in db['files'].keys() 
                      if k.endswith(f"_{method}") and k not in current_keys]
        for k in stale_keys:
            print(f"  [CLEANUP] Removing stale cache entry: {k}")
            del db['files'][k]
            needs_save = True
    
    # Save if we processed new files or cleaned up stale entries
    if needs_save:
        save_json_database(db)
    
    print(f"  Database summary: {len(song_db)} songs loaded ({method.upper()})")
    return song_db


def find_matches(hum_path, dataset_dir, top_n=5, method='dsp'):
    """Find top N matching songs for a humming audio file."""
    print(f"\n=== Finding matches with {method.upper()} ===")
    
    # Get hum vector
    print(f"Processing hum file: {hum_path}")
    if method == 'dsp':
        hum_vec = dsp_processing.get_audio_vector(hum_path)
    else:
        hum_vec = ai_processing.get_audio_vector(hum_path)
    
    if hum_vec is None:
        print("No melody detected in hum file")
        return []
    
    # Load song database (with caching)
    print(f"Loading song database from: {dataset_dir}")
    song_db = load_song_database(dataset_dir, method)
    
    if not song_db:
        print("No songs in database")
        return []
    
    # Calculate similarities
    print("Comparing with songs...")
    results = []
    for song in song_db:
        score = cosine_similarity(hum_vec, song['vector'])
        results.append({
            'title': song['title'],
            'filename': song['filename'],
            'confidence': round(score, 4),
            'method': method.upper()
        })
    
    # Sort by confidence descending
    results.sort(key=lambda x: x['confidence'], reverse=True)
    
    print(f"Found {len(results)} matches, returning top {top_n}")
    return results[:top_n]


def save_uploaded_audio(uploaded_file):
    """Save uploaded file to a temporary location and return the path."""
    suffix = os.path.splitext(uploaded_file.name)[1] or '.webm'
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        for chunk in uploaded_file.chunks():
            tmp.write(chunk)
        return tmp.name


def cleanup_temp_file(path):
    """Remove temporary file."""
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except Exception:
        pass


def check_ai_available():
    """Check if AI model is available."""
    return ai_processing.is_available()
