import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest } from "../utils/api";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL_SECOND;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY_SECOND;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const Login = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const navigation = useNavigation();

	// State to handle input focus for dynamic styling
	const [isEmailFocused, setIsEmailFocused] = useState(false);
	const [isPasswordFocused, setIsPasswordFocused] = useState(false);

	useEffect(() => {
		const checkUser = async () => {
			const accessToken = await AsyncStorage.getItem("accessToken");
			const refreshToken = await AsyncStorage.getItem("refreshToken");
			if (accessToken && refreshToken) {
				navigation.replace("home");
			}
		};
		checkUser();
	}, [navigation]);

	const handleSubmit = async () => {
		setLoading(true);
		setError("");
		try {
			const data2 = await apiRequest(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/login/`, {
				method: "POST",
				body: JSON.stringify({
					username: email,
					password: password,
				}),
			});
			const { data, error } = await supabase.auth.signInWithPassword({ email, password });
			if (error) Alert.alert("Login Error", error.message);
			if (data) {
				let userId = data?.user?.id;
				let { data: salesman, error } = await supabase.from("salesman").select("*").eq("authId", userId).single();
				if (error) {
					console.error("Error fetching salesman data:", error);
					Alert.alert("Error", "Failed to fetch salesman data.");
					return;
				} else {
					await AsyncStorage.setItem("salesmanInfo", JSON.stringify(salesman));
				}
			}
			if (data2.status === "success") {
				await AsyncStorage.setItem("accessToken", data2.tokens.access);
				await AsyncStorage.setItem("refreshToken", data2.tokens.refresh);
				if (data2.user_info) {
					await AsyncStorage.setItem("userInfo", JSON.stringify(data2.user_info));
				}
				navigation.replace("home");
			} else {
				setError(data2.message || "Login failed");
			}
		} catch (err) {
			console.log(err);
			setError("A network error occurred. Please try again.");
		}
		setLoading(false);
	};

	useEffect(() => {
		supabase.auth.getSession().then(async ({ data: { session } }) => {
			await AsyncStorage.setItem("supabase.auth.token", JSON.stringify(session));
		});

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (_event, session) => {
			await AsyncStorage.setItem("supabase.auth.token", JSON.stringify(session));
		});

		return () => subscription.unsubscribe();
	}, []);

	return (
		<SafeAreaView className="flex-1 bg-gray-50">
			<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
				<View className="flex-1 items-center justify-center p-4">
					<View className="absolute top-[60px] left-[25px] p-2 bg-red-100/75 border border-dashed border-red-500 rounded-lg flex-row items-center justify-center">
						<Image source={require("../assets/adaptive-icon-1.png")} className="w-12 h-12" resizeMode="contain" />
						<Text className="text-4xl ml-2 font-semibold text-red-600">Workspace</Text>
					</View>

					<View className="bg-white rounded-xl p-10 pt-20 w-full max-w-[380px] shadow-lg">
						<View className="items-center mb-6">
							<Text className="text-2xl font-semibold mb-1 text-gray-800">Welcome back</Text>
							<Text className="text-gray-500 text-sm text-center leading-5">
								Glad to see you again 👋{"\n"}
								Login to your account below
							</Text>
						</View>

						<View>
							<TextInput placeholder="Enter Email..." className={`border border-dashed ${isEmailFocused ? "border-red-500" : "border-gray-300"} rounded-lg px-3 py-3 w-full text-sm`} value={email} onChangeText={setEmail} onFocus={() => setIsEmailFocused(true)} onBlur={() => setIsEmailFocused(false)} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#9CA3AF" />
							<TextInput placeholder="Enter Password..." className={`mt-3 border border-dashed ${isPasswordFocused ? "border-red-500" : "border-gray-300"} rounded-lg px-3 py-3 w-full text-sm`} value={password} onChangeText={setPassword} onFocus={() => setIsPasswordFocused(true)} onBlur={() => setIsPasswordFocused(false)} secureTextEntry placeholderTextColor="#9CA3AF" />
							{error && <Text className="text-red-500 text-sm mt-2">{error}</Text>}

							<TouchableOpacity onPress={handleSubmit} className="w-full py-3 rounded-lg bg-red-600 items-center justify-center mt-4" disabled={loading}>
								{loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-medium text-base">Login</Text>}
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
};

export default Login;
