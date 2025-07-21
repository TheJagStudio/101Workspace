import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import {
	Battery,
	CheckCircle,
	Clock,
	MapPin,
	Play,
	Route,
	Search,
	Settings,
	Square,
	Wifi,
	WifiOff,
	Navigation,
	ArrowUp,
	ArrowRight,
	ArrowLeft,
	RotateCcw,
	X,
	ChevronDown,
	ChevronUp,
	Zap,
	RefreshCcw,
	Scroll, // Added for refresh functionality
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Alert, FlatList, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View, Dimensions, Animated, ScrollView } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from "react-native-maps"; // Added Polyline
import MapViewDirections from "react-native-maps-directions";
import { SafeAreaView } from "react-native-safe-area-context";
import "react-native-url-polyfill/auto";
import { apiRequest } from "../utils/api";
import { useBatteryLevel } from 'expo-battery';
import * as Network from 'expo-network';
import { createClient } from "@supabase/supabase-js";
import { Linking } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL_SECOND;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY_SECOND;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const LOCATION_TASK_NAME = "background-location-task";

// Enhanced TaskManager with better error handling
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
	if (error) {
		console.error("TaskManager Error:", error);
		return;
	}

	if (data) {
		const { locations } = data;
		const location = locations[0];

		if (location) {
			console.log("Background Location Update:", location.coords);

			try {
				const sessionStr = await AsyncStorage.getItem("supabase.auth.token");
				const session = sessionStr ? JSON.parse(sessionStr) : null;

				if (!session || !session.user || !session.access_token) {
					console.log("No valid session found, skipping location update");
					return;
				}

				// Update current location
				await fetch(supabaseUrl + "/rest/v1/salesman?authId=eq." + session?.user.id, {
					method: "PATCH",
					headers: {
						apikey: supabaseAnonKey,
						Authorization: `Bearer ${session?.access_token}`,
						"Content-Type": "application/json",
						Prefer: "return=minimal",
					},
					body: JSON.stringify({
						current_location_lat: location.coords.latitude,
						current_location_lng: location.coords.longitude,
						last_updated: new Date().toISOString(),
					}),
				});

				console.log("Location sent to Supabase successfully.");
				await AsyncStorage.setItem(
					"lastLocation",
					JSON.stringify({
						...location.coords,
						timestamp: new Date().toISOString(),
					})
				);

				// Store route tracking data
				const salesmanInfo = await AsyncStorage.getItem("salesmanInfo");
				if (salesmanInfo) {
					const parsedSalesmanInfo = JSON.parse(salesmanInfo);
					await fetch(supabaseUrl + "/rest/v1/tracker_locationpoint", {
						method: "POST",
						headers: {
							apikey: supabaseAnonKey,
							Authorization: `Bearer ${session?.access_token}`, // Use access token for this, not anon key
							"Content-Type": "application/json",
							Prefer: "return=minimal",
						},
						body: JSON.stringify({
							latitude: location.coords.latitude,
							longitude: location.coords.longitude,
							timestamp: new Date().toISOString(),
							salesman_id: parsedSalesmanInfo?.id,
							accuracy: location.coords.accuracy,
							speed: location.coords.speed,
							heading: location.coords.heading,
						}),
					});
					console.log("Route tracking data sent successfully.");
				}
			} catch (e) {
				console.error("Background Task Error:", e);
			}
		}
	}
});

// Enhanced Alert Component
const AlertComponent = ({ alert, onRemove }) => {
	const slideAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		Animated.spring(slideAnim, {
			toValue: 1,
			useNativeDriver: true,
			tension: 100,
			friction: 8,
		}).start();
	}, []);

	const handleRemove = () => {
		Animated.timing(slideAnim, {
			toValue: 0,
			duration: 200,
			useNativeDriver: true,
		}).start(() => onRemove());
	};

	const getAlertStyles = () => {
		switch (alert.type) {
			case "error":
				return {
					bg: "bg-red-50",
					border: "border-red-500",
					text: "text-red-700",
					shadow: "shadow-red-500/25",
				};
			case "success":
				return {
					bg: "bg-green-50",
					border: "border-green-500",
					text: "text-green-700",
					shadow: "shadow-green-500/25",
				};
			case "info":
				return {
					bg: "bg-blue-50",
					border: "border-blue-500",
					text: "text-blue-700",
					shadow: "shadow-blue-500/25",
				};
			default:
				return {
					bg: "bg-gray-50",
					border: "border-gray-500",
					text: "text-gray-700",
					shadow: "shadow-gray-500/25",
				};
		}
	};

	const styles = getAlertStyles();

	return (
		<Animated.View
			style={{
				transform: [
					{
						translateY: slideAnim.interpolate({
							inputRange: [0, 1],
							outputRange: [50, 0],
						}),
					},
					{
						scale: slideAnim,
					},
				],
				opacity: slideAnim,
			}}
			className={`flex-row items-center justify-between min-w-[300px] max-w-[90vw] ${styles.bg} border border-l-4 ${styles.border} py-3 px-4 rounded-xl shadow-lg ${styles.shadow} mb-2`}
		>
			<Text className={`${styles.text} flex-1 font-medium`}>{alert?.message}</Text>
			<TouchableOpacity onPress={handleRemove} className="ml-3 p-1">
				<X size={18} color={styles.text.includes("red") ? "#b91c1c" : styles.text.includes("green") ? "#15803d" : "#1d4ed8"} />
			</TouchableOpacity>
		</Animated.View>
	);
};

// Navigation Instructions Component
const NavigationInstructions = ({ instructions, isVisible, onToggle, nextStep }) => {
	const slideAnim = useRef(new Animated.Value(isVisible ? 1 : 0)).current;

	useEffect(() => {
		Animated.timing(slideAnim, {
			toValue: isVisible ? 1 : 0,
			duration: 300,
			useNativeDriver: true,
		}).start();
	}, [isVisible]);

	const getInstructionIcon = (instruction) => {
		const text = instruction?.toLowerCase() || "";
		if (text.includes("left")) return <ArrowLeft size={24} color="#fff" />;
		if (text.includes("right")) return <ArrowRight size={24} color="#fff" />;
		if (text.includes("u-turn")) return <RotateCcw size={24} color="#fff" />;
		return <ArrowUp size={24} color="#fff" />;
	};

	return (
		<Animated.View
			style={{
				transform: [
					{
						translateY: slideAnim.interpolate({
							inputRange: [0, 1],
							outputRange: [-100, 0],
						}),
					},
				],
				opacity: slideAnim,
			}}
			className="absolute top-4 left-4 right-4 z-10"
		>
			<View className="bg-blue-600 rounded-xl p-4 shadow-lg">
				<TouchableOpacity onPress={onToggle} className="flex-row items-center justify-between">
					<View className="flex-row items-center flex-1">
						<View className="mr-3">{getInstructionIcon(instructions)}</View>
						<View className="flex-1">
							<Text className="text-white font-bold text-base" numberOfLines={2}>
								{instructions || "Follow the route"}
							</Text>
							{nextStep && (
								<Text className="text-blue-200 text-sm mt-1" numberOfLines={1}>
									Then {nextStep}
								</Text>
							)}
						</View>
					</View>
					<View className="ml-2">{isVisible ? <ChevronUp size={20} color="#fff" /> : <ChevronDown size={20} color="#fff" />}</View>
				</TouchableOpacity>
			</View>
		</Animated.View>
	);
};

const Home = () => {
	// State variables
	const [isTracking, setIsTracking] = useState(false);
	const [isRegistered, setIsRegistered] = useState(false);
	const [permissionsGranted, setPermissionsGranted] = useState(false);
	const [battery, setBattery] = useState(100);
	const [signal, setSignal] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState([]);
	const [alerts, setAlerts] = useState([]);
	const [routeHistory, setRouteHistory] = useState([]);
	const [todaysActivity, setTodaysActivity] = useState(null);
	const [todaysPlannedRoute, setTodaysPlannedRoute] = useState(null);
	const [currentLocation, setCurrentLocation] = useState(null);
	const [isNavigating, setIsNavigating] = useState(false);
	const [routeInstructions, setRouteInstructions] = useState(null);
	const [showInstructions, setShowInstructions] = useState(true);
	const [routeProgress, setRouteProgress] = useState(null);
	const [isMapReady, setIsMapReady] = useState(false);
	const [mapDirectionsKey, setMapDirectionsKey] = useState(0);
	const batteryLevel = useBatteryLevel();
	const networkState = Network.useNetworkState();
	console.log(`Current network type: ${networkState.type}`);

	const navigation = useNavigation();
	const mapRef = useRef(null);
	const locationInterval = useRef(null);
	const routeFetchInterval = useRef(null); // New ref for route fetch interval

	// Enhanced permission checking
	const checkCurrentPermissions = useCallback(async () => {
		try {
			const foregroundPermission = await Location.getForegroundPermissionsAsync();
			const backgroundPermission = await Location.getBackgroundPermissionsAsync();

			const hasPermissions = foregroundPermission.status === "granted" && backgroundPermission.status === "granted";

			setPermissionsGranted(hasPermissions);

			return {
				foreground: foregroundPermission.status,
				background: backgroundPermission.status,
			};
		} catch (error) {
			console.error("Error checking permissions:", error);
			return null;
		}
	}, []);

	// Enhanced location tracking registration
	const handleRegisterTask = useCallback(async () => {
		try {
			// Check current permissions first to avoid redundant requests if already granted
			const currentForegroundPermission = await Location.getForegroundPermissionsAsync();
			const currentBackgroundPermission = await Location.getBackgroundPermissionsAsync();

			let foregroundStatus = currentForegroundPermission.status;
			let backgroundStatus = currentBackgroundPermission.status;

			// Request foreground permissions if not granted
			if (foregroundStatus !== "granted") {
				const { status } = await Location.requestForegroundPermissionsAsync();
				foregroundStatus = status;
			}

			if (foregroundStatus !== "granted") {
				addAlert("error", "Foreground location access is required for tracking.");
				return false;
			}

			// Request background permissions if not granted
			if (backgroundStatus !== "granted") {
				const { status } = await Location.requestBackgroundPermissionsAsync();
				backgroundStatus = status;
			}

			if (backgroundStatus !== "granted") {
				addAlert("error", "Background location access is required. Please enable 'Allow all the time' in settings.");
				return false;
			}

			setPermissionsGranted(true);

			// Check if task is already registered
			const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
			if (isTaskRegistered) {
				console.log("Location task already registered.");
				setIsRegistered(true);
				addAlert("info", "Location tracking is already active.");
				return true;
			}

			// Start background location updates with enhanced configuration
			await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
				accuracy: Location.Accuracy.BestForNavigation,
				timeInterval: 10000, // 10 seconds
				distanceInterval: 20, // 20 meters
				deferredUpdatesInterval: 30000, // 30 seconds
				foregroundService: {
					notificationTitle: "📍 Location Tracking Active",
					notificationBody: "Tracking your route for work purposes",
					notificationColor: "#3498db",
				},
				pausesUpdatesAutomatically: false,
				showsBackgroundLocationIndicator: true,
			});

			setIsRegistered(true);
			addAlert("success", "Location tracking activated successfully!");
			return true;
		} catch (error) {
			console.error("Error in handleRegisterTask:", error);
			addAlert("error", "Failed to set up location tracking. Please try again.");
			return false;
		}
	}, [addAlert]);

	// Enhanced location tracking stop
	const handleUnregisterTask = useCallback(async () => {
		try {
			const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
			if (isTaskRegistered) {
				await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
				setIsRegistered(false);
				addAlert("success", "Location tracking stopped successfully.");
			} else {
				addAlert("info", "Location tracking was not active.");
			}
		} catch (error) {
			console.error("Error stopping location updates:", error);
			addAlert("error", "Failed to stop location tracking.");
		}
	}, [addAlert]);

	// Alert management
	const addAlert = useCallback((type, message) => {
		const alert = { type, message, id: Date.now() };
		setAlerts((prev) => [...prev, alert]);

		// Auto-remove after 4 seconds
		setTimeout(() => {
			setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
		}, 4000);
	}, []);

	const removeAlert = useCallback((alertToRemove) => {
		setAlerts((prev) => prev.filter((alert) => alert !== alertToRemove));
	}, []);

	// Authentication check
	useEffect(() => {
		const checkUser = async () => {
			const accessToken = await AsyncStorage.getItem("accessToken");
			const refreshToken = await AsyncStorage.getItem("refreshToken");
			const salesmanInfo = await AsyncStorage.getItem("salesmanInfo");
			const sessionStr = await AsyncStorage.getItem("supabase.auth.token");
			if (!accessToken || !refreshToken || !salesmanInfo || !sessionStr) {
				await handleUnregisterTask(); // Stop tracking if no valid session
				navigation.replace("login");
			}
		};
		checkUser();
	}, [navigation]);

	// Function to fetch today's activity and planned route
	const fetchTodaysData = useCallback(async () => {
		try {
			const activityResponse = await apiRequest(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker/salesman/activity/today/`);
			setTodaysActivity(activityResponse);
			if (activityResponse?.is_tracking) {
				setIsTracking(activityResponse.is_tracking);
			} else {
				// If backend says not tracking, ensure we stop local tracking too
				// await handleUnregisterTask(); // Uncomment if you want automatic stop on backend status change
			}
		} catch (err) {
			if (err.name === "AuthError") {
				navigation.replace("login");
			} else if (err.status !== 404) {
				addAlert("error", err.message || "Failed to fetch today's activity.");
			} else {
				setTodaysActivity(null); // Clear activity if 404
			}
		}

		try {
			const routeResponse = await apiRequest(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker/salesman/planned_routes/today/`);
			setTodaysPlannedRoute(routeResponse);
			setMapDirectionsKey((prev) => prev + 1); // Increment key to force MapViewDirections re-render
		} catch (err) {
			if (err.status !== 404) {
				// addAlert("info", "There isn't any planned route today.");
			} else {
				setTodaysPlannedRoute(null); // Clear route if 404
			}
		}
	}, [addAlert, navigation]);

	// Initialize location tracking and fetch data
	useEffect(() => {
		const initializeApp = async () => {
			// Check permissions
			await checkCurrentPermissions();

			// Start location tracking if permissions are granted
			await handleRegisterTask(); // Call it here for initial setup

			// Initialize Supabase session
			try {
				const {
					data: { session },
				} = await supabase.auth.getSession();
				if (session) {
					await AsyncStorage.setItem("supabase.auth.token", JSON.stringify(session));

					const { data: salesman, error } = await supabase.from("salesman").select("*").eq("authId", session.user.id).single();

					if (error) {
						console.error("Error fetching salesman data:", error);
						addAlert("error", "Failed to fetch user data.");
					} else {
						await AsyncStorage.setItem("salesmanInfo", JSON.stringify(salesman));
						await AsyncStorage.setItem("userInfo", JSON.stringify(salesman)); // Ensure userInfo is also set
						await AsyncStorage.setItem("accessToken", session.access_token);
						await AsyncStorage.setItem("refreshToken", session.refresh_token);
						await AsyncStorage.setItem("salesmanId", salesman.id.toString());
					}
				}
			} catch (error) {
				console.error("Session initialization error:", error);
			}

			// Fetch initial today's data
			await fetchTodaysData();
		};

		initializeApp();

		// Set up location update interval for current location display
		locationInterval.current = setInterval(async () => {
			try {
				const lastLocationStr = await AsyncStorage.getItem("lastLocation");
				if (lastLocationStr) {
					const lastLocation = JSON.parse(lastLocationStr);
					setCurrentLocation(lastLocation);
				}
			} catch (error) {
				console.error("Error fetching lastLocation from AsyncStorage:", error);
			}
		}, 5000); // Update current location every 5 seconds

		// Set up route data fetch interval
		routeFetchInterval.current = setInterval(fetchTodaysData, 60000); // Refresh route data every 60 seconds

		return () => {
			if (locationInterval.current) {
				clearInterval(locationInterval.current);
			}
			if (routeFetchInterval.current) {
				clearInterval(routeFetchInterval.current);
			}
		};
	}, [addAlert, checkCurrentPermissions, handleRegisterTask, navigation, fetchTodaysData]);

	// Enhanced search functionality
	const handleSearch = useCallback(async () => {
		if (!searchQuery.trim()) return;

		try {
			const data = await apiRequest(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker/salesman/places_search/?query=${encodeURIComponent(searchQuery)}`);

			if (data.status === "OK" && data.results) {
				const formattedResults = data.results.map((place) => ({
					id: place?.place_id,
					name: place?.name,
					address: place?.formatted_address,
					lat: place?.geometry?.location?.lat,
					lng: place?.geometry?.location?.lng,
					rating: place?.rating,
					types: place?.types,
				}));
				setSearchResults(formattedResults);
			} else {
				setSearchResults([]);
				addAlert("info", "No places found for your search");
			}
		} catch (err) {
			console.error("Search error:", err);
			addAlert("error", "Failed to search places. Please try again.");
			setSearchResults([]);
		}

		Keyboard.dismiss();
	}, [searchQuery, addAlert]);

	// Enhanced route management
	const handleAddToRoute = useCallback(
		async (place, isBulk = false) => {
			const payload = {
				location_name: place?.name,
				address: place?.address,
				latitude: place?.lat,
				longitude: place?.lng,
				place_id: place?.id, // Ensure place_id is sent
			};

			try {
				await apiRequest(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker/salesman/planned_routes/add_stop/`, {
					method: "POST",
					body: JSON.stringify(payload),
				});

				if (!isBulk) {
					addAlert("success", `Added "${place?.name}" to your route!`);
				}

				// Refresh planned route
				await fetchTodaysData(); // Use the consolidated fetch function

				// Update route history (client-side only for display)
				setRouteHistory((prev) => {
					const exists = prev.some((entry) => entry.id === place.id);
					if (!exists) {
						return [...prev, { id: place.id, addedAt: new Date().toISOString() }];
					}
					return prev;
				});
			} catch (err) {
				console.error("Add to route error:", err);
				addAlert("error", `Failed to add "${place?.name}" to route.`);
			}
		},
		[addAlert, fetchTodaysData]
	);

	const handleRemoveFromRoute = useCallback(
		async (placeId, placeName) => {
			try {
				await apiRequest(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker/salesman/planned_routes/delete_stop/${placeId}/`, {
					method: "DELETE",
				});
				addAlert("success", `Removed "${placeName}" from route successfully.`);
				await fetchTodaysData();
				setRouteHistory((prev) => prev.filter((entry) => entry.id !== placeId));
			} catch (error) {
				console.error("Error removing from route:", error);
				addAlert("error", `Failed to remove "${placeName}" from route.`);
			}
		},
		[addAlert, fetchTodaysData]
	);

	// Navigation controls
	const startNavigation = useCallback(() => {
		if (plannedRouteMarkers.length < 2) {
			addAlert("error", "At least two stops are needed to start navigation.");
			return;
		}

		setIsNavigating(true);
		setShowInstructions(true);
		addAlert("success", "Navigation started! Follow the red route.");

		// Focus map on route
		if (mapRef.current && plannedRouteMarkers.length > 0) {
			mapRef.current.fitToCoordinates(
				plannedRouteMarkers.map((marker) => marker.coordinate),
				{
					edgePadding: { top: 100, right: 50, bottom: 50, left: 50 },
					animated: true,
				}
			);
		}
	}, [plannedRouteMarkers, addAlert]);

	const stopNavigation = useCallback(() => {
		setIsNavigating(false);
		setShowInstructions(false);
		setRouteInstructions(null);
		setRouteProgress(null);
		addAlert("info", "Navigation stopped.");
	}, [addAlert]);

	// Enhanced tracking toggle
	const handleToggleTracking = useCallback(async () => {
		const newTrackingStatus = !isTracking;

		try {
			// Update tracking status in backend
			await apiRequest(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker/salesman/set_tracking_status/`, {
				method: "POST",
				body: JSON.stringify({
					status: newTrackingStatus ? "active" : "offline",
				}),
			});

			// Start or stop local background location tracking
			if (newTrackingStatus) {
				const success = await handleRegisterTask();
				if (success) {
					setIsTracking(true);
					addAlert("success", "Tracking started successfully!");
				}
			} else {
				await handleUnregisterTask();
				setIsTracking(false);
				addAlert("info", "Tracking stopped successfully.");
			}
			await fetchTodaysData(); // Refresh activity status
		} catch (error) {
			console.error("Error toggling tracking:", error);
			addAlert("error", "Failed to update tracking status.");
		}
	}, [isTracking, handleRegisterTask, handleUnregisterTask, addAlert, fetchTodaysData]);

	// Memoized computed values
	const plannedRouteMarkers = useMemo(() => {
		if (!todaysPlannedRoute?.stops || !Array.isArray(todaysPlannedRoute.stops)) {
			return [];
		}

		return todaysPlannedRoute.stops.map((stop, idx) => ({
			id: stop.id?.toString() || idx.toString(),
			placeId: stop.place_id, // Store place_id for deletion
			title: stop.location_name || `Stop ${idx + 1}`,
			description: stop.address || "",
			coordinate: {
				latitude: stop.latitude,
				longitude: stop.longitude,
			},
			isFirst: idx === 0,
			isLast: idx === todaysPlannedRoute.stops.length - 1,
		}));
	}, [todaysPlannedRoute]);

	const initialRegion = useMemo(() => {
		if (currentLocation) {
			return {
				latitude: currentLocation.latitude,
				longitude: currentLocation.longitude,
				latitudeDelta: 0.01,
				longitudeDelta: 0.01,
			};
		}

		if (plannedRouteMarkers.length > 0) {
			return {
				latitude: plannedRouteMarkers[0].coordinate.latitude,
				longitude: plannedRouteMarkers[0].coordinate.longitude,
				latitudeDelta: 0.05,
				longitudeDelta: 0.05,
			};
		}

		return {
			latitude: 37.78825,
			longitude: -122.4324,
			latitudeDelta: 0.05,
			longitudeDelta: 0.05,
		};
	}, [currentLocation, plannedRouteMarkers]);

	const canNavigate = useMemo(() => {
		return plannedRouteMarkers.length >= 1;
	}, [plannedRouteMarkers]);

	// Battery status and signal strength (mocked for now, can be integrated with native modules)
	useEffect(() => {
		// Mock signal strength
		const signalInterval = setInterval(() => {
			setSignal(Math.random() > 0.1); // 90% chance of good signal
		}, 15000); // Check every 15 seconds

		const checkUser = async () => {
			const accessToken = await AsyncStorage.getItem("accessToken");
			const refreshToken = await AsyncStorage.getItem("refreshToken");
			const salesmanInfo = await AsyncStorage.getItem("salesmanInfo");
			const sessionStr = await AsyncStorage.getItem("supabase.auth.token");
			if (!accessToken || !refreshToken || !salesmanInfo || !sessionStr) {
				await handleUnregisterTask(); // Stop tracking if no valid session
				navigation.replace("login");
			}
		};
		checkUser();
		return () => {
			clearInterval(signalInterval);
		};
	}, []);

	return (
		<SafeAreaView className="flex-1 bg-gray-50">
			<ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }} stickyHeaderIndices={[0]} nestedScrollEnabled={true}>
				{/* Enhanced Header */}
				<View className="px-4 pt-2 pb-4 bg-white shadow-sm z-20">
					<View className="flex-row items-center gap-3">
						<View className="flex-1 bg-gray-100 rounded-xl flex-row items-center px-3 py-2">
							<TextInput className="flex-1 text-base text-gray-900 py-1" placeholder="Search places, gas stations, restaurants..." value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={handleSearch} returnKeyType="search" placeholderTextColor="#6b7280" />
							<TouchableOpacity className="bg-red-500 rounded-lg px-3 py-2 ml-2" onPress={handleSearch}>
								<Search size={16} color="#fff" />
							</TouchableOpacity>
						</View>
						<TouchableOpacity className="bg-gray-100 rounded-xl p-3" onPress={() => navigation.replace("settings")}>
							<Settings size={24} color="#374151" />
						</TouchableOpacity>
					</View>
					{/* Search Results */}
					{searchResults.length > 0 && (
						<View className="bg-white rounded-xl border border-gray-200 mt-3 max-h-60 shadow-sm z-10">
							<ScrollView className="max-h-64 h-64 overflow-y-auto" contentContainerStyle={{ flexGrow: 1 }} nestedScrollEnabled={true}>
								{searchResults.map((item) => (
									<TouchableOpacity key={item?.id} className="flex-row justify-between items-center py-3 px-4 border-b border-gray-100" onPress={() => handleAddToRoute(item)}>
										<View className="flex-1">
											<Text className="font-semibold text-gray-900 text-base">{item?.name}</Text>
											<Text className="text-gray-500 text-sm mt-1" numberOfLines={1}>
												{item?.address}
											</Text>
										</View>
										{!routeHistory.some((entry) => entry.id === item?.id) && (
											<View className="bg-red-500 rounded-lg px-3 py-2">
												<Text className="text-white font-semibold text-sm">Add</Text>
											</View>
										)}
									</TouchableOpacity>
								))}
							</ScrollView>
							<View className="flex-row justify-between p-3 bg-gray-50 rounded-b-xl">
								<TouchableOpacity
									className="bg-red-500 rounded-lg px-4 py-2 flex-1 mr-2"
									onPress={() => {
										searchResults.forEach((place) => handleAddToRoute(place, true));
										setSearchResults([]);
										addAlert("success", "Added all results to your route!");
									}}
								>
									<Text className="text-white font-semibold text-center">Add All</Text>
								</TouchableOpacity>
								<TouchableOpacity className="bg-gray-500 rounded-lg px-4 py-2 flex-1 ml-2" onPress={() => setSearchResults([])}>
									<Text className="text-white font-semibold text-center">Clear</Text>
								</TouchableOpacity>
							</View>
						</View>
					)}

					{/* Enhanced Status Bar */}
					<View className="flex-row justify-between mt-4 bg-gray-50 rounded-xl p-3">
						<View className="items-center flex-1">
							<View className="flex-row items-center gap-0">
								<View className={`w-3 h-3 rounded-full mr-2 ${isTracking ? "bg-green-400" : "bg-red-400"}`} />
								<Text className={`font-semibold ${isTracking ? "text-green-600" : "text-red-600"}`}>{isTracking ? "Active" : "Inactive"}</Text>
							</View>
							<Text className="text-xs text-gray-500 mt-1">Status</Text>
						</View>

						<View className="items-center flex-1">
							<View className="flex-row items-center gap-2">
								<Battery size={18} color={(batteryLevel*100).toFixed(0) < 20 ? "#ef4444" : "#22c55e"} className="mr-1" />
								<Text className="font-semibold text-gray-800">{(batteryLevel*100).toFixed(0)}%</Text>
							</View>
							<Text className="text-xs text-gray-500 mt-1">Battery</Text>
						</View>

						<View className="items-center flex-1">
							<View className="flex-row items-center gap-0">
								{signal ? <Wifi size={18} color="#22c55e" /> : <WifiOff size={18} color="#ef4444" />}
								<Text className="font-semibold text-gray-800 ml-1">{signal ? "Strong" : "Weak"}</Text>
							</View>
							<Text className="text-xs text-gray-500 mt-1">Signal</Text>
						</View>
					</View>
				</View>
				<View className="flex-1">

					{/* Control Buttons */}
					<View className="flex-row px-4 my-4 gap-3">
						<TouchableOpacity className={`flex-1 flex-row items-center justify-center py-4 rounded-xl ${isTracking ? "bg-red-500" : "bg-green-500"}`} onPress={handleToggleTracking}>
							{isTracking ? <Square size={20} color="#fff" className="mr-2" /> : <Play size={20} color="#fff" className="mr-2" />}
							<Text className="text-white font-bold text-base ml-2">{isTracking ? "Stop Tracking" : "Start Tracking"}</Text>
						</TouchableOpacity>

						{/* <TouchableOpacity className={`flex-1 flex-row items-center justify-center py-4 rounded-xl ${canNavigate ? (isNavigating ? "bg-yellow-500" : "bg-blue-500") : "bg-gray-400"}`} onPress={isNavigating ? stopNavigation : startNavigation} disabled={!canNavigate}>
							{isNavigating ? <X size={20} color="#fff" className="mr-2" /> : <Navigation size={20} color="#fff" className="mr-2" />}
							<Text className="text-white font-bold text-base ml-2">{isNavigating ? "Stop Nav." : "Start Nav."}</Text>
						</TouchableOpacity> */}
						{/* create button which will open the full route in google maps */}
						<TouchableOpacity className={`flex-1 flex-row items-center justify-center py-4 rounded-xl ${canNavigate ? (isNavigating ? "bg-yellow-500" : "bg-blue-500") : "bg-gray-400"}`} onPress={()=>{
							Linking.openURL(`https://www.google.com/maps/dir/?api=1&origin=${currentLocation.latitude},${currentLocation.longitude}&destination=${plannedRouteMarkers[plannedRouteMarkers.length - 1].coordinate.latitude},${plannedRouteMarkers[plannedRouteMarkers.length - 1].coordinate.longitude}&waypoints=${plannedRouteMarkers.slice(1, -1).map(marker => `${marker.coordinate.latitude},${marker.coordinate.longitude}`).join("|")}`);
						}} disabled={!canNavigate}>
							<Navigation size={20} color="#fff" className="mr-2" />
							<Text className="text-white font-bold text-base ml-2">Open in Maps</Text>
						</TouchableOpacity>
					</View>

					{/* Map Section */}
					<View className="flex-1 min-h-96 mx-4 mb-4 rounded-xl overflow-hidden bg-white border border-gray-200 shadow-md">
						<MapView ref={mapRef} style={StyleSheet.absoluteFillObject} provider={PROVIDER_GOOGLE} initialRegion={initialRegion} center={currentLocation} showsUserLocation={true} showsMyLocationButton={true} showsCompass={false} showsScale={false} showsTraffic={false} loadingEnabled={true} loadingIndicatorColor="#3498db" loadingBackgroundColor="#f0f0f0" onMapReady={() => setIsMapReady(true)}>
							{plannedRouteMarkers?.map((marker, index) => (
								<Marker key={index} coordinate={marker.coordinate} title={marker.title} description={marker.description}  >
									<MapPin
										size={20}
										color="#fff"
										style={{
											backgroundColor: "blue",
											margin: 0,
											borderRadius: 50,
											borderWidth: 3,
											borderColor: "black",
										}}
									/>
									{/* Optional: Add text for start/end points */}
									{marker.isFirst && <Text style={{ color: "white", fontSize: 10, position: "absolute", bottom: -15 }}>Start</Text>}
									{marker.isLast && <Text style={{ color: "white", fontSize: 10, position: "absolute", bottom: -15 }}>End</Text>}
								</Marker>
							))}
							{/* {currentLocation && (
								<Marker
									coordinate={{
										latitude: currentLocation.latitude,
										longitude: currentLocation.longitude,
									}}
									title="My Current Location"
									anchor={{ x: 0.5, y: 0.5 }}
								>
									<View
										style={{
											backgroundColor: "#007bff",
											padding: 8,
											borderRadius: 50,
											borderWidth: 3,
											borderColor: "white",
											shadowColor: "#000",
											shadowOffset: { width: 0, height: 2 },
											shadowOpacity: 0.25,
											shadowRadius: 3.84,
											elevation: 5,
										}}
									>
										<Navigation size={20} color="#fff" />
									</View>
								</Marker>
							)} */}
							{isMapReady && plannedRouteMarkers.length >= 1 && (
								<MapViewDirections
									origin={currentLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude } : plannedRouteMarkers[0].coordinate}
									destination={plannedRouteMarkers[plannedRouteMarkers.length - 1].coordinate}
									waypoints={plannedRouteMarkers.slice(0, -1).map((marker) => marker.coordinate)}
									apikey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}
									strokeWidth={6}
									strokeColor="red"
									optimizeWaypoints={true}
								/>
							)}
							
						</MapView>
						{isNavigating && <NavigationInstructions instructions={routeInstructions} isVisible={showInstructions} onToggle={() => setShowInstructions((prev) => !prev)} nextStep={routeProgress && routeProgress.steps[routeProgress.currentStep + 1]?.instructions} />}
					</View>

					{/* Today's Activity */}
					{/* <View className="bg-white rounded-xl p-4 mx-4 mb-4 shadow-md">
						<View className="flex-row justify-between items-center mb-2">
							<Text className="font-bold text-gray-800 text-lg">Today's Activity</Text>
							<TouchableOpacity onPress={fetchTodaysData} className="p-2 rounded-full bg-gray-100">
								<RefreshCcw size={20} color="#6b7280" />
							</TouchableOpacity>
						</View>
						{todaysActivity ? (
							<View className="flex-row justify-around gap-2">
								<View className="flex-row flex-1 items-center justify-start bg-gray-50 p-2 rounded-lg border-l-4 border-b border-blue-500">
									<CheckCircle size={18} className="mr-2 text-blue-500" color="#3b82f6" />
									<View className="ml-2">
										<Text className="font-bold text-base">{todaysActivity.checkpoints}</Text>
										<Text className="text-xs text-gray-500">Checkpoints</Text>
									</View>
								</View>
								<View className="flex-row flex-1 items-center justify-start bg-gray-50 p-2 rounded-lg border-l-4 border-b border-purple-500">
									<Route size={18} className="mr-2 text-purple-500" color="#a21caf" />
									<View className="ml-2">
										<Text className="font-bold text-base">{todaysActivity.distance?.toFixed(1) || 0} km</Text>
										<Text className="text-xs text-gray-500">Distance</Text>
									</View>
								</View>
								<View className="flex-row flex-1 items-center justify-start bg-gray-50 p-2 rounded-lg border-l-4 border-b border-green-500">
									<Clock size={18} className="mr-2 text-green-500" color="#22c55e" />
									<View className="ml-2">
										<Text className="font-bold text-base">{todaysActivity.duration || "0m"}</Text>
										<Text className="text-xs text-gray-500">Duration</Text>
									</View>
								</View>
							</View>
						) : (
							<Text className="text-sm text-gray-500 py-2">No activity recorded yet today.</Text>
						)}
					</View> */}

					{/* Planned Route List */}
					{plannedRouteMarkers.length > 0 && (
						<View style={{ flexDirection: "column", display: "flex" }} className="bg-white rounded-xl p-4 mx-4 mb-4 shadow-md">
							<Text className="font-bold text-gray-800 text-lg mb-2">Planned Stops</Text>
							{plannedRouteMarkers.map((item, index) => (
								<View key={item.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: index === plannedRouteMarkers.length - 1 ? 0 : 1, borderBottomColor: "#f3f4f6" }}>
									<View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
										<Text className="font-bold text-gray-600 mr-2">{index + 1}.</Text>
										<View style={{ flex: 1 }}>
											<Text className="font-semibold text-gray-900">{item.title}</Text>
											<Text className="text-xs text-gray-500" numberOfLines={1}>
												{item.description}
											</Text>
										</View>
									</View>
									<TouchableOpacity onPress={() => handleRemoveFromRoute(item.id, item.title)} style={{ padding: 8, marginLeft: 8 }}>
										<X size={18} color="#ef4444" />
									</TouchableOpacity>
								</View>
							))}
						</View>
					)}
				</View>
				<View
					pointerEvents="box-none"
					className="absolute left-0 right-0 items-center"
					style={{
						bottom: Platform.OS === "ios" ? 48 : 24,
						zIndex: 50,
					}}
				>
					{alerts.map((alert, idx) => (
						<AlertComponent key={alert.id || idx} alert={alert} onRemove={() => removeAlert(alert)} />
					))}
				</View>
			</ScrollView>
		</SafeAreaView>
	);
};

export default Home;
