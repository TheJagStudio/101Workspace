import "react-native-url-polyfill/auto"; // Required for Supabase to work
import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Alert, TextInput, Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { createClient, Session } from "@supabase/supabase-js";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

// --- Supabase Client Initialization ---
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// We use AsyncStorage to persist the user's session
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		storage: AsyncStorage,
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false,
	},
});
// --- Background Task Definition ---
const LOCATION_TASK_NAME = "background-location-task";

// IMPORTANT: This task runs in a separate context.
// It needs to initialize its own Supabase client.
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
			
			// try{
			// 	fetch('https://thejagstudio-ntfy.hf.space/101-location', {
			// 		method: 'POST',
			// 		headers: {
			// 			'Content-Type': 'application/x-www-form-urlencoded'
			// 		},
			// 		body: `lat:${location.coords.latitude} \nlng:${location.coords.longitude}`
			// 	});
			// 	console.log("Location sent to ntfy successfully.");
			// }
			// catch (e) {
			// 	console.error("Background Task Error:", e);
			// }

			const sessionStr = await AsyncStorage.getItem("supabase.auth.token");
			const session = sessionStr ? JSON.parse(sessionStr) : null;

			try{
				fetch('https://igsosentooipcjyflmnw.supabase.co/rest/v1/salesman?authId=eq.' + session?.user.id, {
					method: 'PATCH',
					headers: {
						'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
						'Authorization': `Bearer ${session?.access_token}`,
						'Content-Type': 'application/json',
						'Prefer': 'return=minimal'
					},
					body: JSON.stringify({
						'current_location_lat': location.coords.latitude,
						'current_location_lng': location.coords.longitude
					})
				});
				console.log("Location sent to Supabase successfully.");
			}
			catch (e) {
				console.error("Background Task Error:", e);
			}

			if (error) {
				console.error("Supabase Update Error:", error.message);
			} else {
				console.log("Location successfully sent to Supabase.");
				await AsyncStorage.setItem("lastLocation", JSON.stringify(location.coords));
			}
		}
	}
});

const Demo = () => {
	const [session, setSession] = useState(null);
	const [isTracking, setIsTracking] = useState(false);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");

	// Handle Auth State
	useEffect(() => {
		supabase.auth.getSession().then(async ({ data: { session } }) => {
			setSession(session);
			await AsyncStorage.setItem("supabase.auth.token", JSON.stringify(session));
		});

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (_event, session) => {
			setSession(session);
			await AsyncStorage.setItem("supabase.auth.token", JSON.stringify(session));
		});

		return () => subscription.unsubscribe();
	}, []);

	// Check if tracking is already active on app load
	useEffect(() => {
		const checkTrackingStatus = async () => {
			const trackingStatus = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
			setIsTracking(trackingStatus);
		};
		if (session) {
			checkTrackingStatus();
		}
	}, [session]);

	const requestPermissions = async () => {
		const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
		if (foregroundStatus !== "granted") {
			Alert.alert("Permission Denied", "Foreground location access is required.");
			return false;
		}

		const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
		if (backgroundStatus !== "granted") {
			Alert.alert("Permission Denied", "Background location access is required. Please enable it in settings.");
			return false;
		}
		return true;
	};

	const startLocationTracking = async () => {
		const hasPermissions = await requestPermissions();
		if (!hasPermissions) return;

		await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
			accuracy: Location.Accuracy.Highest,
			// More frequent updates:
			timeInterval: 10000, // 10 seconds
			distanceInterval: 10, // 50 meters
			// Android Foreground Service settings:
			foregroundService: {
				notificationTitle: "Tracking Location",
				notificationBody: "Your location is being tracked for work routes.",
				notificationColor: "#3498db",
			},
			// iOS settings:
			pausesUpdatesAutomatically: false,
			showsBackgroundLocationIndicator: true,
		});

		setIsTracking(true);
		// Alert.alert("Tracking Started", "Location tracking is now active.");
	};

	const stopLocationTracking = async () => {
		await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
		setIsTracking(false);
		// Alert.alert("Tracking Stopped", "Location tracking has been disabled.");
	};

	async function handleLogin() {
		const { error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) Alert.alert("Login Error", error.message);
	}

	// UI rendering
	if (!session) {
		return (
			<SafeAreaView className="flex-1 justify-center items-center bg-gray-800 p-4">
				<Text className="text-2xl text-white font-bold mb-4">Salesman Login</Text>
				<TextInput className="w-full bg-gray-700 text-white p-3 rounded-md mb-3" placeholder="email@address.com" placeholderTextColor="#999" value={email} onChangeText={setEmail} autoCapitalize="none" />
				<TextInput className="w-full bg-gray-700 text-white p-3 rounded-md mb-4" placeholder="Password" placeholderTextColor="#999" value={password} onChangeText={setPassword} secureTextEntry />
				<TouchableOpacity className="bg-blue-600 w-full p-4 rounded-md" onPress={handleLogin}>
					<Text className="text-white text-center font-bold">Sign In</Text>
				</TouchableOpacity>
			</SafeAreaView>
		);
	}
	return (
		<SafeAreaView className="flex-1 bg-white">
			<View className="flex-1 items-center justify-center bg-gray-100 p-5">
				<Text className="text-2xl font-bold mb-2 text-gray-800">Salesman Tracker</Text>
				<Text className="text-sm mb-6 text-gray-500">{session.user.email}</Text>
				<Text className="text-lg mb-8 text-center text-gray-600">Status: {isTracking ? "Tracking Active" : "Not Tracking"}</Text>

				{isTracking ? (
					<TouchableOpacity onPress={stopLocationTracking} className="bg-red-600 px-8 py-4 rounded-full shadow-lg">
						<Text className="text-white text-lg font-semibold">Stop Tracking</Text>
					</TouchableOpacity>
				) : (
					<TouchableOpacity onPress={startLocationTracking} className="bg-green-600 px-8 py-4 rounded-full shadow-lg">
						<Text className="text-white text-lg font-semibold">Start Tracking</Text>
					</TouchableOpacity>
				)}

				<TouchableOpacity
					className="mt-6"
					onPress={async () => {
						const lastLocation = await AsyncStorage.getItem("lastLocation");
						if (lastLocation) {
							Alert.alert("Last Location", lastLocation);
						} else {
							Alert.alert("No Location Found", "No location data available.");
						}
					}}
				>
					<Text className="text-blue-600">Show Last Location</Text>
				</TouchableOpacity>

				<TouchableOpacity className="absolute bottom-10" onPress={() => supabase.auth.signOut()}>
					<Text className="text-blue-600">Sign Out</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
};

export default Demo;