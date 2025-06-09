import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GoogleMap, useLoadScript, Marker, DirectionsService, DirectionsRenderer, Polyline } from '@react-google-maps/api';
import { useAtom } from 'jotai';
import { trackerSettingsAtom, userAtom } from '../../Variables';

const libraries = ['places'];
const mapContainerStyle = {
    width: '100%',
    height: '100%',
};

const mapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: true,
    clickableIcons: true,
    automaticallyAdjustsViewport: true,
    accessibility: true,
    alwaysPointNorth: true,
    styles: [ // Optional: A nice map style
        {
            "featureType": "poi",
            "stylers": [{ "visibility": "off" }]
        },
        {
            "featureType": "road",
            "elementType": "labels.icon",
            "stylers": [{ "visibility": "off" }]
        },
        {
            "featureType": "transit",
            "stylers": [{ "visibility": "on", "color": "#808080", "weight": 0.5 }]
        },
        {
            "featureType": "water",
            "stylers": [{ "visibility": "off" }]
        },
        {
            "featureType": "landscape",
            "stylers": [{ "visibility": "on" }]
        },
        {
            "featureType": "road.highway",
            "elementType": "geometry.fill",
            "stylers": [{ "color": "#f8f8f8" }]
        },
        {
            "featureType": "road.local",
            "elementType": "geometry.fill",
            "stylers": [{ "color": "#ffffff" }]
        },
        {
            "featureType": "road.arterial",
            "elementType": "geometry.fill",
            "stylers": [{ "color": "#f0f0f0" }]
        }

    ]
};


const GoogleMapWrapper = ({ center, zoom = 12, markers = [], polylines = [], liveRoute = [], todayRoute = [] }) => {
    const { isLoaded, loadError } = useLoadScript({
        googleMapsApiKey: atob('QUl6YVN5QnhCS0t3OHFSYm9vSElBU3ZTMGdraGlHYTRFSXI4cEE0'),
        libraries,
    });

    const [trackerSettings] = useAtom(trackerSettingsAtom);
    const [userLocation, setUserLocation] = useState(null);
    const intervalRef = useRef(null);
    const [user] = useAtom(userAtom);
    const [directions, setDirections] = useState(null);
    const [directionsError, setDirectionsError] = useState(null);

    // Create route path from user location and today's stops
    const getTodayRoutePath = () => {
        if (!userLocation || !todayRoute || todayRoute.length === 0) return [];
        return [
            userLocation,
            ...todayRoute.map(stop => ({ lat: stop?.lat, lng: stop?.lng }))
        ];
    };

    // Function to calculate route using DirectionsService
    const calculateRoute = useCallback(() => {
        if (!userLocation || !todayRoute || todayRoute.length === 0 || !window.google) return;

        const directionsService = new window.google.maps.DirectionsService();
        const waypoints = todayRoute.map(stop => ({
            location: new window.google.maps.LatLng(stop.lat, stop.lng),
            stopover: true
        }));

        const origin = new window.google.maps.LatLng(userLocation.lat, userLocation.lng);
        const destination = waypoints.pop().location;

        directionsService.route(
            {
                origin: origin,
                destination: destination,
                waypoints: waypoints,
                optimizeWaypoints: true,
                travelMode: window.google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
                if (status === "OK") {
                    setDirections(result);
                    setDirectionsError(null);
                } else {
                    setDirectionsError(`Directions request failed: ${status}`);
                    setDirections(null);
                }
            }
        );
    }, [userLocation, todayRoute]);

    // Recalculate route when user location or todayRoute changes
    useEffect(() => {
        if (isLoaded && userLocation && todayRoute.length > 0) {
            calculateRoute();
        }
    }, [isLoaded, userLocation, todayRoute, calculateRoute]);

    // Get and update user location at the interval specified in trackerSettings
    useEffect(() => {
        function updateLocation() {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        setUserLocation({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        });
                    },
                    (error) => {
                        // Optionally handle error
                    }
                );
            }
        }
        updateLocation();
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(
            updateLocation,
            (trackerSettings.location_update_interval_minutes || 3) * 60 * 1000
        );
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [trackerSettings.location_update_interval_minutes]);

    if (loadError) return <div>Error loading maps</div>;
    if (!isLoaded) return <div>Loading Maps...</div>;

    return (
        <GoogleMap
            mapContainerStyle={mapContainerStyle}
            zoom={zoom}
            center={userLocation || center}
            options={mapOptions}
        >
            {/* Today's route stop markers */}
            {todayRoute.map((stop, index) => (
                <Marker
                    key={stop?.id || `stop-${index}`}
                    position={{ lat: stop?.lat, lng: stop?.lng }}
                    title={stop?.title || `Stop ${index + 1}`}
                    icon={{
                        path: "M24 12a12 12 0 1 1-24 0 12 12 0 0 1 24 0z", // SVG path for a circle centered at (12,12) with radius 12
                        fillColor: "#ffffff",
                        fillOpacity: 1,
                        strokeColor: "orange",
                        strokeWeight: 3,
                        scale: 0.5,
                        anchor: typeof window !== 'undefined' && window.google && window.google.maps ? new window.google.maps.Point(12, 12) : undefined,
                        className: "peer"
                    }}
                    label={{
                        text: stop?.title || `Stop ${index + 1}`,
                        className: "absolute top-1/2 left-0 -translate-x-1/2 translate-y-4 w-fit rounded border border-orange-500 text-wrap whitespace-wrap bg-white p-1 " + (zoom > 12 ? "hidden" : "")
                    }}
                />
            ))}


            {markers.map((marker) => (
                <Marker
                    key={marker.id}
                    position={{ lat: marker.lat, lng: marker.lng }}
                    title={marker.title}
                    icon={{
                        url: `https://api.dicebear.com/9.x/micah/svg?seed=${marker?.first_name}${marker?.last_name}&shirt=collared&shirtColor=6bd9e9&hair=fonze,dougFunny,mrClean,mrT,turban&backgroundColor=ffdfbf&radius=50`,
                        scaledSize: typeof window !== 'undefined' && window.google && window.google.maps ? new window.google.maps.Size(48, 48) : undefined,
                        anchor: typeof window !== 'undefined' && window.google && window.google.maps ? new window.google.maps.Point(24, 24) : undefined,
                    }}
                />
            ))}
            {/* Render directions if available */}
            {directions && (
                <DirectionsRenderer
                    directions={directions}
                    options={{
                        suppressMarkers: true, // We're handling markers separately
                        polylineOptions: {
                            strokeColor: 'orange',
                            strokeWeight: 5,
                            strokeOpacity: 0.8
                        }
                    }}
                />
            )}
            {/* Render liveRoute as a blue path if provided and has at least 2 points */}
            {Array.isArray(liveRoute) && liveRoute.length > 1 && (
                <Polyline
                    path={liveRoute}
                    options={{
                        strokeColor: '#1976D2', // blue
                        strokeOpacity: 1,
                        strokeWeight: 5,
                    }}
                />
            )}

            {/* User location marker */}
            {userLocation && (
                <Marker
                    position={userLocation}
                    title="Your Location"
                    icon={{
                        url: `https://api.dicebear.com/9.x/micah/svg?seed=${user?.first_name}${user?.last_name}&shirt=collared&shirtColor=6bd9e9&hair=fonze,dougFunny,mrClean,mrT,turban&backgroundColor=ffdfbf&radius=50`,
                        scaledSize: typeof window !== 'undefined' && window.google && window.google.maps ? new window.google.maps.Size(48, 48) : undefined,
                        anchor: typeof window !== 'undefined' && window.google && window.google.maps ? new window.google.maps.Point(24, 24) : undefined,
                    }}
                />
            )}
        </GoogleMap>
    );
};

export default GoogleMapWrapper;