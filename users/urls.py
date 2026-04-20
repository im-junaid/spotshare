from django.urls import path
from . import views

urlpatterns = [
    path("otp/send/", views.send_otp, name="send_otp"),
    path("otp/verify/", views.verify_otp, name="verify_otp"),
]
