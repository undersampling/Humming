import os
import random
from pathlib import Path
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status
import librosa
import numpy as np

# Define path to your dataset folder (Assuming it's at the root level alongside backend)
# BASE_DIR is backend/, so parent is the root where 'dataset' lives
DATASET_DIR = Path(__file__).resolve().parent.parent.parent / 'dataset'


def compare_audio(hum_path, song_path):
    # Load hum and song
    y1, sr1 = librosa.load(hum_path, duration=10) # Load 10s of hum
    y2, sr2 = librosa.load(song_path, duration=30) # Load 30s of song
    
    # Extract Chroma features (good for melody matching)
    chroma_1 = librosa.feature.chroma_cens(y=y1, sr=sr1)
    chroma_2 = librosa.feature.chroma_cens(y=y2, sr=sr2)
    
    # Logic to compare chroma_1 and chroma_2 sequences...
    # Return a similarity score
    return score

class HummingSearchView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        uploaded_audio = request.FILES.get('audio')
        
        if not uploaded_audio:
            return Response({"error": "No audio file provided"}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Scan the 'dataset' folder for audio files
        try:
            song_files = [f for f in os.listdir(DATASET_DIR) if f.endswith(('.mp3', '.wav', '.flac'))]
        except FileNotFoundError:
            return Response({"error": "Dataset folder not found"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if not song_files:
            return Response({"message": "No songs found in dataset"}, status=status.HTTP_404_NOT_FOUND)

        # -------------------------------------------------------------------------
        # REAL COMPARISON LOGIC GOES HERE
        #
        # Right now, this code picks a RANDOM song from your actual dataset folder.
        # To make this real, you would need to:
        # 1. Load 'uploaded_audio' using librosa.
        # 2. Loop through 'song_files', loading each one.
        # 3. Compare their audio features (Spectrogram, MFCC, Chroma).
        # -------------------------------------------------------------------------

        # --- TEMPORARY: Pick a random song from your REAL dataset folder ---
        matched_filename = random.choice(song_files)
        
        # specific logic to parse "Artist - Title.mp3" filenames
        # Example: "Ed Sheeran - Shape of You.mp3"
        clean_name = os.path.splitext(matched_filename)[0] # Remove .mp3
        
        if '-' in clean_name:
            artist, title = clean_name.split('-', 1)
        else:
            artist = "Unknown Artist"
            title = clean_name

        response_data = [{
            'title': title.strip(),
            'artist': artist.strip(),
            'album': 'From Dataset',
            'confidence': round(random.uniform(0.7, 0.99), 2), # Simulated confidence
            'year': 'N/A'
        }]

        return Response(response_data, status=status.HTTP_200_OK)