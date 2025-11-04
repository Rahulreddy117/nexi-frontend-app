// MapsScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
  Text,
  Image,
  Pressable,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import EncryptedStorage from 'react-native-encrypted-storage';
import { jwtDecode } from 'jwt-decode';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from './types/navigation';

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

/* --------------------------------------------------- */
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

/* --------------------------------------------------- */
interface MapsScreenProps {
  navigation: NavigationProp<RootStackParamList>;
}

/* --------------------------------------------------- */
export default function MapsScreen({ navigation }: MapsScreenProps) {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const mapRef = useRef<MapView>(null);

  /* ---- profile picture on focus ---- */
  useEffect(() => {
    const loadPic = async () => {
      const token = await EncryptedStorage.getItem('idToken');
      if (!token) return;
      const decoded: Auth0IdToken = jwtDecode(token);
      const snap = await queryUser(decoded.sub);
      setProfilePicUrl(snap?.profilePicUrl ?? decoded.picture ?? null);
    };
    loadPic();
    const unsub = navigation.addListener('focus', loadPic);
    return () => unsub?.();
  }, [navigation]);

  /* ---- location ---- */
  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) startLocationFlow();
    } else {
      startLocationFlow();
    }
  };

  const startLocationFlow = () => {
    Geolocation.getCurrentPosition(
      pos => setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => console.log('Geolocation error', err),
      { enableHighAccuracy: false, timeout: 1000, maximumAge: 60000 }
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
      err => console.log('watch error', err),
      { enableHighAccuracy: true, distanceFilter: 1, interval: 2000, fastestInterval: 1000 }
    );

    return () => Geolocation.clearWatch(watchId);
  };

  const openSearch = () => navigation.navigate('SearchBar', { initialQuery: searchQuery });

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Search bar */}
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
      </View>

      {/* Map */}
      {location ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          showsUserLocation
          showsMyLocationButton={false}
          region={{
            latitude: location.lat,
            longitude: location.lon,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
        >
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
      ) : (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.loadingText}>Fetching your location…</Text>
        </View>
      )}
    </View>
  );
}

/* --------------------------------------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { flex: 1 },
  searchContainer: { position: 'absolute', top: 40, left: 16, right: 16, zIndex: 1000 },
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
  profileMarker: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#fff' },
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
});