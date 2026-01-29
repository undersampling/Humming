from django.urls import path
from .views import HummingSearchView

urlpatterns = [
    path('search/', HummingSearchView.as_view(), name='humming-search'),
]