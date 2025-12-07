// rooms/RoomUserProfile.tsx — FINAL VERSION (Public posts + Unjoin button + Pagination + Post Menu + User Profile Navigation + Member Count)
import React, { useState, useEffect } from 'react';
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
  Dimensions,
  Modal,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import EncryptedStorage from 'react-native-encrypted-storage';
import { jwtDecode } from 'jwt-decode';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { io, Socket } from 'socket.io-client';
import type { RootStackParamList } from '../types/navigation';
import { useTheme } from '../ThemeContext';

const { width: screenWidth } = Dimensions.get('window');
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

export default function RoomUserProfile({ navigation, route }: { navigation: NavigationProp; route: RoomUserProfileRouteProp }) {
  const { colors } = useTheme();
  const { roomId, roomName } = route.params as RouteParams;

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

  useEffect(() => {
    const getUserInfo = async () => {
      const token = await EncryptedStorage.getItem('idToken');
      if (token) {
        const decoded: any = jwtDecode(token);
        setCurrentAuth0Id(decoded.sub);
      }
      const parseId = await AsyncStorage.getItem('parseObjectId');
      setMyParseObjectId(parseId);
    };
    getUserInfo();
  }, []);

  // Socket.IO — Real-time member count updates
  useEffect(() => {
    if (!currentAuth0Id || !roomId) return;

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected for room');
    });

    newSocket.on('roomMemberUpdated', (data: { roomId: string; count: number }) => {
      if (data.roomId === roomId) {
        setMemberCount(data.count);
      }
    });

    newSocket.on('sendError', (err) => console.error('Socket error:', err));

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
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

  // Always fetch posts + check join status + member count
  useEffect(() => {
    if (!roomId || !myParseObjectId || !currentAuth0Id) return;

    const loadEverything = async () => {
      try {
        // 1. Check if creator
        const roomRes = await fetch(`${API_URL}/classes/Room/${roomId}`, { headers: { 'X-Parse-Application-Id': APP_ID, 'X-Parse-Master-Key': MASTER_KEY } });
        const room = await roomRes.json();
        const creatorRes = await fetch(`${API_URL}/classes/UserProfile/${room.creator.objectId}`, { headers: { 'X-Parse-Application-Id': APP_ID, 'X-Parse-Master-Key': MASTER_KEY } });
        const creator = await creatorRes.json();
        setIsCreator(creator.auth0Id === currentAuth0Id);

        // 2. Check if joined
        const memberRes = await fetch(
          `${API_URL}/classes/RoomMember?where=${encodeURIComponent(JSON.stringify({
            room: { __type: 'Pointer', className: 'Room', objectId: roomId },
            user: { __type: 'Pointer', className: 'UserProfile', objectId: myParseObjectId },
          }))}`,
          { headers: { 'X-Parse-Application-Id': APP_ID, 'X-Parse-Master-Key': MASTER_KEY } }
        );
        const memberData = await memberRes.json();
        setIsJoined(memberData.results.length > 0);

        // 3. Fetch member count
        const count = await getMemberCount();
        setMemberCount(count);

        // 4. Always fetch posts — PUBLIC FOR EVERYONE (initial 4)
        await fetchPosts(0, 4);
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to load room');
      } finally {
        setLoading(false);
      }
    };

    loadEverything();
  }, [roomId, myParseObjectId, currentAuth0Id]);

  const fetchPosts = async (skip = 0, limit = 4) => {
    try {
      const res = await fetch(
        `${API_URL}/classes/RoomPost?where=${encodeURIComponent(JSON.stringify({
          room: { __type: 'Pointer', className: 'Room', objectId: roomId },
        }))}&include=user&order=-createdAt&limit=${limit}&skip=${skip}`,
        { headers: { 'X-Parse-Application-Id': APP_ID, 'X-Parse-Master-Key': MASTER_KEY } }
      );
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

      if (skip === 0) {
        setPosts(newPosts);
      } else {
        setPosts((prev) => [...prev, ...newPosts]);
      }
      setHasMore(newPosts.length === limit);
    } catch (err) {
      console.error('Fetch posts error:', err);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchPosts(posts.length, 4);
    setLoadingMore(false);
  };

   // Always refresh posts + member count when coming back to this screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Refetch everything fresh
      setHasMore(true);
      fetchPosts(0, 4);
      
      // Also refresh member count (in case someone joined/left while away)
      getMemberCount().then(count => setMemberCount(count));
    });

    return unsubscribe;
  }, [navigation]);

  const handleMorePress = (post: Post) => {
    setSelectedPost(post);
    setShowMenu(true);
  };

  const handleDelete = async (post: Post) => {
    try {
      await fetch(`${API_URL}/classes/RoomPost/${post.objectId}`, {
        method: 'DELETE',
        headers: { 'X-Parse-Application-Id': APP_ID, 'X-Parse-Master-Key': MASTER_KEY },
      });
      setPosts((prev) => prev.filter((p) => p.objectId !== post.objectId));
      setShowMenu(false);
      Alert.alert('Success', 'Post deleted');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to delete post');
    }
  };

  const handleReport = (post: Post) => {
    setShowMenu(false);
    Alert.alert('Report', 'Report functionality coming soon');
  };

  const handleJoin = async () => {
    try {
      await fetch(`${API_URL}/classes/RoomMember`, {
        method: 'POST',
        headers: { 'X-Parse-Application-Id': APP_ID, 'X-Parse-Master-Key': MASTER_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: { __type: 'Pointer', className: 'UserProfile', objectId: myParseObjectId },
          room: { __type: 'Pointer', className: 'Room', objectId: roomId },
        }),
      });
      setIsJoined(true);
      const newCount = await getMemberCount();
      setMemberCount(newCount);
      if (socket) {
        socket.emit('roomMemberUpdated', { roomId, count: newCount });
      }
      Alert.alert('Success', `Joined ${roomName}!`);
    } catch (err) {
      Alert.alert('Error', 'Failed to join');
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
            try {
              // Find and delete RoomMember entry
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
              setIsJoined(false);
              const newCount = await getMemberCount();
              setMemberCount(newCount);
              if (socket) {
                socket.emit('roomMemberUpdated', { roomId, count: newCount });
              }
              Alert.alert('Left', `You have left ${roomName}`);
            } catch (err) {
              Alert.alert('Error', 'Failed to leave room');
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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
  <>
    {/* ───── MAIN SCREEN ───── */}
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.roomTitleContainer}>
          <Text style={[styles.roomTitle, { color: colors.text }]} numberOfLines={1}>
            {roomName}
          </Text>
          <View style={styles.memberCountContainer}>
            <Ionicons name="people-outline" size={16} color={colors.text} />
            <Text style={[styles.memberCount, { color: colors.text }]}>{memberCount}</Text>
          </View>
        </View>

        {isCreator ? null : isJoined ? (
          <TouchableOpacity style={[styles.joinButton, { backgroundColor: '#ff4444' }]} onPress={handleUnjoin}>
            <Text style={styles.joinButtonText}>Unjoin</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.joinButton, { backgroundColor: colors.primary }]} onPress={handleJoin}>
            <Text style={styles.joinButtonText}>Join</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Posts List */}
      <FlatList
        data={posts}
        
        renderItem={({ item }) => (
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
                <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {item.text ? <Text style={[styles.postText, { color: colors.text }]}>{item.text}</Text> : null}

            {item.imageUrls.length > 0 && (
              <View style={styles.imagesContainer}>
                {item.imageUrls.map((url, i) => (
                  <Image key={i} source={{ uri: url }} style={styles.postImage} resizeMode="cover" />
                ))}
              </View>
            )}
          </View>
        )}
        keyExtractor={(item) => item.objectId}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.loadingMore} color={colors.primary} /> : null}
        ListEmptyComponent={
          <View style={styles.emptyFeed}>
            <Text style={[styles.emptyText, { color: colors.secondaryText }]}>No posts yet</Text>
          </View>
        }
      />

      {/* FAB – safe because it’s inside the main View */}
      {canPost && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('RoomPostUpload', { roomId, roomName })}
        >
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      )}
    </View>

    {/* ───── POST MENU MODAL (NOW OUTSIDE THE MAIN VIEW) ───── */}
    <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
        <View style={[styles.menuContainer, { backgroundColor: colors.card }]}>
          {selectedPost?.user.objectId === myParseObjectId && (
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={() => selectedPost && handleDelete(selectedPost)}
            >
              <Text style={[styles.menuText, { color: '#ff4444' }]}>Delete</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.menuItem} onPress={() => selectedPost && handleReport(selectedPost)}>
            <Text style={[styles.menuText, { color: colors.text }]}>Report</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  </>
);
}

// Updated styles
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: { padding: 4 },
  roomTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  roomTitle: { fontSize: 18, fontWeight: 'bold', flex: 1 },
  memberCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  memberCount: { fontSize: 12, fontWeight: '600', marginLeft: 2 },
  joinButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  joinButtonText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  postContainer: { padding: 16, marginVertical: 8, marginHorizontal: 12, borderRadius: 12 },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  userInfo: { flex: 1 },
  username: { fontWeight: 'bold', fontSize: 15 },
  timestamp: { fontSize: 12, opacity: 0.7 },
  moreButton: { padding: 4 },
  postText: { fontSize: 16, lineHeight: 22, marginBottom: 10 },
  imagesContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  postImage: { width: (screenWidth - 60) / 2, height: (screenWidth - 60) / 2, borderRadius: 10, margin: 4 },
  fab: { position: 'absolute', right: 16, bottom: 16, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  emptyFeed: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: 16, opacity: 0.7 },
  loadingMore: { padding: 20 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuContainer: {
    borderRadius: 10,
    padding: 0,
    minWidth: 150,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuText: { fontSize: 16 },
});