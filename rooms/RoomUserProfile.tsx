// rooms/RoomUserProfile.tsx — Responsive UI with Image Carousel
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import EncryptedStorage from 'react-native-encrypted-storage';
import { jwtDecode } from 'jwt-decode';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { io, Socket } from 'socket.io-client';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import type { RootStackParamList } from '../types/navigation';
import { useTheme } from '../ThemeContext';
import ReportScreen from './ReportScreen'; // Import the new ReportScreen component

const API_URL = 'https://nexi-server.onrender.com/parse';
const SOCKET_URL = 'https://nexi-server.onrender.com';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RoomUserProfileRouteProp = RouteProp<RootStackParamList, 'RoomUserProfile'>;

interface RouteParams {
  roomId: string;
  roomName: string;
}

interface Post {
  objectId: string;
  text?: string;
  imageUrls: string[];
  user: {
    objectId: string;
    username: string;
    profilePicUrl?: string;
    auth0Id: string;
  };
  createdAt: string;
}

// Image Carousel Component
const ImageCarousel = React.memo(({ images }: { images: string[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const isMountedRef = useRef(true);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      <Image
        key={`single-img-${images[0]}`}
        source={{ uri: images[0] }}
        style={styles.singleImage}
        resizeMode="cover"
      />
    );
  }

  return (
    <View key={`carousel-${images.length}`} style={styles.carouselContainer}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          if (isMountedRef.current) {
            const index = Math.round(event.nativeEvent.contentOffset.x / wp('86%'));
            setCurrentIndex(index);
          }
        }}
        style={styles.carouselScroll}
        removeClippedSubviews={false}
        scrollEventThrottle={16}
      >
        {images.map((url, index) => (
          <Image
            key={`carousel-img-${url || index}`}
            source={{ uri: url }}
            style={styles.carouselImage}
            resizeMode="cover"
          />
        ))}
      </ScrollView>
      <View style={styles.paginationContainer}>
        {images.map((_, index) => (
          <View
            key={`dot-${index}`}
            style={[
              styles.paginationDot,
              currentIndex === index && styles.paginationDotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
});

export default function RoomUserProfile({ navigation, route }: { navigation: NavigationProp; route: RoomUserProfileRouteProp }) {
  const { colors } = useTheme();
  const { roomId, roomName } = route.params as RouteParams;
  const isMountedRef = useRef(true);

  const [isCreator, setIsCreator] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentAuth0Id, setCurrentAuth0Id] = useState<string | null>(null);
  const [myParseObjectId, setMyParseObjectId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Report modal states
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportingType, setReportingType] = useState<'post' | 'room' | null>(null);
  const [selectedReportingPost, setSelectedReportingPost] = useState<Post | undefined>(undefined);

  useEffect(() => {
    isMountedRef.current = true;
    // Reset state when roomId changes
    setPosts([]);
    setLoading(true);
    setHasMore(true);
    setLoadingMore(false);
    setShowMenu(false);
    setSelectedPost(null);
    // Reset report states
    setReportModalVisible(false);
    setReportingType(null);
    setSelectedReportingPost(undefined);

    return () => {
      isMountedRef.current = false;
      // Cleanup socket
      if (socket) {
        socket.disconnect();
        socket.removeAllListeners();
      }
    };
  }, [roomId]);

  useEffect(() => {
    const getUserInfo = async () => {
      const token = await EncryptedStorage.getItem('idToken');
      if (token) {
        const decoded: any = jwtDecode(token);
        if (isMountedRef.current) {
          setCurrentAuth0Id(decoded.sub);
        }
      }
      const parseId = await AsyncStorage.getItem('parseObjectId');
      if (isMountedRef.current) {
        setMyParseObjectId(parseId);
      }
    };
    getUserInfo();
  }, []);

  useEffect(() => {
    if (!currentAuth0Id || !roomId || !isMountedRef.current) return;

    // Cleanup old socket first
    if (socket) {
      socket.disconnect();
      socket.removeAllListeners();
    }

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      if (isMountedRef.current) {
        console.log('Socket connected for room');
      }
    });

    const handleMemberUpdate = (data: { roomId: string; count: number }) => {
      if (data.roomId === roomId && isMountedRef.current) {
        setMemberCount(data.count);
      }
    };

    newSocket.on('roomMemberUpdated', handleMemberUpdate);
    newSocket.on('sendError', (err) => console.error('Socket error:', err));

    if (isMountedRef.current) {
      setSocket(newSocket);
    }

    return () => {
      if (newSocket) {
        newSocket.off('roomMemberUpdated', handleMemberUpdate);
        newSocket.disconnect();
        newSocket.removeAllListeners();
      }
    };
  }, [currentAuth0Id, roomId]);

  const getMemberCount = async (): Promise<number> => {
    try {
      const whereStr = encodeURIComponent(JSON.stringify({
        room: { __type: 'Pointer', className: 'Room', objectId: roomId },
      }));
      const res = await fetch(
        `${API_URL}/classes/RoomMember?where=${whereStr}&count=1&limit=0`,
        { headers: { 'X-Parse-Application-Id': APP_ID, 'X-Parse-Master-Key': MASTER_KEY } }
      );
      const data = await res.json();
      return data.count || 0;
    } catch (err) {
      console.error('Fetch member count error:', err);
      return 0;
    }
  };

  useEffect(() => {
    if (!roomId || !myParseObjectId || !currentAuth0Id) return;
    if (!isMountedRef.current) return;

    let cancelled = false;

    const loadEverything = async () => {
      if (cancelled || !isMountedRef.current) return;

      try {
        const roomRes = await fetch(`${API_URL}/classes/Room/${roomId}`, { headers: { 'X-Parse-Application-Id': APP_ID, 'X-Parse-Master-Key': MASTER_KEY } });
        if (cancelled || !isMountedRef.current) return;

        const room = await roomRes.json();
        const creatorRes = await fetch(`${API_URL}/classes/UserProfile/${room.creator.objectId}`, { headers: { 'X-Parse-Application-Id': APP_ID, 'X-Parse-Master-Key': MASTER_KEY } });
        if (cancelled || !isMountedRef.current) return;

        const creator = await creatorRes.json();

        if (isMountedRef.current && !cancelled) {
          setIsCreator(creator.auth0Id === currentAuth0Id);
        }

        const memberRes = await fetch(
          `${API_URL}/classes/RoomMember?where=${encodeURIComponent(JSON.stringify({
            room: { __type: 'Pointer', className: 'Room', objectId: roomId },
            user: { __type: 'Pointer', className: 'UserProfile', objectId: myParseObjectId },
          }))}`,
          { headers: { 'X-Parse-Application-Id': APP_ID, 'X-Parse-Master-Key': MASTER_KEY } }
        );
        if (cancelled || !isMountedRef.current) return;

        const memberData = await memberRes.json();

        if (isMountedRef.current && !cancelled) {
          setIsJoined(memberData.results.length > 0);
        }

        const count = await getMemberCount();
        if (isMountedRef.current && !cancelled) {
          setMemberCount(count);
        }

        if (!cancelled && isMountedRef.current) {
          await fetchPosts(0, 4);
        }
      } catch (err) {
        console.error(err);
        if (isMountedRef.current && !cancelled) {
          Alert.alert('Error', 'Failed to load room');
        }
      } finally {
        if (isMountedRef.current && !cancelled) {
          setLoading(false);
        }
      }
    };

    loadEverything();

    return () => {
      cancelled = true;
    };
  }, [roomId, myParseObjectId, currentAuth0Id]);

  const fetchPosts = async (skip = 0, limit = 4) => {
    if (!isMountedRef.current || !roomId) return;

    try {
      const res = await fetch(
        `${API_URL}/classes/RoomPost?where=${encodeURIComponent(JSON.stringify({
          room: { __type: 'Pointer', className: 'Room', objectId: roomId },
        }))}&include=user&order=-createdAt&limit=${limit}&skip=${skip}`,
        { headers: { 'X-Parse-Application-Id': APP_ID, 'X-Parse-Master-Key': MASTER_KEY } }
      );

      if (!isMountedRef.current) return;

      const data = await res.json();
      const newPosts = (data.results || []).map((p: any) => ({
        objectId: p.objectId,
        text: p.text,
        imageUrls: p.imageUrls || [],
        user: {
          objectId: p.user?.objectId || '',
          username: p.user?.username || 'Unknown',
          profilePicUrl: p.user?.profilePicUrl,
          auth0Id: p.user?.auth0Id || '',
        },
        createdAt: p.createdAt,
      }));

      if (isMountedRef.current) {
        if (skip === 0) {
          setPosts(newPosts);
        } else {
          setPosts((prev) => [...prev, ...newPosts]);
        }
        setHasMore(newPosts.length === limit);
      }
    } catch (err) {
      console.error('Fetch posts error:', err);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || !isMountedRef.current) return;
    if (isMountedRef.current) {
      setLoadingMore(true);
    }
    await fetchPosts(posts.length, 4);
    if (isMountedRef.current) {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!isMountedRef.current) return;

    const handleFocus = () => {
      if (!isMountedRef.current || !roomId) return;
      setHasMore(true);
      fetchPosts(0, 4);
      getMemberCount().then(count => {
        if (isMountedRef.current) {
          setMemberCount(count);
        }
      });
    };

    const unsubscribe = navigation.addListener('focus', handleFocus);

    return () => {
      unsubscribe();
    };
  }, [navigation, roomId]);

  const handleMorePress = (post: Post) => {
    setSelectedPost(post);
    setShowMenu(true);
  };

  const handleDelete = async (post: Post) => {
    if (!isMountedRef.current) return;
    try {
      await fetch(`${API_URL}/classes/RoomPost/${post.objectId}`, {
        method: 'DELETE',
        headers: { 'X-Parse-Application-Id': APP_ID, 'X-Parse-Master-Key': MASTER_KEY },
      });
      if (isMountedRef.current) {
        setPosts((prev) => prev.filter((p) => p.objectId !== post.objectId));
        setShowMenu(false);
        Alert.alert('Success', 'Post deleted');
      }
    } catch (err) {
      console.error(err);
      if (isMountedRef.current) {
        Alert.alert('Error', 'Failed to delete post');
      }
    }
  };

  const handleReport = (post: Post) => {
    if (!myParseObjectId) {
      Alert.alert('Error', 'User profile not loaded');
      return;
    }
    setReportingType('post');
    setSelectedReportingPost(post);
    setReportModalVisible(true);
    setShowMenu(false);
  };

  const handleReportRoom = () => {
  if (!myParseObjectId) {
    Alert.alert('Error', 'User profile not loaded');
    return;
  }

  if (isCreator) {
    Alert.alert('Cannot Report', 'You cannot report your own room.');
    setShowMenu(false);
    return;
  }

  setReportingType('room');
  setSelectedReportingPost(undefined);
  setReportModalVisible(true);
  setShowMenu(false);
};
  const handleReportClose = () => {
    setReportModalVisible(false);
    setReportingType(null);
    setSelectedReportingPost(undefined);
  };

  const handleJoin = async () => {
    if (!isMountedRef.current) return;
    try {
      await fetch(`${API_URL}/classes/RoomMember`, {
        method: 'POST',
        headers: { 'X-Parse-Application-Id': APP_ID, 'X-Parse-Master-Key': MASTER_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: { __type: 'Pointer', className: 'UserProfile', objectId: myParseObjectId },
          room: { __type: 'Pointer', className: 'Room', objectId: roomId },
        }),
      });
      if (isMountedRef.current) {
        setIsJoined(true);
        const newCount = await getMemberCount();
        setMemberCount(newCount);
        if (socket) {
          socket.emit('roomMemberUpdated', { roomId, count: newCount });
        }
        Alert.alert('Success', `Joined ${roomName}!`);
      }
    } catch (err) {
      if (isMountedRef.current) {
        Alert.alert('Error', 'Failed to join');
      }
    }
  };

  const handleUnjoin = async () => {
    Alert.alert(
      'Leave Room',
      `Are you sure you want to leave ${roomName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            if (!isMountedRef.current) return;
            try {
              const res = await fetch(
                `${API_URL}/classes/RoomMember?where=${encodeURIComponent(JSON.stringify({
                  room: { __type: 'Pointer', className: 'Room', objectId: roomId },
                  user: { __type: 'Pointer', className: 'UserProfile', objectId: myParseObjectId },
                }))}`,
                { headers: { 'X-Parse-Application-Id': APP_ID, 'X-Parse-Master-Key': MASTER_KEY } }
              );
              const data = await res.json();
              if (data.results.length > 0) {
                await fetch(`${API_URL}/classes/RoomMember/${data.results[0].objectId}`, {
                  method: 'DELETE',
                  headers: { 'X-Parse-Application-Id': APP_ID, 'X-Parse-Master-Key': MASTER_KEY },
                });
              }
              if (isMountedRef.current) {
                setIsJoined(false);
                const newCount = await getMemberCount();
                setMemberCount(newCount);
                if (socket) {
                  socket.emit('roomMemberUpdated', { roomId, count: newCount });
                }
                Alert.alert('Left', `You have left ${roomName}`);
              }
            } catch (err) {
              if (isMountedRef.current) {
                Alert.alert('Error', 'Failed to leave room');
              }
            }
          },
        },
      ]
    );
  };

  const handleUserProfilePress = (user: Post['user']) => {
    if (!user.auth0Id) return;
    navigation.navigate('UserProfile', {
      userId: user.auth0Id,
      username: user.username,
      profilePicUrl: user.profilePicUrl,
    });
  };

  const canPost = isCreator || isJoined;

  if (loading) {
    return (
      <SafeAreaView key={`loading-${roomId}`} style={{ flex: 1, backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView key={`room-${roomId}`} style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View key={`container-${roomId}`} style={styles.container}>
        {/* Header */}
        <View key={`header-${roomId}`} style={[styles.header, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={moderateScale(24)} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.roomTitleContainer}>
            <Text style={[styles.roomTitle, { color: colors.text }]} numberOfLines={1}>
              {roomName}
            </Text>
            <View style={styles.memberCountContainer}>
              <Ionicons name="people-outline" size={moderateScale(14)} color={colors.text} />
              <Text style={[styles.memberCount, { color: colors.text }]}>{memberCount}</Text>
            </View>
          </View>

          {isCreator ? null : isJoined ? (
            <TouchableOpacity style={[styles.joinButton, styles.unjoinButton]} onPress={handleUnjoin}>
              <Text style={[styles.joinButtonText, { color: '#ff4444' }]}>Leave</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.joinButton, { backgroundColor: colors.primary }]} onPress={handleJoin}>
              <Text style={styles.joinButtonText}>Join</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Posts List */}
        <FlatList
          key={`room-posts-${roomId}`}
          data={posts}
          extraData={`${posts.length}-${roomId}`}
          renderItem={({ item }) => {
            if (!isMountedRef.current) return null;
            return (
              <View style={[styles.postContainer, { backgroundColor: colors.card }]}>
                <View style={styles.postHeader}>
                  <TouchableOpacity
                    style={styles.leftHeader}
                    onPress={() => handleUserProfilePress(item.user)}
                  >
                    <Image
                      source={{
                        uri: item.user.profilePicUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user.username)}&background=6366f1&color=fff`,
                      }}
                      style={styles.userAvatar}
                    />
                    <View style={styles.userInfo}>
                      <Text style={[styles.username, { color: colors.text }]}>{item.user.username}</Text>
                      <Text style={[styles.timestamp, { color: colors.secondaryText }]}>
                        {new Date(item.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.moreButton} onPress={() => handleMorePress(item)}>
                    <Ionicons name="ellipsis-vertical" size={moderateScale(20)} color={colors.text} />
                  </TouchableOpacity>
                </View>

                {item.text ? (
                  <Text style={[styles.postText, { color: colors.text }]}>{item.text}</Text>
                ) : null}

                {item.imageUrls.length > 0 && (
                  <ImageCarousel images={item.imageUrls} />
                )}
              </View>
            );
          }}
          keyExtractor={(item) => `post-${roomId}-${item.objectId || item.createdAt}`}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          removeClippedSubviews={false}
          maxToRenderPerBatch={2}
          windowSize={2}
          initialNumToRender={2}
          updateCellsBatchingPeriod={100}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.loadingMore} color={colors.primary} /> : null}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyFeed}>
                <Ionicons name="chatbubbles-outline" size={moderateScale(64)} color={colors.secondaryText} style={{ opacity: 0.3 }} />
                <Text style={[styles.emptyText, { color: colors.secondaryText }]}>No posts yet</Text>
                <Text style={[styles.emptySubtext, { color: colors.secondaryText }]}>Be the first to share something!</Text>
              </View>
            ) : null
          }
        />

        {/* FAB */}
        {canPost && (
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('RoomPostUpload', { roomId, roomName })}
          >
            <Ionicons name="add" size={moderateScale(28)} color="white" />
          </TouchableOpacity>
        )}
      </View>

      {/* Post Menu Modal */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuContainer, { backgroundColor: colors.card }]}>
            {selectedPost?.user.objectId === myParseObjectId && (
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                onPress={() => selectedPost && handleDelete(selectedPost)}
              >
                <Ionicons name="trash-outline" size={moderateScale(18)} color="#ff4444" style={styles.menuIcon} />
                <Text style={[styles.menuText, { color: '#ff4444' }]}>Delete</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.menuItem} onPress={() => selectedPost && handleReport(selectedPost)}>
              <Ionicons name="flag-outline" size={moderateScale(18)} color={colors.text} style={styles.menuIcon} />
              <Text style={[styles.menuText, { color: colors.text }]}>Report Post</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.menuItem, 
                { borderTopWidth: 1, borderTopColor: colors.border }
              ]} 
              onPress={handleReportRoom}
            >
              <Ionicons name="flag-outline" size={moderateScale(18)} color={colors.text} style={styles.menuIcon} />
              <Text style={[styles.menuText, { color: colors.text }]}>Report Room</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Screen Modal */}
      {myParseObjectId && reportingType && (
        <ReportScreen
          visible={reportModalVisible}
          onClose={handleReportClose}
          type={reportingType}
          post={selectedReportingPost}
          roomId={roomId}
          roomName={roomName}
          reporterObjectId={myParseObjectId}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: scale(4),
    marginRight: scale(8),
  },
  roomTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roomTitle: {
    fontSize: moderateScale(17),
    fontWeight: '600',
    flex: 1,
    marginRight: scale(8),
  },
  memberCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(12),
  },
  memberCount: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    marginLeft: scale(4),
  },
  joinButton: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(20),
    marginLeft: scale(8),
  },
  unjoinButton: {
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  joinButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: moderateScale(13),
  },
  postContainer: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    marginVertical: verticalScale(4),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(10),
  },
  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    marginRight: scale(10),
  },
  userInfo: { flex: 1 },
  username: {
    fontWeight: '600',
    fontSize: moderateScale(14),
    marginBottom: verticalScale(2),
  },
  timestamp: {
    fontSize: moderateScale(11),
    opacity: 0.6,
  },
  moreButton: {
    padding: scale(4),
  },
  postText: {
    fontSize: moderateScale(15),
    lineHeight: moderateScale(21),
    marginBottom: verticalScale(12),
  },
  singleImage: {
    width: wp('86%'),
    height: wp('86%'),
    borderRadius: moderateScale(12),
    alignSelf: 'center',
    marginTop: verticalScale(8),
  },
  carouselContainer: {
    marginTop: verticalScale(8),
    alignItems: 'center',
  },
  carouselScroll: {
    width: wp('86%'),
  },
  carouselImage: {
    width: wp('86%'),
    height: wp('86%'),
    borderRadius: moderateScale(12),
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: verticalScale(10),
  },
  paginationDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: scale(3),
  },
  paginationDotActive: {
    backgroundColor: '#6366f1',
    width: scale(20),
  },
  fab: {
    position: 'absolute',
    right: scale(16),
    bottom: verticalScale(20),
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  emptyFeed: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: verticalScale(100),
  },
  emptyText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    marginTop: verticalScale(16),
  },
  emptySubtext: {
    fontSize: moderateScale(13),
    marginTop: verticalScale(4),
    opacity: 0.6,
  },
  loadingMore: {
    paddingVertical: verticalScale(20),
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  menuContainer: {
    borderRadius: moderateScale(12),
    padding: 0,
    minWidth: scale(180),
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(14),
  },
  menuIcon: {
    marginRight: scale(12),
  },
  menuText: {
    fontSize: moderateScale(15),
    fontWeight: '500',
  },
});