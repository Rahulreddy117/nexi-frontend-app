// MapsScreen.tsx (Improved UI + Responsive)
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
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import MapView, { Marker } from 'react-native-maps';
import EncryptedStorage from 'react-native-encrypted-storage';
import { jwtDecode } from 'jwt-decode';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { NavigationProp } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from './types/navigation';
import LocationToggle from './screens/LocationToggleScreen';
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [radiusMeters, setRadiusMeters] = useState<number>(20);
  const [nearbyUsers, setNearbyUsers] = useState<UserMarker[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPreciseModal, setShowPreciseModal] = useState(false);
  //removed
  const mapRef = useRef<MapView>(null);
  

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

    const handleReloadMap = async () => {
    if (!location) return;
    
    // Optional: show a quick feedback (you can remove if not needed)
    // You could add a small loading state if you want, but for now it's instant

    await fetchNearbyUsers(location.lat, location.lon, radiusMeters);
  };

  const fetchUnreadCount = useCallback(async () => {
    if (!currentUserId) return;
    const lastSeenStr = await AsyncStorage.getItem(`lastInboxSeen_${currentUserId}`);
    let where: any = { receiverId: currentUserId };
    if (lastSeenStr) {
      where.createdAt = { $gt: { __type: 'Date', iso: lastSeenStr } };
    }
    const whereStr = encodeURIComponent(JSON.stringify(where));
    try {
      const res = await fetch(`${API_URL}/classes/Message?where=${whereStr}&limit=1000`, {
        method: 'GET',
        headers: {
          'X-Parse-Application-Id': APP_ID,
          'X-Parse-Master-Key': MASTER_KEY,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      const results = data.results || [];
      const uniqueSenders = new Set(results.map((m: any) => m.senderId));
      setUnreadCount(uniqueSenders.size);
    } catch (e) {
      console.warn('Unread count fetch error', e);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    fetchUnreadCount();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        fetchUnreadCount();
      }
    });

    return () => subscription.remove();
  }, [currentUserId, fetchUnreadCount]);

  useEffect(() => {
    const init = async () => {
      const token = await EncryptedStorage.getItem('idToken');
      if (token) {
        const decoded: Auth0IdToken = jwtDecode(token);
        const auth0Id = decoded.sub;
        await AsyncStorage.setItem('auth0Id', auth0Id);
        setCurrentUserId(auth0Id);
        const snap = await queryUser(auth0Id);
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

  const filteredUsers = location ? nearbyUsers.filter(u => getDistance(location.lat, location.lon, u.location.latitude, u.location.longitude) <= radiusMeters) : [];

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
     <View style={styles.searchContainer}>
  <Pressable 
    style={({ pressed }) => [styles.searchBar, pressed && { opacity: 0.7 }]} 
    onPress={() => navigation.navigate('SearchBar', { initialQuery: searchQuery })}
  >
    <Ionicons name="search" size={moderateScale(20)} color="#fff" style={styles.searchIcon} />
    <Text style={styles.searchPlaceholder}>{searchQuery || 'Search Friends...'}</Text>
    {searchQuery.length > 0 && (
      <TouchableOpacity 
        onPress={e => { e.stopPropagation(); setSearchQuery(''); }} 
        style={styles.clearButton}
      >
        <Ionicons name="close-circle" size={moderateScale(20)} color="#ccc" />
      </TouchableOpacity>
    )}
  </Pressable>
  
  <LocationToggle enabled={locationSharingEnabled} onToggle={setLocationSharingEnabled} />
  
  {/* Controls Row with Filter, Reload, and Inbox */}
  <View style={styles.controlsRow}>
    {/* Show radius filter button ONLY when location is enabled */}
    {locationSharingEnabled && (
      <TouchableOpacity 
        onPress={() => setShowPreciseModal(true)}
        style={styles.filterButton}
      >
        <Ionicons name="options-outline" size={moderateScale(18)} color="#fff" />
        <Text style={styles.filterText}>{radiusMeters}m</Text>
      </TouchableOpacity>
    )}

    {/* Reload + Inbox buttons group (right side) */}
    <View style={{ flexDirection: 'row', gap: wp('2%') }}>
      {/* Reload Button - only when location enabled */}
      {locationSharingEnabled && (
        <TouchableOpacity 
          onPress={handleReloadMap}
          style={styles.reloadButton}
        >
          <Ionicons name="reload-outline" size={moderateScale(20)} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Inbox button - always visible */}
      <TouchableOpacity 
        onPress={() => {
          setUnreadCount(0);
          navigation.navigate('Inbox');
        }} 
        style={styles.inboxButton}
      >
        <Ionicons name="mail-outline" size={moderateScale(20)} color="#fff" />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount.toString()}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  </View>
</View>

      {locationSharingEnabled && location ? (
        <>
          <MapView 
            ref={mapRef} 
            style={styles.map}  
            mapType="standard" 
            showsUserLocation 
            showsMyLocationButton={false} 
            customMapStyle={darkMapStyle} 
            initialRegion={{ 
              latitude: location.lat, 
              longitude: location.lon, 
              latitudeDelta: 0.005, 
              longitudeDelta: 0.005 
            }}
          >
            {nearbyUsers.map(user => (
              <Marker 
                key={user.objectId} 
                coordinate={user.location} 
                title={user.username || 'User'} 
                anchor={{ x: 0.5, y: 0.5 }} 
                onPress={() => navigation.navigate('UserProfile', { 
                  objectId: user.objectId, 
                  username: user.username || 'User', 
                  profilePicUrl: user.profilePicUrl || null, 
                  bio: '', 
                  height: '' 
                })}
              >
                {user.profilePicUrl ? (
                  <Image source={{ uri: user.profilePicUrl }} style={styles.profileMarker} />
                ) : (
                  <View style={styles.defaultMarker}>
                    <Ionicons name="person" size={moderateScale(24)} color="#fff" />
                  </View>
                )}
              </Marker>
            ))}
            <Marker 
              coordinate={{ latitude: location.lat, longitude: location.lon }} 
              title="You" 
              anchor={{ x: 0.5, y: 0.5 }} 
              onPress={() => myObjectId && navigation.navigate('UserProfile', { 
                objectId: myObjectId, 
                username: 'Me', 
                profilePicUrl: profilePicUrl || null, 
                bio: '', 
                height: '' 
              })}
            >
              {profilePicUrl ? (
                <Image source={{ uri: profilePicUrl }} style={styles.profileMarker} />
              ) : (
                <View style={styles.defaultMarker}>
                  <Ionicons name="person" size={moderateScale(24)} color="#fff" />
                </View>
              )}
            </Marker>
          </MapView>

          <TouchableOpacity 
            style={styles.preciseButton} 
            onPress={() => setShowPreciseModal(true)}
          >
            <Ionicons name="people-outline" size={moderateScale(18)} color="#fff" />
            <Text style={styles.preciseText}>Precise Users</Text>
          </TouchableOpacity>
        </>
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

      <Modal visible={showPreciseModal} transparent animationType="slide" onRequestClose={() => setShowPreciseModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPreciseModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Precise Users ({filteredUsers.length})</Text>
            <View style={styles.filterRow}>
              {[5, 10, 20, 40].map(m => (
                <TouchableOpacity 
                  key={m} 
                  onPress={() => setRadiusMeters(m)}
                  style={[
                    styles.filterChip,
                    radiusMeters === m && styles.filterChipActive
                  ]}
                >
                  <Text style={styles.filterChipText}>{m}m</Text>
                </TouchableOpacity>
              ))}
            </View>
            <FlatList 
              data={filteredUsers} 
              keyExtractor={u => u.objectId} 
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.userItem} 
                  onPress={() => { 
                    setShowPreciseModal(false); 
                    navigation.navigate('UserProfile', { 
                      objectId: item.objectId, 
                      username: item.username || 'User', 
                      profilePicUrl: item.profilePicUrl || null, 
                      bio: '', 
                      height: '' 
                    }); 
                  }}
                >
                  {item.profilePicUrl ? (
                    <Image source={{ uri: item.profilePicUrl }} style={styles.userPic} />
                  ) : (
                    <View style={styles.userPicPlaceholder}>
                      <Ionicons name="person" size={moderateScale(20)} color="#fff" />
                    </View>
                  )}
                  <Text style={styles.userName}>{item.username || 'User'}</Text>
                  <Text style={styles.userDistance}>
                    {Math.round(getDistance(location!.lat, location!.lon, item.location.latitude, item.location.longitude))}m
                  </Text>
                </TouchableOpacity>
              )} 
              ListEmptyComponent={
                <Text style={styles.emptyListText}>No users within {radiusMeters}m  </Text>
              } 
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  searchContainer: { 
    position: 'absolute', 
    top: StatusBar.currentHeight ? StatusBar.currentHeight + hp('2%') : hp('6%'),
    left: wp('4%'), 
    right: wp('4%'), 
    zIndex: 1000, 
    gap: hp('1.5%')
  },
    reloadButton: {
    padding: scale(8),
    borderRadius: moderateScale(16),
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    borderRadius: moderateScale(25), 
    paddingHorizontal: wp('4%'), 
    height: hp('6%'), 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.2)', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 8, 
    elevation: 8 
  },
  searchIcon: { 
    marginRight: wp('2.5%') 
  },
  searchPlaceholder: { 
    flex: 1, 
    fontSize: moderateScale(16), 
    color: '#fff', 
    fontWeight: '400' 
  },
  clearButton: { 
    padding: scale(4) 
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: wp('2%'),
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.2%'),
    borderRadius: moderateScale(20),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    gap: wp('2%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  filterText: {
    color: '#fff',
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  map: { 
    flex: 1 
  },
  profileMarker: { 
    width: moderateScale(44), 
    height: moderateScale(44), 
    borderRadius: moderateScale(22), 
    borderWidth: 2, 
    borderColor: '#fff' 
  },
  defaultMarker: { 
    width: moderateScale(44), 
    height: moderateScale(44), 
    borderRadius: moderateScale(22), 
    backgroundColor: '#555', 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 2, 
    borderColor: '#fff' 
  },
  preciseButton: { 
    position: 'absolute', 
    bottom: hp('4%'), 
    right: wp('4%'), 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,122,255,0.9)', 
    paddingHorizontal: wp('4%'), 
    paddingVertical: hp('1.5%'), 
    borderRadius: moderateScale(25), 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 8, 
    elevation: 8, 
    gap: wp('2%') 
  },
  preciseText: { 
    color: '#fff', 
    fontSize: moderateScale(14), 
    fontWeight: '600' 
  },
  inboxButton: { 
    padding: scale(8), 
    borderRadius: moderateScale(16), 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.2)',
    position: 'relative',
    marginLeft: 'auto',  // ← This is the magic line
  },
  badge: { 
    position: 'absolute', 
    top: -scale(4), 
    right: -scale(4), 
    backgroundColor: '#FF3B30', 
    borderRadius: moderateScale(9), 
    minWidth: moderateScale(18), 
    height: moderateScale(18), 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingHorizontal: scale(4)
  },
  badgeText: { 
    color: '#fff', 
    fontSize: moderateScale(10), 
    fontWeight: 'bold' 
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
    zIndex: 999 
  },
  loadingText: { 
    color: '#fff', 
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
    color: '#aaa', 
    fontSize: moderateScale(16), 
    textAlign: 'center' 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    justifyContent: 'flex-end' 
  },
  modalContent: { 
    backgroundColor: '#1c1c1c', 
    borderTopLeftRadius: moderateScale(20), 
    borderTopRightRadius: moderateScale(20), 
    padding: wp('5%'), 
    maxHeight: '70%' 
  },
  modalTitle: { 
    color: '#fff', 
    fontSize: moderateScale(18), 
    fontWeight: 'bold', 
    marginBottom: hp('1.5%') 
  },
  filterRow: { 
    flexDirection: 'row', 
    gap: wp('2%'), 
    marginBottom: hp('2%') 
  },
  filterChip: {
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.8%'),
    borderRadius: moderateScale(12),
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#444',
  },
  filterChipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterChipText: {
    color: '#fff',
    fontSize: moderateScale(13),
    fontWeight: '500',
  },
  userItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: hp('1.5%'), 
    borderBottomWidth: 1, 
    borderBottomColor: '#333' 
  },
  userPic: { 
    width: moderateScale(40), 
    height: moderateScale(40), 
    borderRadius: moderateScale(20), 
    marginRight: wp('3%') 
  },
  userPicPlaceholder: { 
    width: moderateScale(40), 
    height: moderateScale(40), 
    borderRadius: moderateScale(20), 
    backgroundColor: '#555', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: wp('3%') 
  },
  userName: { 
    flex: 1, 
    color: '#fff', 
    fontSize: moderateScale(16),
    fontWeight: '500'
  },
  userDistance: { 
    color: '#888', 
    fontSize: moderateScale(13) 
  },
  emptyListText: { 
    color: '#888', 
    textAlign: 'center', 
    marginTop: hp('2.5%'), 
    fontSize: moderateScale(14) 
  },
});   