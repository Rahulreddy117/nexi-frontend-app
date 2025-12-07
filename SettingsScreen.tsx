import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
  NativeModules,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';

import type { RootStackParamList } from './types/navigation';
import { useTheme } from './ThemeContext';

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { LocationModule } = NativeModules;

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { mode, colors, toggleTheme } = useTheme();

  // NEW: Navigate to Personal Info screen
  const handlePersonalInfo = () => {
    navigation.navigate('PersonalInfo' as never);
  };
  

  // ONLY NEW CODE STARTS HERE
  const handleJoinedRooms = async () => {
    try {
      const parseObjectId = await AsyncStorage.getItem('parseObjectId');
      if (!parseObjectId) {
        Alert.alert('Error', 'User data not found. Please log in again.');
        return;
      }
      navigation.navigate('JoinedRooms', { userParseObjectId: parseObjectId });
    } catch (err) {
      Alert.alert('Error', 'Could not open Joined Rooms');
    }
  };
  // ONLY NEW CODE ENDS HERE

  const ThemedButton = ({
    title,
    onPress,
    disabled,
    danger = false,
  }: {
    title: string;
    onPress: () => void;
    disabled?: boolean;
    danger?: boolean;
  }) => (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: disabled
            ? colors.secondaryText
            : danger
            ? '#ff4444'
            : colors.accent,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <Text
        style={[
          styles.buttonText,
          { color: colors.buttonText, ...(danger && { color: 'white' }) },
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove(['idToken', 'parseObjectId', 'sessionToken']);

      if (Platform.OS === 'android' && LocationModule?.stopLocationSharing) {
        await LocationModule.stopLocationSharing();
      }

      navigation.reset({
        index: 0,
        routes: [{ name: 'Login', params: undefined }],
      });
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  const handleDeleteAccount = async () => {
    const auth0Id = await AsyncStorage.getItem('auth0Id');
    const parseObjectId = await AsyncStorage.getItem('parseObjectId');

    if (!auth0Id || !parseObjectId) {
      Alert.alert('Error', 'Not logged in');
      return;
    }

    Alert.alert(
      'DELETE ACCOUNT FOREVER',
      'Everything will be erased. Your rooms will live on.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'DELETE',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${API_URL}/classes/UserProfile/${parseObjectId}`, {
                method: 'DELETE',
                headers: {
                  'X-Parse-Application-Id': APP_ID,
                  'X-Parse-Master-Key': MASTER_KEY,
                },
              });
              console.log('UserProfile deleted → ALL POSTS GONE');

              const deleteByStringField = async (className: string, fields: string[]) => {
                const allIds: string[] = [];
                for (const field of fields) {
                  const res = await fetch(
                    `${API_URL}/classes/${className}?where=${encodeURIComponent(
                      JSON.stringify({ [field]: auth0Id })
                    )}&limit=1000`,
                    { headers: { 'X-Parse-Application-Id': APP_ID, 'X-Parse-Master-Key': MASTER_KEY } }
                  );
                  const data = await res.json();
                  data.results?.forEach((item: any) => item.objectId && allIds.push(item.objectId));
                }
                if (allIds.length === 0) return;

                await fetch(`${API_URL}/batch`, {
                  method: 'POST',
                  headers: {
                    'X-Parse-Application-Id': APP_ID,
                    'X-Parse-Master-Key': MASTER_KEY,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    requests: allIds.map(id => ({
                      method: 'DELETE',
                      path: `/parse/classes/${className}/${id}`,
                    })),
                  }),
                });
              };

              await deleteByStringField('Message', ['senderId', 'receiverId']);
              await deleteByStringField('Follow', ['followerId', 'followingId']);
              await deleteByStringField('FollowNotification', ['followerId', 'followedId']);

              await AsyncStorage.clear();
              Alert.alert('You Are Gone', 'Everything deleted. Fresh start.');
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });

            } catch (err: any) {
              console.error('Delete failed:', err);
              Alert.alert('Error', 'Try again — some data may remain.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      <Text style={[styles.info, { color: colors.secondaryText }]}>
        Configure your app settings here.
      </Text>

      {/* Dark Mode Toggle */}
     {/* Dark Mode Toggle – ONLY dark mode works, Light mode = Coming Soon! */}
<View style={[styles.toggleContainer, { backgroundColor: colors.background }]}>
  <View>
    <Text style={[styles.toggleLabel, { color: colors.text }]}>Dark Mode</Text>
    {mode === 'light' && (
      <Text style={[styles.comingSoonText, { color: colors.secondaryText }]}>
        Light mode coming soon!
      </Text>
    )}
  </View>

  <Switch
    value={mode === 'dark'}                         // Shows ON only in dark mode
    onValueChange={(newValue) => {
      if (newValue) {
        // User wants to turn ON → allow dark mode
        toggleTheme();   // this will switch to dark
      } else {
        // User tries to turn OFF (go to light mode) → block it
        Alert.alert(
          'Light Mode Coming Soon!',
          'We\'re working on the light theme. Stay tuned! ',
          [{ text: 'OK' }]
        );
        // Do NOT call toggleTheme() → stays in dark mode
      }
    }}
    trackColor={{ false: '#767577', true: '#81b0ff' }}
    thumbColor={mode === 'dark' ? '#f5dd4b' : '#f4f3f4'}
  />
</View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        {/* THIS IS THE ONLY NEW BUTTON */}
        
        <ThemedButton title="Personal Info" onPress={handlePersonalInfo} />


        <ThemedButton title="Joined Rooms" onPress={handleJoinedRooms} />

        <ThemedButton title="Back" onPress={() => navigation.goBack()} />

        <ThemedButton
          title="Logout"
          onPress={() => {
            Alert.alert(
              'Confirm Logout',
              'Are you sure you want to log out? This will stop location sharing and clear your session.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Logout',
                  style: 'destructive',
                  onPress: handleLogout,
                },
              ]
            );
          }}
        />

        <ThemedButton
          title="Delete Account"
          onPress={handleDeleteAccount}
          danger={true}
        />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
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
  comingSoonText: {
  fontSize: 12,
  fontStyle: 'italic',
  marginTop: 4,
},
});