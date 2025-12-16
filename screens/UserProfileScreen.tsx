// screens/UserProfileScreen.tsx - PROFESSIONAL RESPONSIVE UI WITH REPORT
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  FlatList,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import type { RootStackParamList } from '../types/navigation';
import { useTheme } from '../ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReportScreen from '../rooms/ReportScreen'; // Import ReportScreen

type UserProfileRouteProp = RouteProp<RootStackParamList, 'UserProfile'>;

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

const HEADERS = {
  'X-Parse-Application-Id': APP_ID,
  'X-Parse-Master-Key': MASTER_KEY,
  'Content-Type': 'application/json',
};

const { width } = Dimensions.get('window');
const numColumns = 3;
const itemWidth = (width - wp('8%') - (numColumns - 1) * scale(6)) / numColumns;

async function queryUserByAuth0Id(auth0Id: string): Promise<any | null> {
  const where = { auth0Id };
  const whereStr = encodeURIComponent(JSON.stringify(where));
  const res = await fetch(`${API_URL}/classes/UserProfile?where=${whereStr}&limit=1`, {
    method: 'GET',
    headers: HEADERS,
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] ?? null;
}

async function queryUserByObjectId(objectId: string): Promise<any | null> {
  const res = await fetch(`${API_URL}/classes/UserProfile/${objectId}`, {
    method: 'GET',
    headers: HEADERS,
  });
  if (!res.ok) return null;
  return await res.json();
}

async function isFollowing(myId: string, otherId: string): Promise<any | null> {
  const where = { followerId: myId, followingId: otherId };
  const whereStr = encodeURIComponent(JSON.stringify(where));
  const res = await fetch(`${API_URL}/classes/Follow?where=${whereStr}&limit=1`, {
    method: 'GET',
    headers: HEADERS,
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] ?? null;
}

export default function UserProfileScreen() {
  const route = useRoute<UserProfileRouteProp>();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

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
  const [userAuth0Id, setUserAuth0Id] = useState<string | null>(initialUserId || null);
  const [myId, setMyId] = useState<string | null>(null);
  const [myObjectId, setMyObjectId] = useState<string | null>(null);
  const [isMyProfile, setIsMyProfile] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followObjectId, setFollowObjectId] = useState<string | null>(null);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [posts, setPosts] = useState<string[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Block system states
  const [myBlocked, setMyBlocked] = useState<string[]>([]);
  const [targetBlocked, setTargetBlocked] = useState<string[]>([]);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [loadingBlock, setLoadingBlock] = useState(false);

  // NEW: Report states
  const [reportModalVisible, setReportModalVisible] = useState(false);

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
    const loadMyFullData = async () => {
      if (!myObjectId) return;
      try {
        const res = await fetch(`${API_URL}/classes/UserProfile/${myObjectId}`, {
          method: 'GET',
          headers: HEADERS,
        });
        if (res.ok) {
          const data = await res.json();
          setMyBlocked(data.blocked || []);
        }
      } catch (err) {
        console.error('Failed to load my profile:', err);
      }
    };
    loadMyFullData();
  }, [myObjectId]);

  useEffect(() => {
    const fetchFullProfile = async () => {
      try {
        let userData: any = null;
        if (initialObjectId) {
          userData = await queryUserByObjectId(initialObjectId);
        } else if (initialUserId) {
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
          setUserAuth0Id(userData.auth0Id);
          setTargetBlocked(userData.blocked || []);
          await fetchUserPosts(userData.objectId);
        }
      } catch (err) {
        console.error('Failed to fetch full profile:', err);
      } finally {
        setLoading(false);
      }
    };
    if (initialObjectId || initialUserId) fetchFullProfile();
    else setLoading(false);
  }, [initialObjectId, initialUserId]);

  useEffect(() => {
    if (isMyProfile) {
      setIsBlocked(false);
      return;
    }

    if (!myId || !userAuth0Id) {
      setIsBlocked(false);
      return;
    }

    const iBlockedThem = myBlocked.includes(userAuth0Id);
    const theyBlockedMe = targetBlocked.includes(myId);

    setIsBlocked(iBlockedThem || theyBlockedMe);
  }, [isMyProfile, myId, userAuth0Id, myBlocked, targetBlocked]);

  useEffect(() => {
    if (myId && userAuth0Id && myId === userAuth0Id) {
      setIsMyProfile(true);
    } else if (myId && userAuth0Id && objectId) {
      isFollowing(myId, userAuth0Id).then(f => {
        setFollowing(!!f);
        setFollowObjectId(f?.objectId || null);
      });
    }
  }, [myId, userAuth0Id, objectId]);

  const handleBlock = async () => {
    if (!myObjectId || !userAuth0Id || loadingBlock) return;

    Alert.alert(
      'Block User',
      'Are you sure you want to block this user? You will no longer see their profile, posts, or messages.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setLoadingBlock(true);
            try {
              await fetch(`${API_URL}/classes/UserProfile/${myObjectId}`, {
                method: 'PUT',
                headers: HEADERS,
                body: JSON.stringify({
                  blocked: {
                    __op: 'AddUnique',
                    objects: [userAuth0Id],
                  },
                }),
              });

              const myRes = await fetch(`${API_URL}/classes/UserProfile/${myObjectId}`, {
                method: 'GET',
                headers: HEADERS,
              });
              if (myRes.ok) {
                const myData = await myRes.json();
                setMyBlocked(myData.blocked || []);
              }

              Alert.alert('Success', 'User blocked successfully.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to block user');
            } finally {
              setLoadingBlock(false);
            }
          },
        },
      ]
    );
  };

  // NEW: Handle Report
  const handleReport = () => {
    if (!myObjectId) {
      Alert.alert('Error', 'User profile not loaded');
      return;
    }
    setShowMenu(false);
    setReportModalVisible(true);
  };

  const handleReportClose = () => {
    setReportModalVisible(false);
  };

  const handleFollow = async () => {
    if (!myId || !myObjectId || !objectId || !userAuth0Id || loadingFollow) return;
    setLoadingFollow(true);
    try {
      if (following) {
        if (followObjectId) {
          await fetch(`${API_URL}/classes/Follow/${followObjectId}`, { method: 'DELETE', headers: HEADERS });
        }
        await fetch(`${API_URL}/classes/UserProfile/${myObjectId}`, {
          method: 'PUT', headers: HEADERS,
          body: JSON.stringify({ followingCount: { __op: 'Increment', amount: -1 } }),
        });
        await fetch(`${API_URL}/classes/UserProfile/${objectId}`, {
          method: 'PUT', headers: HEADERS,
          body: JSON.stringify({ followersCount: { __op: 'Increment', amount: -1 } }),
        });
        const notifRes = await fetch(
          `${API_URL}/classes/FollowNotification?where=${encodeURIComponent(JSON.stringify({
            followerId: myId,
            followedId: userAuth0Id,
          }))}`,
          { headers: HEADERS }
        );
        const notifs = await notifRes.json();
        for (const n of notifs.results) {
          await fetch(`${API_URL}/classes/FollowNotification/${n.objectId}`, { method: 'DELETE', headers: HEADERS });
        }
        setFollowersCount(p => p - 1);
        setFollowing(false);
        setFollowObjectId(null);
      } else {
        const followRes = await fetch(`${API_URL}/classes/Follow`, {
          method: 'POST',
          headers: HEADERS,
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
        const followerProfile = await queryUserByAuth0Id(myId);
        await fetch(`${API_URL}/classes/FollowNotification`, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify({
            followerId: myId,
            followedId: userAuth0Id,
            followerProfile: {
              __type: 'Pointer',
              className: 'UserProfile',
              objectId: followerProfile.objectId,
            },
            read: false,
          }),
        });
        setFollowersCount(p => p + 1);
        setFollowing(true);
        setFollowObjectId(newFollow.objectId);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to follow/unfollow');
    } finally {
      setLoadingFollow(false);
    }
  };

  const handleMessage = () => {
    if (!myId || !userAuth0Id) return;
    if (myBlocked.includes(userAuth0Id) || targetBlocked.includes(myId)) {
      Alert.alert('Blocked', 'You cannot message this user as one of you has blocked the other.');
      return;
    }
    navigation.navigate('Chat', {
      receiverId: userAuth0Id,
      receiverName: username,
      receiverPic: profilePicUrl || undefined,
    });
  };

  const handleViewFollowers = () => {
    if (!userAuth0Id) return;
    navigation.navigate('FollowingFollowers', { userAuth0Id, type: 'followers' });
  };

  const handleViewFollowing = () => {
    if (!userAuth0Id) return;
    navigation.navigate('FollowingFollowers', { userAuth0Id, type: 'following' });
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.loading, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.iconColor} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isBlocked) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['left', 'right', 'bottom']}>
        <View style={styles.containerWrapper}>
          <View style={styles.blockedContainer}>
            <Ionicons name="person-remove-outline" size={moderateScale(80)} color={colors.secondaryText} />
            <Text style={[styles.blockedTitle, { color: colors.text }]}>User not found</Text>
            <Text style={[styles.blockedSubtitle, { color: colors.secondaryText }]}>
              This profile is not available.
            </Text>
            <TouchableOpacity
              style={[styles.goBackButton, { backgroundColor: colors.accent }]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Text style={styles.goBackButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['left', 'right', 'bottom']}>
      <View style={styles.containerWrapper}>
        {/* Top Bar */}
        <View style={[
          styles.topBar, 
          { 
            backgroundColor: colors.background, 
            borderBottomColor: colors.border,
            paddingTop: insets.top + hp('0%'),
          }
        ]}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={moderateScale(28)} color={colors.iconColor} />
          </TouchableOpacity>
          <View style={styles.usernameContainer}>
            <Text style={[styles.topUsername, { color: colors.text }]} numberOfLines={1}>
              {username}
            </Text>
          </View>
          {!isMyProfile && (
            <TouchableOpacity
              onPress={() => setShowMenu(true)}
              activeOpacity={0.7}
              style={styles.menuBtn}
            >
              <Ionicons name="ellipsis-vertical" size={moderateScale(24)} color={colors.iconColor} />
            </TouchableOpacity>
          )}
          {isMyProfile && <View style={styles.placeholder} />}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Info Section */}
          <View style={styles.profileInfoSection}>
            <View style={styles.avatarContainer}>
              {profilePicUrl ? (
                <Image source={{ uri: profilePicUrl }} style={[styles.avatar, { borderColor: colors.border }]} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.placeholderBackground }]}>
                  <Ionicons name="person" size={moderateScale(50)} color={colors.placeholderText} />
                </View>
              )}
            </View>
            <View style={styles.statsContainer}>
              <TouchableOpacity style={styles.statBox} onPress={handleViewFollowing} activeOpacity={0.7}>
                <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Following</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {followingCount > 999 ? `${(followingCount / 1000).toFixed(1)}k` : followingCount}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statBox} onPress={handleViewFollowers} activeOpacity={0.7}>
                <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Followers</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {followersCount > 999 ? `${(followersCount / 1000).toFixed(1)}k` : followersCount}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bio Section */}
          <View style={styles.bioSection}>
            <Text style={[styles.bioTitle, { color: colors.text }]}>Bio</Text>
            <Text style={[styles.bioText, { color: colors.secondaryText }]}>
              {bio || 'No bio available'}
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

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {!isMyProfile && (
              <TouchableOpacity
                style={[
                  styles.followButton,
                  { backgroundColor: following ? colors.card : colors.accent },
                  following && { borderWidth: 1.5, borderColor: colors.border }
                ]}
                onPress={handleFollow}
                disabled={loadingFollow}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={following ? 'person-remove-outline' : 'person-add-outline'}
                  size={moderateScale(18)}
                  color={following ? colors.text : colors.buttonText}
                />
                <Text style={[
                  styles.followButtonText,
                  { color: following ? colors.text : colors.buttonText }
                ]}>
                  {following ? 'Unfollow' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.messageButton,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  flex: isMyProfile ? 1 : 0.48
                }
              ]}
              onPress={handleMessage}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-outline" size={moderateScale(18)} color={colors.iconColor} />
              <Text style={[styles.messageButtonText, { color: colors.text }]}>Message</Text>
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
                  Nothing to see here
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
        </ScrollView>

        {/* Fullscreen Image Modal */}
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
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={moderateScale(32)} color="white" />
            </TouchableOpacity>
          </View>
        </Modal>

        {/* Menu Modal */}
        {!isMyProfile && (
          <Modal
            visible={showMenu}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowMenu(false)}
          >
            <TouchableOpacity
              style={styles.menuBackdrop}
              activeOpacity={1}
              onPress={() => setShowMenu(false)}
            />
            <View style={[styles.menuContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleBlock}
                disabled={loadingBlock}
                activeOpacity={0.7}
              >
                <Ionicons name="person-remove-outline" size={moderateScale(20)} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.primary }]}>Block</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleReport}
                activeOpacity={0.7}
              >
                <Ionicons name="flag-outline" size={moderateScale(20)} color={colors.iconColor} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>Report</Text>
              </TouchableOpacity>
            </View>
          </Modal>
        )}

        {/* NEW: Report Screen Modal */}
        {myObjectId && userAuth0Id && objectId && (
          <ReportScreen
            visible={reportModalVisible}
            onClose={handleReportClose}
            type="userprofile"
            reporterObjectId={myObjectId}
            targetUserAuth0Id={userAuth0Id}
            targetUserObjectId={objectId}
            targetUsername={username}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  containerWrapper: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: hp('4%'),
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingBottom: hp('1.8%'),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    padding: scale(6),
  },
  usernameContainer: {
    flex: 1,
    marginLeft: wp('2%'),
    marginRight: wp('2%'),
    alignItems: 'center',
  },
  topUsername: {
    fontSize: moderateScale(19),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  menuBtn: {
    padding: scale(8),
  },
  placeholder: {
    width: moderateScale(40),
  },
  blockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp('10%'),
    gap: hp('2%'),
  },
  blockedTitle: {
    fontSize: moderateScale(24),
    fontWeight: '700',
    textAlign: 'center',
  },
  blockedSubtitle: {
    fontSize: moderateScale(16),
    textAlign: 'center',
    lineHeight: moderateScale(22),
  },
  goBackButton: {
    paddingHorizontal: wp('8%'),
    paddingVertical: hp('1.5%'),
    borderRadius: moderateScale(10),
    marginTop: hp('2%'),
  },
  goBackButtonText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: 'white',
  },
  profileInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('5%'),
    paddingTop: hp('3%'),
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
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: wp('5%'),
    paddingTop: hp('2.5%'),
    gap: wp('3%'),
  },
  followButton: {
    flex: 0.48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.4%'),
    borderRadius: moderateScale(10),
    gap: wp('2%'),
  },
  followButtonText: {
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  messageButton: {
    flex: 0.48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.4%'),
    borderRadius: moderateScale(10),
    borderWidth: 1.5,
    gap: wp('2%'),
  },
  messageButtonText: {
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
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
    right: wp('5%'),
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: moderateScale(24),
    padding: scale(10),
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuContainer: {
    position: 'absolute',
    top: hp('6%'),
    right: wp('4%'),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('6%'),
    paddingVertical: hp('2%'),
    gap: wp('3%'),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuItemText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
});