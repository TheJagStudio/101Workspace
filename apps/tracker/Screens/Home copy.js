import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Battery, CheckCircle, Clock, MapPin, Play, Route, Search, Settings, Square, Wifi, WifiOff } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { FlatList, Keyboard, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { SafeAreaView } from "react-native-safe-area-context";
import "react-native-url-polyfill/auto";
import { apiRequest } from "../utils/api";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL_SECOND;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY_SECOND;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const LOCATION_TASK_NAME = "background-location-task";

// IMPORTANT: This task runs in a separate context
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

			// Use the same session key as Demo.js
			const sessionStr = await AsyncStorage.getItem("supabase.auth.token");
			const session = sessionStr ? JSON.parse(sessionStr) : null;
			try {
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
					}),
				});
				console.log("Location sent to Supabase successfully.");
				await AsyncStorage.setItem("lastLocation", JSON.stringify(location.coords));
			} catch (e) {
				console.error("Background Task Error in live location update:", e);
			}
			try {
				let salesmanInfo = await AsyncStorage.getItem("salesmanInfo");
				salesmanInfo = JSON.parse(salesmanInfo);
				await fetch(supabaseUrl + "/rest/v1/tracker_locationpoint", {
					method: "POST",
					headers: {
						apikey: supabaseAnonKey,
						Authorization: `Bearer ${supabaseAnonKey}`,
						"Content-Type": "application/json",
						Prefer: "return=minimal",
					},
					body: JSON.stringify({
						latitude: location.coords.latitude,
						longitude: location.coords.longitude,
						timestamp: new Date().toISOString(),
						salesman_id: salesmanInfo?.id,
					}),
				});
				console.log("route sent to Supabase successfully.");
			} catch (e) {
				console.error("Background Task Error in route update:", e);
			}
		}
	}
});

const Home = () => {
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
	const navigation = useNavigation();

	// Helper function to check current permissions
	const checkCurrentPermissions = async () => {
		try {
			const foregroundPermission = await Location.getForegroundPermissionsAsync();
			const backgroundPermission = await Location.getBackgroundPermissionsAsync();
			return {
				foreground: foregroundPermission.status,
				background: backgroundPermission.status,
			};
		} catch (error) {
			console.error("Error checking permissions:", error);
			return null;
		}
	};

	useEffect(() => {
		const checkUser = async () => {
			const accessToken = await AsyncStorage.getItem("accessToken");
			const refreshToken = await AsyncStorage.getItem("refreshToken");
			if (!accessToken || !refreshToken) {
				navigation.replace("login");
			}
		};
		checkUser();
	}, [navigation]);

	async function handleRegisterTask() {
		try {
			// Check current permissions first
			const currentForegroundPermission = await Location.getForegroundPermissionsAsync();
			const currentBackgroundPermission = await Location.getBackgroundPermissionsAsync();

			// console.log("Current foreground permission:", currentForegroundPermission.status);
			// console.log("Current background permission:", currentBackgroundPermission.status);

			// 1. Request foreground permissions
			// console.log("Requesting foreground location permission...");
			const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
			// console.log("Foreground location permission after request:", foregroundStatus);

			if (foregroundStatus !== "granted") {
				setAlerts((prev) => [
					...prev,
					{
						type: "error",
						message: "Foreground location access is needed to track your location.",
					},
				]);
				return;
			}

			// 2. Request background permissions (only if foreground is granted)
			// console.log("Requesting background location permission...");
			const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
			// console.log("Background location permission after request:", backgroundStatus);

			if (backgroundStatus !== "granted") {
				setAlerts((prev) => [
					...prev,
					{
						type: "error",
						message: "Background location access is needed for the app to work when closed. Please go to Settings > Apps > 101-tracker > Permissions > Location and select 'Allow all the time'.",
					},
				]);
				return;
			}

			// console.log("Both permissions granted successfully");
			setPermissionsGranted(true);

			// Start background location updates
			await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
				accuracy: Location.Accuracy.Highest,
				timeInterval: 10000, // 10 seconds
				distanceInterval: 10, // 10 meters
				foregroundService: {
					notificationTitle: "Location Tracking",
					notificationBody: "Your location is being tracked for work routes.",
					notificationColor: "#3498db",
				},
				pausesUpdatesAutomatically: false,
				showsBackgroundLocationIndicator: true,
			});

			setIsRegistered(true);

			setAlerts((prev) => [
				...prev,
				{
					type: "success",
					message: "Location tracking activated successfully.",
				},
			]);
		} catch (error) {
			console.error("Error in handleRegisterTask:", error);
			setAlerts((prev) => [
				...prev,
				{
					type: "error",
					message: "Failed to set up location tracking. Please try again.",
				},
			]);
		}
	}

	async function handleUnregisterTask() {
		try {
			await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
			setIsRegistered(false);
			setAlerts((prev) => [
				...prev,
				{
					type: "success",
					message: "Location tracking stopped successfully.",
				},
			]);
		} catch (error) {
			console.error("Error stopping location updates:", error);
			setAlerts((prev) => [
				...prev,
				{
					type: "error",
					message: "Failed to stop location tracking.",
				},
			]);
		}
	}

	useEffect(() => {
		// Check permissions status on component mount
		checkCurrentPermissions();
		handleRegisterTask();

		apiRequest(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker/salesman/activity/today/`)
			.then((response) => {
				setTodaysActivity(response);
				if (response?.is_tracking) {
					setIsTracking(response?.is_tracking || false);
				} else {
					handleUnregisterTask();
				}
			})
			.catch((err) => {
				if (err.name === "AuthError") {
					navigation.replace("login");
				} else {
					if (err.status !== 404) {
						setAlerts((prev) => [
							...prev,
							{
								type: "error",
								message: err.message || "An unexpected error occurred.",
							},
						]);
					}
				}
			});

		apiRequest(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker/salesman/planned_routes/today/`)
			.then((response) => {
				setTodaysPlannedRoute(response);
			})
			.catch((err) => {
				if (err.status !== 404) {
					setAlerts((prev) => [...prev, { type: "info", message: "There isn't any planned route today" }]);
				}
			});

		// set interval to get location updates every 5 seconds
		const intervalId = setInterval(async () => {
			let lastLocation = await AsyncStorage.getItem("lastLocation");
			if (lastLocation) {
				lastLocation = JSON.parse(lastLocation);
				setCurrentLocation(lastLocation);
			} else {
				setCurrentLocation(null);
			}
		}, 10000);
		return () => clearInterval(intervalId);
	}, []);

	useEffect(() => {
		if (alerts.length > 0) {
			const timeoutId = setTimeout(() => {
				setAlerts((prev) => prev.slice(1));
			}, 2000);
			return () => clearTimeout(timeoutId);
		}
	}, [alerts]);

	const handleSearch = () => {
		if (!searchQuery.trim()) return;
		apiRequest(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker/salesman/places_search/?query=${encodeURIComponent(searchQuery)}`)
			.then((data) => {
				if (data.status === "OK") {
					setSearchResults(
						data?.results?.map((place) => ({
							id: place?.place_id,
							name: place?.name,
							address: place?.formatted_address,
							lat: place?.geometry.location.lat,
							lng: place?.geometry.location.lng,
						}))
					);
				} else {
					setSearchResults([]);
				}
			})
			.catch((err) => {
				setAlerts((prev) => [...prev, { type: "error", message: "Failed to search places." }]);
				setSearchResults([]);
			});
		Keyboard.dismiss();
	};

	const handleAddToRoute = (place, isBulk = false) => {
		const payload = {
			location_name: place?.name,
			address: place?.address,
			latitude: place?.lat,
			longitude: place?.lng,
		};
		apiRequest(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker/salesman/planned_routes/add_stop/`, {
			method: "POST",
			body: JSON.stringify(payload),
		})
			.then(() => {
				if (!isBulk) {
					setAlerts((prev) => [
						...prev,
						{
							type: "success",
							message: `Added "${place?.name}" to your route!`,
						},
					]);
				}
				return apiRequest(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker/salesman/planned_routes/today/`);
			})
			.then((response) => {
				setTodaysPlannedRoute(response);
			})
			.catch((err) => {
				setAlerts((prev) => [
					...prev,
					{
						type: "error",
						message: `Failed to add "${place?.name}" to route.`,
					},
				]);
			});
		if (!routeHistory.some((entry) => entry.id === place.id)) {
			const newHistory = [...routeHistory, { id: place.id, addedAt: new Date().toISOString() }];
			setRouteHistory(newHistory);
		}
	};

	const handleAddAll = () => {
		searchResults.forEach((place) => handleAddToRoute(place, true));
		setSearchResults([]);
		setAlerts((prev) => [...prev, { type: "success", message: "Added all search results to your route!" }]);
	};

	const handleClearSearch = () => {
		setSearchResults([]);
	};

	const handleToggleTracking = async () => {
		const newTrackingStatus = !isTracking;
		try {
			// Update tracking status in backend
			await apiRequest(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker/salesman/set_tracking_status/`, {
				method: "POST",
				body: JSON.stringify({
					status: newTrackingStatus ? "active" : "offline",
				}),
			});

			// Start or stop location tracking
			if (newTrackingStatus) {
				await handleRegisterTask();
			} else {
				await handleUnregisterTask();
			}

			setIsTracking(newTrackingStatus);
			setAlerts((prev) => [
				...prev,
				{
					type: "success",
					message: newTrackingStatus ? "Tracking started successfully." : "Tracking stopped successfully.",
				},
			]);
		} catch (error) {
			console.error("Error toggling tracking:", error);
			setAlerts((prev) => [
				...prev,
				{
					type: "error",
					message: "Failed to update tracking status.",
				},
			]);
		}
	};

	const removeAlert = (idx) => {
		setAlerts((prev) => prev.filter((_, i) => i !== idx));
	};

	const plannedRouteMarkers = React.useMemo(() => {
		if (!todaysPlannedRoute?.stops || !Array.isArray(todaysPlannedRoute.stops)) return [];
		return todaysPlannedRoute.stops.map((stop, idx) => ({
			id: stop.id?.toString() || idx.toString(),
			title: stop.location_name || `Stop ${idx + 1}`,
			description: stop.address || "",
			coordinate: {
				latitude: stop.latitude,
				longitude: stop.longitude,
			},
		}));
	}, [todaysPlannedRoute]);

	const routePoints = React.useMemo(() => {
		if (!todaysPlannedRoute?.stops || todaysPlannedRoute.stops.length < 2) return null;
		const stops = todaysPlannedRoute.stops;
		const origin = {
			latitude: stops[0].latitude,
			longitude: stops[0].longitude,
		};
		const destination = {
			latitude: stops[stops.length - 1].latitude,
			longitude: stops[stops.length - 1].longitude,
		};
		const waypoints = stops.slice(1, -1).map((stop) => ({ latitude: stop.latitude, longitude: stop.longitude }));
		return { origin, destination, waypoints };
	}, [todaysPlannedRoute]);

	const initialRegion =
		plannedRouteMarkers.length > 0
			? {
					latitude: plannedRouteMarkers[0].coordinate.latitude,
					longitude: plannedRouteMarkers[0].coordinate.longitude,
					latitudeDelta: 0.05,
					longitudeDelta: 0.05,
				}
			: {
					latitude: 37.78825,
					longitude: -122.4324,
					latitudeDelta: 0.05,
					longitudeDelta: 0.05,
				};

	return (
		<SafeAreaView className="flex-1 bg-gray-100">
			<View className="flex-1 p-4">
				{/* Search Bar */}
				<View className="flex-row items-center justify-between gap-2 mb-4 w-[calc(100vw-2rem)]">
					<View className="flex-row flex-1 bg-white rounded-xl items-center p-2 border border-gray-300">
						<TextInput className="flex-1 h-10 p-2 text-md text-gray-900" placeholder="e.g., gas station near stone mountain" value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={handleSearch} returnKeyType="search" placeholderTextColor="#6b7280" />
						<TouchableOpacity className="p-2 bg-orange-500 rounded-md ml-2" onPress={handleSearch}>
							<Search size={20} color="#fff" />
						</TouchableOpacity>
					</View>
					<TouchableOpacity
						className="p-2 w-fit rounded-xl bg-gray-500 my-2"
						onPress={() => {
							navigation.replace("settings");
						}}
					>
						<Settings size={30} className="text-white absolute right-2 top-2" color="#fff" />
					</TouchableOpacity>
				</View>

				{/* Search Results */}
				{searchResults.length > 0 && (
					<View className="bg-white rounded-xl border border-gray-300 mb-3 pt-1 max-h-56">
						<FlatList
							data={searchResults}
							keyExtractor={(item) => item?.id}
							renderItem={({ item }) => (
								<View className="flex-row w-full justify-between items-center py-2 px-3 border-b border-gray-200">
									<View>
										<Text className="font-bold text-base">{item?.name}</Text>
										<Text className="text-xs text-gray-500 overflow-hidden w-[70vw]" style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
											{item?.address}
										</Text>
									</View>
									{!routeHistory.some((entry) => entry.id === item?.id) && (
										<TouchableOpacity onPress={() => handleAddToRoute(item, false)}>
											<Text className="text-orange-600 font-bold text-sm">Add</Text>
										</TouchableOpacity>
									)}
								</View>
							)}
						/>
						<View className="flex-row justify-between bg-gray-200 p-2 rounded-b-xl">
							<TouchableOpacity className="bg-white py-1 px-3 rounded border border-gray-300" onPress={handleAddAll}>
								<Text className="text-gray-700 font-semibold">Add All</Text>
							</TouchableOpacity>
							<TouchableOpacity className="bg-white py-1 px-3 rounded border border-gray-300" onPress={handleClearSearch}>
								<Text className="text-gray-700 font-semibold">Clear</Text>
							</TouchableOpacity>
						</View>
					</View>
				)}

				{/* Status Indicators */}
				<View className="flex-row justify-between mb-4 mt-2">
					<View className="items-center flex-1">
						<Text className={`font-bold text-lg ${isTracking ? "text-green-600" : "text-red-600"}`}>{isTracking ? "Active" : "Inactive"}</Text>
						<Text className="text-xs text-gray-500">Tracking Status</Text>
					</View>
					<View className="items-center flex-1">
						<View className="font-bold text-lg text-gray-800 flex-row gap-2 items-center justify-center">
							<Battery size={20} className={`mr-1 ${battery < 20 ? "text-red-500" : "text-green-500"}`} color={battery < 20 ? "#ef4444" : "#22c55e"} />
							<Text>{battery}%</Text>
						</View>
						<Text className="text-xs text-gray-500">Battery</Text>
					</View>
					<View className="items-center flex-1">
						<Text className="font-bold text-lg text-gray-800">{signal ? <Wifi size={20} className="text-green-500" color="#22c55e" /> : <WifiOff size={20} className="text-red-500" color="#ef4444" />}</Text>
						<Text className="text-xs text-gray-500">Signal</Text>
					</View>
				</View>

				{/* Tracking Button */}
				<TouchableOpacity className={`w-full py-4 rounded-lg items-center mb-4 flex-row justify-center ${isTracking ? "bg-red-500" : "bg-green-500"}`} onPress={handleToggleTracking}>
					{isTracking ? <Square size={24} className="mr-2" color="#fff" /> : <Play size={24} className="mr-2" color="#fff" />}
					<Text className="text-white font-bold text-lg ml-2">{isTracking ? "Stop Tracking" : "Start Tracking"}</Text>
				</TouchableOpacity>

				{/* Map Section */}
				<View className="mb-4 rounded-xl overflow-hidden bg-white border border-gray-200" style={{ height: "50%" }}>
					{plannedRouteMarkers.length > 0 ? (
						<MapView style={StyleSheet.absoluteFill} region={initialRegion} center={initialRegion} showsUserLocation={true} showsMyLocationButton={true} showsCompass={true} showsScale={true} showsTraffic={false} loadingEnabled={true} loadingIndicatorColor="#3498db" loadingBackgroundColor="#f0f0f0">
							{plannedRouteMarkers.map((marker) => (
								<Marker key={marker.id} coordinate={marker.coordinate} title={marker.title} description={marker.description}>
									<View
										style={{
											backgroundColor: "#3498db",
											padding: 5,
											borderRadius: 50,
											borderWidth: 3,
											borderColor: "white",
										}}
									>
										<MapPin size={20} color="#fff" />
									</View>
								</Marker>
							))}
							{currentLocation && (
								<Marker
									coordinate={{
										latitude: currentLocation.latitude,
										longitude: currentLocation.longitude,
									}}
									title="My Location"
								>
									<View
										style={{
											backgroundColor: "#4CAF50",
											padding: 5,
											borderRadius: 50,
											borderWidth: 3,
											borderColor: "white",
										}}
									>
										<MapPin size={20} color="#fff" />
									</View>
								</Marker>
							)}
							{plannedRouteMarkers && <MapViewDirections origin={plannedRouteMarkers[0].coordinate} destination={plannedRouteMarkers[plannedRouteMarkers.length - 1].coordinate} apikey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY} strokeWidth={4} strokeColor="orange" precision="high" timePrecision="now" optimizeWaypoints={true} waypoints={plannedRouteMarkers.map((marker) => marker.coordinate)} />}
						</MapView>
					) : (
						<View className="flex-1 items-center justify-center">
							<Text className="text-gray-400">No planned route stops to display on map.</Text>
						</View>
					)}
				</View>

				{/* Today's Activity */}
				<View className="bg-white rounded-xl p-4 mb-4">
					<Text className="font-bold text-gray-800 mb-2">Today's Activity</Text>
					{todaysActivity ? (
						<View className="flex-row justify-around gap-2">
							<View className="flex-row flex-1 items-center justify-start bg-gray-50 p-2 rounded-lg border-l border-b border-gray-300">
								<CheckCircle size={18} className="mr-2 text-blue-500" color="#3b82f6" />
								<View className="ml-2">
									<Text className="font-bold text-base">{todaysActivity.checkpoints}</Text>
									<Text className="text-xs text-gray-500">Checkpoints</Text>
								</View>
							</View>
							<View className="flex-row flex-1 items-center justify-start bg-gray-50 p-2 rounded-lg border-l border-b border-gray-300">
								<Route size={18} className="mr-2 text-purple-500" color="#a21caf" />
								<View className="ml-2">
									<Text className="font-bold text-base">{todaysActivity.distance?.toFixed(1)} km</Text>
									<Text className="text-xs text-gray-500">Distance</Text>
								</View>
							</View>
							<View className="flex-row flex-1 items-center justify-start bg-gray-50 p-2 rounded-lg border-l border-b border-gray-300">
								<Clock size={18} className="mr-2 text-green-500" color="#22c55e" />
								<View className="ml-2">
									<Text className="font-bold text-base">{todaysActivity.duration || "0m"}</Text>
									<Text className="text-xs text-gray-500">Duration</Text>
								</View>
							</View>
						</View>
					) : (
						<Text className="text-xs text-gray-500">No activity recorded yet today.</Text>
					)}
				</View>
			</View>

			{/* Alerts (popup style, floating at bottom) */}
			<View
				pointerEvents="box-none"
				className="absolute left-0 right-0 items-center"
				style={{
					bottom: Platform.OS === "ios" ? 48 : 24,
					zIndex: 50,
				}}
			>
				{alerts.map((alert, idx) => (
					<View key={idx} className={`  flex-row items-center justify-between min-w-[300px] max-w-[90vw]  ${alert.type === "error" ? "bg-red-50" : "bg-green-50"} border border-l-4 ${alert.type === "error" ? "border-red-500" : "border-green-500"} py-1 px-4 rounded-xl  shadow ${alert.type === "error" ? "shadow-red-500/25" : "shadow-green-500/25"} mb-2 animate-slideIn`} style={{ backdropFilter: "blur(12px)" }}>
						<View className="flex-1 flex-col">
							<Text className={`${alert.type === "error" ? "text-red-700" : "text-green-700"}`}>{alert?.message}</Text>
							{/* {alert?.status && <Text className="text-xs opacity-80">Status: {alert?.status}</Text>} */}
						</View>
						<TouchableOpacity onPress={() => removeAlert(idx)} className="bg-transparent border-0 ml-2.5 px-1.5" hitSlop={10}>
							<Text className={`${alert.type === "error" ? "text-red-700" : "text-green-700"} text-xl`}>×</Text>
						</TouchableOpacity>
					</View>
				))}
			</View>
		</SafeAreaView>
	);
};

export default Home;
