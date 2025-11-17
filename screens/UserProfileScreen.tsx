// UserProfileScreen.tsx (Updated: Handles Both auth0Id & objectId)
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
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { RootStackParamList } from '../types/navigation';
import { useTheme } from '../ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

type UserProfileRouteProp = RouteProp<RootStackParamList, 'UserProfile'>;

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

const HEADERS = {
  'X-Parse-Application-Id': APP_ID,
  'X-Parse-Master-Key': MASTER_KEY,
  'Content-Type': 'application/json',
};

async function queryUserByAuth0Id(auth0Id: string): Promise<any | null> {
  const where = { auth0Id };
  const whereStr = encodeURIComponent(JSON.stringify(where));
  const res = await fetch(`${API_URL}/classes/UserProfile?where=${whereStr}&limit=1`, {
    method: 'GET',
    headers: HEADERS,
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error('queryUserByAuth0Id error', res.status, txt);
    return null;
  }
  const data = await res.json();
  return data.results?.[0] ?? null;
}

async function queryUserByObjectId(objectId: string): Promise<any | null> {
  const res = await fetch(`${API_URL}/classes/UserProfile/${objectId}`, {
    method: 'GET',
    headers: HEADERS,
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error('queryUserByObjectId error', res.status, txt);
    return null;
  }
  return await res.json();
}

async function isFollowing(myId: string, otherId: string): Promise<any | null> {
  const where = { followerId: myId, followingId: otherId };
  const whereStr = encodeURIComponent(JSON.stringify(where));
  const res = await fetch(`${API_URL}/classes/Follow?where=${whereStr}&limit=1`, {
    method: 'GET',
    headers: HEADERS,
  });

  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  return data.results?.[0] ?? null;
}

export default function UserProfileScreen() {
  const route = useRoute<UserProfileRouteProp>();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const { 
    userId: initialUserId, 
    objectId: initialObjectId, 
    username: initialUsername, 
    profilePicUrl: initialPic, 
    bio: initialBio, 
    height: initialHeight 
  } = route.params;

  const [username, setUsername] = useState(initialUsername || 'Loading...');
  const [bio, setBio] = useState(initialBio || '');
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(initialPic || null);
  const [height, setHeight] = useState<string | null>(initialHeight || null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [objectId, setObjectId] = useState<string | null>(initialObjectId || null);
  const [userAuth0Id, setUserAuth0Id] = useState<string | null>(initialUserId || null); // Track fetched auth0Id

  const [myId, setMyId] = useState<string | null>(null);
  const [myObjectId, setMyObjectId] = useState<string | null>(null);
  const [isMyProfile, setIsMyProfile] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followObjectId, setFollowObjectId] = useState<string | null>(null);
  const [loadingFollow, setLoadingFollow] = useState(false);

  useEffect(() => {
    const loadMyData = async () => {
      const auth0Id = await AsyncStorage.getItem('auth0Id');
      const parseId = await AsyncStorage.getItem('parseObjectId');
      setMyId(auth0Id);
      setMyObjectId(parseId);
    };
    loadMyData();
  }, []);

  useEffect(() => {
    const fetchFullProfile = async () => {
      try {
        let userData: any = null;

        // Fetch based on param type
        if (initialObjectId) {
          // From Maps: Use objectId
          userData = await queryUserByObjectId(initialObjectId);
        } else if (initialUserId) {
          // From Search/Home: Use auth0Id
          userData = await queryUserByAuth0Id(initialUserId);
        }

        if (userData) {
          setUsername(userData.username || initialUsername);
          setBio(userData.bio || '');
          setProfilePicUrl(userData.profilePicUrl || initialPic || null);
          setHeight(userData.height || null);
          setFollowersCount(userData.followersCount || 0);
          setFollowingCount(userData.followingCount || 0);
          setObjectId(userData.objectId);
          setUserAuth0Id(userData.auth0Id); // Extract auth0Id for follow/message
        }
      } catch (err) {
        console.error('Failed to fetch full profile:', err);
      } finally {
        setLoading(false);
      }
    };

    if (initialObjectId || initialUserId) {
      fetchFullProfile();
    } else {
      setLoading(false);
    }
  }, [initialObjectId, initialUserId, initialUsername, initialPic]);

  useEffect(() => {
    if (myId && userAuth0Id && myId === userAuth0Id) {
      setIsMyProfile(true);
    } else if (myId && userAuth0Id && objectId) {
      const checkIfFollowing = async () => {
        const follow = await isFollowing(myId, userAuth0Id!);
        setFollowing(!!follow);
        setFollowObjectId(follow ? follow.objectId : null);
      };
      checkIfFollowing();
    }
  }, [myId, userAuth0Id, objectId]);

  const handleFollow = async () => {
    if (!myId || !myObjectId || !objectId || !userAuth0Id || loadingFollow) return;
    setLoadingFollow(true);

    try {
      if (following) {
        // === UNFOLLOW ===
        await fetch(`${API_URL}/classes/Follow/${followObjectId}`, { method: 'DELETE', headers: HEADERS });
        await fetch(`${API_URL}/classes/UserProfile/${myObjectId}`, {
          method: 'PUT', headers: HEADERS,
          body: JSON.stringify({ followingCount: { __op: 'Increment', amount: -1 } }),
        });
        await fetch(`${API_URL}/classes/UserProfile/${objectId}`, {
          method: 'PUT', headers: HEADERS,
          body: JSON.stringify({ followersCount: { __op: 'Increment', amount: -1 } }),
        });

        // Delete notification
        const notifRes = await fetch(
          `${API_URL}/classes/FollowNotification?where=${encodeURIComponent(JSON.stringify({
            followerId: myId,
            followedId: userAuth0Id,
          }))}&limit=1`,
          { method: 'GET', headers: HEADERS }
        );
        const notifData = await notifRes.json();
        if (notifData.results[0]) {
          await fetch(`${API_URL}/classes/FollowNotification/${notifData.results[0].objectId}`, {
            method: 'DELETE',
            headers: HEADERS,
          });
        }

        setFollowersCount(p => p - 1);
        setFollowing(false);
        setFollowObjectId(null);
      } else {
        // === FOLLOW ===
        const followRes = await fetch(`${API_URL}/classes/Follow`, {
          method: 'POST', headers: HEADERS,
          body: JSON.stringify({ followerId: myId, followingId: userAuth0Id }),
        });
        const newFollow = await followRes.json();

        await fetch(`${API_URL}/classes/UserProfile/${myObjectId}`, {
          method: 'PUT', headers: HEADERS,
          body: JSON.stringify({ followingCount: { __op: 'Increment', amount: 1 } }),
        });
        await fetch(`${API_URL}/classes/UserProfile/${objectId}`, {
          method: 'PUT', headers: HEADERS,
          body: JSON.stringify({ followersCount: { __op: 'Increment', amount: 1 } }),
        });

        // === CREATE NOTIFICATION ===
        const followerProfile = await queryUserByAuth0Id(myId);
        await fetch(`${API_URL}/classes/FollowNotification`, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify({
            followerId: myId,
            followedId: userAuth0Id,
            followerProfile: { __type: 'Pointer', className: 'UserProfile', objectId: followerProfile.objectId },
          }),
        });

        setFollowersCount(p => p + 1);
        setFollowing(true);
        setFollowObjectId(newFollow.objectId);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to follow/unfollow');
    } finally {
      setLoadingFollow(false);
    }
  };

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

        {/* Follow Stats */}
        <View style={styles.followStats}>
          <TouchableOpacity
            style={styles.followStatBtn}
            onPress={() => {
              // TODO: Navigate to Followers list screen
              Alert.alert('Coming Soon', 'View followers list');
            }}
          >
            <Text style={[styles.followStatText, { color: colors.text }]}>Followers</Text>
            <Text style={[styles.followStatCount, { color: colors.text }]}>{followersCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.followStatBtn}
            onPress={() => {
              // TODO: Navigate to Following list screen
              Alert.alert('Coming Soon', 'View following list');
            }}
          >
            <Text style={[styles.followStatText, { color: colors.text }]}>Following</Text>
            <Text style={[styles.followStatCount, { color: colors.text }]}>{followingCount}</Text>
          </TouchableOpacity>
        </View>

        {/* Buttons */}
        <View style={styles.buttonsContainer}>
          {!isMyProfile && (
            <TouchableOpacity
              style={[styles.followBtn, { backgroundColor: following ? colors.accent: colors.primary }]}
              onPress={handleFollow}
              disabled={loadingFollow}
            >
              <Ionicons name={following ? 'person-remove-outline' : 'person-add-outline'} size={20} color="#fff" />
              <Text style={styles.followBtnText}>{following ? 'Unfollow' : 'Follow'}</Text>
            </TouchableOpacity>
          )}

          {/* MESSAGE BUTTON */}
          <TouchableOpacity
            style={[styles.messageBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (userAuth0Id) {
                navigation.navigate('Chat', {
                  receiverId: userAuth0Id,
                  receiverName: username,
                  receiverPic: profilePicUrl || undefined,
                });
              }
            }}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#fff" />
            <Text style={styles.messageBtnText}>Message</Text>
          </TouchableOpacity>
        </View>

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
    position: 'absolute',
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
  } as ImageStyle,
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
  followStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  followStatBtn: {
    alignItems: 'center',
    padding: 10,
  },
  followStatText: {
    fontSize: 16,
    fontWeight: '600',
  },
  followStatCount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 20,
    gap: 16,
  },
  followBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 25,
    gap: 8,
  },
  followBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  messageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 25,
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