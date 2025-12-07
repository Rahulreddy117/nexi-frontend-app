// screens/RoomLocationScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  TextInput,
  FlatList,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../ThemeContext';

const GOOGLE_API_KEY = "AIzaSyD4Qj2VtIMt_4wrnXKoFtQcGX91cOduYoc"; // you will replace later
const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

const { width, height } = Dimensions.get('window');

export default function RoomLocationScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const { roomName, roomPhotoUrl } = route.params;

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);

  // --- our custom autocomplete ---
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const mapRef = useRef<MapView>(null);

  const initialRegion: Region = {
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const onMapPress = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLocation({ lat: latitude, lng: longitude });
  };

  // Fetch autocomplete suggestions from Google
  const fetchSuggestions = async (input: string) => {
    if (input.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      setLoadingSuggestions(true);

      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        input
      )}&key=${GOOGLE_API_KEY}`;

      const res = await fetch(url);
      const data = await res.json();
      setSuggestions(data.predictions || []);
    } catch (e) {
      console.log("Autocomplete error:", e);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuggestions(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // After selecting an item, get lat/lng
  const onSelectSuggestion = async (item: any) => {
    setSearch(item.description);
    setSuggestions([]);

    try {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.place_id}&key=${GOOGLE_API_KEY}`;
      const res = await fetch(detailsUrl);
      const data = await res.json();

      const loc = data?.result?.geometry?.location;
      if (!loc) return;

      const { lat, lng } = loc;
      setLocation({ lat, lng });

      mapRef.current?.animateToRegion(
        {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    } catch (e) {
      console.log("place details error", e);
    }
  };

    const saveRoom = async () => {
    if (!location) return Alert.alert('Error', 'Please select a location');

    setSaving(true);
    try {
      const parseObjectId = await AsyncStorage.getItem('parseObjectId');
      if (!parseObjectId) throw new Error('User not logged in');

      // 1. First create the Room
      const roomData = {
        name: roomName,
        photoUrl: roomPhotoUrl || null,
        creator: { __type: 'Pointer', className: 'UserProfile', objectId: parseObjectId },
        location: {
          __type: 'GeoPoint',
          latitude: location.lat,
          longitude: location.lng,
        },
      };

      const roomRes = await fetch(`${API_URL}/classes/Room`, {
        method: 'POST',
        headers: {
          'X-Parse-Application-Id': APP_ID,
          'X-Parse-Master-Key': MASTER_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(roomData),
      });

      if (!roomRes.ok) throw new Error('Failed to create room');
      const roomJson = await roomRes.json();
      const roomId = roomJson.objectId;

      // 2. Now auto-join the creator as a member
      const memberData = {
        user: { __type: 'Pointer', className: 'UserProfile', objectId: parseObjectId },
        room: { __type: 'Pointer', className: 'Room', objectId: roomId },
      };

      await fetch(`${API_URL}/classes/RoomMember`, {
        method: 'POST',
        headers: {
          'X-Parse-Application-Id': APP_ID,
          'X-Parse-Master-Key': MASTER_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(memberData),
      });

      Alert.alert('Success!', 'Room created successfully', [
        { text: 'OK', onPress: () => navigation.popToTop() }
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save room');
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={styles.container}>

      {/* SEARCH INPUT (replacement for GooglePlacesAutocomplete) */}
      <View style={styles.searchContainer}>
  <TextInput
    value={search}
    onChangeText={setSearch}
    placeholder="Search for location..."
    placeholderTextColor="#999"
    style={[
      styles.textInput,
      { backgroundColor: colors.card, color: colors.text }
    ]}
  />

  {/* ABSOLUTE SUGGESTIONS BOX */}
  {suggestions.length > 0 && (
    <View
      style={[
        styles.suggestionBox,
        {
          backgroundColor: colors.background,
          top: 58, // directly below input
          position: "absolute",
          zIndex: 9999,
          elevation: 20,
        },
      ]}
    >
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={suggestions}
        keyExtractor={(item) => item.place_id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => onSelectSuggestion(item)}
            style={styles.suggestionItem}
          >
            <Text style={{ color: colors.text }}>{item.description}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )}
</View>


      {/* MAP */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        onPress={onMapPress}
        showsUserLocation
        showsMyLocationButton
      >
        {location && (
          <Marker coordinate={{ latitude: location.lat, longitude: location.lng }}>
            <View style={styles.marker}>
              <Ionicons name="location" size={40} color="#007AFF" />
            </View>
          </Marker>
        )}
      </MapView>

      {/* OVERLAY */}
      {!location && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Tap on map to set room location</Text>
        </View>
      )}

      {/* BOTTOM BAR */}
      <View style={styles.bottomBar}>
        <Text style={{ color: colors.text, fontSize: 16, marginBottom: 10 }}>
          {location
            ? `Selected: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
            : 'No location selected'}
        </Text>

        <TouchableOpacity
          style={[
            styles.createBtn,
            { backgroundColor: colors.accent, opacity: saving || !location ? 0.6 : 1 }
          ]}
          onPress={saveRoom}
          disabled={saving || !location}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createBtnText}>Create Room</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  searchContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 1000,
  },

  textInput: {
    fontSize: 16,
    padding: 14,
    borderRadius: 12,
  },

  suggestionBox: {
    marginTop: 8,
    borderRadius: 12,
    maxHeight: 200,
    paddingVertical: 4,
  },

  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#333',
  },

  map: { flex: 1 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  overlayText: { color: '#fff', fontSize: 18, fontWeight: '600' },

  marker: {
    backgroundColor: 'white',
    padding: 5,
    borderRadius: 25,
    elevation: 5,
  },

  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },

  createBtn: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
  },

  createBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  
});
