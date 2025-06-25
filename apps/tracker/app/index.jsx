import { View, Text, Button, Dimensions } from 'react-native'
import React, { useState } from 'react'
import * as Location from 'expo-location'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView, { Marker } from 'react-native-maps'
import MapViewDirections from 'react-native-maps-directions';

const Index = () => {
    const [location, setLocation] = useState(null)
    const [errorMsg, setErrorMsg] = useState(null)

    const getLocation = async () => {
        let { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') {
            setErrorMsg('Permission to access location was denied')
            setLocation(null)
            return
        }

        let loc = await Location.getCurrentPositionAsync({})
        setLocation(loc)
        setErrorMsg(null)
    }

    return (
        <SafeAreaView className="flex flex-col gap-3 items-center justify-center p-4">
            <Button title="Get Location" onPress={getLocation} className="flex-1 items-center justify-center p-4" />
            {errorMsg && <Text style={{ color: 'red' }}>{errorMsg}</Text>}
            {location && (
                <View className="w-full p-4 bg-white rounded-lg shadow-md">
                    <Text>Latitude: {location.coords.latitude}</Text>
                    <Text>Longitude: {location.coords.longitude}</Text>
                    <Text>Accuracy: {location.coords.accuracy}</Text>
                    <Text>Altitude: {location.coords.altitude}</Text>
                    <Text>Altitude Accuracy: {location.coords.altitudeAccuracy}</Text>
                    <Text>Heading: {location.coords.heading}</Text>
                    <Text>Speed: {location.coords.speed}</Text>
                    <Text>Timestamp: {location.timestamp}</Text>
                </View>
            )}
            {location && (<View className="rounded-lg bg-white shadow-md overflow-hidden">
                <MapView
                    style={{
                        width: Dimensions.get('window').width - 40,
                        height: 300,
                    }}
                    initialRegion={{
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    }}
                    region={{
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    }}
                >
                    <Marker
                        coordinate={{
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                        }}
                        title="You are here"
                    />
                    <MapViewDirections
                        origin={"Stone Mountain, GA"}
                        destination={"Alpharetta, GA"}
                        apikey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}
                        strokeWidth={4}
                        strokeColor="orange"
                        precision='high'
                        timePrecision='now'
                        optimizeWaypoints={true}
                        waypoints={[]}
                    />
                </MapView>
            </View>)}
        </SafeAreaView>
    )
}

export default Index