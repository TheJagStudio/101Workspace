import { View, Text, TouchableOpacity, Image } from "react-native";
import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft, LogOut, History } from "lucide-react-native";

const Settings = () => {
	const navigation = useNavigation();
	const [userInfo, setUserInfo] = useState(null);

	useEffect(() => {
		const fetchUser = async () => {
			let userInfoTemp = await AsyncStorage.getItem("userInfo");
			setUserInfo(userInfoTemp ? JSON.parse(userInfoTemp) : null);
		};
		fetchUser();
	}, []);

	const handleLogout = async () => {
		await AsyncStorage.clear();
		navigation.replace("login");
	};

	return (
		<SafeAreaView className="flex-1 bg-orange-50/25">
			{/* Header */}
			<View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-200">
				<TouchableOpacity onPress={() => navigation.replace("home")} className="p-2 mr-2">
					<ArrowLeft size={24} color="#222" />
				</TouchableOpacity>
				<Text className="text-xl font-bold text-gray-800">Settings</Text>
			</View>

			{/* Info Section */}
			<View className="m-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
				<Text className="text-gray-700 font-semibold mb-1 text-xl py-2 px-4 bg-gray-100 border-b border-gray-200">Account</Text>
                <Image source={{uri:`https://api.dicebear.com/9.x/micah/png?seed=${userInfo?.first_name} ${userInfo?.last_name}&shirt=collared&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&shirtColor=6bd9e9&radius=10`}} className="w-32 h-32 mx-auto mt-4" resizeMode="contain" />
				<View className="flex-row items-center mb-3 gap-1 px-4 mt-5">
					<Text className="text-gray-500 text-base">Username:</Text>
					<Text className="text-gray-900 font-bold text-lg">{userInfo?.username}</Text>
				</View>
				<View className="flex-row items-center mb-3 gap-1 px-4">
					<Text className="text-gray-500 text-base">Email:</Text>
					<Text className="text-gray-900 font-bold text-lg">{userInfo?.email}</Text>
				</View>
				<View className="flex-row items-center mb-3 gap-1 px-4">
					<Text className="text-gray-500 text-base">Name:</Text>
					<Text className="text-gray-900 font-bold text-lg">
						{userInfo?.first_name} {userInfo?.last_name}
					</Text>
				</View>
				<View className="flex-row items-center mb-4 gap-1 px-4">
					<Text className="text-gray-500 text-base">Active:</Text>
					<Text className="text-green-500 font-bold text-lg">{userInfo?.is_active ? "Yes" : "No"}</Text>
				</View>
			</View>

			{/* Action Buttons */}
			<View className="m-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
				<Text className="text-gray-700 font-semibold mb-1 text-xl py-2 px-4 bg-gray-100 border-b border-gray-200">Actions</Text>
				
				<TouchableOpacity 
					className="flex-row items-center p-4 border-b border-gray-100"
					onPress={() => navigation.navigate("history")}
				>
					<History size={24} color="#f97316" />
					<View className="ml-3 flex-1">
						<Text className="text-gray-900 font-semibold text-lg">Route History</Text>
						<Text className="text-gray-500 text-sm">View your saved route history</Text>
					</View>
				</TouchableOpacity>
			</View>

			{/* Logout Button at bottom */}
			<View className="flex-1 justify-end p-4">
				<TouchableOpacity className="flex-row items-center justify-center bg-orange-500 px-6 py-3 rounded-lg" onPress={handleLogout}>
					<LogOut size={20} color="#fff" className="mr-2" />
					<Text className="text-white font-bold text-xl ml-2">Logout</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
};

export default Settings;
