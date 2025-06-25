import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Text, View, Button, Alert } from 'react-native';

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

    // 3. Get access token
    const accessToken = await AsyncStorage.getItem("accessToken");
    if (!accessToken) {
      console.log('No access token found');
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

    // 4. Send POST request to update status
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || '';
    const response = await fetch(`${backendUrl}/api/salesman/update_status/`, {
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

async function registerBackgroundTaskAsync() {
  return BackgroundTask.registerTaskAsync(BACKGROUND_TASK_IDENTIFIER);
}

async function unregisterBackgroundTaskAsync() {
  return BackgroundTask.unregisterTaskAsync(BACKGROUND_TASK_IDENTIFIER);
}

export default function BackgroundTaskScreen() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    updateAsync();
  }, []);

  const updateAsync = async () => {
    const status = await BackgroundTask.getStatusAsync();
    setStatus(status);
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_IDENTIFIER);
    setIsRegistered(isRegistered);
  };

  const toggle = async () => {
    if (!isRegistered) {
      await registerBackgroundTaskAsync();
    } else {
      await unregisterBackgroundTaskAsync();
    }
    await updateAsync();
  };

  return (
    <View className="flex-1 justify-center items-center">
      <View className="m-2.5">
        <Text>
          Background Task Service Availability:{' '}
          <Text className="font-bold">
            {status ? BackgroundTask.BackgroundTaskStatus[status] : null}
          </Text>
        </Text>
      </View>
      <Button
        disabled={status === BackgroundTask.BackgroundTaskStatus.Restricted}
        title={isRegistered ? 'Cancel Background Task' : 'Schedule Background Task'}
        onPress={toggle}
      />
      <Button title="Check Background Task Status" onPress={updateAsync} />
    </View>
  );
}
