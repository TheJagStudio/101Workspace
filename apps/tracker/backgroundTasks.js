import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKGROUND_TASK_IDENTIFIER = 'background-task';

TaskManager.defineTask(BACKGROUND_TASK_IDENTIFIER, async () => {
  try {
    await AsyncStorage.setItem('lastBackgroundRun', new Date().toISOString());
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
    // 3. Get access token
    const accessToken = await AsyncStorage.getItem("accessToken");
    if (!accessToken) {
      console.log('No access token found');
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

    const response = await fetch(`http://127.0.0.1:8000/api/salesman/update_status/`, {
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

    await AsyncStorage.setItem('backgroundTaskStatus', 'success');
    await AsyncStorage.setItem('lastSuccessfulRun', JSON.stringify({
      timestamp: new Date().toISOString(),
      location: { latitude, longitude },
      battery
    }));
  } catch (error) {
    await AsyncStorage.setItem('backgroundTaskError', error.message);
    await AsyncStorage.setItem('backgroundTaskStatus', 'failed');
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
  return BackgroundTask.BackgroundTaskResult.Success;
});

export async function registerBackgroundTaskAsync() {
  try {
    console.log("Registering background task");
    await BackgroundTask.registerTaskAsync(BACKGROUND_TASK_IDENTIFIER, {
      minimumInterval: 15,
      stopOnTerminate: false, // (Android) Keep the task running even when the app is killed
      startOnBoot: true,      // (Android) Restart the task when the device boots up
    });
    console.log("Background task registered");
  } catch (error) {
    console.log("Error registering background task", error);
  }
}

export async function unregisterBackgroundTaskAsync() {
  console.log("Unregistering background task");
  return BackgroundTask.unregisterTaskAsync(BACKGROUND_TASK_IDENTIFIER);
}

export async function getBackgroundTaskDebugInfo() {
  const status = await AsyncStorage.getItem('backgroundTaskStatus');
  const lastRun = await AsyncStorage.getItem('lastBackgroundRun');
  const lastSuccess = await AsyncStorage.getItem('lastSuccessfulRun');
  const error = await AsyncStorage.getItem('backgroundTaskError');
  
  return {
    status,
    lastRun,
    lastSuccess: lastSuccess ? JSON.parse(lastSuccess) : null,
    error
  };
}

export async function checkTaskStatus() {
  // Use TaskManager instead of BackgroundTask for isTaskRegisteredAsync
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_IDENTIFIER);
  console.log('Task registered:', isRegistered);
  return isRegistered;
}
