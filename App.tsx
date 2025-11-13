// App.tsx
import React, { useState, useEffect } from 'react';
import {
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  Image,
} from 'react-native';
import ChatScreen from './screens/ChatScreen';      
import InboxScreen from './screens/InboxScreen';  // ← ADD THIS LINE    // ← IMPORT HERE

import SearchBarScreen from './screens/SearchScreen';           // ← NEW
import UserProfileScreen from './screens/UserProfileScreen';       // ← NEW
import EncryptedStorage from 'react-native-encrypted-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';

import LoginScreen from './LoginScreen';
import ProfileSetupScreen from './ProfileSetupScreen';
import ViewProfileScreen from './ViewProfileScreen';
import MapsScreen from './MapsScreen';               // direct import
import SettingsScreen from './SettingsScreen';

import type { RootStackParamList } from './types/navigation';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ThemeProvider, useTheme } from './ThemeContext';

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

interface Auth0IdToken {
  sub: string;
  name: string;
  picture: string;
  email: string;
  email_verified: boolean;
}

/* ------------------------------------------------------------------ */
/*  Parse helper                                                      */
/* ------------------------------------------------------------------ */
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
  if (!res.ok) {
    const txt = await res.text();
    console.error('queryUser error', res.status, txt);
    return null;
  }
  const data = await res.json();
  return data.results?.[0] ?? null;
}

/* ------------------------------------------------------------------ */
/*  Loading screen                                                    */
/* ------------------------------------------------------------------ */
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" />
      <Text style={styles.loadingText}>Loading…</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Bottom-Tab navigator (Home)                                       */
/* ------------------------------------------------------------------ */

interface BottomTabsProps {
  profilePicUrl?: string | null;
  homeParams?: any; // Pass through to ViewProfile
}

function BottomTabsNavigator({ profilePicUrl, homeParams }: BottomTabsProps) {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="ViewProfile"
      screenOptions={{
        tabBarActiveTintColor: colors.iconColor,
        tabBarInactiveTintColor: colors.iconColor,
        tabBarStyle: { backgroundColor: colors.tabBarBackground },
        headerShown: false,
        tabBarShowLabel: false,
      }}
    >
      {/* MAPS – direct component */}
      <Tab.Screen
        name="Maps"
        component={MapsScreen}               // direct
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="location-outline" size={size} color={color} />
          ),
        }}
      />

      {/* PROFILE */}
      <Tab.Screen
        name="ViewProfile"
        options={{
          tabBarIcon: ({ size }) =>
            profilePicUrl ? (
              <Image
                source={{ uri: profilePicUrl }}
                style={{
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  borderWidth: 1,
                  borderColor: colors.iconColor,
                }}
              />
            ) : (
              <Ionicons name="person-outline" size={size} color={colors.iconColor} />
            ),
        }}
      >
        {() => <ViewProfileScreen />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16 },
});

/* ------------------------------------------------------------------ */
/*  Main App component                                                */
/* ------------------------------------------------------------------ */
export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRouteName, setInitialRouteName] = useState<keyof RootStackParamList>('Login');
  const [initialRouteParams, setInitialRouteParams] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = await EncryptedStorage.getItem('idToken');
      if (!token) {
        setInitialRouteName('Login');
        setIsLoading(false);
        return;
      }

      try {
        const userInfo: Auth0IdToken = jwtDecode(token);
        const snap = await queryUser(userInfo.sub);

        if (snap) {
          await AsyncStorage.setItem('parseObjectId', snap.objectId);

          setInitialRouteParams({
            userId: userInfo.sub,
            username: snap.username || userInfo.name,
            bio: snap.bio || '',
            profilePicUrl: snap.profilePicUrl || userInfo.picture,
            height: snap.height ?? null,
          });
          setInitialRouteName('Home');
        } else {
          setInitialRouteName('ProfileSetup');
          setInitialRouteParams({
            userId: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
          });
        }
      } catch (e) {
        console.error('auto-login error', e);
        await EncryptedStorage.removeItem('idToken');
        await AsyncStorage.removeItem('parseObjectId');
        setInitialRouteName('Login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (isLoading) return <LoadingScreen />;

  return (
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
  <Stack.Screen name="Login" component={LoginScreen} />
  <Stack.Screen name="ProfileSetup">
    {() => <ProfileSetupScreen {...(initialRouteParams as any)} />}
  </Stack.Screen>

  <Stack.Screen name="Home">
    {() => (
      <BottomTabsNavigator
        profilePicUrl={initialRouteParams?.profilePicUrl}
        homeParams={initialRouteParams}
      />
    )}
  </Stack.Screen>
  <Stack.Screen name="UserProfile" component={UserProfileScreen} />
  <Stack.Screen name="Chat" component={ChatScreen} />
  <Stack.Screen name="Inbox" component={InboxScreen} />

  <Stack.Screen name="Settings" component={SettingsScreen} />
  
  {/* ADD THESE TWO */}
  <Stack.Screen name="SearchBar" component={SearchBarScreen} />
</Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}    