from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('register/', views.register_view, name='auth-register'),
    path('login/', views.login_view, name='auth-login'),
    path('refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('me/', views.me_view, name='auth-me'),
    path('users/', views.users_list_view, name='auth-users'),
    path('logout/', views.logout_view, name='auth-logout'),
]
