from django.urls import path
from .views import HummingSearchView, AIStatusView

urlpatterns = [
    path('search/', HummingSearchView.as_view(), name='humming-search'),
    path('ai-status/', AIStatusView.as_view(), name='ai-status'),
]