from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
import json
import uuid
from django.shortcuts import render
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import send_mail
from django.conf import settings
from django.utils.crypto import get_random_string
from tracker.models import Salesman, LocationPoint, DailyActivity, AdminSettings, PlannedRoute, RouteStop, SystemNotification

# Store tokens temporarily (in production, use database)
password_reset_tokens = {}
email_verification_tokens = {}


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        user = authenticate(username=username, password=password)
        if user is not None:
            refresh = RefreshToken.for_user(user)

            return Response(
                {
                    "status": "success",
                    "message": "Login successful",
                    "tokens": {
                        "refresh": str(refresh),
                        "access": str(refresh.access_token),
                    },
                    "user_info": get_user_info(user),
                }
            )
        return Response({"status": "error", "message": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Blacklists the refresh token to log the user out.
        """
        refresh_token = request.data.get("refresh_token")

        if not refresh_token:
            return Response({"error": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()

            return Response({"success": "Logged out successfully."}, status=status.HTTP_200_OK)
        except TokenError:
            return Response({"error": "Invalid or expired refresh token."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            # For debugging purposes, you might want to log the exception e
            return Response({"error": "An unexpected error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            username = request.data.get("username")
            email = request.data.get("email")
            password = request.data.get("password")
            firstName = request.data.get("firstName")
            lastName = request.data.get("lastName")

            if User.objects.filter(username=username).exists():
                return Response({"status": "error", "message": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)

            if User.objects.filter(email=email).exists():
                return Response({"status": "error", "message": "Email already exists"}, status=status.HTTP_400_BAD_REQUEST)

            user = User.objects.create_user(username=username, email=email, password=password, first_name=firstName, last_name=lastName)
            user.is_active = False  # User needs to verify email
            user.save()

            # Generate verification token
            token = str(uuid.uuid4())
            email_verification_tokens[token] = user.id

            # Send verification email
            verification_url = f"{request.build_absolute_uri('/auth/verifyEmail/')}{token}"
            # send_mail(
            #     'Verify your email',
            #     f'Click this link to verify your email: {verification_url}',
            #     settings.DEFAULT_FROM_EMAIL,
            #     [email],
            #     fail_silently=False,
            # )

            return Response({"status": "success", "message": "Registration successful. Please verify your email."})
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            old_password = request.data.get("old_password")
            new_password = request.data.get("new_password")
            if not old_password or not new_password:
                return Response(
                    {
                        "status": "error",
                        "message": "Both old and new password are required.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user = request.user
            if user.check_password(old_password):
                user.set_password(new_password)
                user.save()

                # Generate new tokens after password change
                refresh = RefreshToken.for_user(user)

                return Response(
                    {
                        "status": "success",
                        "message": "Password changed successfully",
                        "tokens": {
                            "refresh": str(refresh),
                            "access": str(refresh.access_token),
                        },
                    }
                )
            return Response({"status": "error", "message": "Invalid old password"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            email = request.data.get("email")

            try:
                user = User.objects.get(email=email)
                token = get_random_string(32)
                password_reset_tokens[token] = user.id

                # Send reset email
                reset_url = f"{request.build_absolute_uri('/auth/resetPassword/')}{token}"
                # send_mail(
                #     'Reset your password',
                #     f'Click this link to reset your password: {reset_url}',
                #     settings.DEFAULT_FROM_EMAIL,
                #     [email],
                #     fail_silently=False,
                # )

                return Response({"status": "success", "message": "Password reset instructions sent to your email"})
            except User.DoesNotExist:
                return Response({"status": "error", "message": "No user found with this email"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, token):
        try:
            if token not in password_reset_tokens:
                return Response({"status": "error", "message": "Invalid or expired token"}, status=status.HTTP_400_BAD_REQUEST)

            user_id = password_reset_tokens[token]
            new_password = request.data.get("new_password")

            try:
                user = User.objects.get(id=user_id)
                user.set_password(new_password)
                user.save()

                # Remove used token
                del password_reset_tokens[token]

                return Response({"status": "success", "message": "Password reset successful"})
            except User.DoesNotExist:
                return Response({"status": "error", "message": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        if token not in email_verification_tokens:
            return Response({"status": "error", "message": "Invalid or expired token"}, status=status.HTTP_400_BAD_REQUEST)

        user_id = email_verification_tokens[token]
        try:
            user = User.objects.get(id=user_id)
            user.is_active = True
            user.save()

            # Remove used token
            del email_verification_tokens[token]

            return Response({"status": "success", "message": "Email verified successfully"})
        except User.DoesNotExist:
            return Response({"status": "error", "message": "User not found"}, status=status.HTTP_404_NOT_FOUND)


class UserInfoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        user_info = get_user_info(user)
        return Response({"status": "success", "user_info": user_info})

def get_user_info(user):
    isSalesman = False
    salesmanEntry = Salesman.objects.filter(user=user).first()
    if salesmanEntry:
        isSalesman = True
    user_info = {
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_active": user.is_active,
        "is_salesman": isSalesman,
        "is_superadmin": False
    }
    if isSalesman:
        salesmanType = salesmanEntry.user_type
        user_info["salesmanType"] = salesmanType if isSalesman else None
    return user_info