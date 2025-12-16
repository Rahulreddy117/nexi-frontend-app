// screens/RoomLocationScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  FlatList,
  Platform,
  PermissionsAndroid,
  Modal,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeContext';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

const GOOGLE_API_KEY = "AIzaSyD4Qj2VtIMt_4wrnXKoFtQcGX91cOduYoc"; // Replace with your key
const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

export default function RoomLocationScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const { roomName, roomPhotoUrl } = route.params;

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(true);

  // Guidelines modal state
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [agreedToGuidelines, setAgreedToGuidelines] = useState(false);

  // Custom autocomplete
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const mapRef = useRef<MapView>(null);

  const [initialRegion, setInitialRegion] = useState<Region>({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  // Request location permission (Android)
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs access to your location to show your current position.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  // Get user's current location
  const getUserLocation = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      setLoadingLocation(false);
      return;
    }

    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const userRegion: Region = {
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setInitialRegion(userRegion);
        setLocation({ lat: latitude, lng: longitude });
        
        // Animate to user location
        setTimeout(() => {
          mapRef.current?.animateToRegion(userRegion, 1000);
        }, 100);
        
        setLoadingLocation(false);
      },
      (error) => {
        console.log('Location error:', error);
        setLoadingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  useEffect(() => {
    // Only get user location if guidelines are accepted
    if (!showGuidelines) {
      getUserLocation();
    }
  }, [showGuidelines]);

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

  // Debounce search input
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

  const handleContinue = () => {
    if (!agreedToGuidelines) {
      Alert.alert('Agreement Required', 'Please check the box to agree to the guidelines before continuing.');
      return;
    }
    setShowGuidelines(false);
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Guidelines Modal */}
      <Modal
        visible={showGuidelines}
        animationType="fade"
        transparent={true}
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
               <Ionicons
        name="information-circle"
        size={moderateScale(40)}
        color="#F44330"   // 🔴 Red color
      />
              <Text style={[styles.modalTitle, { color: colors.text }]}>Room Location Guidelines</Text>
            </View>

            <ScrollView style={styles.guidelinesScroll} showsVerticalScrollIndicator={true}>
              <View style={styles.guidelinesContent}>
                <View style={styles.guidelineItem}>
                  <Ionicons name="alert-circle-outline" size={moderateScale(20)} color="#F44330" style={styles.bulletIcon} />
                  <Text style={[styles.guidelineText, { color: colors.text }]}>
                    The room will appear exactly at the location you select on the map. Other users can view this room location. This does not show your live location, but it does show the fixed spot you chose. For your safety, do not place a room on your home or any private residential property.
                  </Text>
                </View>

                <View style={styles.guidelineItem}>
                  <Ionicons name="checkmark-circle-outline" size={moderateScale(20)} color="#4CAF50" style={styles.bulletIcon} />
                  <Text style={[styles.guidelineText, { color: colors.text }]}>
                    Create rooms only in public or non-private areas such as parks, malls, markets, public roads, community spaces, or general neighborhood zones.
                  </Text>
                </View>

                <View style={styles.guidelineItem}>
                  <Ionicons name="close-circle-outline" size={moderateScale(20)} color="#F44336" style={styles.bulletIcon} />
                  <Text style={[styles.guidelineText, { color: colors.text }]}>
                    Do NOT place rooms on private properties, including houses, apartments, hostels, PG buildings, gated societies, or any restricted/residential building you do not own or manage.
                  </Text>
                </View>

                <View style={styles.guidelineItem}>
                  <Ionicons name="location-outline" size={moderateScale(20)} color="#fff" style={styles.bulletIcon} />
                  <Text style={[styles.guidelineText, { color: colors.text }]}>
                    Avoid placing rooms on exact building coordinates. If needed, choose a nearby public road or open area instead.
                  </Text>
                </View>

                <View style={styles.guidelineItem}>
                  <Ionicons name="shield-outline" size={moderateScale(20)} color="#fff" style={styles.bulletIcon} />
                  <Text style={[styles.guidelineText, { color: colors.text }]}>
                    Rooms must NOT be used to target, expose, or reference specific homes or individuals. Such rooms will be removed.
                  </Text>
                </View>

                <View style={styles.guidelineItem}>
                  <Ionicons name="warning-outline" size={moderateScale(20)} color="#FF9800" style={styles.bulletIcon} />
                  <Text style={[styles.guidelineText, { color: colors.text }]}>
                    Rooms placed incorrectly or violating privacy may be hidden or permanently removed. Repeated misuse may lead to account restrictions.
                  </Text>
                </View>

                <View style={styles.guidelineItem}>
                  <Ionicons name="information-outline" size={moderateScale(20)} color="#F44330" style={styles.bulletIcon} />
                  <Text style={[styles.guidelineText, { color: colors.text }]}>
                    Nexi is not responsible for incorrectly placed rooms, but we will remove any room on private property if reported or detected.
                  </Text>
                </View>

                <Text style={[styles.agreementText, { color: colors.text }]}>
                  By continuing, you agree to these guidelines.
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={styles.checkboxContainer}
              onPress={() => setAgreedToGuidelines(!agreedToGuidelines)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.checkbox, 
                { 
                  borderColor: colors.border,
                  backgroundColor: agreedToGuidelines ? colors.accent : 'transparent'
                }
              ]}>
                {agreedToGuidelines && (
                  <Ionicons name="checkmark" size={moderateScale(18)} color="#FFFFFF" />
                )}
              </View>
              <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                I Understand & Agree
              </Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={handleCancel}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.continueButton, 
                  { 
                    backgroundColor: colors.accent,
                    opacity: agreedToGuidelines ? 1 : 0.5
                  }
                ]}
                onPress={handleContinue}
                disabled={!agreedToGuidelines}
                activeOpacity={0.8}
              >
                <Text style={styles.continueButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Main Content - Only show when guidelines are accepted */}
      {!showGuidelines && (
        <>
          {/* Header with Search */}
          <View style={[styles.header, { backgroundColor: colors.background }]}>
            <View style={styles.headerTitleSection}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Room Location</Text>
              <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]} numberOfLines={1}>
                {roomName}
              </Text>
            </View>
            
            {/* Search Input */}
            <View style={styles.searchContainer}>
              <View style={[styles.searchInputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="search" size={moderateScale(20)} color={colors.secondaryText} style={styles.searchIcon} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search for a location..."
                  placeholderTextColor={colors.secondaryText}
                  style={[styles.textInput, { color: colors.text }]}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearch(''); setSuggestions([]); }} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={moderateScale(20)} color={colors.secondaryText} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Suggestions Dropdown - Positioned absolutely */}
          {suggestions.length > 0 && (
            <View
              style={[
                styles.suggestionBox,
                { 
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  shadowColor: colors.text,
                }
              ]}
            >
              <FlatList
                keyboardShouldPersistTaps="handled"
                data={suggestions}
                keyExtractor={(item) => item.place_id}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    onPress={() => onSelectSuggestion(item)}
                    style={[
                      styles.suggestionItem,
                      index !== suggestions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="location-outline" size={moderateScale(18)} color={colors.secondaryText} style={styles.suggestionIcon} />
                    <Text style={[styles.suggestionText, { color: colors.text }]} numberOfLines={2}>
                      {item.description}
                    </Text>
                  </TouchableOpacity>
                )}
                style={styles.suggestionList}
              />
            </View>
          )}

          {/* Map */}
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={initialRegion}
            onPress={onMapPress}
            showsUserLocation
            showsMyLocationButton
            showsCompass
            loadingEnabled
          >
            {location && (
              <Marker 
                coordinate={{ latitude: location.lat, longitude: location.lng }}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={[styles.markerContainer, { backgroundColor: colors.primary }]}>
                  <Ionicons name="location" size={moderateScale(32)} color="#FFFFFF" />
                </View>
              </Marker>
            )}
          </MapView>

          {/* Loading overlay */}
          {loadingLocation && (
            <View style={styles.loadingOverlay}>
              <View style={[styles.loadingCard, { backgroundColor: colors.card }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.text }]}>Getting your location...</Text>
              </View>
            </View>
          )}

          {/* Instruction overlay (only when no location is selected) */}
          {!location && !loadingLocation && (
            <View style={styles.instructionOverlay}>
              <View style={[styles.instructionCard, { backgroundColor: colors.card }]}>
                <Ionicons name="hand-left-outline" size={moderateScale(32)} color={colors.primary} />
                <Text style={[styles.instructionText, { color: colors.text }]}>
                  Tap on the map or search to set room location
                </Text>
              </View>
            </View>
          )}

          {/* Bottom Action Bar */}
          <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <View style={styles.locationInfo}>
              <Ionicons 
                name={location ? "checkmark-circle" : "location-outline"} 
                size={moderateScale(22)} 
                color={location ? colors.accent : colors.secondaryText} 
              />
              <View style={styles.locationTextContainer}>
                <Text style={[styles.locationLabel, { color: colors.secondaryText }]}>
                  {location ? 'Location Selected' : 'No location selected'}
                </Text>
                {location && (
                  <Text style={[styles.locationCoords, { color: colors.text }]}>
                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.createBtn,
                { 
                  backgroundColor: colors.accent,
                  opacity: (saving || !location) ? 0.5 : 1 
                }
              ]}
              onPress={saveRoom}
              disabled={saving || !location}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.createBtnText}>Create Room</Text>
                  <Ionicons name="arrow-forward" size={moderateScale(20)} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  header: {
    paddingHorizontal: wp('4%'),
    paddingTop: hp('1%'),
    paddingBottom: hp('1.5%'),
    zIndex: 100,
  },
  headerTitleSection: {
    alignItems: 'center',
    marginBottom: hp('1.5%'),
  },
  headerTitle: {
    fontSize: moderateScale(24),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    marginTop: verticalScale(4),
  },
  searchContainer: {
    // No position absolute anymore
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(14),
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  searchIcon: {
    marginRight: scale(8),
  },
  textInput: {
    flex: 1,
    fontSize: moderateScale(15),
    fontWeight: '500',
    padding: 0,
  },
  clearButton: {
    padding: scale(4),
  },
  suggestionBox: {
    position: 'absolute',
    top: hp('20%'),
    left: wp('4%'),
    right: wp('4%'),
    borderRadius: moderateScale(14),
    maxHeight: hp('35%'),
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
    zIndex: 1000,
  },
  suggestionList: {
    flexGrow: 0,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(14),
  },
  suggestionIcon: {
    marginRight: scale(10),
  },
  suggestionText: {
    flex: 1,
    fontSize: moderateScale(14),
    fontWeight: '500',
    lineHeight: moderateScale(20),
  },
  map: { 
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingCard: {
    paddingVertical: verticalScale(24),
    paddingHorizontal: scale(32),
    borderRadius: moderateScale(20),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  loadingText: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    marginTop: verticalScale(12),
  },
  instructionOverlay: {
    position: 'absolute',
    top: hp('35%'),
    left: wp('8%'),
    right: wp('8%'),
    alignItems: 'center',
  },
  instructionCard: {
    paddingVertical: verticalScale(22),
    paddingHorizontal: scale(28),
    borderRadius: moderateScale(18),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  instructionText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    textAlign: 'center',
    marginTop: verticalScale(12),
    lineHeight: moderateScale(20),
  },
  markerContainer: {
    width: moderateScale(60),
    height: moderateScale(60),
    borderRadius: moderateScale(30),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  bottomBar: {
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2.2%'),
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: hp('1.8%'),
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(14),
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  locationCoords: {
    fontSize: moderateScale(12),
    fontWeight: '500',
    marginTop: verticalScale(2),
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(24),
    borderRadius: moderateScale(16),
    gap: scale(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  createBtnText: { 
    color: '#FFFFFF',
    fontSize: moderateScale(16),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('5%'),
  },
  modalContainer: {
    width: '100%',
    maxHeight: hp('80%'),
    borderRadius: moderateScale(20),
    padding: scale(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  modalTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    marginTop: verticalScale(12),
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  guidelinesScroll: {
    maxHeight: hp('45%'),
  },
  guidelinesContent: {
    paddingVertical: verticalScale(8),
  },
  guidelineItem: {
    flexDirection: 'row',
    marginBottom: verticalScale(16),
    paddingRight: scale(8),
  },
  bulletIcon: {
    marginTop: verticalScale(2),
    marginRight: scale(12),
  },
  guidelineText: {
    flex: 1,
    fontSize: moderateScale(13),
    lineHeight: moderateScale(20),
    fontWeight: '500',
  },
  agreementText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    textAlign: 'center',
    marginTop: verticalScale(20),
    marginBottom: verticalScale(8),
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: hp('2%'),
    marginBottom: hp('2%'),
    paddingVertical: verticalScale(12),
  },
  checkbox: {
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: moderateScale(6),
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  checkboxLabel: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: scale(12),
  },
  modalButton: {
    flex: 1,
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1.5,
  },
  cancelButtonText: {
    fontSize: moderateScale(15),
    fontWeight: '600',
  },
  continueButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: moderateScale(15),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});