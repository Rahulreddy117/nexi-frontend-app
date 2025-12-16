// ViewProfileScreen.tsx - COMPLETELY NEW UI DESIGN (Instagram/TikTok Style)
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
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp, NavigationProp } from '@react-navigation/native';
import EncryptedStorage from 'react-native-encrypted-storage';
import { jwtDecode } from 'jwt-decode';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import type { RootStackParamList } from './types/navigation';
import { useTheme } from './ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

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
const itemWidth = (width - wp('8%') - (numColumns - 1) * scale(6)) / numColumns;

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
  const [posts, setPosts] = useState<string[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);

  const API_URL = 'https://nexi-server.onrender.com/parse';
  const APP_ID = 'myAppId';
  const MASTER_KEY = 'myMasterKey';

  const HEADERS = {
    'X-Parse-Application-Id': APP_ID,
    'X-Parse-Master-Key': MASTER_KEY,
    'Content-Type': 'application/json',
  };

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
    } else {
      setLoading(true);
      fetchProfile();
    }
  }, [route.params, fetchProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  }, [fetchProfile]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (userId) {
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

  const handleDeleteImage = async () => {
    if (!selectedImage || deletingImage) return;
    
    Alert.alert(
      'Delete Image',
      'Are you sure you want to delete this image?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingImage(true);
            try {
              const userSnap = await queryUser(userId!);
              if (!userSnap) throw new Error('User not found');

              const where = {
                user: {
                  __type: 'Pointer',
                  className: 'UserProfile',
                  objectId: userSnap.objectId,
                },
              };
              const whereStr = encodeURIComponent(JSON.stringify(where));
              const response = await fetch(
                `${API_URL}/classes/Post?where=${whereStr}`,
                { method: 'GET', headers: HEADERS }
              );

              if (!response.ok) throw new Error('Failed to fetch posts');

              const data = await response.json();
              
              const postWithImage = data.results.find((post: any) => 
                post.imageUrls?.includes(selectedImage)
              );

              if (postWithImage) {
                const updatedImageUrls = postWithImage.imageUrls.filter(
                  (url: string) => url !== selectedImage
                );

                if (updatedImageUrls.length === 0) {
                  const deleteResponse = await fetch(
                    `${API_URL}/classes/Post/${postWithImage.objectId}`,
                    { method: 'DELETE', headers: HEADERS }
                  );
                  
                  if (!deleteResponse.ok) throw new Error('Failed to delete post');
                } else {
                  const updateResponse = await fetch(
                    `${API_URL}/classes/Post/${postWithImage.objectId}`,
                    {
                      method: 'PUT',
                      headers: HEADERS,
                      body: JSON.stringify({ imageUrls: updatedImageUrls }),
                    }
                  );
                  
                  if (!updateResponse.ok) throw new Error('Failed to update post');
                }

                setPosts(prev => prev.filter(url => url !== selectedImage));
                setSelectedImage(null);
                setShowDeleteMenu(false);
              }
            } catch (error) {
              console.error('Failed to delete image:', error);
              Alert.alert('Error', 'Failed to delete image. Please try again.');
            } finally {
              setDeletingImage(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.loading, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={colors.iconColor} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.containerWrapper, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Top Bar with Username and Settings */}
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <Text style={[styles.topUsername, { color: colors.text }]} numberOfLines={1}>
          {username}
        </Text>
        <TouchableOpacity onPress={handleSettings} activeOpacity={0.7}>
          <Ionicons name="settings-outline" size={moderateScale(26)} color={colors.iconColor} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.iconColor]} progressBackgroundColor="#000"/>
        }
      >
        {/* Profile Info Section - Horizontal Layout */}
        <View style={styles.profileInfoSection}>
          {/* Left: Avatar */}
          <View style={styles.avatarContainer}>
            {profilePicUrl ? (
              <Image source={{ uri: profilePicUrl }} style={[styles.avatar, { borderColor: colors.border }]} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.placeholderBackground }]}>
                <Ionicons name="person" size={moderateScale(50)} color={colors.placeholderText} />
              </View>
            )}
          </View>

          {/* Right: Stats (Vertical) */}
          <View style={styles.statsContainer}>
            <TouchableOpacity style={styles.statBox} onPress={handleViewFollowing} activeOpacity={0.7}>
              <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Following</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{followingCount > 999 ? `${(followingCount / 1000).toFixed(1)}k` : followingCount}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.statBox} onPress={handleViewFollowers} activeOpacity={0.7}>
              <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Followers</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{followersCount > 999 ? `${(followersCount / 1000).toFixed(1)}k` : followersCount}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.bioSection}>
          <Text style={[styles.bioTitle, { color: colors.text }]}>Bio</Text>
          <Text style={[styles.bioText, { color: colors.secondaryText }]}>
            {bio || 'No bio added yet'}
          </Text>
          {height && (
            <View style={styles.heightContainer}>
              <Ionicons name="resize-outline" size={moderateScale(14)} color={colors.secondaryText} />
              <Text style={[styles.heightText, { color: colors.secondaryText }]}>
                {height} cm
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons - Side by Side */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: colors.accent }]}
            onPress={handleEditProfile}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={moderateScale(18)} color={colors.buttonText} />
            <Text style={[styles.editButtonText, { color: colors.buttonText }]}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.uploadButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleUploadPost}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={moderateScale(18)} color={colors.iconColor} />
            <Text style={[styles.uploadButtonText, { color: colors.text }]}>Upload</Text>
          </TouchableOpacity>
        </View>

        {/* Posts Grid */}
        <View style={styles.postsSection}>
          {postsLoading ? (
            <ActivityIndicator size="small" color={colors.iconColor} style={{ marginTop: hp('3%') }} />
          ) : posts.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconContainer, { backgroundColor: colors.card }]}>
                <Ionicons name="images-outline" size={moderateScale(56)} color={colors.secondaryText} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No posts yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>
                Share your first moment
              </Text>
            </View>
          ) : (
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
          )}
        </View>

        {/* Fullscreen Image Modal */}
        <Modal
          visible={!!selectedImage}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setSelectedImage(null);
            setShowDeleteMenu(false);
          }}
        >
          <View style={styles.modalBackdrop}>
            <TouchableOpacity
              style={styles.modalCloseArea}
              activeOpacity={1}
              onPress={() => {
                setSelectedImage(null);
                setShowDeleteMenu(false);
              }}
            />
            <Image
              source={{ uri: selectedImage! }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
            
            {/* Close Button - Left Side */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setSelectedImage(null);
                setShowDeleteMenu(false);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={moderateScale(32)} color="white" />
            </TouchableOpacity>

            {/* Menu Button - Right Side */}
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => setShowDeleteMenu(!showDeleteMenu)}
              activeOpacity={0.8}
            >
              <Ionicons name="ellipsis-vertical" size={moderateScale(24)} color="white" />
            </TouchableOpacity>

            {/* Delete Menu */}
            {showDeleteMenu && (
              <View style={styles.deleteMenu}>
                <TouchableOpacity
                  style={styles.deleteMenuItem}
                  onPress={handleDeleteImage}
                  activeOpacity={0.7}
                  disabled={deletingImage}
                >
                  {deletingImage ? (
                    <ActivityIndicator size="small" color="#ff3b30" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={moderateScale(24)} color="#ff3b30" />
                      <Text style={styles.deleteMenuText}>Delete</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  containerWrapper: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: hp('3%'),
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingTop: hp('1.8%'),
    paddingBottom: hp('1.5%'),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topUsername: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    flex: 1,
    letterSpacing: 0.3,
  },

  // Profile Info Section (Horizontal)
  profileInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('5%'),
    paddingTop: hp('2.5%'),
    gap: wp('6%'),
  },
  avatarContainer: {
    alignItems: 'center',
  },
  avatar: {
    width: moderateScale(100),
    height: moderateScale(100),
    borderRadius: moderateScale(50),
    borderWidth: 2,
  },
  avatarPlaceholder: {
    width: moderateScale(100),
    height: moderateScale(100),
    borderRadius: moderateScale(50),
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Stats Container (Vertical Pills)
  statsContainer: {
    flex: 1,
    gap: hp('1.5%'),
  },
  statBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.2%'),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  statLabel: {
    fontSize: moderateScale(14),
    fontWeight: '500',
  },
  statValue: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Bio Section
  bioSection: {
    paddingHorizontal: wp('5%'),
    paddingTop: hp('2.5%'),
  },
  bioTitle: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    marginBottom: hp('0.8%'),
  },
  bioText: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
  },
  heightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    marginTop: hp('1%'),
  },
  heightText: {
    fontSize: moderateScale(13),
    fontWeight: '500',
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: wp('5%'),
    paddingTop: hp('2.5%'),
    gap: wp('3%'),
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.4%'),
    borderRadius: moderateScale(10),
    gap: wp('2%'),
  },
  editButtonText: {
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.4%'),
    borderRadius: moderateScale(10),
    borderWidth: 1.5,
    gap: wp('2%'),
  },
  uploadButtonText: {
    fontSize: moderateScale(15),
    fontWeight: '700',
  },

  // Posts Section
  postsSection: {
    marginTop: hp('3%'),
    paddingHorizontal: wp('4%'),
  },
  postImage: {
    width: itemWidth,
    height: itemWidth,
    borderRadius: moderateScale(6),
    margin: scale(3),
  },
  row: {
    justifyContent: 'flex-start',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: hp('8%'),
    paddingHorizontal: wp('10%'),
  },
  emptyIconContainer: {
    width: moderateScale(120),
    height: moderateScale(120),
    borderRadius: moderateScale(60),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  emptyTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    marginBottom: hp('0.8%'),
  },
  emptySubtitle: {
    fontSize: moderateScale(15),
    textAlign: 'center',
  },

  // Loading
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: hp('1.5%'),
  },
  loadingText: {
    fontSize: moderateScale(15),
    fontWeight: '500',
  },

  // Modal
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
    top: hp('5%'),
    left: wp('5%'),
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: moderateScale(24),
    padding: scale(10),
  },
  menuButton: {
    position: 'absolute',
    top: hp('5%'),
    right: wp('5%'),
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: moderateScale(24),
    padding: scale(10),
  },
  deleteMenu: {
    position: 'absolute',
    top: hp('12%'),
    right: wp('5%'),
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderRadius: moderateScale(12),
    paddingVertical: scale(8),
    paddingHorizontal: scale(12),
    minWidth: scale(140),
    zIndex: 2,
  },
  deleteMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    paddingVertical: scale(10),
  },
  deleteMenuText: {
    color: '#ff3b30',
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
});