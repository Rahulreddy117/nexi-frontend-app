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
import InboxScreen from './screens/InboxScreen';
import NotificationScreen from './screens/NotificationScreen';

import SearchBarScreen from './screens/SearchScreen';
import UserProfileScreen from './screens/UserProfileScreen';
import EncryptedStorage from 'react-native-encrypted-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';

import LoginScreen from './LoginScreen';
import ProfileSetupScreen from './ProfileSetupScreen';
import ViewProfileScreen from './ViewProfileScreen';
import MapsScreen from './MapsScreen';
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
  homeParams?: any;
}

function BottomTabsNavigator({ profilePicUrl, homeParams }: BottomTabsProps) {
  const { colors } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(async () => {
      const auth0Id = await AsyncStorage.getItem('auth0Id');
      if (!auth0Id) return;
      const res = await fetch(
        `${API_URL}/classes/FollowNotification?where=${encodeURIComponent(
          JSON.stringify({ followedId: auth0Id, read: false })
        )}&count=1`,
        {
          headers: {
            'X-Parse-Application-Id': APP_ID,
            'X-Parse-Master-Key': MASTER_KEY,
          },
        }
      );
      const data = await res.json();
      setUnreadCount(data.count || 0);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

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
      <Tab.Screen
        name="Maps"
        component={MapsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="location-outline" size={size} color={color} />,
        }}
      />

      <Tab.Screen
        name="Notifications"
        component={NotificationScreen}
        options={{
          tabBarIcon: ({ size }) => (
            <View>
              <Ionicons name="notifications-outline" size={size} color={colors.iconColor} />
              {unreadCount > 0 && (
                <View style={[styles.badge, { backgroundColor: '#ef4444' }]}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />

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
  badge: {
    position: 'absolute',
    right: -6,
    top: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
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
          <Stack.Screen name="SearchBar" component={SearchBarScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}