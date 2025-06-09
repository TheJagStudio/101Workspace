from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path("login/", views.LoginView.as_view(), name="login"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("register/", views.RegisterView.as_view(), name="register"),
    path("changePassword/", views.ChangePasswordView.as_view(), name="change_password"),
    path("forgotPassword/", views.ForgotPasswordView.as_view(), name="forgot_password"),
    path("resetPassword/<str:token>/", views.ResetPasswordView.as_view(), name="reset_password"),
    path("verifyEmail/<str:token>/", views.VerifyEmailView.as_view(), name="verify_email"),
    path("me/", views.UserInfoView.as_view(), name="get_user_info"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]