import React, { useState } from 'react';
import { View, Button, Text, StyleSheet } from 'react-native';
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
    throw new Error(`Query failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('Login Query Result:', data);
  if (data.results && data.results.length > 0) {
    return data.results[0];
  }
  return null;
}

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [error, setError] = useState<string | null>(null);

  const onLogin = async () => {
    try {
      const credentials = await auth0.webAuth.authorize({
        scope: 'openid profile email',
        connection: 'google-oauth2',
        redirectUrl: 'nexi://nexi.us.auth0.com/android/com.nexi/callback',
      });

      const idToken = credentials.idToken;
      if (idToken) {
        await EncryptedStorage.setItem('idToken', idToken);
        const userInfo: Auth0IdToken = jwtDecode<Auth0IdToken>(idToken);

        const userSnap = await queryUser(userInfo.sub);

        if (userSnap) {
          await AsyncStorage.setItem('parseObjectId', userSnap.objectId);
          navigation.navigate('Home', {
            userId: userInfo.sub,
            username: userSnap.username || userInfo.name,
            bio: userSnap.bio || '',
            profilePicUrl: userSnap.profilePicUrl || userInfo.picture,
          });
        } else {
          navigation.navigate('ProfileSetup', {
            userId: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
          });
        }
      } else {
        setError('No ID token received');
      }
    } catch (e: any) {
      setError(e.message || 'Login failed');
      console.error('Login Error:', e);
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Login with Google" onPress={onLogin} />
      {error && <Text style={styles.error}>Error: {error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: 'red', marginTop: 10 },
});    