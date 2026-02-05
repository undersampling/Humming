"""
Football Similarity Detection Services

This module provides functionality to find similar plays using
pre-computed latent representations from the VAE model.
"""

import os
import pickle
import numpy as np
from typing import List, Dict, Tuple, Any
from sklearn.metrics.pairwise import cosine_similarity
from dataclasses import dataclass

# Path to the World_Cup data folder
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WORLD_CUP_DIR = os.path.join(BASE_DIR, 'World_Cup')
MODEL_OUTPUTS_DIR = os.path.join(WORLD_CUP_DIR, 'Model Outputs')


@dataclass
class Play:
    """Represents a possession sequence (play)."""
    game_id: int
    play_id: int
    team_id: int
    team_name: str
    events: List[Dict]
    start_time: float
    end_time: float
    period: int
    set_piece_type: str

    @property
    def duration(self) -> float:
        return self.end_time - self.start_time

    @property
    def num_events(self) -> int:
        return len(self.events)


class SimilarityService:
    """
    Service for finding similar plays using pre-computed latent representations.
    """
    
    _instance = None
    _all_plays = None
    _latent_representations = None
    _is_loaded = False
    
    def __new__(cls):
        """Singleton pattern to avoid reloading data multiple times."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not self._is_loaded:
            self._load_data()
    
    def _load_data(self):
        """Load pre-computed plays and latent representations."""
        try:
            # Load all plays with custom unpickler to handle __main__.Play
            plays_path = os.path.join(MODEL_OUTPUTS_DIR, 'all_plays.pkl')
            
            # Custom unpickler to redirect __main__.Play to our Play class
            class CustomUnpickler(pickle.Unpickler):
                def find_class(self_, module, name):
                    if module == '__main__' and name == 'Play':
                        return Play
                    return super().find_class(module, name)
            
            with open(plays_path, 'rb') as f:
                self._all_plays = CustomUnpickler(f).load()
            
            # Load latent representations
            latent_path = os.path.join(MODEL_OUTPUTS_DIR, 'latent_representations.npy')
            self._latent_representations = np.load(latent_path)
            
            self._is_loaded = True
            print(f"Loaded {len(self._all_plays)} plays and latent representations of shape {self._latent_representations.shape}")
            
        except FileNotFoundError as e:
            print(f"Error loading data files: {e}")
            self._all_plays = []
            self._latent_representations = np.array([])
            self._is_loaded = False
    
    def get_total_plays(self) -> int:
        """Return the total number of plays available."""
        return len(self._all_plays) if self._all_plays else 0
    
    def get_play_info(self, play_idx: int) -> Dict[str, Any]:
        """
        Get information about a specific play.
        
        Args:
            play_idx: Index of the play (0 to total_plays-1)
            
        Returns:
            Dictionary with play information
        """
        if not self._all_plays or play_idx < 0 or play_idx >= len(self._all_plays):
            return None
        
        play = self._all_plays[play_idx]
        return self._play_to_dict(play, play_idx)
    
    def _extract_ball_trajectory(self, play: Play) -> List[Dict[str, float]]:
        """
        Extract ball positions from play events for trajectory visualization.
        
        Returns:
            List of {x, y} coordinates for each event
        """
        trajectory = []
        for event in play.events:
            ball_data = event.get('ball', [{}])
            if isinstance(ball_data, list) and len(ball_data) > 0:
                ball = ball_data[0]
            else:
                ball = ball_data if isinstance(ball_data, dict) else {}
            
            x = float(ball.get('x', 0.0)) if ball else 0.0
            y = float(ball.get('y', 0.0)) if ball else 0.0
            
            # Get event type for label
            poss_events = event.get('possessionEvents', {})
            evt_type = poss_events.get('possessionEventType', '?')
            
            trajectory.append({
                'x': x,
                'y': y,
                'event_type': evt_type
            })
        
        return trajectory
    
    def _play_to_dict(self, play: Play, idx: int, similarity: float = None, include_trajectory: bool = True, max_events_in_description: int = 5) -> Dict[str, Any]:
        """Convert a Play object to a dictionary for API response."""
        result = {
            'index': idx,
            'game_id': play.game_id,
            'play_id': play.play_id,
            'team_name': play.team_name,
            'period': play.period,
            'set_piece_type': play.set_piece_type,
            'num_events': play.num_events,
            'duration': round(play.duration, 1),
            'description': self.describe_play(play, max_events_in_description)
        }
        
        if similarity is not None:
            result['similarity'] = round(float(similarity), 4)
        
        if include_trajectory:
            result['trajectory'] = self._extract_ball_trajectory(play)
        
        return result
    
    def describe_play(self, play: Play, max_events: int = 5) -> str:
        """
        Generate human-readable description of a play.
        
        Args:
            play: Play object
            max_events: Maximum number of events to show in sequence
            
        Returns:
            String description of the play
        """
        events = play.events
        
        # Get event types in sequence
        event_types = []
        for evt in events[:max_events]:
            poss_events = evt.get('possessionEvents', {})
            evt_type = poss_events.get('possessionEventType', '?')
            event_types.append(evt_type)
        
        if len(events) > max_events:
            event_types.append(f"...+{len(events)-max_events}")
        
        return (f"Game {play.game_id} | {play.team_name} | "
                f"Period {play.period} | {play.set_piece_type} | "
                f"{len(events)} events | {play.duration:.1f}s | "
                f"[{' → '.join(event_types)}]")
    
    def find_similar_plays(self, query_idx: int, top_k: int = 5, max_events_in_description: int = 5) -> Dict[str, Any]:
        """
        Find most similar plays to a query play.
        
        Args:
            query_idx: Index of query play
            top_k: Number of similar plays to return
            max_events_in_description: Max events to show in the text description
            
        Returns:
            Dictionary with query play and list of similar plays
        """
        if not self._is_loaded:
            return {
                'error': 'Data not loaded. Please check if model output files exist.',
                'query_play': None,
                'similar_plays': []
            }
        
        if query_idx < 0 or query_idx >= len(self._all_plays):
            return {
                'error': f'Invalid play index. Must be between 0 and {len(self._all_plays) - 1}',
                'query_play': None,
                'similar_plays': []
            }
        
        query_play = self._all_plays[query_idx]
        
        # Get query latent representation
        query_latent = self._latent_representations[query_idx:query_idx+1]
        
        # Compute cosine similarity with all plays
        similarities = cosine_similarity(query_latent, self._latent_representations)[0]
        
        # Get top-k indices (excluding query itself)
        top_indices = np.argsort(similarities)[::-1][1:top_k+1]
        
        # Build results
        similar_plays = []
        for idx in top_indices:
            play = self._all_plays[idx]
            similar_plays.append(self._play_to_dict(play, int(idx), similarities[idx], max_events_in_description=max_events_in_description))
        
        return {
            'error': None,
            'total_plays': len(self._all_plays),
            'query_play': self._play_to_dict(query_play, query_idx, max_events_in_description=max_events_in_description),
            'similar_plays': similar_plays
        }
    
    # ============================================================
    # Goal Similarity Search Methods
    # ============================================================
    
    def _build_goals_index(self):
        """Build index of all goals in the dataset."""
        if hasattr(self, '_goals_indexed') and self._goals_indexed:
            return
        
        # Build match lookup for finding opponents
        match_teams = {}
        for p in self._all_plays:
            if p.game_id not in match_teams:
                match_teams[p.game_id] = set()
            match_teams[p.game_id].add(p.team_name)
        
        # Collect all goals with metadata
        goals_by_match_team = {}
        
        for i, p in enumerate(self._all_plays):
            # Skip penalties
            if p.set_piece_type == 'P':
                continue
            
            for evt in p.events:
                poss = evt.get('possessionEvents', {})
                if poss.get('possessionEventType') == 'SH' and poss.get('shotOutcomeType') == 'G':
                    game_events = evt.get('gameEvents', {})
                    formatted_clock = game_events.get('startFormattedGameClock', '?:?')
                    minute = formatted_clock.split(':')[0] if ':' in formatted_clock else '?'
                    
                    key = (p.game_id, p.team_name)
                    if key not in goals_by_match_team:
                        goals_by_match_team[key] = []
                    goals_by_match_team[key].append((i, p, minute))
                    break
        
        # Assign goal numbers and build final list
        self._all_goals = []
        self._goals_by_country = {}
        
        for (match_id, team), goals_list in goals_by_match_team.items():
            goals_list.sort(key=lambda x: x[0])
            teams_in_match = match_teams.get(match_id, set())
            opponent = [t for t in teams_in_match if t != team]
            opponent = opponent[0] if opponent else "?"
            
            for goal_num, (idx, play, minute) in enumerate(goals_list, 1):
                goal_data = {
                    'idx': idx,
                    'play': play,
                    'team': team,
                    'opponent': opponent,
                    'minute': minute,
                    'goal_num': goal_num,
                    'total_goals_in_match': len(goals_list),
                    'match_id': match_id
                }
                self._all_goals.append(goal_data)
                
                # Index by country
                if team not in self._goals_by_country:
                    self._goals_by_country[team] = []
                self._goals_by_country[team].append(goal_data)
        
        self._goals_indexed = True
        print(f"Indexed {len(self._all_goals)} goals from {len(self._goals_by_country)} countries")
    
    def get_countries_with_goals(self) -> List[Dict[str, Any]]:
        """Get list of all countries that scored goals."""
        self._build_goals_index()
        
        countries = []
        for country, goals in sorted(self._goals_by_country.items()):
            countries.append({
                'name': country,
                'total_goals': len(goals)
            })
        
        return countries
    
    def get_goals_by_country(self, country_name: str) -> List[Dict[str, Any]]:
        """Get all goals scored by a specific country."""
        self._build_goals_index()
        
        goals = self._goals_by_country.get(country_name, [])
        
        result = []
        for g in goals:
            result.append({
                'goal_id': f"{g['team']}_{g['match_id']}_{g['goal_num']}",
                'play_index': g['idx'],
                'team': g['team'],
                'opponent': g['opponent'],
                'minute': g['minute'],
                'goal_num': g['goal_num'],
                'match_id': g['match_id'],
                'period': g['play'].period,
                'duration': round(g['play'].duration, 1),
                'num_events': g['play'].num_events,
                'set_piece_type': g['play'].set_piece_type
            })
        
        return result
    
    def _goal_to_dict(self, goal_data: Dict, similarity: float = None, max_events_in_description: int = 5) -> Dict[str, Any]:
        """Convert goal data to dictionary for API response."""
        play = goal_data['play']
        
        # Set piece names
        sp_names = {
            'O': 'Open Play', 'K': 'Kickoff', 'F': 'Free Kick',
            'C': 'Corner', 'T': 'Throw-in', 'G': 'Goal Kick', 'D': 'Drop Ball'
        }
        
        result = {
            'play_index': goal_data['idx'],
            'team': goal_data['team'],
            'opponent': goal_data['opponent'],
            'minute': goal_data['minute'],
            'goal_num': goal_data['goal_num'],
            'match_id': goal_data['match_id'],
            'period': play.period,
            'duration': round(play.duration, 1),
            'num_events': play.num_events,
            'set_piece_type': play.set_piece_type,
            'set_piece_name': sp_names.get(play.set_piece_type, play.set_piece_type),
            'description': self.describe_play(play, max_events_in_description),
            'trajectory': self._extract_ball_trajectory(play)
        }
        
        if similarity is not None:
            result['similarity'] = round(float(similarity), 4)
        
        return result
    
    def find_similar_goals(self, play_index: int, top_k: int = 5, max_events_in_description: int = 5) -> Dict[str, Any]:
        """
        Find similar goals to a query goal.
        
        Args:
            play_index: Index of the play that contains the goal
            top_k: Number of similar goals to return
            max_events_in_description: Max events to show in text description
            
        Returns:
            Dictionary with query goal and list of similar goals
        """
        self._build_goals_index()
        
        if not self._is_loaded:
            return {
                'error': 'Data not loaded.',
                'query_goal': None,
                'similar_goals': []
            }
        
        # Find the goal data for this play index
        query_goal = None
        for g in self._all_goals:
            if g['idx'] == play_index:
                query_goal = g
                break
        
        if query_goal is None:
            return {
                'error': f'No goal found at play index {play_index}',
                'query_goal': None,
                'similar_goals': []
            }
        
        # Get query latent representation
        query_latent = self._latent_representations[play_index:play_index+1]
        
        # Find similar goals (only compare with other goals, not all plays)
        similarities = []
        for other_g in self._all_goals:
            if other_g['idx'] == play_index:
                continue
            other_latent = self._latent_representations[other_g['idx']:other_g['idx']+1]
            sim = cosine_similarity(query_latent, other_latent)[0, 0]
            similarities.append((sim, other_g))
        
        # Sort by similarity
        similarities.sort(reverse=True, key=lambda x: x[0])
        
        # Build results
        similar_goals = []
        for sim, g in similarities[:top_k]:
            similar_goals.append(self._goal_to_dict(g, sim, max_events_in_description))
        
        return {
            'error': None,
            'total_goals': len(self._all_goals),
            'query_goal': self._goal_to_dict(query_goal, max_events_in_description=max_events_in_description),
            'similar_goals': similar_goals
        }


# Create singleton instance
similarity_service = SimilarityService()
