// ChatScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { io, Socket } from 'socket.io-client';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import type { RootStackParamList } from '../types/navigation';
import { useTheme } from '../ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
const API_URL = 'https://nexi-server.onrender.com/parse';
const SOCKET_URL = 'https://nexi-server.onrender.com';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

interface Message {
  objectId: string;
  text: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
}

type ChatRouteProps = {
  receiverId: string;
  receiverName: string;
  receiverPic?: string;
};

export default function ChatScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { receiverId, receiverName, receiverPic } = route.params as ChatRouteProps;

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  // New states for block system
  const [myBlocked, setMyBlocked] = useState<string[]>([]);
  const [targetBlocked, setTargetBlocked] = useState<string[]>([]);

  const flatListRef = useRef<FlatList>(null);

  // 1. Load currentUserId FIRST
  useEffect(() => {
    let mounted = true;
    (async () => {
      const id = await AsyncStorage.getItem('auth0Id');
      if (mounted) {
        console.log('Loaded currentUserId:', id);
        setCurrentUserId(id);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // New: Load blocked lists
  useEffect(() => {
    const loadBlockedLists = async () => {
      if (!currentUserId) return;

      try {
        // Load my blocked list
        const whereMy = { auth0Id: currentUserId! };
        const whereStrMy = encodeURIComponent(JSON.stringify(whereMy));
        const myProfileRes = await fetch(`${API_URL}/classes/UserProfile?where=${whereStrMy}&limit=1`, {
          headers: { 'X-Parse-Application-Id': APP_ID, 'X-Parse-Master-Key': MASTER_KEY },
        });
        if (myProfileRes.ok) {
          const myData = await myProfileRes.json();
          if (myData.results[0]) setMyBlocked(myData.results[0].blocked || []);
        }

        // Load target's blocked list
        const whereTarget = { auth0Id: receiverId };
        const whereStrTarget = encodeURIComponent(JSON.stringify(whereTarget));
        const targetProfileRes = await fetch(`${API_URL}/classes/UserProfile?where=${whereStrTarget}&limit=1`, {
          headers: { 'X-Parse-Application-Id': APP_ID, 'X-Parse-Master-Key': MASTER_KEY },
        });
        if (targetProfileRes.ok) {
          const targetData = await targetProfileRes.json();
          if (targetData.results[0]) setTargetBlocked(targetData.results[0].blocked || []);
        }
      } catch (err) {
        console.error('Failed to load blocked lists:', err);
      }
    };

    loadBlockedLists();
  }, [currentUserId, receiverId]);

  // 2. Socket.IO — Real-time
  useEffect(() => {
    if (!currentUserId) return;

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      newSocket.emit('join', currentUserId!);
    });

    newSocket.on('newMessage', (msg: Message) => {
      if (msg.senderId === receiverId) addMessage(msg);
    });

    newSocket.on('messageSent', (msg: Message) => {
      if (msg.senderId === currentUserId!) addMessage(msg);
    });

    newSocket.on('sendError', (err) => console.error('Send error:', err));

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [currentUserId, receiverId]);

  const addMessage = (msg: any) => {
    setMessages((prev) => {
      // Prevent duplicate messages (happens when both users are online)
      if (prev.some(m => m.objectId === msg.objectId)) {
        return prev;
      }

      const newMsg = {
        ...msg,
        // Safety net if objectId is missing for any reason
        objectId: msg.objectId || `temp-${Date.now()}-${Math.random().toString(36)}`,
      };

      const updated = [...prev, newMsg];
      return updated.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  };

  // 4. Fetch messages (no order, we sort client-side)
  const fetchMessages = useCallback(async () => {
    if (!currentUserId) return;

    setLoading(true);

    const where = {
      $or: [
        { senderId: currentUserId!, receiverId },
        { senderId: receiverId, receiverId: currentUserId! },
      ],
    };

    const whereStr = encodeURIComponent(JSON.stringify(where));

    try {
      console.log('Fetching messages...');
      const res = await fetch(
        `${API_URL}/classes/Message?where=${whereStr}&limit=100`,
        {
          headers: {
            'X-Parse-Application-Id': APP_ID,
            'X-Parse-Master-Key': MASTER_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const { results = [] } = await res.json();
      console.log('Fetched messages:', results.length);

      const sorted = results.sort((a: any, b: any) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      setMessages(sorted);
    } catch (e) {
      console.error('fetchMessages error:', e);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, receiverId]);

  // 5. Refetch on focus (only if no messages)
  useFocusEffect(
    useCallback(() => {
      if (currentUserId && messages.length === 0) {
        fetchMessages();
      }
    }, [currentUserId, fetchMessages, messages.length])
  );

  // 6. Auto-scroll to bottom
  useEffect(() => {
    if (!loading && messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, loading]);

  // 7. Send message
  const sendMessage = () => {
    if (!newMessage.trim() || !currentUserId || !socket) return;

    // NEW: Block check
        // Silent block check - no alert, just stop sending
    if (myBlocked.includes(receiverId) || targetBlocked.includes(currentUserId!)) {
      return;
    }

    const payload = {
      senderId: currentUserId!,
      receiverId,
      text: newMessage.trim(),
    };

    socket.emit('sendMessage', payload);
    setNewMessage('');
  };

  // Navigate to User Profile
  const handleUserProfilePress = () => {
    navigation.navigate('UserProfile', {
      userId: receiverId,
      username: receiverName,
      profilePicUrl: receiverPic,
    });
  };

  // 8. Render message bubble
  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === currentUserId!;
    return (
      <View
        style={[
          styles.messageBubble,
          isMe ? styles.myBubble : styles.theirBubble,
          { backgroundColor: isMe ? colors.primary : colors.card },
        ]}
      >
        <Text style={[styles.messageText, { color: isMe ? '#fff' : colors.text }]}>
          {item.text}
        </Text>
        <Text style={[styles.timestamp, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.secondaryText }]}>
          {new Date(item.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  };

  // 9. Loading UI
  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading chat…</Text>
      </SafeAreaView>
    );
  }

  // 10. Main UI
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={moderateScale(24)} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.headerUserContainer} 
          onPress={handleUserProfilePress}
          activeOpacity={0.7}
        >
          {receiverPic ? (
            <Image source={{ uri: receiverPic }} style={styles.headerPic} />
          ) : (
            <View style={[styles.headerPic, { backgroundColor: colors.placeholderBackground }]}>
              <Ionicons name="person" size={moderateScale(18)} color={colors.secondaryText} />
            </View>
          )}

          <Text 
            style={[styles.headerName, { color: colors.text }]} 
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {receiverName}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.objectId || `temp-${Date.now()}`}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 10,
          }}
        />

        

        {/* INPUT BAR – NOW STICKS PERFECTLY TO BOTTOM */}
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.background }}>
          <View style={[styles.inputContainer, { borderTopColor: colors.border }]}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.text }]}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              placeholderTextColor={colors.secondaryText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              onPress={sendMessage}
              disabled={!newMessage.trim() || (myBlocked.includes(receiverId) || targetBlocked.includes(currentUserId!))}
              style={[
                styles.sendBtn,
                { backgroundColor: newMessage.trim() && !(myBlocked.includes(receiverId) || targetBlocked.includes(currentUserId!)) ? colors.primary : colors.border },
              ]}
            >
              <Ionicons name="send" size={moderateScale(20)} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Responsive Styles using both size-matters & responsive-screen
const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: {
    marginTop: hp('1.5%'),
    fontSize: moderateScale(15),
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.5%'),
    borderBottomWidth: 1,
    gap: wp('3%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  backButton: {
    padding: scale(4),
  },
  headerUserContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: wp('2.5%'),
  },
  headerPic: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerName: { 
    fontSize: moderateScale(17), 
    fontWeight: '600',
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
  },
  messageBubble: {
    maxWidth: wp('75%'),
    paddingHorizontal: wp('3.5%'),
    paddingVertical: hp('1.2%'),
    borderRadius: moderateScale(20),
    marginVertical: hp('0.4%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  myBubble: { 
    alignSelf: 'flex-end', 
    borderBottomRightRadius: moderateScale(4),
  },
  theirBubble: { 
    alignSelf: 'flex-start', 
    borderBottomLeftRadius: moderateScale(4),
  },
  messageText: { 
    fontSize: moderateScale(15),
    lineHeight: moderateScale(20),
  },
  timestamp: { 
    fontSize: moderateScale(10), 
    marginTop: hp('0.5%'), 
    alignSelf: 'flex-end',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1.2%'),
    paddingBottom: hp('1%'),        // ← reduce a little
    borderTopWidth: 1,
    alignItems: 'flex-end',
    gap: wp('2.5%'),
    backgroundColor:'#000',
  },
  input: {
    flex: 1,
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    borderRadius: moderateScale(24),
    maxHeight: hp('12%'),
    fontSize: moderateScale(15),
    lineHeight: moderateScale(20),
  },
  sendBtn: {
    width: moderateScale(46),
    height: moderateScale(46),
    borderRadius: moderateScale(23),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
 
});