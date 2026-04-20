from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth import login, logout, get_user_model
import json
from .utils import is_valid_email, OTPHandler

User = get_user_model()


@require_POST
def send_otp(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse(
            {
                "success": False,
                "message": "Invaild JSON. Tr again",
                "code": "Invaild JSON",
            },
            status=400,
        )

    print("\n send otp : ", data)
    email = data.get("email")
    full_name = data.get("full_name")
    phone = data.get("phone")
    auth_type = data.get("type")

    # Validate Email
    if not is_valid_email(email):
        return JsonResponse(
            {
                "success": False,
                "message": "Please enter a valid email address format.",
                "code": "Invaild EMAIL",
                "error": "",
            },
            status=400,
        )

    user_exists = User.objects.filter(email=email).exists()

    # --- LOGIN ---
    if auth_type == "login":
        if user_exists:
            OTPHandler.send_and_store_otp(email, purpose="login")
            return JsonResponse(
                {
                    "success": True,
                    "message": "Login OTP sent to email.",
                    "code": "Login OTP Sent",
                }
            )
        else:
            return JsonResponse(
                {
                    "success": False,
                    "message": "No account with this email. Please sign up first.",
                    "code": "No account Exist",
                },
                status=404,
            )
    # --- SIGNUP ---
    elif auth_type == "signup":
        if user_exists:
            return JsonResponse(
                {
                    "success": False,
                    "message": "Account already exists. Please login instead.",
                    "code": "Account Already Exist",
                },
                status=400,
            )
        # Validation for signup fields
        if len(full_name) < 4:
            return JsonResponse(
                {
                    "success": False,
                    "message": "Name must be longer than 4 characters.",
                    "code": "Invaild Full name",
                },
                status=400,
            )
        if len(phone) < 10:
            return JsonResponse(
                {
                    "success": False,
                    "message": "Valid phone number required.",
                    "code": "Invaild phone",
                },
                status=400,
            )

        signup_data = {"full_name": full_name, "phone": phone}

        OTPHandler.send_and_store_otp(email, purpose="signup", signup_data=signup_data)
        return JsonResponse(
            {
                "success": True,
                "message": "Signup OTP sent to email",
                "code": "Signup OTP send",
            }
        )
    return JsonResponse(
        {
            "success": True,
            "message": "Invalid request type.",
            "code": "Invaild Request",
        },
        status=400,
    )


@require_POST
def verify_otp(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse(
            {
                "success": False,
                "message": "Invaild JSON. Tr again",
                "code": "Invaild JSON",
            },
            status=400,
        )

    print("\n Verify : ", data)
    email = data.get("email")
    otp = data.get("otp")

    if not email or not otp:
        return JsonResponse(
            {
                "success": False,
                "message": "Email and OTP are required.",
                "code": "Invaild Email, OTP",
            },
            status=400,
        )

    if not OTPHandler.verify_otp(email, otp):
        return JsonResponse(
            {
                "success": False,
                "message": "Invaild or expired OTP.",
                "code": "Invaild OTP",
            },
            status=400,
        )

    signup_data = OTPHandler.get_signup_data(email)

    if signup_data:
        user = User.objects.create_user(
            email=email,
            full_name=signup_data["full_name"],
            phone=signup_data.get("phone"),
        )
    else:
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return JsonResponse(
                {
                    "success": False,
                    "message": "User not found.",
                    "code": "User not found",
                },
                status=404,
            )

    login(request, user, backend="users.backends.PasswordlessAuthBackend")

    OTPHandler.clear_data(email)
    return JsonResponse(
        {
            "success": True,
            "message": "Successfully authenticated",
            "code": "Auth Success",
            "user": {"email": user.email, "full_name": user.full_name},
        }
    )
