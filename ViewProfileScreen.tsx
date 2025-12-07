// ViewProfileScreen.tsx - NOW WITH YOUR POSTS GRID + FULLSCREEN MODAL!
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
  FlatList,
  Dimensions,
  Modal,
} from 'react-native';
import { useRoute, useNavigation, RouteProp, NavigationProp } from '@react-navigation/native';
import EncryptedStorage from 'react-native-encrypted-storage';
import { jwtDecode } from 'jwt-decode';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { RootStackParamList } from './types/navigation';
import { useTheme } from './ThemeContext';

interface Auth0IdToken {
  sub: string;
  name: string;
  picture: string;
  email: string;
  email_verified: boolean;
}

type HomeRouteProp = RouteProp<RootStackParamList, 'Home'>;
type ViewProfileNavProp = NavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');
const numColumns = 3;
const itemWidth = (width - 40 - (numColumns - 1) * 10) / numColumns; // 40 padding, 10 gap

export default function ViewProfileScreen() {
  const route = useRoute<HomeRouteProp>();
  const navigation = useNavigation<ViewProfileNavProp>();
  const { colors } = useTheme();

  const [username, setUsername] = useState('Loading...');
  const [bio, setBio] = useState('');
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [height, setHeight] = useState<string | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // NEW: Posts state
  const [posts, setPosts] = useState<string[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  // NEW: Fullscreen modal state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const API_URL = 'https://nexi-server.onrender.com/parse';
  const APP_ID = 'myAppId';
  const MASTER_KEY = 'myMasterKey';

  const HEADERS = {
    'X-Parse-Application-Id': APP_ID,
    'X-Parse-Master-Key': MASTER_KEY,
    'Content-Type': 'application/json',
  };

  // Fetch UserProfile
  async function queryUser(auth0Id: string): Promise<any | null> {
    const where = { auth0Id };
    const whereStr = encodeURIComponent(JSON.stringify(where));
    const response = await fetch(
      `${API_URL}/classes/UserProfile?where=${whereStr}&limit=1`,
      { method: 'GET', headers: HEADERS }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.results?.[0] ?? null;
  }

  // NEW: Fetch user's posts
  async function fetchUserPosts(userParseObjectId: string) {
    try {
      const where = {
        user: {
          __type: 'Pointer',
          className: 'UserProfile',
          objectId: userParseObjectId,
        },
      };
      const whereStr = encodeURIComponent(JSON.stringify(where));
      const response = await fetch(
        `${API_URL}/classes/Post?where=${whereStr}&order=-createdAt&limit=50`,
        { method: 'GET', headers: HEADERS }
      );

      if (!response.ok) throw new Error('Failed to fetch posts');

      const data = await response.json();
      const imageUrls = data.results.flatMap((post: any) => post.imageUrls || []);
      setPosts(imageUrls);
    } catch (err) {
      console.error('Failed to load posts:', err);
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }

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
        setFollowersCount(userSnap.followersCount ?? 0);
        setFollowingCount(userSnap.followingCount ?? 0);

        // Fetch posts after getting user
        await fetchUserPosts(userSnap.objectId);
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

  useEffect(() => {
    const params = (route.params as any) ?? {};

    if (params?.userId) {
      setUserId(params.userId);
      setUsername(params.username ?? 'Loading...');
      setBio(params.bio ?? '');
      setProfilePicUrl(params.profilePicUrl ?? null);
      setHeight(params.height ?? null);
      setFollowersCount(params.followersCount ?? 0);
      setFollowingCount(params.followingCount ?? 0);
      setLoading(false);
      // If viewing someone else, don't show posts yet (you can add later)
    } else {
      setLoading(true);
      fetchProfile();
    }
  }, [route.params, fetchProfile]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  }, [fetchProfile]);

  // Auto-refresh when coming back from upload
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (userId) {
        // Re-fetch posts when returning to profile
        queryUser(userId).then(user => {
          if (user?.objectId) fetchUserPosts(user.objectId);
        });
      }
    });
    return unsubscribe;
  }, [navigation, userId]);

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

  const handleUploadPost = () => {
    if (!userId) return;
    navigation.navigate('UserUploadPost', { auth0Id: userId });
  };

  const handleSettings = () => navigation.navigate('Settings');
  const handleViewFollowers = () => {
    if (!userId) return;
    navigation.navigate('FollowingFollowers', { userAuth0Id: userId, type: 'followers' } as any);
  };
  const handleViewFollowing = () => {
    if (!userId) return;
    navigation.navigate('FollowingFollowers', { userAuth0Id: userId, type: 'following' } as any);
  };

  const ThemedButton = ({ title, onPress }: { title: string; onPress: () => void }) => (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: colors.accent }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.buttonText, { color: colors.buttonText }]}>{title}</Text>
    </TouchableOpacity>
  );

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
      <TouchableOpacity style={styles.settingsIcon} onPress={handleSettings}>
        <Ionicons name="settings-outline" size={28} color={colors.iconColor} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.iconColor]} />
        }
      >
        <Text style={[styles.title, { color: colors.text }]}>Your Profile</Text>

        {/* Avatar */}
        {profilePicUrl ? (
          <Image source={{ uri: profilePicUrl }} style={[styles.avatar, { borderColor: colors.border }]} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.placeholderBackground }]}>
            <Text style={[styles.placeholderText, { color: colors.placeholderText }]}>
              No Profile Picture
            </Text>
          </View>
        )}

        {/* Follow stats */}
        <View style={styles.followStats}>
          <TouchableOpacity style={styles.followStatBtn} onPress={handleViewFollowers}>
            <Text style={[styles.followStatText, { color: colors.text }]}>Followers</Text>
            <Text style={[styles.followStatCount, { color: colors.text }]}>{followersCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.followStatBtn} onPress={handleViewFollowing}>
            <Text style={[styles.followStatText, { color: colors.text }]}>Following</Text>
            <Text style={[styles.followStatCount, { color: colors.text }]}>{followingCount}</Text>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <Text style={[styles.info, { color: colors.text }]}>Username: {username}</Text>
        <Text style={[styles.info, { color: colors.text }]}>Bio: {bio || 'No bio set'}</Text>
        <Text style={[styles.info, { color: colors.text }]}>
          Height: {height ? `${height} cm` : 'Not set'}
        </Text>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <ThemedButton title="Edit Profile" onPress={handleEditProfile} />
          <ThemedButton title="Upload Post" onPress={handleUploadPost} />
        </View>

        {/* Posts Grid Title */}
        <Text style={[styles.postsTitle, { color: colors.text }]}>Your Posts</Text>

        {/* Posts Grid + Fullscreen Modal */}
        {postsLoading ? (
          <ActivityIndicator size="small" color={colors.iconColor} style={{ marginTop: 20 }} />
        ) : posts.length === 0 ? (
          <Text style={[styles.noPosts, { color: colors.secondaryText }]}>
            No posts yet. Upload your first one!
          </Text>
        ) : (
          <>
            <FlatList
              data={posts}
              numColumns={numColumns}
              keyExtractor={(_, index) => index.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setSelectedImage(item)}
                >
                  <Image source={{ uri: item }} style={styles.postImage} resizeMode="cover" />
                </TouchableOpacity>
              )}
              columnWrapperStyle={styles.row}
              scrollEnabled={false}
            />

            {/* Fullscreen Image Modal – super lightweight */}
            <Modal
              visible={!!selectedImage}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setSelectedImage(null)}
            >
              <View style={styles.modalBackdrop}>
                <TouchableOpacity
                  style={styles.modalCloseArea}
                  activeOpacity={1}
                  onPress={() => setSelectedImage(null)}
                />
                <Image
                  source={{ uri: selectedImage! }}
                  style={styles.fullscreenImage}
                  resizeMode="contain"
                />
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setSelectedImage(null)}
                >
                  <Ionicons name="close" size={36} color="white" />
                </TouchableOpacity>
              </View>
            </Modal>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  containerWrapper: { flex: 1 },
  container: { alignItems: 'center', padding: 20, paddingTop: 60 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  info: { fontSize: 16, marginVertical: 5, textAlign: 'center' },
  postsTitle: { fontSize: 18, fontWeight: 'bold', alignSelf: 'flex-start', marginTop: 20, marginBottom: 10 },

  avatar: { width: 110, height: 110, borderRadius: 55, marginVertical: 12, borderWidth: 2 },
  avatarPlaceholder: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center', marginVertical: 12 },
  placeholderText: { fontSize: 13 },

  followStats: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginVertical: 16 },
  followStatBtn: { alignItems: 'center', padding: 8 },
  followStatText: { fontSize: 15, fontWeight: '600' },
  followStatCount: { fontSize: 18, fontWeight: 'bold' },

  buttonContainer: { marginVertical: 12, width: '100%', gap: 10 },
  button: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, alignItems: 'center', minHeight: 44 },
  buttonText: { fontSize: 16, fontWeight: '600' },

  postImage: {
    width: itemWidth,
    height: itemWidth,
    borderRadius: 8,
    margin: 2,
  },
  row: { justifyContent: 'space-between' },
  noPosts: { fontSize: 16, textAlign: 'center', marginTop: 30, fontStyle: 'italic' },

  settingsIcon: { position: 'absolute', top: 20, right: 10, zIndex: 1, padding: 10 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // NEW: Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  modalCloseArea: {
    ...StyleSheet.absoluteFillObject,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 25,
    padding: 8,
  },
});