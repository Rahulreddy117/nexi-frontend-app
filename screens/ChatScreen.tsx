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
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { io, Socket } from 'socket.io-client';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  // 2. Socket.IO — Real-time
  useEffect(() => {
    if (!currentUserId) return;

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      newSocket.emit('join', currentUserId);
    });

    newSocket.on('newMessage', (msg: Message) => {
      if (msg.senderId === receiverId) addMessage(msg);
    });

    newSocket.on('messageSent', (msg: Message) => {
      if (msg.senderId === currentUserId) addMessage(msg);
    });

    newSocket.on('sendError', (err) => console.error('Send error:', err));

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [currentUserId, receiverId]);

  // 3. Add message + SORT by time (oldest → newest)
  const addMessage = (msg: Message) => {
    setMessages((prev) => {
      const updated = [...prev, msg];
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
        { senderId: currentUserId, receiverId },
        { senderId: receiverId, receiverId: currentUserId },
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

  // 5. Refetch on focus
  useFocusEffect(
    useCallback(() => {
      if (currentUserId) fetchMessages();
    }, [currentUserId, fetchMessages])
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

    const payload = {
      senderId: currentUserId,
      receiverId,
      text: newMessage.trim(),
    };

    socket.emit('sendMessage', payload);
    setNewMessage('');
  };

  // 8. Render message bubble
  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === currentUserId;
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
        <Text style={[styles.timestamp, { color: isMe ? '#ddd' : colors.secondaryText }]}>
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
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 10 }}>Loading chat…</Text>
      </View>
    );
  }

  // 10. Main UI
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color={colors.text} />
        </TouchableOpacity>

        {receiverPic ? (
          <Image source={{ uri: receiverPic }} style={styles.headerPic} />
        ) : (
          <View style={[styles.headerPic, { backgroundColor: colors.placeholderBackground }]}>
            <Ionicons name="person" size={16} color={colors.secondaryText} />
          </View>
        )}

        <Text style={[styles.headerName, { color: colors.text }]}>{receiverName}</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.objectId}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
        />

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
            disabled={!newMessage.trim()}
            style={[
              styles.sendBtn,
              { backgroundColor: newMessage.trim() ? colors.primary : colors.border },
            ]}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerPic: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerName: { fontSize: 18, fontWeight: '600', flex: 1 },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 18,
    marginVertical: 4,
  },
  myBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  messageText: { fontSize: 16 },
  timestamp: { fontSize: 11, marginTop: 4, opacity: 0.7, alignSelf: 'flex-end' },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    maxHeight: 100,
    fontSize: 16,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});