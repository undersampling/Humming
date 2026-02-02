import os
from pathlib import Path
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status

from .audio_processing import (
    find_matches,
    save_uploaded_audio,
    cleanup_temp_file,
    check_ai_available
)

# Dataset directory - relative to backend folder
DATASET_DIR = Path(__file__).resolve().parent.parent.parent / 'dataset'


class HummingSearchView(APIView):
    """
    API endpoint for humming-based song search.
    
    POST parameters:
    - audio: The audio file (webm recording or mp3/wav upload)
    - method: 'dsp', 'ai', or 'both' (default: 'dsp')
    - top_n: Number of results 1-5 (default: 5)
    """
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        uploaded_audio = request.FILES.get('audio')
        
        if not uploaded_audio:
            return Response(
                {"error": "No audio file provided"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get parameters
        method = request.data.get('method', 'dsp').lower()
        if method not in ['dsp', 'ai', 'both']:
            method = 'dsp'
        
        try:
            top_n = int(request.data.get('top_n', 5))
            top_n = max(1, min(5, top_n))  # Clamp to 1-5
        except (ValueError, TypeError):
            top_n = 5
        
        # Check dataset exists
        if not DATASET_DIR.exists():
            return Response(
                {"error": f"Dataset folder not found: {DATASET_DIR}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Save uploaded audio to temp file
        temp_path = None
        try:
            temp_path = save_uploaded_audio(uploaded_audio)
            print(f"Uploaded audio saved to: {temp_path}")
            
            response_data = {}
            
            if method == 'both':
                # Run both DSP and AI methods
                print("Running DSP method...")
                dsp_results = find_matches(
                    temp_path, str(DATASET_DIR), top_n, method='dsp'
                )
                
                print("Running AI method...")
                ai_results = find_matches(
                    temp_path, str(DATASET_DIR), top_n, method='ai'
                )
                
                response_data = {
                    'dsp': dsp_results,
                    'ai': ai_results,
                    'ai_available': check_ai_available()
                }
            else:
                # Run single method
                print(f"Running {method} method...")
                results = find_matches(
                    temp_path, str(DATASET_DIR), top_n, method=method
                )
                response_data = {
                    method: results,
                    'ai_available': check_ai_available()
                }
            
            return Response(response_data, status=status.HTTP_200_OK)
        
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {"error": f"Processing failed: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        finally:
            # Cleanup temp file
            cleanup_temp_file(temp_path)


class AIStatusView(APIView):
    """Check if AI model (basic_pitch) is available."""
    
    def get(self, request, *args, **kwargs):
        is_available = check_ai_available()
        return Response({
            'ai_available': is_available,
            'message': 'AI model ready' if is_available else 'AI model not installed. Run: pip install basic-pitch'
        })