import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import Home from './Screens/Home';
import Login from './Screens/Login'; 
import "./global.css"

const BACKGROUND_TASK_IDENTIFIER = 'background-task';

TaskManager.defineTask(BACKGROUND_TASK_IDENTIFIER, async () => {
  try {
    // 1. Get location permission and current location
    let { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
    if (locationStatus !== 'granted') {
      console.log('Location permission not granted');
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
    const location = await Location.getCurrentPositionAsync({});
    const latitude = location.coords.latitude;
    const longitude = location.coords.longitude;

    // 2. Get battery level
    const batteryLevel = await Battery.getBatteryLevelAsync();
    const battery = Math.round(batteryLevel * 100);
    console.log("log:" , battery,longitude,latitude);
    // 3. Get access token
    const accessToken = await AsyncStorage.getItem("accessToken");
    if (!accessToken) {
      console.log('No access token found');
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

    // 4. Send POST request to update status
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
    const response = await fetch(`http://10.1.11.205:8000/api/salesman/update_status/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        latitude,
        longitude,
        battery,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Failed to update status:', errorText);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

    console.log(`Pinged location: ${latitude},${longitude} battery: ${battery}`);
  } catch (error) {
    console.error('Failed to execute the background task:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
  return BackgroundTask.BackgroundTaskResult.Success;
});

export async function registerBackgroundTaskAsync() {
  try {
    await BackgroundTask.registerTaskAsync(BACKGROUND_TASK_IDENTIFIER, {
      minimumInterval: 30, // Run every 5 minutes
      stopOnTerminate: false, // (Android) Keep the task running even when the app is killed
      startOnBoot: true,      // (Android) Restart the task when the device boots up
    });
    console.log("Background task registered");
  } catch (error) {
    console.log("Error registering background task", error);
  }
}

export async function unregisterBackgroundTaskAsync() {
  return BackgroundTask.unregisterTaskAsync(BACKGROUND_TASK_IDENTIFIER);
}



// Create the navigator
const Stack = createNativeStackNavigator();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="home"
        screenOptions={{
          headerShown: false, 
        }}
      >
        <Stack.Screen name="home" component={Home} />
        <Stack.Screen name="login" component={Login} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;