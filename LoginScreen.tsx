import React, { useState } from 'react';
import { View, Button, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import Auth0 from 'react-native-auth0';
import { jwtDecode } from 'jwt-decode';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import EncryptedStorage from 'react-native-encrypted-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RootStackParamList } from './types/navigation';

const auth0 = new Auth0({
  domain: 'nexi.us.auth0.com',
  clientId: 'k7J1eXJXuPXSNrdqlYhOQN2J9PWNIIvb',
});

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Auth0IdToken {
  sub: string;
  name: string;
  picture: string;
  email: string;
  email_verified: boolean;
}

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

async function queryUser(auth0Id: string): Promise<any | null> {
  const where = { auth0Id };
  const whereStr = encodeURIComponent(JSON.stringify(where));
  const url = `${API_URL}/classes/UserProfile?where=${whereStr}&limit=1`;
  console.log('Querying UserProfile:', url);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Parse-Application-Id': APP_ID,
        'X-Parse-Master-Key': MASTER_KEY,
        'Content-Type': 'application/json',
      },
    });
    const text = await response.text();
    console.log('Raw response:', text);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    const data = JSON.parse(text);
    console.log('Parsed UserProfile:', data);
    return data.results?.[0] || null;
  } catch (err: any) {
    console.error('queryUser failed:', err.message);
    return null;
  }
}

async function createUserProfile(auth0Id: string, email: string, name: string): Promise<any> {
  const payload = {
    auth0Id,
    email,
    username: name.split(' ')[0], // simple default
    name,
    bio: '',
    profilePicUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`,
    height: '',
    gender: '',
  };
  console.log('Creating UserProfile:', payload);
  const response = await fetch(`${API_URL}/classes/UserProfile`, {
    method: 'POST',
    headers: {
      'X-Parse-Application-Id': APP_ID,
      'X-Parse-Master-Key': MASTER_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  console.log('Create response:', text);
  if (!response.ok) {
    throw new Error(`Create failed: ${response.status} - ${text}`);
  }
  return JSON.parse(text);
}

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Starting Auth0 login...');
      const credentials = await auth0.webAuth.authorize({
        scope: 'openid profile email',
        connection: 'google-oauth2',
        redirectUrl: 'nexi://nexi.us.auth0.com/android/com.nexi/callback',
      });

      const idToken = credentials.idToken;
      if (!idToken) throw new Error('No ID token');

      await EncryptedStorage.setItem('idToken', idToken);
      const userInfo: Auth0IdToken = jwtDecode(idToken);
      console.log('Auth0 User Info:', userInfo);

      // Save auth0Id for chat
      await AsyncStorage.setItem('auth0Id', userInfo.sub);
      console.log('Saved auth0Id:', userInfo.sub);

      // Check if profile exists
      let userSnap = await queryUser(userInfo.sub);
      let isNewUser = false;

      if (!userSnap) {
        console.log('No profile → creating...');
        userSnap = await createUserProfile(userInfo.sub, userInfo.email, userInfo.name);
        console.log('Profile created:', userSnap);
        isNewUser = true;
      }

      // Save Parse objectId
      await AsyncStorage.setItem('parseObjectId', userSnap.objectId);
      console.log('Saved parseObjectId:', userSnap.objectId);
      

      await AsyncStorage.setItem('currentUserId', userSnap.objectId);  // ← USE objectId, NOT auth0Id

      
      // NEW: Redirect new users to ProfileSetup
      if (isNewUser) {
        navigation.replace('ProfileSetup', {
          userId: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          username: userSnap.username || '',
          bio: userSnap.bio || '',
          profilePicUrl: userSnap.profilePicUrl || userInfo.picture,
          height: userSnap.height || '',
          gender: userSnap.gender || '',
          isEditMode: false,
        });
        return; // Prevent going to Home
      }

      // Existing users go to Home
      navigation.replace('Home', {
        userId: userInfo.sub,
        username: userSnap.username || userInfo.name,
        bio: userSnap.bio || '',
        profilePicUrl: userSnap.profilePicUrl || userInfo.picture,
        height: userSnap.height || '',
        gender: userSnap.gender || '',
      });
    } catch (e: any) {
      console.error('Login failed:', e);
      setError(e.message || 'Login failed');
      Alert.alert('Login Error', e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Login with Google" onPress={onLogin} disabled={loading} />
      {loading && <ActivityIndicator style={{ marginTop: 20 }} />}
      {error && <Text style={styles.error}>Error: {error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  error: { color: 'red', marginTop: 10, textAlign: 'center' },
});