import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Keyboard, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Search, Battery, Wifi, WifiOff, Play, Square, Route, CheckCircle, Clock } from 'lucide-react-native';
import { apiRequest } from '../utils/api';
import { userAtom } from '../Variables';
import { useAtom } from 'jotai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';

const Home = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [battery, setBattery] = useState(100);
  const [signal, setSignal] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [routeHistory, setRouteHistory] = useState([]);
  const [todaysActivity, setTodaysActivity] = useState(null);
  const [todaysPlannedRoute, setTodaysPlannedRoute] = useState(null);
  const trackingIntervalRef = useRef(null);
  const [user] = useAtom(userAtom);
  const navigation = useNavigation();

   useEffect(() => {
        const checkUser = async () => {
            const accessToken = await AsyncStorage.getItem("accessToken");
            const refreshToken = await AsyncStorage.getItem("refreshToken");
            if (!accessToken || !refreshToken) {
                navigation.replace("login"); // or your home screen name
            }
        };
        checkUser();
        // clear async storage
        // const clearStorage = async () => {
        //     await AsyncStorage.clear();
        //     console.log("AsyncStorage cleared");
        // };
        // clearStorage();
    }, [navigation]);

  // Initial fetch for current status and planned route
  useEffect(() => {
    // Fetch today's activity
    apiRequest(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker/salesman/activity/today/`)
      .then((response) => {
        setTodaysActivity(response);
        setIsTracking(response?.is_tracking || false);
      })
      .catch(err => {
        setAlerts(prev => [...prev, { type: 'error', message: "Could not fetch today's activity" }]);
      });

    // Fetch today's planned route
    apiRequest(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker/salesman/planned_routes/today/`)
      .then(response => {
        setTodaysPlannedRoute(response);
      })
      .catch(err => {
        if (err.status !== 404) {
          setAlerts(prev => [...prev, { type: 'error', message: "Failed to fetch today's planned route" }]);
        }
      });

    // Load routeHistory from local storage if needed (simulate for now)
    // ...existing code...
  }, []);

  // Alerts auto-dismiss
  useEffect(() => {
    if (alerts.length > 0) {
      const timeoutId = setTimeout(() => {
        setAlerts(prev => prev.slice(1));
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [alerts]);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    apiRequest(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker/salesman/places_search/?query=${encodeURIComponent(searchQuery)}`)
      .then(data => {
        if (data.status === 'OK') {
          setSearchResults(data?.results?.map(place => ({
            id: place?.place_id,
            name: place?.name,
            address: place?.formatted_address,
            lat: place?.geometry.location.lat,
            lng: place?.geometry.location.lng,
          })));
        } else {
          setSearchResults([]);
        }
      })
      .catch(err => {
        setAlerts(prev => [...prev, { type: 'error', message: 'Failed to search places.' }]);
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
      method: 'POST',
      body: JSON.stringify(payload),
    })
      .then(() => {
        if (!isBulk) {
          setAlerts(prev => [...prev, { type: 'success', message: `Added "${place?.name}" to your route!` }]);
        }
        // Refresh planned route after successful addition
        return apiRequest(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker/salesman/planned_routes/today/`);
      })
      .then(response => {
        setTodaysPlannedRoute(response);
      })
      .catch(err => {
        setAlerts(prev => [...prev, { type: 'error', message: `Failed to add "${place?.name}" to route.` }]);
      });
    if (!routeHistory.some(entry => entry.id === place.id)) {
      const newHistory = [...routeHistory, { id: place.id, addedAt: new Date().toISOString() }];
      setRouteHistory(newHistory);
    }
  };

  const handleAddAll = () => {
    searchResults.forEach(place => handleAddToRoute(place, true));
    setSearchResults([]);
    setAlerts(prev => [...prev, { type: 'success', message: 'Added all search results to your route!' }]);
  };

  const handleClearSearch = () => {
    setSearchResults([]);
  };

  const handleToggleTracking = async () => {
    const newTrackingStatus = !isTracking;
    try {
      await apiRequest(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker/salesman/set_tracking_status/`, {
        method: 'POST',
        body: JSON.stringify({ status: newTrackingStatus ? 'active' : 'offline' })
      });
      setIsTracking(newTrackingStatus);
      setAlerts(prev => [
        ...prev,
        {
          type: newTrackingStatus ? 'success' : 'error',
          message: newTrackingStatus ? 'Tracking started.' : 'Tracking stopped.',
        },
      ]);
    } catch (error) {
      setAlerts(prev => [...prev, { type: 'error', message: "Could not update tracking status." }]);
    }
  };

  // Remove alert by index
  const removeAlert = (idx) => {
    setAlerts(prev => prev.filter((_, i) => i !== idx));
  };

  // Helper: extract markers from planned route
  const plannedRouteMarkers = React.useMemo(() => {
    if (!todaysPlannedRoute?.stops || !Array.isArray(todaysPlannedRoute.stops)) return [];
    return todaysPlannedRoute.stops.map((stop, idx) => ({
      id: stop.id?.toString() || idx.toString(),
      title: stop.location_name || `Stop ${idx + 1}`,
      description: stop.address || '',
      coordinate: {
        latitude: stop.latitude,
        longitude: stop.longitude,
      },
    }));
  }, [todaysPlannedRoute]);

  // Helper: extract route points for MapViewDirections
  const routePoints = React.useMemo(() => {
    if (!todaysPlannedRoute?.stops || todaysPlannedRoute.stops.length < 2) return null;
    const stops = todaysPlannedRoute.stops;
    const origin = { latitude: stops[0].latitude, longitude: stops[0].longitude };
    const destination = { latitude: stops[stops.length - 1].latitude, longitude: stops[stops.length - 1].longitude };
    const waypoints = stops.slice(1, -1).map(stop => ({ latitude: stop.latitude, longitude: stop.longitude }));
    return { origin, destination, waypoints };
  }, [todaysPlannedRoute]);

  // Helper: initial region for MapView
  const initialRegion = plannedRouteMarkers.length > 0
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
        <View className="flex-row bg-white rounded-xl items-center p-2 mb-3 border border-gray-300">
          <TextInput
            className="flex-1 h-10 p-2 text-md text-gray-900"
            placeholder="e.g., gas station near stone mountain"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            placeholderTextColor="#6b7280"
          />
          <TouchableOpacity className="p-2 bg-orange-500 rounded-md ml-2" onPress={handleSearch}>
            <Search size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <View className="bg-white rounded-xl border border-gray-300 mb-3 pt-1 max-h-56">
            <FlatList
              data={searchResults}
              keyExtractor={item => item?.id}
              renderItem={({ item }) => (
                <View className="flex-row w-full justify-between items-center py-2 px-3 border-b border-gray-200">
                  <View>
                    <Text className="font-bold text-base">{item?.name}</Text>
                    <Text className="text-xs text-gray-500 overflow-hidden w-[70vw]" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item?.address}</Text>
                  </View>
                  {!routeHistory.some(entry => entry.id === item?.id) && (
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
            <Text className={`font-bold text-lg ${isTracking ? 'text-green-600' : 'text-red-600'}`}>
              {isTracking ? 'Active' : 'Inactive'}
            </Text>
            <Text className="text-xs text-gray-500">Tracking Status</Text>
          </View>
          <View className="items-center flex-1">
            <View className="font-bold text-lg text-gray-800 flex-row gap-2 items-center justify-center">
              <Battery size={20} className={`mr-1 ${battery < 20 ? 'text-red-500' : 'text-green-500'}`} color={battery < 20 ? "#ef4444" : "#22c55e"} />
              <Text>{battery}%</Text>
            </View>
            <Text className="text-xs text-gray-500">Battery</Text>
          </View>
          <View className="items-center flex-1">
            <Text className="font-bold text-lg text-gray-800">
              {signal ? (
                <Wifi size={20} className="text-green-500" color="#22c55e" />
              ) : (
                <WifiOff size={20} className="text-red-500" color="#ef4444" />
              )}
            </Text>
            <Text className="text-xs text-gray-500">Signal</Text>
          </View>
        </View>

        {/* Tracking Button */}
        <TouchableOpacity
          className={`w-full py-4 rounded-lg items-center mb-4 flex-row justify-center ${isTracking ? 'bg-red-500' : 'bg-green-500'}`}
          onPress={handleToggleTracking}
        >
          {isTracking ? (
            <Square size={24} className="mr-2" color="#fff" />
          ) : (
            <Play size={24} className="mr-2" color="#fff" />
          )}
          <Text className="text-white font-bold text-lg ml-2">
            {isTracking ? 'Stop Tracking' : 'Start Tracking'}
          </Text>
        </TouchableOpacity>

        {/* Map Section */}
        <View className="mb-4 rounded-xl overflow-hidden bg-white border border-gray-200" style={{ height: 260 }}>
          {plannedRouteMarkers.length > 0 ? (
            <MapView
              style={StyleSheet.absoluteFill}
              region={initialRegion}
            >
              {plannedRouteMarkers.map(marker => (
                <Marker
                  key={marker.id}
                  coordinate={marker.coordinate}
                  title={marker.title}
                  description={marker.description}
                />
              ))}
              {plannedRouteMarkers && (
                <MapViewDirections
                  origin={plannedRouteMarkers[0].coordinate}
                  destination={plannedRouteMarkers[plannedRouteMarkers.length - 1].coordinate}
                  apikey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}
                  strokeWidth={4}
                  strokeColor="orange"
                  precision="high"
                  timePrecision="now"
                  optimizeWaypoints={true}
                  waypoints={plannedRouteMarkers.map(marker => marker.coordinate)}
                />
              )}
            </MapView>
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-gray-400">No planned route stops to display on map.</Text>
            </View>
          )}
        </View>

        {/* Today's Activity */}
        <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
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
                  <Text className="font-bold text-base">{todaysActivity.duration || '0m'}</Text>
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
          bottom: Platform.OS === 'ios' ? 48 : 24,
          zIndex: 50,
        }}
      >
        {alerts.map((alert, idx) => (
          <View
            key={idx}
            className={`
              flex-row items-center justify-between min-w-[300px] max-w-[90vw]
              ${alert.type === 'error' ? 'bg-red-100/50' : 'bg-green-100/50'} border border-l-4 ${alert.type === 'error' ? 'border-red-500' : 'border-green-500'} py-1 px-4 rounded-xl
              shadow ${alert.type === 'error' ? 'shadow-red-500/25' : 'shadow-green-500/25'} mb-2 animate-slideIn
            `}
            style={{ backdropFilter: 'blur(12px)' }}
          >
            <View className="flex-1 flex-col">
              <Text className={`${alert.type === 'error' ? 'text-red-700' : 'text-green-700'}`}>{alert?.message}</Text>
              {/* {alert?.status && <Text className="text-xs opacity-80">Status: {alert?.status}</Text>} */}
            </View>
            <TouchableOpacity
              onPress={() => removeAlert(idx)}
              className="bg-transparent border-0 ml-2.5 px-1.5"
              hitSlop={10}
            >
              <Text className={`${alert.type === 'error' ? 'text-red-700' : 'text-green-700'} text-xl`}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
};


export default Home;