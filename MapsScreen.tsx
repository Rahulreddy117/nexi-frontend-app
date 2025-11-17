// MapsScreen.tsx (Precise Users Button + Filter)
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
  Modal,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import EncryptedStorage from 'react-native-encrypted-storage';
import { jwtDecode } from 'jwt-decode';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from './types/navigation';
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
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] ?? null;
}

interface MapsScreenProps {
  navigation: NavigationProp<RootStackParamList>;
}

type UserMarker = { objectId: string; username?: string; profilePicUrl?: string; location: { latitude: number; longitude: number } };

export default function MapsScreen({ navigation }: MapsScreenProps) {
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [myObjectId, setMyObjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [radiusMeters, setRadiusMeters] = useState<number>(20);
  const [nearbyUsers, setNearbyUsers] = useState<UserMarker[]>([]);
  const [showPreciseModal, setShowPreciseModal] = useState(false);
  const [preciseFilter, setPreciseFilter] = useState(10);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    const init = async () => {
      const token = await EncryptedStorage.getItem('idToken');
      if (token) {
        const decoded: Auth0IdToken = jwtDecode(token);
        const snap = await queryUser(decoded.sub);
        setProfilePicUrl(snap?.profilePicUrl ?? decoded.picture ?? null);
        setMyObjectId(snap?.objectId || null);
      }
    };
    init();
    const unsub = navigation.addListener('focus', init);
    return () => unsub?.();
  }, [navigation]);

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
      { enableHighAccuracy: true, distanceFilter: 1, interval: 2000, fastestInterval: 1000 }
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

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const filteredUsers = location ? nearbyUsers.filter(u => getDistance(location.lat, location.lon, u.location.latitude, u.location.longitude) <= preciseFilter) : [];

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={styles.searchContainer}>
        <Pressable style={({ pressed }) => [styles.searchBar, pressed && { opacity: 0.7 }]} onPress={() => navigation.navigate('SearchBar', { initialQuery: searchQuery })}>
          <Ionicons name="search" size={20} color="#fff" style={styles.searchIcon} />
          <Text style={styles.searchPlaceholder}>{searchQuery || 'Search Friends...'}</Text>
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={e => { e.stopPropagation(); setSearchQuery(''); }} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#ccc" />
            </TouchableOpacity>
          )}
        </Pressable>
        <LocationToggle onToggleChange={setLocationSharingEnabled} />
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4, justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[5, 10, 20, 40].map(m => (
              <TouchableOpacity key={m} onPress={() => setRadiusMeters(m)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: radiusMeters === m ? 'rgba(0,200,83,0.9)' : 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                <Text style={{ color: '#fff', fontSize: 12 }}>{m}m</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Inbox')} style={{ padding: 8, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
            <Ionicons name="mail-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {locationSharingEnabled && location ? (
        <>
          <MapView ref={mapRef} style={styles.map} provider={PROVIDER_GOOGLE} mapType="standard" showsUserLocation showsMyLocationButton={false} initialRegion={{ latitude: location.lat, longitude: location.lon, latitudeDelta: 0.005, longitudeDelta: 0.005 }}>
            {nearbyUsers.map(user => (
              <Marker key={user.objectId} coordinate={user.location} title={user.username || 'User'} anchor={{ x: 0.5, y: 0.5 }} onPress={() => navigation.navigate('UserProfile', { objectId: user.objectId, username: user.username || 'User', profilePicUrl: user.profilePicUrl || null, bio: '', height: '' })}>
                {user.profilePicUrl ? <Image source={{ uri: user.profilePicUrl }} style={styles.profileMarker} /> : <View style={styles.defaultMarker}><Ionicons name="person" size={24} color="#fff" /></View>}
              </Marker>
            ))}
            <Marker coordinate={{ latitude: location.lat, longitude: location.lon }} title="You" anchor={{ x: 0.5, y: 0.5 }} onPress={() => myObjectId && navigation.navigate('UserProfile', { objectId: myObjectId, username: 'Me', profilePicUrl: profilePicUrl || null, bio: '', height: '' })}>
              {profilePicUrl ? <Image source={{ uri: profilePicUrl }} style={styles.profileMarker} /> : <View style={styles.defaultMarker}><Ionicons name="person" size={24} color="#fff" /></View>}
            </Marker>
          </MapView>

          <TouchableOpacity style={styles.preciseButton} onPress={() => setShowPreciseModal(true)}>
            <Ionicons name="people-outline" size={18} color="#fff" />
            <Text style={styles.preciseText}>Precise Users</Text>
          </TouchableOpacity>
        </>
      ) : locationSharingEnabled ? (
        <View style={styles.loadingOverlay}><ActivityIndicator size="small" color="#fff" /><Text style={styles.loadingText}>Fetching your location…</Text></View>
      ) : (
        <View style={styles.emptyContainer}><Text style={styles.emptyText}>Enable location to see the map</Text></View>
      )}

      <Modal visible={showPreciseModal} transparent animationType="slide" onRequestClose={() => setShowPreciseModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPreciseModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Precise Users ({filteredUsers.length})</Text>
            <View style={styles.filterRow}>
              {[5, 10, 20, 30].map(m => (
                <TouchableOpacity key={m} onPress={() => setPreciseFilter(m)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: preciseFilter === m ? '#007AFF' : '#333', borderWidth: 1, borderColor: preciseFilter === m ? '#007AFF' : '#444' }}>
                  <Text style={{ color: '#fff', fontSize: 13 }}>{m}m</Text>
                </TouchableOpacity>
              ))}
            </View>
            <FlatList data={filteredUsers} keyExtractor={u => u.objectId} renderItem={({ item }) => (
              <TouchableOpacity style={styles.userItem} onPress={() => { setShowPreciseModal(false); navigation.navigate('UserProfile', { objectId: item.objectId, username: item.username || 'User', profilePicUrl: item.profilePicUrl || null, bio: '', height: '' }); }}>
                {item.profilePicUrl ? <Image source={{ uri: item.profilePicUrl }} style={styles.userPic} /> : <View style={styles.userPicPlaceholder}><Ionicons name="person" size={20} color="#fff" /></View>}
                <Text style={styles.userName}>{item.username || 'User'}</Text>
                <Text style={styles.userDistance}>{Math.round(getDistance(location!.lat, location!.lon, item.location.latitude, item.location.longitude))}m</Text>
              </TouchableOpacity>
            )} ListEmptyComponent={<Text style={styles.emptyListText}>No users within {preciseFilter}m</Text>} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  searchContainer: { position: 'absolute', top: 40, left: 16, right: 16, zIndex: 1000, gap: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 25, paddingHorizontal: 16, height: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  searchIcon: { marginRight: 10 },
  searchPlaceholder: { flex: 1, fontSize: 16, color: '#fff', fontWeight: '400' },
  clearButton: { padding: 4 },
  map: { flex: 1 },
  profileMarker: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#fff' },
  defaultMarker: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#555', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  preciseButton: { position: 'absolute', bottom: 30, right: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,122,255,0.9)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8, gap: 8 },
  preciseText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  loadingOverlay: { position: 'absolute', top: '45%', alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center', zIndex: 999 },
  loadingText: { color: '#fff', marginLeft: 8, fontSize: 13, fontWeight: '500' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { color: '#aaa', fontSize: 16, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1c1c1c', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  userItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
  userPic: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  userPicPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#555', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  userName: { flex: 1, color: '#fff', fontSize: 16 },
  userDistance: { color: '#888', fontSize: 13 },
  emptyListText: { color: '#888', textAlign: 'center', marginTop: 20, fontSize: 14 },
});