import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { apiRequest } from '../utils/api';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Calendar,
  MapPin,
  Trash2,
  History as HistoryIcon,
  RotateCcw,
} from 'lucide-react-native';

const History = () => {
  const navigation = useNavigation();
  const [routeHistory, setRouteHistory] = useState({});
  const [expandedDates, setExpandedDates] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRouteHistory();
  }, []);

  const loadRouteHistory = async () => {
    try {
      setLoading(true);
      const history = await AsyncStorage.getItem('routeHistory');
      if (history) {
        setRouteHistory(JSON.parse(history));
      }
    } catch (error) {
      console.error('Error loading route history:', error);
      Alert.alert('Error', 'Failed to load route history');
    } finally {
      setLoading(false);
    }
  };

  const toggleDateExpansion = (date) => {
    setExpandedDates(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
  };

  const deleteRouteHistory = async (date) => {
    Alert.alert(
      'Delete Route History',
      `Are you sure you want to delete the route history for ${formatDate(date)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedHistory = { ...routeHistory };
              delete updatedHistory[date];
              await AsyncStorage.setItem('routeHistory', JSON.stringify(updatedHistory));
              setRouteHistory(updatedHistory);
              // Also collapse if it was expanded
              setExpandedDates(prev => ({
                ...prev,
                [date]: false
              }));
            } catch (error) {
              console.error('Error deleting route history:', error);
              Alert.alert('Error', 'Failed to delete route history');
            }
          }
        }
      ]
    );
  };

  const clearAllHistory = async () => {
    Alert.alert(
      'Clear All History',
      'Are you sure you want to delete all route history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('routeHistory');
              setRouteHistory({});
              setExpandedDates({});
            } catch (error) {
              console.error('Error clearing route history:', error);
              Alert.alert('Error', 'Failed to clear route history');
            }
          }
        }
      ]
    );
  };

  const restoreRouteToToday = async (route) => {
    Alert.alert(
      'Restore Route',
      'This will replace your current planned route with this historical route. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'default',
          onPress: async () => {
            try {
              // First, get current planned route to clear existing stops
              try {
                const currentRoute = await apiRequest(
                  `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker/salesman/planned_routes/today/`
                );
                
                // Delete each existing stop
                if (currentRoute?.stops && Array.isArray(currentRoute.stops)) {
                  for (const stop of currentRoute.stops) {
                    try {
                      await apiRequest(
                        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker/salesman/planned_routes/delete_stop/${stop.place_id}/`,
                        { method: 'DELETE' }
                      );
                    } catch (deleteError) {
                      console.log('Error deleting stop:', deleteError);
                    }
                  }
                }
              } catch (clearError) {
                console.log('No existing route to clear or error clearing:', clearError);
              }

              // Add each marker from the historical route
              for (const marker of route.markers) {
                const payload = {
                  location_name: marker.title,
                  address: marker.description,
                  latitude: marker.coordinate.latitude,
                  longitude: marker.coordinate.longitude,
                  place_id: marker.placeId || marker.id,
                };

                await apiRequest(
                  `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tracker/salesman/planned_routes/add_stop/`,
                  {
                    method: 'POST',
                    body: JSON.stringify(payload),
                  }
                );
              }

              Alert.alert('Success', 'Route restored to today\'s planned route!');
              
              // Add a small delay to allow backend to process, then navigate back
              setTimeout(() => {
                navigation.goBack(); // Go back to home screen which will auto-refresh
              }, 1000);
            } catch (error) {
              console.error('Error restoring route:', error);
              Alert.alert('Error', 'Failed to restore route. Please try again.');
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderMarkerItem = ({ item, index }) => (
    <View className="bg-gray-50 p-3 mx-4 mb-2 rounded-lg border border-gray-200">
      <View className="flex-row items-center mb-2">
        <MapPin size={16} color="#f97316" />
        <Text className="text-gray-900 font-semibold ml-2 flex-1">
          {item.title || `Stop ${index + 1}`}
        </Text>
        {item.isFirst && (
          <View className="bg-green-100 px-2 py-1 rounded">
            <Text className="text-green-700 text-xs font-medium">START</Text>
          </View>
        )}
        {item.isLast && (
          <View className="bg-red-100 px-2 py-1 rounded">
            <Text className="text-red-700 text-xs font-medium">END</Text>
          </View>
        )}
      </View>
      {item.description && (
        <Text className="text-gray-600 text-sm mb-2">{item.description}</Text>
      )}
      <Text className="text-gray-500 text-xs">
        Lat: {item.coordinate.latitude.toFixed(6)}, 
        Lng: {item.coordinate.longitude.toFixed(6)}
      </Text>
    </View>
  );

  const renderDateItem = (date) => {
    const routes = routeHistory[date];
    const isExpanded = expandedDates[date];
    
    return (
      <View key={date} className="mb-4">
        {/* Date Header */}
        <TouchableOpacity
          className="bg-white mx-4 p-4 rounded-lg border border-gray-200 shadow-sm"
          onPress={() => toggleDateExpansion(date)}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <Calendar size={20} color="#f97316" />
              <View className="ml-3 flex-1">
                <Text className="text-gray-900 font-semibold text-lg">
                  {formatDate(date)}
                </Text>
                <Text className="text-gray-500 text-sm">
                  {routes.length} route{routes.length !== 1 ? 's' : ''} saved
                </Text>
              </View>
            </View>
            <View className="flex-row items-center">
              <TouchableOpacity
                className="bg-blue-500 px-2 py-1 rounded mr-2"
                onPress={(e) => {
                  e.stopPropagation();
                  // Restore the most recent route from this date
                  if (routes.length > 0) {
                    const mostRecentRoute = routes[routes.length - 1];
                    restoreRouteToToday(mostRecentRoute);
                  }
                }}
              >
                <RotateCcw size={14} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                className="p-2 mr-2"
                onPress={(e) => {
                  e.stopPropagation();
                  deleteRouteHistory(date);
                }}
              >
                <Trash2 size={18} color="#ef4444" />
              </TouchableOpacity>
              {isExpanded ? (
                <ChevronDown size={20} color="#6b7280" />
              ) : (
                <ChevronRight size={20} color="#6b7280" />
              )}
            </View>
          </View>
        </TouchableOpacity>

        {/* Expanded Content */}
        {isExpanded && (
          <View className="mt-2">
            {routes.map((route, routeIndex) => (
              <View key={routeIndex} className="mb-4">
                <View className="bg-orange-50 mx-4 p-3 rounded-lg border border-orange-200">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-orange-800 font-medium mb-1">
                        Route {routeIndex + 1}
                      </Text>
                      <Text className="text-orange-600 text-sm">
                        Saved at: {formatTime(route.timestamp)}
                      </Text>
                      <Text className="text-orange-600 text-sm">
                        {route.markers.length} stop{route.markers.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      className="bg-blue-500 px-3 py-2 rounded-lg flex-row items-center"
                      onPress={() => restoreRouteToToday(route)}
                    >
                      <RotateCcw size={16} color="#fff" />
                      <Text className="text-white font-medium ml-1 text-sm">Restore</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <FlatList
                  data={route.markers}
                  renderItem={renderMarkerItem}
                  keyExtractor={(item, index) => `${item.id || index}`}
                  className="mt-2"
                />
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const sortedDates = Object.keys(routeHistory).sort((a, b) => new Date(b) - new Date(a));

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-orange-50/25">
        <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-200">
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 mr-2">
            <ArrowLeft size={24} color="#222" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-800">Route History</Text>
        </View>
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-500">Loading history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-orange-50/25">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 mr-2">
          <ArrowLeft size={24} color="#222" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-800 flex-1">Route History</Text>
        {sortedDates.length > 0 && (
          <TouchableOpacity
            className="p-2"
            onPress={clearAllHistory}
          >
            <Trash2 size={20} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>

      {sortedDates.length === 0 ? (
        <View className="flex-1 justify-center items-center p-8">
          <HistoryIcon size={64} color="#d1d5db" />
          <Text className="text-gray-500 text-lg font-medium mt-4 text-center">
            No Route History
          </Text>
          <Text className="text-gray-400 text-center mt-2">
            Your saved routes will appear here when you start planning routes.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="py-4">
            {sortedDates.map(renderDateItem)}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default History;
