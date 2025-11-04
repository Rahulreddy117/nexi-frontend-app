// SearchBarScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
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
import { useTheme } from '../ThemeContext';  // Import useTheme


// ──────────────────────────────────────────────────────
//  CONFIG – same values you already use elsewhere
// ──────────────────────────────────────────────────────
const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey'; // TEMP – remove in prod!

// ──────────────────────────────────────────────────────
//  TYPE for a user returned from Parse
// ──────────────────────────────────────────────────────
type User = {
  objectId: string;
  auth0Id: string;
  username: string;
  profilePicUrl?: string;
  bio?: string;
  height?: string;
};

export default function SearchBarScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();  // Get theme colors
  const [query, setQuery] = useState(route.params?.initialQuery ?? '');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ──────────────────────────────────────────────────────
  //  SEARCH API
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
      // Build a case-insensitive “contains” query on username
      const where = {
        username: {
          $regex: `(?i)${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        },
      };
      const whereStr = encodeURIComponent(JSON.stringify(where));

      const url = `${API_URL}/classes/UserProfile?where=${whereStr}&limit=20`;
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
  //  DEBOUNCED version (300 ms)
  // ──────────────────────────────────────────────────────
  const debouncedSearch = useCallback(
    debounce((term: string) => performSearch(term), 300),
    []
  );

  // Trigger search when query changes
  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  // ──────────────────────────────────────────────────────
  //  UI
  // ──────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={[styles.resultRow, { borderBottomColor: colors.border }]}
      onPress={() =>
        navigation.navigate('UserProfile', {
          userId: item.auth0Id,
          username: item.username,
          profilePicUrl: item.profilePicUrl,
          bio: item.bio,
          height: item.height,
        })
      }
    >
      {item.profilePicUrl ? (
        <Image source={{ uri: item.profilePicUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: colors.placeholderBackground }]}>
          <Ionicons name="person" size={20} color={colors.secondaryText} />
        </View>
      )}
      <View style={styles.resultInfo}>
        <Text style={[styles.resultUsername, { color: colors.text }]}>{item.username}</Text>
        {item.bio ? (
          <Text style={[styles.resultBio, { color: colors.secondaryText }]} numberOfLines={1}>
            {item.bio}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* ---------- SEARCH BAR ---------- */}
      <View style={[
        styles.searchBar, 
        { 
          backgroundColor: colors.placeholderBackground,
          borderColor: colors.border,
        }
      ]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
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
          <TouchableOpacity
            onPress={() => setQuery('')}
            style={styles.clearBtn}
          >
            <Ionicons name="close-circle" size={22} color={colors.secondaryText} />
          </TouchableOpacity>
        )}
      </View>

      {/* ---------- RESULTS ---------- */}
      <View style={[styles.resultsContainer, { backgroundColor: colors.background }]}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.text} style={{ marginTop: 30 }} />
        ) : error ? (
          <Text style={[styles.errorText, { color: colors.secondaryText }]}>{error}</Text>
        ) : results.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
            {query.trim() ? 'No users found' : 'Start typing to search'}
          </Text>
        ) : (
          <FlatList
            data={results}
            keyExtractor={i => i.objectId}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ──────────────────────────────────────────────────────
//  STYLES
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
  resultInfo: {
    flex: 1,
  },
  resultUsername: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultBio: {
    fontSize: 13,
    marginTop: 2,
  },
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