// screens/PostFeedScreen.tsx (Custom clustering without external library)
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Image,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import MapView, { Marker, Region } from 'react-native-maps';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';
import LocationToggle from './LocationToggleScreen';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';



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



const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

interface RoomMarker {
  objectId: string;
  name?: string;
  photoUrl?: string;
  location: { latitude: number; longitude: number };
}

interface ClusterMarker {
  id: string;
  coordinate: { latitude: number; longitude: number };
  rooms: RoomMarker[];
  count: number;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PostFeedScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [nearbyRooms, setNearbyRooms] = useState<RoomMarker[]>([]);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [clusterModalVisible, setClusterModalVisible] = useState(false);
  const [selectedClusterRooms, setSelectedClusterRooms] = useState<RoomMarker[]>([]);
  const mapRef = useRef<MapView>(null);
  const fetchTimeoutRef = useRef<any>(null);

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

  useEffect(() => {
    if (!locationSharingEnabled) {
      setLocation(null);
      setNearbyRooms([]);
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
      return;
    }

    Geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lon: longitude });
        if (mapRef.current) {
          mapRef.current.animateCamera({ center: { latitude, longitude }, zoom: 15 });
        }
      },
      err => console.log('Geolocation init error', err),
      { enableHighAccuracy: false, timeout: 5000 }
    );

    let first = true;
    const watchId = Geolocation.watchPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lon: longitude });
        if (first && mapRef.current) {
          mapRef.current.animateCamera({ center: { latitude, longitude }, zoom: 15 });
          first = false;
        }
      },
      err => console.log('Geolocation watch error', err),
      { enableHighAccuracy: true, distanceFilter: 1, interval: 2000, fastestInterval: 1000 }
    );

    return () => Geolocation.clearWatch(watchId);
  }, [locationSharingEnabled]);

  const metersToRadians = (m: number) => m / 6371000;

  const fetchRoomsInViewport = useCallback(async (centerLat: number, centerLon: number, radiusMeters: number = 10000) => {
    try {
      const where = {
        location: {
          $nearSphere: { __type: 'GeoPoint', latitude: centerLat, longitude: centerLon },
          $maxDistance: metersToRadians(radiusMeters),
        },
      };

      const res = await fetch(
        `${API_URL}/classes/Room?where=${encodeURIComponent(JSON.stringify(where))}&limit=40&keys=name,photoUrl,location`,
        {
          method: 'GET',
          headers: {
            'X-Parse-Application-Id': APP_ID,
            'X-Parse-Master-Key': MASTER_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!res.ok) return;

      const data = await res.json();
      const rooms = (data.results || [])
        .filter((r: any) => r.location && typeof r.location.latitude === 'number' && typeof r.location.longitude === 'number')
        .map((r: any) => ({
          objectId: r.objectId,
          name: r.name,
          photoUrl: r.photoUrl,
          location: { latitude: r.location.latitude, longitude: r.location.longitude },
        }));

      setNearbyRooms(rooms);
    } catch (err) {
      console.error('Fetch rooms error:', err);
    }
  }, []);

  const handleRegionChangeComplete = useCallback((region: Region) => {
    setMapRegion(region);
    const { latitude, longitude, latitudeDelta } = region;
    const radius = latitudeDelta * 111000 / 2;

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchTimeoutRef.current = setTimeout(() => {
      fetchRoomsInViewport(latitude, longitude, radius * 1000);
    }, 2000);
  }, [fetchRoomsInViewport]);

  useEffect(() => {
    if (location && locationSharingEnabled) {
      const initialRegion = {
        latitude: location.lat,
        longitude: location.lon,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setMapRegion(initialRegion);
      handleRegionChangeComplete(initialRegion);
    }
  }, [location, locationSharingEnabled]);

  // Custom clustering logic
  const clusteredMarkers = useMemo(() => {
    if (!mapRegion || nearbyRooms.length === 0) return { clusters: [], singles: [] };

    // Calculate clustering distance based on zoom level (latitudeDelta)
    // More zoomed out = larger delta = larger cluster distance
    const clusterDistance = mapRegion.latitudeDelta * 0.15; // Adjust multiplier for sensitivity

    const clusters: ClusterMarker[] = [];
    const singles: RoomMarker[] = [];
    const processed = new Set<string>();

    nearbyRooms.forEach((room, i) => {
      if (processed.has(room.objectId)) return;

      const nearby: RoomMarker[] = [room];
      processed.add(room.objectId);

      // Find nearby rooms within cluster distance
      nearbyRooms.forEach((otherRoom, j) => {
        if (i === j || processed.has(otherRoom.objectId)) return;

        const latDiff = Math.abs(room.location.latitude - otherRoom.location.latitude);
        const lonDiff = Math.abs(room.location.longitude - otherRoom.location.longitude);

        if (latDiff < clusterDistance && lonDiff < clusterDistance) {
          nearby.push(otherRoom);
          processed.add(otherRoom.objectId);
        }
      });

      // If 2+ rooms are close, create a cluster; otherwise it's a single marker
      if (nearby.length >= 2) {
        const avgLat = nearby.reduce((sum, r) => sum + r.location.latitude, 0) / nearby.length;
        const avgLon = nearby.reduce((sum, r) => sum + r.location.longitude, 0) / nearby.length;

        clusters.push({
          id: `cluster-${avgLat}-${avgLon}`,
          coordinate: { latitude: avgLat, longitude: avgLon },
          rooms: nearby,
          count: nearby.length,
        });
      } else {
        singles.push(room);
      }
    });

    return { clusters, singles };
  }, [nearbyRooms, mapRegion]);

  const handleCreateRoom = async () => {
    const auth0Id = await AsyncStorage.getItem('auth0Id');
    if (!auth0Id) {
      console.error('No auth0Id found');
      return;
    }
    navigation.navigate('RoomCreation' as any, { auth0Id });
  };

  const handleRoomPress = (room: RoomMarker) => {
    navigation.navigate('RoomUserProfile', { roomId: room.objectId, roomName: room.name || 'Unknown Room' });
  };

  const handleClusterPress = (cluster: ClusterMarker) => {
    setSelectedClusterRooms(cluster.rooms);
    setClusterModalVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar hidden />
      <View style={styles.toggleContainer}>
        <LocationToggle enabled={locationSharingEnabled} onToggle={setLocationSharingEnabled} />
      </View>

      {locationSharingEnabled && location ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          mapType="standard"
          customMapStyle={darkMapStyle}        // Forces beautiful dark theme
          showsUserLocation={false}
          showsMyLocationButton={false}
          initialRegion={{ 
            latitude: location.lat, 
            longitude: location.lon, 
            latitudeDelta: 0.01, 
            longitudeDelta: 0.01 
          }}
          onRegionChangeComplete={handleRegionChangeComplete}
        >
          {/* Render clusters */}
          {clusteredMarkers.clusters.map(cluster => (
            <Marker
              key={cluster.id}
              coordinate={cluster.coordinate}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => handleClusterPress(cluster)}
            >
              <View style={styles.clusterContainer}>
                {/* Photo collage - show up to 3 photos */}
                <View style={styles.photoCollage}>
                  {cluster.rooms.slice(0, 3).map((room, idx) => (
                    room.photoUrl ? (
                      <Image
                        key={room.objectId}
                        source={{ uri: room.photoUrl }}
                        style={[
                          styles.collagePhoto,
                          idx === 0 && styles.collagePhoto1,
                          idx === 1 && styles.collagePhoto2,
                          idx === 2 && styles.collagePhoto3,
                        ]}
                      />
                    ) : null
                  ))}
                </View>
                
                {/* Count badge */}
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{cluster.count}</Text>
                </View>
              </View>
            </Marker>
          ))}

          {/* Render single markers */}
          {clusteredMarkers.singles.map(room => (
            <Marker
              key={room.objectId}
              coordinate={room.location}
              title={room.name?.substring(0, 30) || 'Room'}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => handleRoomPress(room)}
            >
              <View style={styles.roomMarker}>
                {room.photoUrl ? (
                  <Image source={{ uri: room.photoUrl }} style={styles.roomMarkerImage} />
                ) : (
                  <Ionicons name="image-outline" size={24} color="#fff" />
                )}
              </View>
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
          <Text style={[styles.emptyText, { color: colors.text }]}>Enable location to see rooms on map</Text>
        </View>
      )}

      {/* Cluster Modal - Bottom Sheet */}
      <Modal
        visible={clusterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setClusterModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setClusterModalVisible(false)}
        >
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {selectedClusterRooms.length} Rooms Nearby
            </Text>
            
            <ScrollView style={styles.roomsList} showsVerticalScrollIndicator={false}>
              {selectedClusterRooms.map(room => (
                <TouchableOpacity
                  key={room.objectId}
                  style={[styles.roomItem, { borderBottomColor: colors.border || '#e0e0e0' }]}
                  onPress={() => {
                    setClusterModalVisible(false);
                    handleRoomPress(room);
                  }}
                >
                  {room.photoUrl ? (
                    <Image source={{ uri: room.photoUrl }} style={styles.roomItemImage} />
                  ) : (
                    <View style={styles.roomItemImagePlaceholder}>
                      <Ionicons name="image-outline" size={24} color="#999" />
                    </View>
                  )}
                  <View style={styles.roomItemInfo}>
                    <Text style={[styles.roomItemName, { color: colors.text }]} numberOfLines={1}>
                      {room.name || 'Unnamed Room'}
                    </Text>
                    <Text style={styles.roomItemDistance}>Tap to view</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* + Button */}
      <TouchableOpacity style={styles.createRoomButton} onPress={handleCreateRoom}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toggleContainer: { position: 'absolute', top: 40, left: 16, right: 16, zIndex: 1000 },
  map: { flex: 1 },
  
  // Single room marker
  roomMarker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,122,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  roomMarkerImage: { width: 44, height: 44, borderRadius: 22 },

  // Cluster marker (Snapchat-style)
  clusterContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,122,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  photoCollage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  collagePhoto: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#fff',
  },
  collagePhoto1: {
    top: 8,
    left: 8,
  },
  collagePhoto2: {
    top: 8,
    right: 8,
  },
  collagePhoto3: {
    bottom: 8,
    left: '50%',
    marginLeft: -15,
  },
  countBadge: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Modal (Bottom Sheet)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  roomsList: {
    maxHeight: 400,
  },
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  roomItemImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  roomItemImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roomItemInfo: {
    flex: 1,
  },
  roomItemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  roomItemDistance: {
    fontSize: 13,
    color: '#999',
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
  loadingText: { marginLeft: 8, fontSize: 13, fontWeight: '500' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { fontSize: 16, textAlign: 'center' },
  createRoomButton: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1000,
  },
});