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
import { AppState } from 'react-native';
import ChatScreen from './screens/ChatScreen';
import InboxScreen from './screens/InboxScreen';
import NotificationScreen from './screens/NotificationScreen';
import SearchBarScreen from './screens/SearchScreen';
import UserProfileScreen from './screens/UserProfileScreen';
import FollowingFollowersScreen from './screens/FollowingFollowersScreen';
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
import PostFeedScreen from './screens/PostFeedScreen';
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
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] ?? null;
}
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" />
      <Text style={styles.loadingText}>Loading…</Text>
    </View>
  );
}
function BottomTabsNavigator({ profilePicUrl }: { profilePicUrl?: string | null }) {
  const { colors } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const fetchUnreadCount = async () => {
    try {
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
      const count = data.count || 0;
      setUnreadCount(count);
    } catch (err) {
      console.error('Badge fetch error:', err);
    }
  };
    // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
  // REPLACE THE OLD useEffect WITH THIS ONE:
  useEffect(() => {
    // First load when app starts
    fetchUnreadCount();
    // Refresh when app comes to foreground (user opens app again)
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        fetchUnreadCount();
      }
    });
    return () => subscription.remove();
  }, []);
  // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
  return (
    <Tab.Navigator
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
          tabBarIcon: ({ size }) => (
            < Ionicons name="location-outline" size={size} color={colors.iconColor} />
          ),
        }}
      />
      <Tab.Screen
  name="PostFeed"
  component={PostFeedScreen}
  options={{
    tabBarIcon: ({ size }) => (
      <Ionicons name="play-outline" size={size} color={colors.iconColor} />
    ),
  }}
/>
      <Tab.Screen
        name="Notifications"
        component={NotificationScreen}
        options={{
          tabBarIcon: ({ size }) => (
            <View style={{ position: 'relative' }}>
              <Ionicons
                name={unreadCount > 0 ? "notifications" : "notifications-outline"}
                size={size}
                color={unreadCount > 0 ? "#6366f1" : colors.iconColor}
              />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
        listeners={{
          focus: fetchUnreadCount, // Refresh when user opens tab
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
                  borderWidth: 2,
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
const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16 },
  badge: {
    position: 'absolute',
    right: -8,
    top: -5,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRouteName, setInitialRouteName] = useState<keyof RootStackParamList>('Login');
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
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
        await AsyncStorage.setItem('auth0Id', userInfo.sub);
        const snap = await queryUser(userInfo.sub);
        if (snap) {
          await AsyncStorage.setItem('parseObjectId', snap.objectId);
          setProfilePicUrl(snap.profilePicUrl || userInfo.picture);
          setInitialRouteName('Home');
        } else {
          setInitialRouteName('ProfileSetup');
        }
      } catch (e) {
        console.error('Login error:', e);
        await EncryptedStorage.removeItem('idToken');
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
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
          <Stack.Screen name="Home">
            {() => <BottomTabsNavigator profilePicUrl={profilePicUrl} />}
          </Stack.Screen>
          <Stack.Screen name="UserProfile" component={UserProfileScreen} />
          <Stack.Screen name="FollowingFollowers" component={FollowingFollowersScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="Inbox" component={InboxScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="SearchBar" component={SearchBarScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}