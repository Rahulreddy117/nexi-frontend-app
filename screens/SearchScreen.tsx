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
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
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
      saveToRecent(user as User);
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
      activeOpacity={0.7}
    >
      {item.profilePicUrl ? (
        <Image source={{ uri: item.profilePicUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: colors.placeholderBackground }]}>
          <Ionicons name="person" size={moderateScale(22)} color={colors.secondaryText} />
        </View>
      )}
      <View style={styles.userInfo}>
        <Text 
          style={[styles.resultUsername, { color: colors.text }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item.username}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // ──────────────────────────────────────────────────────
  // RENDER RECENT SEARCH ITEM
  // ──────────────────────────────────────────────────────
  const renderRecentItem = ({ item }: { item: RecentSearch }) => (
    <TouchableOpacity
      style={[styles.recentRow, { borderBottomColor: colors.border }]}
      onPress={() => goToProfile(item)}
      activeOpacity={0.7}
    >
      <View style={styles.recentLeft}>
        {item.profilePicUrl ? (
          <Image source={{ uri: item.profilePicUrl }} style={styles.recentAvatar} />
        ) : (
          <View style={[styles.recentAvatar, { backgroundColor: colors.placeholderBackground }]}>
            <Ionicons name="person" size={moderateScale(20)} color={colors.secondaryText} />
          </View>
        )}
        <View style={styles.recentTextContainer}>
          <Text 
            style={[styles.recentUsername, { color: colors.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.username}
          </Text>
        </View>
      </View>
      <TouchableOpacity 
        onPress={() => removeRecentSearch(item.auth0Id)}
        style={styles.removeBtn}
        activeOpacity={0.7}
      >
        <Ionicons name="close-circle" size={moderateScale(22)} color={colors.secondaryText} />
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
          <Text style={[styles.recentTitle, { color: colors.text }]}>Recent Searches</Text>
          <TouchableOpacity onPress={clearRecentSearches} activeOpacity={0.7}>
            <Text style={[styles.clearText, { color: colors.primary }]}>Clear all</Text>
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
          backgroundColor: colors.card,
          borderColor: colors.border,
        }
      ]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={moderateScale(26)} color={colors.text} />
        </TouchableOpacity>
        <Ionicons name="search" size={moderateScale(20)} color={colors.secondaryText} style={styles.searchIcon} />
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
          <TouchableOpacity 
            onPress={() => setQuery('')} 
            style={styles.clearBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={moderateScale(22)} color={colors.secondaryText} />
          </TouchableOpacity>
        )}
      </View>

      {/* CONTENT */}
      <View style={[styles.resultsContainer, { backgroundColor: colors.background }]}>
        {renderRecentSearches()}

        {query.trim() ? (
          loading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.secondaryText }]}>
                Searching...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.centerContent}>
              <View style={[styles.iconContainer, { backgroundColor: colors.card }]}>
                <Ionicons name="alert-circle-outline" size={moderateScale(48)} color={colors.secondaryText} />
              </View>
              <Text style={[styles.errorText, { color: colors.text }]}>Oops!</Text>
              <Text style={[styles.errorSubtext, { color: colors.secondaryText }]}>{error}</Text>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.centerContent}>
              <View style={[styles.iconContainer, { backgroundColor: colors.card }]}>
                <Ionicons name="search-outline" size={moderateScale(48)} color={colors.secondaryText} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No users found</Text>
              <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
                Try searching with a different username
              </Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.objectId}
              renderItem={renderSearchResult}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={false}
              contentContainerStyle={styles.resultsListContent}
            />
          )
        ) : recentSearches.length === 0 ? (
          <View style={styles.centerContent}>
            <View style={[styles.iconContainer, { backgroundColor: colors.card }]}>
              <Ionicons name="time-outline" size={moderateScale(48)} color={colors.secondaryText} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No recent searches</Text>
            <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
              Start typing to search for users
            </Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

// ──────────────────────────────────────────────────────
// RESPONSIVE STYLES using both size-matters & responsive-screen
// ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
  flex: 1,
  // Remove all paddingTop — SafeAreaView already handles it perfectly
},
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: moderateScale(28),
    marginHorizontal: wp('4%'),
    marginTop: hp('1.5%'),
    height: hp('6.5%'),
    paddingHorizontal: wp('3%'),
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  backBtn: { 
    paddingRight: wp('2%'),
    paddingVertical: hp('1%'),
  },
  searchIcon: {
    marginRight: wp('2%'),
  },
  input: { 
    flex: 1, 
    fontSize: moderateScale(16), 
    fontWeight: '500',
    paddingVertical: hp('1%'),
  },
  clearBtn: { 
    paddingLeft: wp('2%'),
    paddingVertical: hp('1%'),
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: wp('4%'),
    marginTop: hp('2%'),
  },

  // Recent Header
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: hp('1%'),
    paddingHorizontal: wp('1%'),
    marginBottom: hp('0.5%'),
  },
  recentTitle: {
    fontSize: moderateScale(17),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  clearText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },

  // Recent Row
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: hp('1.5%'),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: wp('3%'),
  },
  recentAvatar: {
    width: moderateScale(46),
    height: moderateScale(46),
    borderRadius: moderateScale(23),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recentTextContainer: {
    flex: 1,
  },
  recentUsername: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  removeBtn: {
    padding: scale(4),
  },

  // Search Results
  resultsListContent: {
    paddingTop: hp('0.5%'),
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp('1.5%'),
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: wp('3%'),
  },
  avatar: {
    width: moderateScale(52),
    height: moderateScale(52),
    borderRadius: moderateScale(26),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  userInfo: {
    flex: 1,
  },
  resultUsername: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Center Content (Empty States / Loading)
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: hp('8%'),
    gap: hp('1.5%'),
  },
  iconContainer: {
    width: moderateScale(100),
    height: moderateScale(100),
    borderRadius: moderateScale(50),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  loadingText: {
    fontSize: moderateScale(15),
    fontWeight: '500',
  },
  emptyTitle: {
    fontSize: moderateScale(20),
    fontWeight: '700',
  },
  emptyText: {
    fontSize: moderateScale(15),
    textAlign: 'center',
    lineHeight: moderateScale(22),
    paddingHorizontal: wp('10%'),
  },
  errorText: {
    fontSize: moderateScale(20),
    fontWeight: '700',
  },
  errorSubtext: {
    fontSize: moderateScale(14),
    textAlign: 'center',
    lineHeight: moderateScale(20),
    paddingHorizontal: wp('10%'),
  },
});