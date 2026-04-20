from django.shortcuts import render, redirect
from django.contrib.auth import logout


# Create your views here.
def home(request):
    return render(request, "core/pages/index.html")


def signup(request):
    return render(request, "core/pages/auth.html", {"is_signup": True})


def login(request):
    return render(request, "core/pages/auth.html", {"is_signup": False})


def logout_view(request):
    logout(request)
    return redirect("core:login")
