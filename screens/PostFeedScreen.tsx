// screens/PostFeedScreen.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Region, Marker } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import MapView from 'react-native-maps';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import LocationToggle from '../screens/LocationToggleScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#3c3c3c" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#000000" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#2c2c2c" }],
  },
];

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

export default function PostFeedScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const mapRef = useRef<MapView>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const isMounted = useRef(true);
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const isFocused = useIsFocused();

  const metersToRadians = (m: number) => m / 6371000;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (watchIdRef.current) Geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // Fetch rooms in viewport from Parse
  const fetchRoomsInViewport = useCallback(async (centerLat: number, centerLon: number, radiusMeters: number = 10000) => {
    if (!isFocused || !isMounted.current) return;
    try {
      const where = {
        location: {
          $nearSphere: { __type: 'GeoPoint', latitude: centerLat, longitude: centerLon },
          $maxDistance: metersToRadians(radiusMeters),
        },
      };

      const url = `${API_URL}/classes/Room?where=${encodeURIComponent(JSON.stringify(where))}&limit=40&keys=name,photoUrl,location`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Parse-Application-Id': APP_ID,
          'X-Parse-Master-Key': MASTER_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to fetch rooms');
      const json = await res.json();

      const validRooms = (json.results || [])
        .filter((r: any) => 
          r.objectId &&
          r.location && 
          typeof r.location.latitude === 'number' && 
          typeof r.location.longitude === 'number'
        )
        .map((r: any) => ({
          objectId: r.objectId,
          name: r.name || 'Unnamed Room',
          photoUrl: r.photoUrl,
          location: { 
            latitude: r.location.latitude, 
            longitude: r.location.longitude 
          },
        }));

      if (isMounted.current && isFocused) {
        setRooms(validRooms);
      }
    } catch (e) {
      console.error('Error fetching rooms:', e);
      if (isMounted.current && isFocused) {
        setRooms([]);
      }
    }
  }, [isFocused]);

  // Sync location sharing state from storage on focus
  useFocusEffect(
    useCallback(() => {
      const syncLocationState = async () => {
        const saved = await AsyncStorage.getItem('locationSharingEnabled');
        if (saved !== null) {
          setLocationSharingEnabled(saved === 'true');
        }
      };
      syncLocationState();
    }, [])
  );

  // Refetch every time screen focuses
  useFocusEffect(
    useCallback(() => {
      if (locationSharingEnabled && location && isFocused) {
        fetchRoomsInViewport(location.lat, location.lon, 10000);
      }
      
      if (locationSharingEnabled && location) {
        watchIdRef.current = Geolocation.watchPosition(
          pos => {
            if (!isMounted.current || !isFocused) return;
            const { latitude, longitude } = pos.coords;
            setLocation({ lat: latitude, lon: longitude });
          },
          err => console.error('Geolocation watch error:', err),
          { enableHighAccuracy: true, distanceFilter: 10, interval: 3000, fastestInterval: 2000 }
        );
      }
      return () => {
        if (watchIdRef.current) {
          Geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      };
    }, [locationSharingEnabled, location, fetchRoomsInViewport, isFocused])
  );

  useEffect(() => {
    if (!locationSharingEnabled) {
      setLocation(null);
      setMapRegion(null);
      setRooms([]);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (watchIdRef.current) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    Geolocation.getCurrentPosition(
      pos => {
        if (!isMounted.current) return;
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lon: longitude });
        const initialRegion: Region = {
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setMapRegion(initialRegion);
        if (mapRef.current) {
          mapRef.current.animateToRegion(initialRegion, 1000);
        }
        if (isFocused) {
          fetchRoomsInViewport(latitude, longitude, 10000);
        }
      },
      err => {
        console.error('Geolocation init error:', err);
        const fallbackLat = 37.7749;
        const fallbackLon = -122.4194;
        if (!isMounted.current) return;
        setLocation({ lat: fallbackLat, lon: fallbackLon });
        const initialRegion: Region = {
          latitude: fallbackLat,
          longitude: fallbackLon,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setMapRegion(initialRegion);
        if (mapRef.current) {
          mapRef.current.animateToRegion(initialRegion, 1000);
        }
        if (isFocused) {
          fetchRoomsInViewport(fallbackLat, fallbackLon, 10000);
        }
      },
      { enableHighAccuracy: false, timeout: 5000 }
    );

    return () => {
      if (watchIdRef.current) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [locationSharingEnabled, fetchRoomsInViewport, isFocused]);

  const handleRegionChangeComplete = useCallback((region: Region) => {
    if (!isMounted.current || !isFocused) return;
    setMapRegion(region);
    const { latitude, longitude, latitudeDelta } = region;
    const radius = latitudeDelta * 111000 / 2;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      if (!isMounted.current || !isFocused) return;
      fetchRoomsInViewport(latitude, longitude, radius * 1000);
    }, 500);
  }, [fetchRoomsInViewport, isFocused]);

  const handleMarkerPress = useCallback((room: any) => {
    if (!isMounted.current || !isFocused) return;
    navigation.navigate('RoomUserProfile', {
      roomId: room.objectId,
      roomName: room.name || 'Unnamed Room',
    });
  }, [navigation, isFocused]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      <View style={styles.toggleContainer}>
        <LocationToggle enabled={locationSharingEnabled} onToggle={setLocationSharingEnabled} />
      </View>

      {locationSharingEnabled && mapRegion ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          mapType="standard"
          customMapStyle={darkMapStyle}
          showsUserLocation={true}
          showsMyLocationButton={true}
          region={mapRegion}
          onRegionChangeComplete={handleRegionChangeComplete}
        >
          {rooms.map((room) => (
            <Marker
              key={room.objectId}
              coordinate={room.location}
              title={room.name}
              onPress={() => handleMarkerPress(room)}
            >
              {room.photoUrl ? (
                <Image
                  source={{ uri: room.photoUrl }}
                  style={styles.roomMarkerImage}
                />
              ) : (
                <View style={styles.defaultMarker}>
                  <Ionicons name="image-outline" size={moderateScale(30)} color="#007AFF" />
                </View>
              )}
            </Marker>
          ))}
        </MapView>
      ) : locationSharingEnabled ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Fetching your location…</Text>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text }]}>Enable location to see the map</Text>
        </View>
      )}

      {/* Floating + Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('RoomCreation')}
      >
        <Ionicons name="add" size={moderateScale(32)} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  toggleContainer: { 
    position: 'absolute', 
    top: StatusBar.currentHeight ? StatusBar.currentHeight + hp('2%') : hp('6%'),
    left: wp('4%'), 
    right: wp('4%'), 
    zIndex: 1000 
  },
  map: { 
    flex: 1 
  },
  loadingOverlay: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.2%'),
    borderRadius: moderateScale(20),
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: { 
    marginLeft: wp('2%'), 
    fontSize: moderateScale(13), 
    fontWeight: '500' 
  },
  emptyContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: wp('10%') 
  },
  emptyText: { 
    fontSize: moderateScale(16), 
    textAlign: 'center' 
  },
  fab: {
    position: 'absolute',
    right: wp('5%'),
    bottom: hp('4%'),
    width: moderateScale(60),
    height: moderateScale(60),
    borderRadius: moderateScale(30),
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    zIndex: 1000,
  },
  roomMarkerImage: {
    width: moderateScale(58),
    height: moderateScale(58),
    borderRadius: moderateScale(7),
    borderWidth: 2,
    borderColor: 'white',
  },
  defaultMarker: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
});