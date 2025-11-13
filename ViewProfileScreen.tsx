// ViewProfileScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation, RouteProp, NavigationProp } from '@react-navigation/native';
import EncryptedStorage from 'react-native-encrypted-storage';
import { jwtDecode } from 'jwt-decode';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { RootStackParamList } from './types/navigation';
import { useTheme } from './ThemeContext';


/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
interface Auth0IdToken {
  sub: string;
  name: string;
  picture: string;
  email: string;
  email_verified: boolean;
  
}

type HomeRouteProp = RouteProp<RootStackParamList, 'Home'>;
type ViewProfileNavProp = NavigationProp<RootStackParamList>;

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function ViewProfileScreen() {
  const route = useRoute<HomeRouteProp>();
  const navigation = useNavigation<ViewProfileNavProp>();
  const { colors } = useTheme();

  const [username, setUsername] = useState('Loading...');
  const [bio, setBio] = useState('');
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [height, setHeight] = useState<string | null>(null);

  /* ------------------------------------------------------------------ */
  /*  Parse helpers                                                     */
  /* ------------------------------------------------------------------ */
  const API_URL = 'https://nexi-server.onrender.com/parse';
  const APP_ID = 'myAppId';
  const MASTER_KEY = 'myMasterKey';

  async function queryUser(auth0Id: string): Promise<any | null> {
    const where = { auth0Id };
    const whereStr = encodeURIComponent(JSON.stringify(where));
    const response = await fetch(
      `${API_URL}/classes/UserProfile?where=${whereStr}&limit=1`,
      {
        method: 'GET',
        headers: {
          'X-Parse-Application-Id': APP_ID,
          'X-Parse-Master-Key': MASTER_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Query Error:', response.status, errorText);
      throw new Error(`Query failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.results?.[0] ?? null;
  }

  /* ------------------------------------------------------------------ */
  /*  Fetch profile                                                     */
  /* ------------------------------------------------------------------ */
  const fetchProfile = useCallback(async () => {
    const storedToken = await EncryptedStorage.getItem('idToken');
    if (!storedToken) {
      setUsername('No User');
      setLoading(false);
      return;
    }

    try {
      const userInfo: Auth0IdToken = jwtDecode(storedToken);
      setUserId(userInfo.sub);
      const userSnap = await queryUser(userInfo.sub);

      if (userSnap) {
        setUsername(userSnap.username || userInfo.name || 'Unknown');
        setBio(userSnap.bio || '');
        setProfilePicUrl(userSnap.profilePicUrl || userInfo.picture || null);
        setHeight(userSnap.height || null);
      } else {
        setUsername('No Profile');
      }
    } catch (error) {
      console.error('Fetch profile error:', error);
      setUsername('Error');
    } finally {
      setLoading(false);
    }
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Initial load – use params from Home if they exist                 */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const params = (route.params as any) ?? {};

    if (params?.userId) {
      // Params were passed from App → Home → ViewProfile
      setUserId(params.userId);
      setUsername(params.username ?? 'Loading...');
      setBio(params.bio ?? '');
      setProfilePicUrl(params.profilePicUrl ?? null);
      setHeight(params.height ?? null);
      setLoading(false);
    } else {
      // No params → fetch from storage / server
      setLoading(true);
      fetchProfile();
    }
  }, [route.params, fetchProfile]);

  /* ------------------------------------------------------------------ */
  /*  Pull-to-refresh                                                   */
  /* ------------------------------------------------------------------ */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  }, [fetchProfile]);

  /* ------------------------------------------------------------------ */
  /*  Navigation handlers                                               */
  /* ------------------------------------------------------------------ */
  const handleEditProfile = () => {
    if (!userId) return;
    navigation.navigate('ProfileSetup', {
      userId,
      email: '',
      name: username || 'User',
      username,
      bio,
      profilePicUrl,
      height: height || '',
      isEditMode: true,
    } as any);
  };

  const handleSettings = () => {
    navigation.navigate('Settings');
  };
   
  /* ------------------------------------------------------------------ */        
  /*  Themed button component                                           */         
  /* ------------------------------------------------------------------ */          
  const ThemedButton = ({
    title,
    onPress,
  }: {
    title: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: colors.accent }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.buttonText, { color: colors.buttonText }]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */
  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.iconColor} />
        <Text style={{ color: colors.text }}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.containerWrapper, { backgroundColor: colors.background }]}>
      {/* Settings gear */}
      <TouchableOpacity style={styles.settingsIcon} onPress={handleSettings}>
        <Ionicons name="settings-outline" size={28} color={colors.iconColor} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.iconColor]}
            tintColor={colors.iconColor}
          />
        }
      >
        <Text style={[styles.title, { color: colors.text }]}>Welcome to Home Feed!</Text>

        {profilePicUrl ? (
          <Image
            source={{ uri: profilePicUrl }}
            style={[styles.avatar, { borderColor: colors.border }]}
          />
        ) : (
          <View
            style={[
              styles.avatarPlaceholder,
              { backgroundColor: colors.placeholderBackground },
            ]}
          >
            <Text
              style={[
                styles.placeholderText,
                { color: colors.placeholderText },
              ]}
            >
              No Profile Picture
            </Text>
          </View>
        )}

        <Text style={[styles.info, { color: colors.text }]}>Username: {username}</Text>
        <Text style={[styles.info, { color: colors.text }]}>Bio: {bio || 'No bio set'}</Text>
        <Text style={[styles.info, { color: colors.text }]}>
          Height: {height ? `${height} cm` : 'Not set'}
        </Text>

        <View style={styles.buttonContainer}>
          <ThemedButton title="Edit Profile" onPress={handleEditProfile} />
        </View>

        <Text style={[styles.info, { color: colors.secondaryText }]}>
          Feed content goes here (posts, etc.)
        </Text>
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  containerWrapper: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  info: { fontSize: 16, marginVertical: 5, textAlign: 'center' },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginVertical: 10,
    borderWidth: 1,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  placeholderText: { fontSize: 12 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  buttonContainer: { marginVertical: 10, width: '100%', gap: 10 },
  settingsIcon: { position: 'absolute', top: 10, right: 10, zIndex: 1, padding: 10 },
  button: {
    paddingVertical: 12,
   

 paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
});