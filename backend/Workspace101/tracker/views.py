import os
import requests
from django.utils import timezone
from django.db import transaction
from django.db import models
from django.shortcuts import get_object_or_404
from rest_framework import generics, status, views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter 
from .models import Salesman, DailyActivity, AdminSettings, SystemNotification, PlannedRoute, RouteStop, LocationPoint
from .serializers import SalesmanSerializer, DailyActivitySerializer, AdminSettingsSerializer, SystemNotificationSerializer, PlannedRouteReadSerializer, PlannedRouteWriteSerializer, SalesmanStatusUpdateSerializer, SalesmanTrackingStatusSerializer, RouteStopStatusUpdateSerializer, AddRouteStopSerializer
from .permissions import IsAdmin, IsSalesman
from dotenv import load_dotenv
load_dotenv()
# ===================================================================
# ADMIN VIEWS
# ===================================================================

class AdminSalesmanListView(generics.ListAPIView):
    """
    (Admin) Lists all salesmen. Supports searching by username.
    GET: /api/tracker/admin/salesmen/
    GET: /api/tracker/admin/salesmen/?search=<query>
    """
    queryset = Salesman.objects.select_related('user').all()
    serializer_class = SalesmanSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    # Add SearchFilter
    filter_backends = [SearchFilter]
    search_fields = ['user__username', 'user__first_name', 'user__last_name']


class AdminSalesmanDetailView(generics.RetrieveAPIView):
    """
    (Admin) Retrieves details for a specific salesman.
    GET: /api/tracker/admin/salesmen/<pk>/
    """

    queryset = Salesman.objects.select_related("user").all()
    serializer_class = SalesmanSerializer
    permission_classes = [IsAuthenticated, IsAdmin]


class AdminSalesmanRouteHistoryView(views.APIView):
    """
    (Admin) Retrieves the route coordinate history for a salesman on a specific date.
    GET: /api/tracker/admin/salesmen/<pk>/route_history/?date=YYYY-MM-DD
    """

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request, pk):
        date_str = request.query_params.get("date")
        if not date_str:
            return Response({"error": "Date query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        activity = get_object_or_404(DailyActivity, salesman_id=pk, date=date_str)
        return Response(activity.route_coordinates_json, status=status.HTTP_200_OK)


class AdminSettingsView(generics.RetrieveUpdateAPIView):
    """
    (Admin) View and update global application settings.
    GET, PUT, PATCH: /api/tracker/admin/settings/
    """

    queryset = AdminSettings.objects.all()
    serializer_class = AdminSettingsSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        # Returns the first (and only) settings object, creating it if it doesn't exist.
        obj, created = AdminSettings.objects.get_or_create(pk=1)
        return obj


class AdminNotificationListView(generics.ListAPIView):
    """
    (Admin) List all system notifications.
    GET: /api/tracker/admin/notifications/
    """

    queryset = SystemNotification.objects.select_related("salesman__user").all()
    serializer_class = SystemNotificationSerializer
    permission_classes = [IsAuthenticated, IsAdmin]


class AdminMarkAllNotificationsReadView(views.APIView):
    """
    (Admin) Marks all unread notifications as read.
    POST: /api/tracker/admin/notifications/mark_all_read/
    """

    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, *args, **kwargs):
        SystemNotification.objects.filter(is_read=False).update(is_read=True)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminDashboardStatsView(views.APIView):
    """
    (Admin) Provides aggregated dashboard statistics.
    GET: /api/tracker/admin/dashboard_stats/
    """

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request, *args, **kwargs):
        total_salesmen = Salesman.objects.count()
        active_salesmen = Salesman.objects.filter(status="active").count()
        location_points_today = LocationPoint.objects.filter(timestamp__date=timezone.now().date()).count()

        stats_data = {"total_salesmen": total_salesmen, "active_salesmen": active_salesmen, "offline_salesmen": total_salesmen - active_salesmen, "location_points_today": location_points_today}
        return Response(stats_data, status=status.HTTP_200_OK)


# ===================================================================
# SALESMAN VIEWS
# ===================================================================


class SalesmanUpdateStatusView(views.APIView):
    """
    (Salesman) The main "ping" endpoint for the PWA to send location, battery, etc.
    POST: /api/tracker/salesman/update_status/
    """

    permission_classes = [IsAuthenticated, IsSalesman]

    def post(self, request, *args, **kwargs):
        serializer = SalesmanStatusUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        salesman = request.user.salesmen.get()

        with transaction.atomic():
            # 1. Update Salesman's current status
            salesman.current_location_lat = data["latitude"]
            salesman.current_location_lng = data["longitude"]
            salesman.battery = data["battery"]
            salesman.status = "active"
            salesman.last_seen = timezone.now()
            salesman.save()

            # 2. Create a new historical location point
            LocationPoint.objects.create(salesman=salesman, latitude=data["latitude"], longitude=data["longitude"])

            # 3. Update today's DailyActivity record
            activity, created = DailyActivity.objects.get_or_create(salesman=salesman, date=timezone.now().date(), defaults={"start_time": timezone.now().time()})

            if not activity.route_coordinates_json:
                activity.route_coordinates_json = []

            activity.route_coordinates_json.append({"lat": data["latitude"], "lng": data["longitude"]})
            activity.save()

        return Response({"message": "Status updated successfully."}, status=status.HTTP_200_OK)


class SalesmanSetTrackingStatusView(views.APIView):
    """
    (Salesman) Manually set tracking status to 'active' or 'offline'.
    POST: /api/tracker/salesman/set_tracking_status/
    """

    permission_classes = [IsAuthenticated, IsSalesman]

    def post(self, request, *args, **kwargs):
        serializer = SalesmanTrackingStatusSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        salesman = request.user.salesmen.get()
        salesman.status = serializer.validated_data["status"]
        salesman.save()
        return Response({"status": salesman.status}, status=status.HTTP_200_OK)


class SalesmanActivityHistoryView(generics.ListAPIView):
    """
    (Salesman) List of past daily activities for the logged-in salesman.
    GET: /api/tracker/salesman/activity_history/
    """

    serializer_class = DailyActivitySerializer
    permission_classes = [IsAuthenticated, IsSalesman]

    def get_queryset(self):
        return DailyActivity.objects.filter(salesman__user=self.request.user)


class GooglePlacesProxyView(views.APIView):
    """
    (Salesman) Securely proxy search requests to the Google Places API.
    GET: /api/tracker/salesman/places_search/?query=...
    """

    permission_classes = [IsAuthenticated, IsSalesman]

    def get(self, request, *args, **kwargs):
        query = request.query_params.get("query")
        api_key = os.getenv("GOOGLE_MAPS_API_KEY")  # IMPORTANT: Store your key in environment variables

        if not api_key:
            return Response({"error": "Google API key not configured on server."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        if not query:
            return Response({"error": "Query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?query={query}&key={api_key}"
        try:
            response = requests.get(url)
            response.raise_for_status()  # Raises an exception for bad status codes
            return Response(response.json(), status=response.status_code)
        except requests.exceptions.RequestException as e:
            return Response({"error": f"Failed to connect to Google Places API: {e}"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class SalesmanPlannedRouteView(generics.ListCreateAPIView):
    """
    (Salesman) List all planned routes or create a new one for the logged-in salesman.
    GET, POST: /api/tracker/salesman/planned_routes/
    """

    permission_classes = [IsAuthenticated, IsSalesman]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return PlannedRouteWriteSerializer
        return PlannedRouteReadSerializer

    def get_queryset(self):
        return PlannedRoute.objects.filter(salesman__user=self.request.user).prefetch_related("stops")

    def perform_create(self, serializer):
        salesman = self.request.user.salesmen.get()
        stops_data = serializer.validated_data.pop("stops")

        with transaction.atomic():
            route = serializer.save(salesman=salesman)
            for stop_data in stops_data:
                RouteStop.objects.create(route=route, **stop_data)


class SalesmanTodayPlannedRouteView(generics.RetrieveAPIView):
    """
    (Salesman) Retrieve today's planned route for the logged-in salesman.
    GET: /api/tracker/salesman/planned_routes/today/
    """

    serializer_class = PlannedRouteReadSerializer
    permission_classes = [IsAuthenticated, IsSalesman]

    def get_object(self):
        queryset = PlannedRoute.objects.filter(salesman__user=self.request.user, date=timezone.now().date())
        obj = get_object_or_404(queryset)
        return obj


class SalesmanRouteStopUpdateStatusView(generics.UpdateAPIView):
    """
    (Salesman) Update the status of a specific route stop ('visited', 'skipped').
    PUT, PATCH: /api/tracker/salesman/planned_routes/stops/<pk>/update_status/
    """

    serializer_class = RouteStopStatusUpdateSerializer
    permission_classes = [IsAuthenticated, IsSalesman]

    def get_queryset(self):
        # Ensure salesman can only update their own stops
        return RouteStop.objects.filter(route__salesman__user=self.request.user)

    def perform_update(self, serializer):
        stop = self.get_object()
        stop.status = serializer.validated_data["status"]
        stop.visited_at = timezone.now()
        stop.save()

class SalesmanTodayActivityView(views.APIView):
    """
    (Salesman) Retrieves or creates today's activity log for the logged-in salesman.
    GET: /api/tracker/salesman/activity/today/
    """
    permission_classes = [IsAuthenticated, IsSalesman]

    def get(self, request, *args, **kwargs):
        salesman = request.user.salesmen.get()
        activity, created = DailyActivity.objects.get_or_create(
            salesman=salesman,
            date=timezone.now().date(),
        )
        serializer = DailyActivitySerializer(activity)
        isTracking = salesman.status == "active"
        data = serializer.data
        data["is_tracking"] = isTracking
        print(f"Salesman {salesman.user.username} - Activity for today: {isTracking}")
        return Response(data, status=status.HTTP_200_OK)


class SalesmanMonthlyStatsView(views.APIView):
    """
    (Salesman) Retrieves aggregated stats for the current month for the salesman.
    GET: /api/tracker/salesman/stats/monthly/
    """
    permission_classes = [IsAuthenticated, IsSalesman]

    def get(self, request, *args, **kwargs):
        salesman = request.user.salesmen.get()
        today = timezone.now().date()
        first_day_of_month = today.replace(day=1)

        stats = DailyActivity.objects.filter(
            salesman=salesman,
            date__gte=first_day_of_month,
            date__lte=today
        ).aggregate(
            total_visits=Sum('checkpoints'),
            active_days=Count('id')
        )
        
        return Response({
            "total_visits": stats.get('total_visits') or 0,
            "active_days": stats.get('active_days') or 0
        }, status=status.HTTP_200_OK)


class SalesmanAddRouteStopView(views.APIView):
    """
    (Salesman) Adds a single stop to the planned route for today.
    Creates the route if it doesn't exist.
    POST: /api/tracker/salesman/planned_routes/add_stop/
    """
    permission_classes = [IsAuthenticated, IsSalesman]

    def post(self, request, *args, **kwargs):
        serializer = AddRouteStopSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        salesman = request.user.salesmen.get()

        with transaction.atomic():
            planned_route, created = PlannedRoute.objects.get_or_create(
                salesman=salesman,
                date=timezone.now().date(),
                defaults={'name': f"Route for {timezone.now().strftime('%Y-%m-%d')}"}
            )

            # CORRECTED LINE: Using models.Max after importing models
            last_order = planned_route.stops.aggregate(max_order=models.Max('order'))['max_order'] or 0
            
            stop = RouteStop.objects.create(
                route=planned_route,
                order=last_order + 1,
                **data
            )

        return Response({"message": "Stop added successfully", "stop_id": stop.id}, status=status.HTTP_201_CREATED)
