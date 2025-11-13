// src/screens/InboxScreen.tsx
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

// -----------------------------------------------------------------
//  PROFILE CACHE HELPERS (12-hour cache)
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
//  MAIN SCREEN
// -----------------------------------------------------------------
interface Conversation {
  partnerId: string;
  partnerName: string;
  partnerPic?: string;
  lastMessage: string;
  lastMessageAt: string;
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
  // 2. FETCH + CACHE profile (12hr cache, bypass for self-update)
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
  // === OTHER USERS: 12-hour cache ===
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

        if (!partnerMap.has(partnerId)) {
          const profile = await fetchProfile(partnerId);
          partnerMap.set(partnerId, {
            partnerId,
            partnerName: profile?.username || 'Unknown',
            partnerPic: profile?.profilePicUrl,
            lastMessage: msg.text,
            lastMessageAt: msg.createdAt,
          });
        } else {
          const existing = partnerMap.get(partnerId)!;
          if (new Date(msg.createdAt) > new Date(existing.lastMessageAt)) {
            existing.lastMessage = msg.text;
            existing.lastMessageAt = msg.createdAt;
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
  // 4. Refetch on focus
  // -------------------------------------------------------------
  useFocusEffect(
    useCallback(() => {
      if (currentUserId) fetchInbox();
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
      {item.partnerPic ? (
        <Image source={{ uri: item.partnerPic }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: colors.placeholderBackground }]}>
          <Ionicons name="person" size={20} color={colors.secondaryText} />
        </View>
      )}

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text }]}>{item.partnerName}</Text>
        <Text style={[styles.lastMsg, { color: colors.secondaryText }]} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>

      <Text style={[styles.time, { color: colors.secondaryText }]}>
        {new Date(item.lastMessageAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
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
  time: { fontSize: 12 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 16, textAlign: 'center' },
});