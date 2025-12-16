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

import BlockedUsersScreen from './screens/BlockedUsers';
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
import TermsAndConditionsScreen from './screens/TermsAndConditionsScreen';
import ProfileSetupScreen from './ProfileSetupScreen';
import ViewProfileScreen from './ViewProfileScreen';
import MapsScreen from './MapsScreen';
import SettingsScreen from './SettingsScreen';
import type { RootStackParamList } from './types/navigation';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ThemeProvider, useTheme } from './ThemeContext';
import PostFeedScreen from './screens/PostFeedScreen';
import UserUploadPostScreen from './screens/UserUploadPost';
import RoomCreationScreen from './screens/RoomCreation';
import RoomLocationScreen from './screens/RoomLocationScreen';
import RoomUserProfile from './rooms/RoomUserProfile';
import JoinedRoomsScreen from './rooms/JoinedRooms';
import RoomPostUpload from './rooms/RoomPostUpload';
import PersonalInfo from './screens/PersonalInfo';
import { scale, moderateScale } from 'react-native-size-matters';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

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

  useEffect(() => {
    fetchUnreadCount();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        fetchUnreadCount();
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.iconColor,
        tabBarInactiveTintColor: colors.iconColor,
        tabBarStyle: { 
          backgroundColor: colors.tabBarBackground,
          height: hp('9.4%'),
          paddingBottom: hp('1%'),
          paddingTop: hp('0.5%'),
        },
        headerShown: false,
        tabBarShowLabel: false,
      }}
    >
      {/* Maps */}
      <Tab.Screen
        name="Maps"
        component={MapsScreen}
        options={{
          tabBarIcon: ({ size }) => (
            <Ionicons 
              name="location-outline" 
              size={moderateScale(size)} 
              color={colors.iconColor} 
            />
          ),
          lazy: true,
        }}
      />

      {/* PostFeed */}
      <Tab.Screen
        name="PostFeed"
        component={PostFeedScreen}
        options={{
          tabBarIcon: ({ size }) => (
            <Ionicons 
              name="compass-outline" 
              size={moderateScale(size)} 
              color={colors.iconColor} 
            />
          ),
          lazy: true,
        }}
      />

      {/* Notifications */}
      <Tab.Screen
        name="Notifications"
        component={NotificationScreen}
        options={{
          tabBarIcon: ({ size }) => (
            <View style={{ position: 'relative' }}>
              <Ionicons
                name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
                size={moderateScale(size)}
                color={unreadCount > 0 ? '#888' : colors.iconColor}
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
        listeners={{ focus: fetchUnreadCount }}
      />

      {/* Profile Tab */}
      <Tab.Screen
        name="ViewProfile"
        component={ViewProfileScreen}
        options={{
          tabBarIcon: ({ size }) => {
            const { colors } = useTheme();
            return profilePicUrl ? (
              <Image
                source={{ uri: profilePicUrl }}
                style={{
                  width: moderateScale(size),
                  height: moderateScale(size),
                  borderRadius: moderateScale(size / 2),
                  borderWidth: 2,
                  borderColor: colors.iconColor,
                }}
              />
            ) : (
              <Ionicons 
                name="person-outline" 
                size={moderateScale(size)} 
                color={colors.iconColor} 
              />
            );
          },
          lazy: true,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { 
    marginTop: hp('1.5%'), 
    fontSize: moderateScale(16) 
  },
  badge: {
    position: 'absolute',
    right: scale(-8),
    top: scale(-5),
    backgroundColor: '#FF0000',
    borderRadius: moderateScale(10),
    minWidth: moderateScale(20),
    height: moderateScale(20),
    paddingHorizontal: scale(6),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: moderateScale(11),
    fontWeight: 'bold',
  },
});

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRouteName, setInitialRouteName] = useState<keyof RootStackParamList>('Login');
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      // Check if terms accepted first
      const termsAccepted = await AsyncStorage.getItem('termsAccepted');
      
      if (termsAccepted !== 'true') {
        // First time user - show terms
        setInitialRouteName('TermsAndConditions');
        setIsLoading(false);
        return;
      }

      // Rest of existing checkAuth logic
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
        <Stack.Navigator 
          initialRouteName={initialRouteName} 
          screenOptions={{ 
            headerShown: false,
            // @ts-ignore - Safe for RN, fixes TS but unmounts inactive screens (kills lag/errors)
            detachInactiveScreens: true,
            animation: 'fade_from_bottom',
          }}
        >
          <Stack.Screen name="TermsAndConditions" component={TermsAndConditionsScreen} />
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
          <Stack.Screen name="UserUploadPost" component={UserUploadPostScreen} />
          <Stack.Screen name="RoomCreation" component={RoomCreationScreen} />
          <Stack.Screen name="RoomLocation" component={RoomLocationScreen} />
          <Stack.Screen name="RoomUserProfile" component={RoomUserProfile} />
          <Stack.Screen name="RoomPostUpload" component={RoomPostUpload} />
          <Stack.Screen name="JoinedRooms" component={JoinedRoomsScreen} />
          <Stack.Screen name="PersonalInfo" component={PersonalInfo} />
          <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}