from django.urls import path
from .views import FootballAnalysisView, GoalCountriesView, GoalsByCountryView, SimilarGoalsView

urlpatterns = [
    path('analyze/', FootballAnalysisView.as_view(), name='football-analyze'),
    path('goals/countries/', GoalCountriesView.as_view(), name='goal-countries'),
    path('goals/country/<str:country_name>/', GoalsByCountryView.as_view(), name='goals-by-country'),
    path('goals/similar/', SimilarGoalsView.as_view(), name='similar-goals'),
]
