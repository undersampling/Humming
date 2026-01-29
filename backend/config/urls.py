from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('humming.urls')), # This makes the endpoint: http://localhost:8000/api/search/
]