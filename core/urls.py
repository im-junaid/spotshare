from django.urls import path
from . import views

app_name = "core"

urlpatterns = [
    path("", views.home, name="home"),
    path("signup/", views.signup, name="signup"),
    path("login/", views.login, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("switch-role/", views.switch_role, name="switch_role"),
    path("profile/", views.profile, name="profile"),
]
