class RoleSwitcherMiddleware:
    """
    Injects `request.active_role` from the session.
    Defaults to 'driver' if not set.
    Templates and views can use request.active_role to switch UI.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.active_role = request.session.get("active_role", "driver")
        response = self.get_response(request)
        return response
