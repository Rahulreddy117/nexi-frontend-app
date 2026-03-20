// RootLauncher.tsx
import React, { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

const PARSE_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function RootLauncher() {
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const sessionToken = await AsyncStorage.getItem('parseSessionToken');
        const auth0Id = await AsyncStorage.getItem('auth0Id');

        // If no session or auth0Id → go to Login
        if (!sessionToken || !auth0Id) {
          navigation.replace('Login');
          return;
        }

        // Check if UserProfile exists in Parse
        const where = encodeURIComponent(JSON.stringify({ auth0Id }));
        const response = await fetch(`${PARSE_URL}/classes/UserProfile?where=${where}&limit=1`, {
          method: 'GET',
          headers: {
            'X-Parse-Application-Id': APP_ID,
            'X-Parse-Session-Token': sessionToken,
            'Content-Type': 'application/json',
          },
        });

        // If session invalid (e.g., 403 or error) → clear and go to login
        if (!response.ok) {
          await AsyncStorage.multiRemove(['parseSessionToken', 'auth0Id', 'parseObjectId']);
          navigation.replace('Login');
          return;
        }

        const data = await response.json();

        if (data.results && data.results.length > 0) {
          // Profile exists → go to Home
          const profile = data.results[0];
          await AsyncStorage.setItem('parseObjectId', profile.objectId);
          await AsyncStorage.setItem('currentUserId', profile.objectId);

          navigation.replace('Home', {
            userId: auth0Id,
            username: profile.username || '',
            bio: profile.bio || '',
            profilePicUrl: profile.profilePicUrl || '',
            height: profile.height || '',
            gender: profile.gender || '',
          });
        } else {
          // Logged in but no profile → continue onboarding
          navigation.replace('ProfileSetup', {
            userId: auth0Id,
            email: '',
            name: '',
            username: '',
            bio: '',
            profilePicUrl: null,
            height: '',
            gender: '',
            isEditMode: false,
          });
        }
      } catch (error) {
        console.error('RootLauncher error:', error);
        // On any error, clear storage and go to login (safest)
        await AsyncStorage.multiRemove(['parseSessionToken', 'auth0Id', 'parseObjectId']);
        navigation.replace('Login');
      }
    };

    checkAuthState();
  }, [navigation]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#000" />
      <Text style={{ marginTop: 20, fontSize: 16, color: '#333' }}>
        Loading your experience...
      </Text>
    </View>
  );
}