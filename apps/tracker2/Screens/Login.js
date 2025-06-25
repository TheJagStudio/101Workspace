import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Image,
    Alert,
    SafeAreaView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet, // Import StyleSheet
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiRequest } from '../utils/api';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
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
            
            const data = await apiRequest('http://10.1.11.205:8000/api/auth/login/', {
                method: "POST",
                body: JSON.stringify({
                    username: email,
                    password: password,
                }),
            });
            if (data.status === "success") {
                await AsyncStorage.setItem("accessToken", data.tokens.access);
                await AsyncStorage.setItem("refreshToken", data.tokens.refresh);
                if (data.user_info) {
                    await AsyncStorage.setItem("userInfo", JSON.stringify(data.user_info));
                }
                navigation.replace("home");
            } else {
                setError(data.message || "Login failed");
            }
        } catch (err) {
            console.log(err);
            setError("A network error occurred. Please try again.");
        }
        setLoading(false);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardAvoidingView}
            >
                <View style={styles.container}>
                    <View style={styles.logoContainer}>
                        <Image
                            source={require('../assets/adaptive-icon.png')}
                            style={styles.logoImage}
                            resizeMode="contain"
                        />
                        <Text style={styles.logoText}>Workspace</Text>
                    </View>

                    <View style={styles.formCard}>
                        <View style={styles.welcomeContainer}>
                            <Text style={styles.title}>Welcome back</Text>
                            <Text style={styles.subtitle}>
                                Glad to see you again 👋{'\n'}
                                Login to your account below
                            </Text>
                        </View>

                        <View>
                            <TextInput
                                placeholder="Enter Email..."
                                style={[styles.input, isEmailFocused && styles.inputFocused]}
                                value={email}
                                onChangeText={setEmail}
                                onFocus={() => setIsEmailFocused(true)}
                                onBlur={() => setIsEmailFocused(false)}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                placeholderTextColor="#9CA3AF"
                            />
                            <TextInput
                                placeholder="Enter Password..."
                                style={[styles.input, styles.passwordInput, isPasswordFocused && styles.inputFocused]}
                                value={password}
                                onChangeText={setPassword}
                                onFocus={() => setIsPasswordFocused(true)}
                                onBlur={() => setIsPasswordFocused(false)}
                                secureTextEntry
                                placeholderTextColor="#9CA3AF"
                            />
                            {error && <Text style={styles.errorText}>{error}</Text>}

                            <TouchableOpacity
                                onPress={handleSubmit}
                                style={styles.loginButton}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text style={styles.loginButtonText}>Login</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// Create the StyleSheet object
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f9fbfc',
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    logoContainer: {
        position: 'absolute',
        top: 60, // A bit more than top-10 for better placement
        left: 25,
        padding: 8,
        backgroundColor: 'rgba(254, 226, 226, 0.75)',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#ef4444',
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoImage: {
        width: 48,
        height: 48,
    },
    logoText: {
        fontSize: 36,
        marginLeft: 8,
        fontWeight: '600',
        color: '#dc2626',
    },
    formCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 40,
        paddingTop: 80, // for the inner welcome text
        width: '100%',
        maxWidth: 380,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 5,
        },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 10,
    },
    welcomeContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        marginBottom: 4,
        color: '#1f2937',
    },
    subtitle: {
        color: '#6b7280',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    input: {
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#d1d5db',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        width: '100%',
        fontSize: 14,
    },
    passwordInput: {
        marginTop: 12,
    },
    inputFocused: {
        borderColor: '#ef4444', // Equivalent to focus:border-red-500
    },
    errorText: {
        color: '#ef4444',
        fontSize: 14,
        marginTop: 8,
    },
    loginButton: {
        width: '100%',
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: '#dc2626',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
    },
    loginButtonText: {
        color: 'white',
        fontWeight: '500',
        fontSize: 16,
    },
});

export default Login;