from functools import wraps
from django.shortcuts import redirect
from django.contrib import messages


def host_required(view_func):
    """
    Decorator that ensures:
    1. User is authenticated
    2. User's session is in 'host' mode

    If not authenticated, redirects to login.
    If not in host mode, switches them to host mode automatically.
    """

    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            messages.warning(request, "Please log in to access the host dashboard.")
            return redirect("core:login")

        # Auto-switch to host mode if accessing a host URL
        if request.session.get("active_role") != "host":
            request.session["active_role"] = "host"

        return view_func(request, *args, **kwargs)

    return wrapper
