import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { jwtDecode } from 'jwt-decode';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { RootStackParamList } from './types/navigation';
import { useTheme } from './ThemeContext';

// NativeModules to access the LocationModule
const { LocationModule } = NativeModules;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey'; // TEMP: Remove in production!

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
  const response = await fetch(`${API_URL}/classes/UserProfile?where=${whereStr}&limit=1`, {
    method: 'GET',
    headers: {
      'X-Parse-Application-Id': APP_ID,
      'X-Parse-Master-Key': MASTER_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Query Error:', response.status, errorText);
    return null;
  }

  const data = await response.json();
  console.log('Settings Query Result:', data);
  if (data.results && data.results.length > 0) {
    return data.results[0];
  }
  return null;
}

// Stop location service
const stopLocationService = async () => {
  if (Platform.OS === 'android') {
    try {
      await LocationModule.stopLocationSharing();
      console.log('Location service stopped');
    } catch (err) {
      console.error('Failed to stop location service:', err);
    }
  }
};

// Start location service
const startLocationService = async () => {
  if (Platform.OS === 'android') {
    try {
      await LocationModule.startLocationSharing();
      console.log('Location service started');
    } catch (err) {
      console.error('Failed to start location service:', err);
      throw err;
    }
  }
};

// Logout function
const handleLogout = async (navigation: NavigationProp) => {
  try {
    await AsyncStorage.removeItem('idToken');
    await AsyncStorage.removeItem('parseObjectId');
    await stopLocationService();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  } catch (err) {
    console.error('Logout error:', err);
    Alert.alert('Error', 'Logout failed. Please try again.');
  }
};

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { mode, colors, toggleTheme } = useTheme();
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadInitialState = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('idToken');
        if (storedToken) {
          const userInfo: Auth0IdToken = jwtDecode<Auth0IdToken>(storedToken);
          const userSnap = await queryUser(userInfo.sub);
          setLocationSharingEnabled(!!userSnap?.location);
        }
      } catch (error) {
        console.error('Load initial state error:', error);
        setLocationSharingEnabled(false);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialState();
  }, []);

  const handleLocationSharingToggle = async () => {
    const newEnabled = !locationSharingEnabled;
    try {
      if (newEnabled) {
        await startLocationService();
      } else {
        await stopLocationService();
      }
      setLocationSharingEnabled(newEnabled);
    } catch (err) {
      console.error('Toggle error:', err);
      Alert.alert(
        'Permission Error',
        'Location sharing requires background location permission. Please enable it in app settings.',
        [{ text: 'OK' }]
      );
    }
  };

  const ThemedButton = ({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) => (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: disabled ? colors.secondaryText : colors.accent },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <Text style={[styles.buttonText, { color: colors.buttonText }]}>{title}</Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Loading Settings...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      <Text style={[styles.info, { color: colors.secondaryText }]}>Configure your app settings here.</Text>

      <View style={[styles.toggleContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.toggleLabel, { color: colors.text }]}>Dark Mode</Text>
        <Switch
          value={mode === 'dark'}
          onValueChange={toggleTheme}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={mode === 'dark' ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>

      <View style={[styles.toggleContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.toggleLabel, { color: colors.text }]}>Location Sharing</Text>
        <Switch
          value={locationSharingEnabled}
          onValueChange={handleLocationSharingToggle}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={locationSharingEnabled ? '#f5dd4b' : '#f4f3f4'}
          disabled={isLoading}
        />
      </View>

      <View style={styles.buttonContainer}>
        <ThemedButton title="Back to Profile" onPress={() => (navigation as any).navigate('Home')} />
        <ThemedButton
          title="Logout"
          onPress={() => {
            Alert.alert(
              'Confirm Logout',
              'Are you sure you want to log out? This will stop location sharing and clear your data.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Logout',
                  style: 'destructive',
                  onPress: () => handleLogout(navigation),
                },
              ]
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 20,
  },
  info: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  toggleLabel: {
    fontSize: 18,
    fontWeight: '500',
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
