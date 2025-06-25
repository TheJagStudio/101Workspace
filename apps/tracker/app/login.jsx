import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Image,
    SafeAreaView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAtom } from 'jotai';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { userAtom } from '../Variables';
import { apiRequest } from '../utils/api';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigation = useNavigation();
    const [, setUser] = useAtom(userAtom);

    useEffect(() => {
        const checkUser = async () => {
            const accessToken = await AsyncStorage.getItem("accessToken");
            const refreshToken = await AsyncStorage.getItem("refreshToken");
            if (accessToken && refreshToken) {
                // navigation.replace("Home"); // or your home screen name
                navigation.replace("BackgroundTaskScreen");
            }
        };
        checkUser();
    }, [navigation]);

    const handleSubmit = async () => {
        setLoading(true);
        setError("");
        try {
            const data = await apiRequest(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/login/`, {
                method: "POST",
                body: JSON.stringify({
                    username: email,
                    password: password,
                }),
            });
            if (data.status === "success") {
                // Store tokens in AsyncStorage
                await AsyncStorage.setItem("accessToken", data.tokens.access);
                await AsyncStorage.setItem("refreshToken", data.tokens.refresh);

                // Set user info
                setUser(data.user_info);
                // Navigate to the home screen
                // navigation.replace("Home"); // or your home screen name
                navigation.replace("BackgroundTaskScreen");
            } else {
                setError(data.message || "Login failed");
            }
        } catch (err) {
            setError("A network error occurred. Please try again.");
        }
        setLoading(false);
    };

    return (
        <SafeAreaView className="flex-1 bg-[#f9fbfc]">
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
            >
                <View className="flex-1 items-center justify-center p-4">
                    <View className="absolute top-10 left-5 p-2 bg-red-100/75 border border-dashed border-red-500 rounded-lg flex-row items-center justify-center">
                        {/* Ensure the image path is correct for your project structure */}
                        <Image
                            source={require('../assets/adaptive-icon.png')}
                            className="w-12 h-12"
                            resizeMode="contain"
                        />
                        <Text className="text-4xl ml-2 font-semibold text-red-600">Workspace</Text>
                    </View>
                    <View className="bg-white rounded-xl shadow-lg p-10 w-full max-w-md">

                        <View className="flex-col items-center mb-6 pt-20">
                            <Text className="text-2xl font-semibold mb-1 text-gray-800">Welcome back</Text>
                            <Text className="text-gray-500 text-sm text-center">
                                Glad to see you again <Text className="animate-spin">👋</Text>{'\n'}
                                Login to your account below
                            </Text>
                        </View>

                        <View className="space-y-3">
                            <TextInput
                                placeholder="Enter Email..."
                                className="border border-dashed border-gray-300 rounded-lg px-3 py-3 w-full text-sm focus:border-red-500"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                placeholderTextColor="#9CA3AF"
                            />
                            <TextInput
                                placeholder="Enter Password..."
                                className="border border-dashed border-gray-300 rounded-lg px-3 py-3 w-full text-sm focus:border-red-500 mt-3"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                placeholderTextColor="#9CA3AF"
                            />
                            {error && <Text className="text-red-500 text-sm">{error}</Text>}

                            <TouchableOpacity
                                onPress={handleSubmit}
                                className="w-full py-3 rounded-lg bg-red-600 items-center justify-center mt-2"
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white font-medium text-base">Login</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default Login;