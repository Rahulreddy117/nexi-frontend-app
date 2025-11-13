// SearchBarScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  FlatList,
  Image,
  ActivityIndicator,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import debounce from 'lodash.debounce';
import { useTheme } from '../ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ──────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────
const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';
const RECENT_SEARCHES_KEY = '@recent_searches';

// ──────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────
type User = {
  objectId: string;
  auth0Id: string;
  username: string;
  profilePicUrl?: string;
};

type RecentSearch = {
  auth0Id: string;
  username: string;
  profilePicUrl?: string;
  timestamp: number;
};

export default function SearchBarScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();

  const [query, setQuery] = useState(route.params?.initialQuery ?? '');
  const [results, setResults] = useState<User[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  // ──────────────────────────────────────────────────────
  // LOAD RECENT SEARCHES FROM STORAGE
  // ──────────────────────────────────────────────────────
  useEffect(() => {
    const loadRecent = async () => {
      try {
        const json = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
        if (json) {
          const parsed: RecentSearch[] = JSON.parse(json);
          const sorted = parsed.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
          if (isMounted.current) setRecentSearches(sorted);
        }
      } catch (e) {
        console.error('Failed to load recent searches', e);
      }
    };
    loadRecent();
  }, []);

  // ──────────────────────────────────────────────────────
  // SAVE TO RECENT SEARCHES
  // ──────────────────────────────────────────────────────
  const saveToRecent = async (user: User) => {
    try {
      const newEntry: RecentSearch = {
        auth0Id: user.auth0Id,
        username: user.username,
        profilePicUrl: user.profilePicUrl,
        timestamp: Date.now(),
      };

      const updated = [
        newEntry,
        ...recentSearches.filter((r) => r.auth0Id !== user.auth0Id),
      ].slice(0, 10);

      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      if (isMounted.current) setRecentSearches(updated);
    } catch (e) {
      console.error('Failed to save recent search', e);
    }
  };

  // ──────────────────────────────────────────────────────
  // CLEAR ALL RECENT SEARCHES
  // ──────────────────────────────────────────────────────
  const clearRecentSearches = async () => {
    try {
      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
      setRecentSearches([]);
    } catch (e) {
      console.error('Failed to clear recent searches', e);
    }
  };

  // ──────────────────────────────────────────────────────
  // REMOVE SINGLE RECENT SEARCH
  // ──────────────────────────────────────────────────────
  const removeRecentSearch = async (auth0Id: string) => {
    const updated = recentSearches.filter((r) => r.auth0Id !== auth0Id);
    setRecentSearches(updated);
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  // ──────────────────────────────────────────────────────
  // PERFORM SEARCH API
  // ──────────────────────────────────────────────────────
  const performSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const where = {
        username: {
          $regex: `(?i)${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        },
      };
      const whereStr = encodeURIComponent(JSON.stringify(where));
      const url = `${API_URL}/classes/UserProfile?where=${whereStr}&limit=8&keys=username,auth0Id,profilePicUrl`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Parse-Application-Id': APP_ID,
          'X-Parse-Master-Key': MASTER_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }

      const data = await res.json();
      const users: User[] = data.results ?? [];
      setResults(users);
    } catch (e: any) {
      console.error('Search error:', e);
      setError(e.message ?? 'Something went wrong');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // ──────────────────────────────────────────────────────
  // DEBOUNCED SEARCH
  // ──────────────────────────────────────────────────────
  const debouncedSearch = useCallback(debounce((term: string) => performSearch(term), 900), []);

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
      isMounted.current = false;
    };
  }, [debouncedSearch]);

  // ──────────────────────────────────────────────────────
  // NAVIGATE TO PROFILE + SAVE RECENT
  // ──────────────────────────────────────────────────────
  const goToProfile = (user: User | RecentSearch) => {
    const { auth0Id, username, profilePicUrl } = user;
    if ('objectId' in user) {
      saveToRecent(user as User); // Only save if it's a fresh search result
    }
    navigation.navigate('UserProfile', {
      userId: auth0Id,
      username,
      profilePicUrl,
    });
  };

  // ──────────────────────────────────────────────────────
  // RENDER SEARCH RESULT ITEM
  // ──────────────────────────────────────────────────────
  const renderSearchResult = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={[styles.resultRow, { borderBottomColor: colors.border }]}
      onPress={() => goToProfile(item)}
    >
      {item.profilePicUrl ? (
        <Image source={{ uri: item.profilePicUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: colors.placeholderBackground }]}>
          <Ionicons name="person" size={20} color={colors.secondaryText} />
        </View>
      )}
      <Text style={[styles.resultUsername, { color: colors.text }]}>{item.username}</Text>
    </TouchableOpacity>
  );

  // ──────────────────────────────────────────────────────
  // RENDER RECENT SEARCH ITEM
  // ──────────────────────────────────────────────────────
  const renderRecentItem = ({ item }: { item: RecentSearch }) => (
    <TouchableOpacity
      style={[styles.recentRow, { borderBottomColor: colors.border }]}
      onPress={() => goToProfile(item)}
    >
      <View style={styles.recentLeft}>
        {item.profilePicUrl ? (
          <Image source={{ uri: item.profilePicUrl }} style={styles.recentAvatar} />
        ) : (
          <View style={[styles.recentAvatar, { backgroundColor: colors.placeholderBackground }]}>
            <Ionicons name="person" size={18} color={colors.secondaryText} />
          </View>
        )}
        <Text style={[styles.recentUsername, { color: colors.text }]}>{item.username}</Text>
      </View>
      <TouchableOpacity onPress={() => removeRecentSearch(item.auth0Id)}>
        <Ionicons name="close" size={20} color={colors.secondaryText} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // ──────────────────────────────────────────────────────
  // RENDER RECENT SEARCHES SECTION
  // ──────────────────────────────────────────────────────
  const renderRecentSearches = () => {
    if (query.trim() || recentSearches.length === 0) return null;

    return (
      <>
        <View style={styles.recentHeader}>
          <Text style={[styles.recentTitle, { color: colors.text }]}>Recent</Text>
          <TouchableOpacity onPress={clearRecentSearches}>
            <Text style={[styles.clearText, { color: colors.accent }]}>Clear all</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={recentSearches}
          keyExtractor={(item) => item.auth0Id}
          renderItem={renderRecentItem}
          scrollEnabled={false}
          keyboardShouldPersistTaps="handled"
        />
      </>
    );
  };

  // ──────────────────────────────────────────────────────
  // MAIN RENDER
  // ──────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* SEARCH BAR */}
      <View style={[
        styles.searchBar,
        {
          backgroundColor: colors.placeholderBackground,
          borderColor: colors.border,
        }
      ]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="Search users..."
          placeholderTextColor={colors.secondaryText}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoFocus
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={22} color={colors.secondaryText} />
          </TouchableOpacity>
        )}
      </View>

      {/* CONTENT */}
      <View style={[styles.resultsContainer, { backgroundColor: colors.background }]}>
        {renderRecentSearches()}

        {query.trim() ? (
          loading ? (
            <ActivityIndicator size="large" color={colors.text} style={{ marginTop: 30 }} />
          ) : error ? (
            <Text style={[styles.errorText, { color: colors.secondaryText }]}>{error}</Text>
          ) : results.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
              No users found
            </Text>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.objectId}
              renderItem={renderSearchResult}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={false}
            />
          )
        ) : recentSearches.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.secondaryText, marginTop: 30 }]}>
            Start typing to search
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

// ──────────────────────────────────────────────────────
// STYLES – Instagram-inspired
// ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 25,
    marginHorizontal: 16,
    marginTop: 12,
    height: 50,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  backBtn: { paddingRight: 8 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  clearBtn: { paddingLeft: 8 },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: 12,
  },

  // Recent Header
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  clearText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Recent Row
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  recentUsername: {
    fontSize: 15,
    fontWeight: '500',
  },

  // Search Results
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  resultUsername: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Empty / Error
  emptyText: {
    textAlign: 'center',
    marginTop: 30,
    fontSize: 15,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 30,
  },
});