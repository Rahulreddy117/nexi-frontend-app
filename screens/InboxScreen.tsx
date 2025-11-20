import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../ThemeContext';

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

const UNREAD_DOT_SIZE = 10; // New constant for dot size

// -----------------------------------------------------------------
//  PROFILE CACHE HELPERS (3-day cache)
// -----------------------------------------------------------------
const PROFILE_PREFIX = '@profile_';
const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

interface CachedProfile {
  username: string;
  profilePicUrl?: string;
  updatedAt: string;
  _cachedAt: string;
}

const getCachedProfile = async (userId: string): Promise<CachedProfile | null> => {
  try {
    const json = await AsyncStorage.getItem(PROFILE_PREFIX + userId);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
};

const setCachedProfile = async (userId: string, profile: any) => {
  try {
    const toStore: CachedProfile = {
      username: profile.username || 'Unknown',
      profilePicUrl: profile.profilePicUrl,
      updatedAt: profile.updatedAt || new Date().toISOString(),
      _cachedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(PROFILE_PREFIX + userId, JSON.stringify(toStore));
  } catch (e) {
    console.warn('Failed to cache profile', e);
  }
};

// -----------------------------------------------------------------
//  MAIN SCREEN
// -----------------------------------------------------------------
interface Conversation {
  partnerId: string;
  partnerName: string;
  partnerPic?: string;
  lastMessage: string;
  lastMessageAt: string;
  isUnread: boolean; // NEW: Track unread status
}

export default function InboxScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // -------------------------------------------------------------
  // 1. Load current user (auth0Id) once
  // -------------------------------------------------------------
  useEffect(() => {
    (async () => {
      const id = await AsyncStorage.getItem('auth0Id');
      setCurrentUserId(id);
    })();
  }, []);

  // -------------------------------------------------------------
  // 2. FETCH + CACHE profile (3-day cache, bypass for self-update)
  // -------------------------------------------------------------
  const fetchProfile = async (auth0Id: string): Promise<CachedProfile | null> => {
    const cached = await getCachedProfile(auth0Id);

    // === SPECIAL CASE: Current user (force refresh if flag set) ===
    if (auth0Id === currentUserId) {
      const lastUpdateStr = await AsyncStorage.getItem('profile_updated_at');
      if (lastUpdateStr && cached) {
        const updateTime = new Date(lastUpdateStr).getTime();
        const cacheTime = new Date(cached._cachedAt).getTime();
        if (updateTime > cacheTime) {
          // Force fetch
        } else {
          const ageMs = Date.now() - cacheTime;
          if (ageMs < CACHE_TTL_MS) return cached;
        }
      }
    }
    // === OTHER USERS: 3-day cache ===
    else if (cached) {
      const ageMs = Date.now() - new Date(cached._cachedAt).getTime();
      if (ageMs < CACHE_TTL_MS) return cached;
    }

    // === FETCH FROM SERVER ===
    const where = { auth0Id };
    const whereStr = encodeURIComponent(JSON.stringify(where));
    try {
      const res = await fetch(
        `${API_URL}/classes/UserProfile?where=${whereStr}&limit=1`,
        {
          headers: {
            'X-Parse-Application-Id': APP_ID,
            'X-Parse-Master-Key': MASTER_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!res.ok) return cached || null;

      const data = await res.json();
      const profile = data.results?.[0] ?? null;

      if (profile) {
        const serverUpdatedAt = profile.updatedAt;

        // === ONLY UPDATE CACHE IF DATA CHANGED ===
        if (cached && cached.updatedAt === serverUpdatedAt) {
          // No change → just refresh _cachedAt
          return { ...cached, _cachedAt: new Date().toISOString() };
        }

        // Data changed → save new version
        await setCachedProfile(auth0Id, profile);

        // Clear flag for current user
        if (auth0Id === currentUserId) {
          await AsyncStorage.removeItem('profile_updated_at');
        }

        return {
          username: profile.username || 'Unknown',
          profilePicUrl: profile.profilePicUrl,
          updatedAt: serverUpdatedAt,
          _cachedAt: new Date().toISOString(),
        };
      }
    } catch (e) {
      console.warn('Profile fetch error', e);
    }

    return cached || null;
  };

  // -------------------------------------------------------------
  // 3. Build inbox
  // -------------------------------------------------------------
  const fetchInbox = useCallback(async (forceRefresh = false) => {
    if (!currentUserId) return;

    if (forceRefresh) setRefreshing(true);
    else setLoading(true);

    // Get the time the user last viewed this screen
    const lastInboxSeenStr = await AsyncStorage.getItem(`lastInboxSeen_${currentUserId}`);
    const lastInboxSeenTime = lastInboxSeenStr
      ? new Date(lastInboxSeenStr).getTime()
      : 0; // If never seen, assume all messages are new

    try {
      // Optional: clear all profile caches on force refresh
      if (forceRefresh) {
        const keys = await AsyncStorage.getAllKeys();
        const profileKeys = keys.filter(k => k.startsWith(PROFILE_PREFIX));
        await AsyncStorage.multiRemove(profileKeys);
      }

      const where = {
        $or: [{ senderId: currentUserId }, { receiverId: currentUserId }],
      };
      const whereStr = encodeURIComponent(JSON.stringify(where));

      const res = await fetch(
        `${API_URL}/classes/Message?where=${whereStr}&limit=1000`,
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

      const partnerMap = new Map<string, Conversation>();

      for (const msg of results) {
        const isMe = msg.senderId === currentUserId;
        const partnerId = isMe ? msg.receiverId : msg.senderId;

        // Message is unread if:
        // 1. It was NOT sent by the current user.
        // 2. It was created AFTER the last time the user viewed the inbox.
        const isMsgUnread = !isMe && new Date(msg.createdAt).getTime() > lastInboxSeenTime;

        if (!partnerMap.has(partnerId)) {
          const profile = await fetchProfile(partnerId);
          partnerMap.set(partnerId, {
            partnerId,
            partnerName: profile?.username || 'Unknown',
            partnerPic: profile?.profilePicUrl,
            lastMessage: msg.text,
            lastMessageAt: msg.createdAt,
            isUnread: isMsgUnread, // Initial unread status
          });
        } else {
          const existing = partnerMap.get(partnerId)!;
          if (new Date(msg.createdAt) > new Date(existing.lastMessageAt)) {
            // This is the latest message, update conversation details
            existing.lastMessage = msg.text;
            existing.lastMessageAt = msg.createdAt;
            existing.isUnread = isMsgUnread; // Update unread status for the latest message
          }
        }
      }

      const list = Array.from(partnerMap.values()).sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );

      setConversations(list);
    } catch (e) {
      console.error('Inbox fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId]);

  // -------------------------------------------------------------
  // 4. Refetch on focus (Crucial: sets the `lastInboxSeen` time)
  // -------------------------------------------------------------
  useFocusEffect(
    useCallback(() => {
      if (currentUserId) {
        fetchInbox().then(() => {
          // Record the time the inbox screen was last fully viewed/refreshed
          AsyncStorage.setItem(`lastInboxSeen_${currentUserId}`, new Date().toISOString());
        });
      }
    }, [currentUserId, fetchInbox])
  );

  // -------------------------------------------------------------
  // 5. Pull to refresh
  // -------------------------------------------------------------
  const onRefresh = () => fetchInbox(true);

  // -------------------------------------------------------------
  // 6. Render row
  // -------------------------------------------------------------
  const renderItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={() =>
        navigation.navigate('Chat', {
          receiverId: item.partnerId,
          receiverName: item.partnerName,
          receiverPic: item.partnerPic,
        })
      }
    >
      {/* Avatar Section */}
      <View style={styles.avatarContainer}> 
        {item.partnerPic ? (
          <Image source={{ uri: item.partnerPic }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.placeholderBackground }]}>
            <Ionicons name="person" size={20} color={colors.secondaryText} />
          </View>
        )}
      </View>

      {/* Info Section (Name and Last Message) */}
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text }]}>{item.partnerName}</Text>
        <Text
          style={[
            styles.lastMsg,
            { color: colors.secondaryText },
            // Apply bold style if unread
            item.isUnread && { fontWeight: '700', color: colors.text }, 
          ]}
          numberOfLines={1}
        >
          {item.lastMessage}
        </Text>
      </View>

      {/* Time and Unread Dot Section */}
      <View style={styles.timeContainer}> 
        <Text style={[styles.time, { color: colors.secondaryText }]}>
          {new Date(item.lastMessageAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
        {/* Render the blue dot on the top right */}
        {item.isUnread && (
          <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
        )}
      </View>
    </TouchableOpacity>
  );

  // -------------------------------------------------------------
  // 7. UI
  // -------------------------------------------------------------
  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Inbox</Text>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
            No messages yet. Start a conversation!
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderItem}
          keyExtractor={(item) => item.partnerId}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </SafeAreaView>
  );
}

// -----------------------------------------------------------------
// Styles
// -----------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 20, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  avatarContainer: {
    // No specific positioning needed here
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  lastMsg: { fontSize: 14, marginTop: 2 },
  timeContainer: {
    // This container holds both the time and the dot, aligned vertically
    alignSelf: 'flex-start', // Align to the top of the row
    alignItems: 'flex-end',  // Align children to the right
    paddingTop: 4, // Push down slightly to align with the top margin
    gap: 4, // Space between time and dot
  },
  time: { fontSize: 12 },
  unreadDot: {
    width: UNREAD_DOT_SIZE,
    height: UNREAD_DOT_SIZE,
    borderRadius: UNREAD_DOT_SIZE / 2,
  },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 16, textAlign: 'center' },
});