// MapsScreen.tsx (updated)
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  Image,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import EncryptedStorage from 'react-native-encrypted-storage';
import { jwtDecode } from 'jwt-decode';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from './types/navigation';

// Import the new component
import LocationToggle from './screens/LocationToggleScreen';

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

interface Auth0IdToken {
  sub: string;
  name: string;
  picture: string;
  email: string;
  email_verified: boolean;
}

async function queryUser(auth0Id: string): Promise<any | null> {
  const where = { auth0Id };
  const whereStr = encodeURIComponent(JSON.stringify(where));
  const res = await fetch(`${API_URL}/classes/UserProfile?where=${whereStr}&limit=1`, {
    method: 'GET',
    headers: {
      'X-Parse-Application-Id': APP_ID,
      'X-Parse-Master-Key': MASTER_KEY,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error('queryUser error', res.status, txt);
    return null;
  }
  const data = await res.json();
  return data.results?.[0] ?? null;
}

interface MapsScreenProps {
  navigation: NavigationProp<RootStackParamList>;
}

export default function MapsScreen({ navigation }: MapsScreenProps) {
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [radiusMeters, setRadiusMeters] = useState<number>(20);
  const [nearbyUsers, setNearbyUsers] = useState<Array<{ objectId: string; username?: string; profilePicUrl?: string; location: { latitude: number; longitude: number } }>>([]);
  const mapRef = useRef<MapView>(null);

  // Load profile picture
  useEffect(() => {
    const init = async () => {
      const token = await EncryptedStorage.getItem('idToken');
      if (token) {
        const decoded: Auth0IdToken = jwtDecode(token);
        const snap = await queryUser(decoded.sub);
        setProfilePicUrl(snap?.profilePicUrl ?? decoded.picture ?? null);
      }
    };
    init();

    const unsub = navigation.addListener('focus', init);
    return () => unsub?.();
  }, [navigation]);

  // Geolocation when sharing is ON
  useEffect(() => {
    if (!locationSharingEnabled) {
      setLocation(null);
      return;
    }

    Geolocation.getCurrentPosition(
      pos => setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => console.log('Geolocation init error', err),
      { enableHighAccuracy: false, timeout: 5000 }
    );

    let first = true;
    const watchId = Geolocation.watchPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lon: longitude });
        if (first && mapRef.current) {
          mapRef.current.animateCamera({ center: { latitude, longitude }, zoom: 18 });
          first = false;
        }
      },
      err => console.log('Geolocation watch error', err),
      {
        enableHighAccuracy: true,
        distanceFilter: 1,
        interval: 2000,
        fastestInterval: 1000,
      }
    );

    return () => Geolocation.clearWatch(watchId);
  }, [locationSharingEnabled]);

  const metersToRadians = (m: number) => m / 6371000;

  const fetchNearbyUsers = useCallback(async (lat: number, lon: number, meters: number) => {
    try {
      const currentObjectId = await AsyncStorage.getItem('parseObjectId');
      const where: any = {
        isOnline: true,
        location: {
          $nearSphere: { __type: 'GeoPoint', latitude: lat, longitude: lon },
          $maxDistance: metersToRadians(meters),
        },
      };
      if (currentObjectId) where.objectId = { $ne: currentObjectId };
      const whereStr = encodeURIComponent(JSON.stringify(where));
      const res = await fetch(`${API_URL}/classes/UserProfile?where=${whereStr}&limit=100`, {
        method: 'GET',
        headers: {
          'X-Parse-Application-Id': APP_ID,
          'X-Parse-Master-Key': MASTER_KEY,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      const items = (data.results || [])
        .filter((u: any) => u.location && typeof u.location.latitude === 'number' && typeof u.location.longitude === 'number')
        .map((u: any) => ({
          objectId: u.objectId,
          username: u.username,
          profilePicUrl: u.profilePicUrl,
          location: { latitude: u.location.latitude, longitude: u.location.longitude },
        }));
      setNearbyUsers(items);
    } catch {}
  }, []);

  useEffect(() => {
    if (!location) return;
    fetchNearbyUsers(location.lat, location.lon, radiusMeters);
    const id = setInterval(() => fetchNearbyUsers(location.lat, location.lon, radiusMeters), 10000);
    return () => clearInterval(id);
  }, [location?.lat, location?.lon, radiusMeters, fetchNearbyUsers]);

  const openSearch = () => navigation.navigate('SearchBar', { initialQuery: searchQuery });

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Search + Toggle */}
      <View style={styles.searchContainer}>
        <Pressable
          style={({ pressed }) => [styles.searchBar, pressed && { opacity: 0.7 }]}
          onPress={openSearch}
        >
          <Ionicons name="search" size={20} color="#fff" style={styles.searchIcon} />
          <Text style={styles.searchPlaceholder}>
            {searchQuery || 'Search Friends...'}
          </Text>
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={e => {
                e.stopPropagation();
                setSearchQuery('');
              }}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#ccc" />
            </TouchableOpacity>
          )}
        </Pressable>

        {/* Reusable Toggle Component */}
        <LocationToggle onToggleChange={setLocationSharingEnabled} />

        {/* Radius selector */}
                {/* Radius selector + Inbox Button */}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4, justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[5, 10, 20, 40].map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setRadiusMeters(m)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 14,
                  backgroundColor: radiusMeters === m ? 'rgba(0,200,83,0.9)' : 'rgba(255,255,255,0.15)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.2)',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 12 }}>{m}m</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Inbox Button */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Inbox')}
            style={{
              padding: 8,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
            }}
          >
            <Ionicons name="mail-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Map or Empty State */}
      {locationSharingEnabled && location ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          mapType="standard" 
          showsUserLocation
          showsMyLocationButton={false}
          initialRegion={{
            latitude: location.lat,
            longitude: location.lon,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
        >
          {/* Nearby users */}
          {nearbyUsers.map(user => (
            <Marker
              key={user.objectId}
              coordinate={user.location}
              title={user.username || 'Nearby user'}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              {user.profilePicUrl ? (
                <Image source={{ uri: user.profilePicUrl }} style={styles.profileMarker} />
              ) : (
                <View style={styles.defaultMarker}>
                  <Ionicons name="person" size={24} color="#fff" />
                </View>
              )}
            </Marker>
          ))}
          <Marker
            coordinate={{ latitude: location.lat, longitude: location.lon }}
            title="You are here"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            {profilePicUrl ? (
              <Image source={{ uri: profilePicUrl }} style={styles.profileMarker} />
            ) : (
              <View style={styles.defaultMarker}>
                <Ionicons name="person" size={24} color="#fff" />
              </View>
            )}
          </Marker>
        </MapView>
      ) : locationSharingEnabled ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.loadingText}>Fetching your location…</Text>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Enable location to see the map</Text>
        </View>
      )}
    </View>
  );
}

/* Styles remain the same (only keep what's used) */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  searchContainer: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    zIndex: 1000,
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 25,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  searchIcon: { marginRight: 10 },
  searchPlaceholder: { flex: 1, fontSize: 16, color: '#fff', fontWeight: '400' },
  clearButton: { padding: 4 },

  map: { flex: 1 },

  profileMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#fff',
  },
  defaultMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#555',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },

  loadingOverlay: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: { color: '#fff', marginLeft: 8, fontSize: 13, fontWeight: '500' },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
  },
});  


     