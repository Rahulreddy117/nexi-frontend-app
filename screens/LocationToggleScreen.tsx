// components/LocationToggle.tsx
import React, { useEffect, useCallback, useRef,useState } from 'react';
import {
  View,
  Text,
  Switch,
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Linking,
  AppState,
  AppStateStatus,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import Geolocation from '@react-native-community/geolocation';


const { LocationModule } = NativeModules;

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

interface LocationToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export default function LocationToggle({ enabled, onToggle }: LocationToggleProps) {
  const [isLoadingToggle, setIsLoadingToggle] = useState(false);
  const [hasAllPermissions, setHasAllPermissions] = useState(false);
  const [isSystemLocationEnabled, setIsSystemLocationEnabled] = useState<boolean | null>(null);

  const appState = useRef(AppState.currentState);
  const gpsWatcherRef = useRef<any>(null);

  // ──────────────────────────────────────────────────────────────
  // 1. Helper: safe API level
  // ──────────────────────────────────────────────────────────────
  const getApiLevel = (): number => {
    const version = Platform.Version;
    return typeof version === 'string' ? parseInt(version, 10) || 0 : version || 0;
  };

  // ──────────────────────────────────────────────────────────────
  // 2. Check ONLY permissions (never calls getCurrentPosition)
  // ──────────────────────────────────────────────────────────────
  const checkPermissions = useCallback(async () => {
    try {
      const fine = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      const coarse = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);

      if (!fine && !coarse) {
        setHasAllPermissions(false);
        return;
      }

      const apiLevel = getApiLevel();
      if (apiLevel >= 29) {
        const bg = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
        setHasAllPermissions(bg);
      } else {
        setHasAllPermissions(true);
      }
    } catch {
      setHasAllPermissions(false);
    }
  }, []);

  // ──────────────────────────────────────────────────────────────
  // 3. Check if SYSTEM location (GPS) is ON
  // ──────────────────────────────────────────────────────────────
  const checkSystemLocation = useCallback(() => {
    if (Platform.OS !== 'android') {
      setIsSystemLocationEnabled(true);
      return;
    }

    Geolocation.getCurrentPosition(
      () => setIsSystemLocationEnabled(true),
      (error) => {
        // error.code === 2 → Location provider disabled
        setIsSystemLocationEnabled(error.code !== 2);
      },
      { enableHighAccuracy: false, timeout: 5000 }
    );
  }, []);

  // ──────────────────────────────────────────────────────────────
  // 4. Open Android Location settings
  // ──────────────────────────────────────────────────────────────
  const openLocationSettings = () => {
    if (Platform.OS === 'android') {
      Linking.sendIntent?.('android.settings.LOCATION_SOURCE_SETTINGS')
        .catch(() => Linking.openSettings());
    } else {
      Linking.openSettings();
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 5. Init on mount
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      await checkPermissions();
      checkSystemLocation();
    };
    init();
  }, [checkPermissions, checkSystemLocation]);

  // ──────────────────────────────────────────────────────────────
  // 6. Re-check when app becomes active
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        checkPermissions();
        checkSystemLocation();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [checkPermissions, checkSystemLocation]);

  // ──────────────────────────────────────────────────────────────
  // 7. REAL-TIME GPS watcher (every 3 sec) → auto-turn-off toggle
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gpsWatcherRef.current) clearInterval(gpsWatcherRef.current);

    gpsWatcherRef.current = setInterval(() => {
      Geolocation.getCurrentPosition(
        () => {
          if (!isSystemLocationEnabled) setIsSystemLocationEnabled(true);
        },
        (error) => {
          const nowOff = error.code === 2;
          if (nowOff && isSystemLocationEnabled !== false) {
            setIsSystemLocationEnabled(false);

            // If sharing was ON → force stop everything
            if (enabled) {
              stopLocationService();
              onToggle(false);
              AsyncStorage.setItem('locationSharingEnabled', 'false');
            }
          } else if (!nowOff && isSystemLocationEnabled === false) {
            setIsSystemLocationEnabled(true);
          }
        },
        { enableHighAccuracy: false, timeout: 3000 }
      );
    }, 3000);

    return () => {
      if (gpsWatcherRef.current) clearInterval(gpsWatcherRef.current);
    };
  }, [isSystemLocationEnabled, enabled, onToggle]);

  // ──────────────────────────────────────────────────────────────
  // 8. Stop service
  // ──────────────────────────────────────────────────────────────
  const stopLocationService = async () => {
    try {
      const objectId = await AsyncStorage.getItem('parseObjectId');
      if (objectId) {
        await fetch(`${API_URL}/classes/UserProfile/${objectId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Parse-Application-Id': APP_ID,
            'X-Parse-Master-Key': MASTER_KEY,
          },
          body: JSON.stringify({ isOnline: false }),
        });
      }
      await LocationModule.stopLocationSharing();
    } catch (e) {
      console.error('Stop error:', e);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 9. Start service (same as original)
  // ──────────────────────────────────────────────────────────────
  const startLocationService = async (): Promise<boolean> => {
    try {
      const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      const coarse = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);

      if (fine !== 'granted' && coarse !== 'granted') {
        Alert.alert('Permission Required', 'Location access is needed.');
        return false;
      }

      const apiLevel = getApiLevel();
      if (apiLevel >= 29) {
        const bg = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
        if (bg !== 'granted') {
          Alert.alert(
            'Background Location Required',
            'Please allow "Allow all the time" for background sharing.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
          return false;
        }
      }

      if (apiLevel >= 33) {
        const notif = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
        if (notif) await PermissionsAndroid.request(notif);
      }

      const objectId = await AsyncStorage.getItem('parseObjectId');
      if (!objectId) {
        Alert.alert('Error', 'User not found.');
        return false;
      }

      await LocationModule.startLocationSharing(objectId, API_URL, APP_ID, MASTER_KEY);

      await fetch(`${API_URL}/classes/UserProfile/${objectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Parse-Application-Id': APP_ID,
          'X-Parse-Master-Key': MASTER_KEY,
        },
        body: JSON.stringify({ isOnline: true }),
      });

      return true;
    } catch (error: any) {
      console.error('Start error:', error);
      Alert.alert('Error', 'Failed to start location sharing.');
      return false;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 10. Toggle handler – now also checks system GPS
  // ──────────────────────────────────────────────────────────────
  const handleToggle = useCallback(async () => {
    // 1. System GPS off?
    if (isSystemLocationEnabled === false) {
      Alert.alert(
        'Location Services Disabled',
        'Please turn on location services to share your location.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Location Settings', onPress: openLocationSettings },
        ]
      );
      return;
    }

    // 2. Permissions missing?
    if (!hasAllPermissions) {
      Alert.alert(
        'Permission Required',
        'Please allow "Allow all the time" in app settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    setIsLoadingToggle(true);
    const willEnable = !enabled;

    if (willEnable) {
      const success = await startLocationService();
      if (!success) {
        setIsLoadingToggle(false);
        return;
      }
    } else {
      await stopLocationService();
    }

    await AsyncStorage.setItem('locationSharingEnabled', String(willEnable));
    onToggle(willEnable);
    setIsLoadingToggle(false);
  }, [
    enabled,
    hasAllPermissions,
    isSystemLocationEnabled,
    onToggle,
  ]);

  // ──────────────────────────────────────────────────────────────
  // UI
  // ──────────────────────────────────────────────────────────────
  if (isSystemLocationEnabled === null) {
    return (
      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>Checking location services…</Text>
        <ActivityIndicator size="small" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.toggleContainer}>
      <Text style={styles.toggleLabel}>
        {enabled ? 'Location ON' : 'Turn on Location'}
      </Text>
      <Switch
        trackColor={{ false: '#555', true: '#00C853' }}
        thumbColor={enabled ? '#fff' : '#aaa'}
        ios_backgroundColor="#555"
        onValueChange={handleToggle}
        value={enabled}
        disabled={isLoadingToggle}
      />
      {isLoadingToggle && <ActivityIndicator size="small" color="#fff" style={styles.toggleLoader} />}
    </View>
  );
}

const styles = StyleSheet.create({
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 25,
    height: 50,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  toggleLabel: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
    flex: 1,
  },
  toggleLoader: {
    marginLeft: 8,
  },
});