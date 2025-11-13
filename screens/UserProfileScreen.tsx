// UserProfileScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  ImageStyle,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { RootStackParamList } from '../types/navigation';
import { useTheme } from '../ThemeContext';

type UserProfileRouteProp = RouteProp<RootStackParamList, 'UserProfile'>;

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

async function queryUserByAuth0Id(auth0Id: string): Promise<any | null> {
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

export default function UserProfileScreen() {
  const route = useRoute<UserProfileRouteProp>();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const { userId, username: initialUsername, profilePicUrl: initialPic, bio: initialBio, height: initialHeight } = route.params;

  const [username, setUsername] = useState(initialUsername || 'Loading...');
  const [bio, setBio] = useState(initialBio || '');
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(initialPic || null);
  const [height, setHeight] = useState<string | null>(initialHeight || null);
  const [loading, setLoading] = useState(true);
  const [objectId, setObjectId] = useState<string | null>(null);

  useEffect(() => {
    const fetchFullProfile = async () => {
      try {
        const userData = await queryUserByAuth0Id(userId);
        if (userData) {
          setUsername(userData.username || initialUsername);
          setBio(userData.bio || '');
          setProfilePicUrl(userData.profilePicUrl || initialPic || null);
          setHeight(userData.height || null);
          setObjectId(userData.objectId);
        }
      } catch (err) {
        console.error('Failed to fetch full profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFullProfile();
  }, [userId, initialUsername, initialPic]);

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.text} />
        <Text style={{ color: colors.text, marginTop: 10 }}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.containerWrapper, { backgroundColor: colors.background }]}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={28} color={colors.text} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Profile Picture */}
        {profilePicUrl ? (
          <Image source={{ uri: profilePicUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={40} color={colors.secondaryText} />
          </View>
        )}

        <Text style={[styles.username, { color: colors.text }]}>{username}</Text>
        <Text style={[styles.bio, { color: colors.secondaryText }]}>
          {bio || 'No bio available'}
        </Text>
        <Text style={[styles.info, { color: colors.text }]}>
          Height: {height ? `${height} cm` : 'Not shared'}
        </Text>

        {/* MESSAGE BUTTON */}
        <TouchableOpacity
          style={[styles.messageBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            if (objectId) {
              navigation.navigate('Chat', {
                receiverId: userId,
                receiverName: username,
                receiverPic: profilePicUrl || undefined,
              });
            }
          }}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#fff" />
          <Text style={styles.messageBtnText}>Message</Text>
        </TouchableOpacity>

        <View style={styles.placeholder}>
          <Text style={[styles.placeholderText, { color: colors.secondaryText }]}>
            Posts, photos, and activity will appear here.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// === STYLES (Fixed & Type-Safe) ===
const styles = StyleSheet.create({
  containerWrapper: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 20,
    paddingTop: 80,
  },
  backBtn: {
    position: 'absolute', // ← FIXED: was 'absoluteolute'
    top: 50,
    left: 20,
    zIndex: 10,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#444',
  } as ImageStyle, // ← Explicit ImageStyle
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
    marginBottom: 16,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  bio: {
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  info: {
    fontSize: 16,
    marginBottom: 10,
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 25,
    marginTop: 20,
    gap: 8,
  },
  messageBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  placeholder: {
    marginTop: 40,
    padding: 20,
    backgroundColor: 'rgba(100,100,100,0.2)',
    borderRadius: 12,
  },
  placeholderText: {
    textAlign: 'center',
    fontSize: 14,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});