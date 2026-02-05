from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .services import similarity_service


class FootballAnalysisView(APIView):
    """
    API endpoint for football similarity analysis.
    """
    
    def get(self, request):
        """Get football analysis status and available play count."""
        total_plays = similarity_service.get_total_plays()
        return Response({
            'message': 'Football Analysis API is ready',
            'status': 'active',
            'total_plays': total_plays,
            'play_index_range': f'0 to {total_plays - 1}' if total_plays > 0 else 'No plays loaded'
        }, status=status.HTTP_200_OK)
    
    def post(self, request):
        """
        Find similar plays for a given play index.
        
        Request body:
            {
                "play_id": int,                      # Index of the play (0 to total_plays-1)
                "top_k": int,                        # Optional, number of similar plays (default: 5)
                "max_events_in_description": int     # Optional, max events shown in text (default: 5)
            }
            
        Response:
            {
                "query_play": { play details with trajectory },
                "similar_plays": [ list of similar plays with similarity scores and trajectories ]
            }
        """
        # Get parameters from request
        play_id = request.data.get('play_id')
        top_k = request.data.get('top_k', 5)
        max_events_in_description = request.data.get('max_events_in_description', 5)
        
        # Validate play_id
        if play_id is None:
            return Response({
                'error': 'play_id is required',
                'total_plays': similarity_service.get_total_plays()
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            play_id = int(play_id)
            top_k = int(top_k)
            max_events_in_description = int(max_events_in_description)
        except (ValueError, TypeError):
            return Response({
                'error': 'All parameters must be integers'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Limit parameters to reasonable ranges
        top_k = min(max(1, top_k), 20)
        max_events_in_description = min(max(1, max_events_in_description), 999)
        
        # Find similar plays
        result = similarity_service.find_similar_plays(play_id, top_k, max_events_in_description)
        
        if result['error']:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(result, status=status.HTTP_200_OK)


class GoalCountriesView(APIView):
    """
    API endpoint for getting countries with goals.
    """
    
    def get(self, request):
        """Get list of all countries that scored goals in the tournament."""
        countries = similarity_service.get_countries_with_goals()
        return Response({
            'countries': countries,
            'total_countries': len(countries)
        }, status=status.HTTP_200_OK)


class GoalsByCountryView(APIView):
    """
    API endpoint for getting goals by a specific country.
    """
    
    def get(self, request, country_name):
        """Get all goals scored by a specific country."""
        goals = similarity_service.get_goals_by_country(country_name)
        return Response({
            'country': country_name,
            'goals': goals,
            'total_goals': len(goals)
        }, status=status.HTTP_200_OK)


class SimilarGoalsView(APIView):
    """
    API endpoint for finding similar goals.
    """
    
    def post(self, request):
        """
        Find similar goals to a query goal.
        
        Request body:
            {
                "play_index": int,                   # Index of the play containing the goal
                "top_k": int,                        # Optional, number of similar goals (default: 5)
                "max_events_in_description": int     # Optional, max events shown in text (default: 5)
            }
        """
        play_index = request.data.get('play_index')
        top_k = request.data.get('top_k', 5)
        max_events_in_description = request.data.get('max_events_in_description', 5)
        
        if play_index is None:
            return Response({
                'error': 'play_index is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            play_index = int(play_index)
            top_k = int(top_k)
            max_events_in_description = int(max_events_in_description)
        except (ValueError, TypeError):
            return Response({
                'error': 'All parameters must be integers'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Limit parameters
        top_k = min(max(1, top_k), 20)
        max_events_in_description = min(max(1, max_events_in_description), 999)
        
        result = similarity_service.find_similar_goals(play_index, top_k, max_events_in_description)
        
        if result['error']:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(result, status=status.HTTP_200_OK)
