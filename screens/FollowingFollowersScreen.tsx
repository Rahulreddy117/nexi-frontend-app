// FollowingFollowersScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  ImageStyle,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { RootStackParamList } from '../types/navigation';
import { useTheme } from '../ThemeContext';

type FollowingFollowersRouteProp = RouteProp<RootStackParamList, 'FollowingFollowers'>;

type User = {
  objectId: string;
  auth0Id: string;
  username: string;
  profilePicUrl?: string | null;
  bio?: string;
  height?: string | null;
};

type Params = {
  userId: string;
  type: 'followers' | 'following';
  username: string;
};

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

const HEADERS = {
  'X-Parse-Application-Id': APP_ID,
  'X-Parse-Master-Key': MASTER_KEY,
  'Content-Type': 'application/json',
};

async function queryUserByAuth0Id(auth0Id: string): Promise<User | null> {
  const where = { auth0Id };
  const whereStr = encodeURIComponent(JSON.stringify(where));
  const res = await fetch(`${API_URL}/classes/UserProfile?where=${whereStr}&limit=1`, {
    method: 'GET',
    headers: HEADERS,
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error('queryUserByAuth0Id error', res.status, txt);
    return null;
  }
  const data = await res.json();
  return data.results?.[0] ?? null;
}

async function getFollowers(userId: string): Promise<User[]> {
  const where = { followingId: userId };
  const whereStr = encodeURIComponent(JSON.stringify(where));
  const res = await fetch(`${API_URL}/classes/Follow?where=${whereStr}`, {
    method: 'GET',
    headers: HEADERS,
  });

  if (!res.ok) {
    console.error('getFollowers error', res.status);
    return [];
  }

  const data = await res.json();
  const follows = data.results || [];

  const users: User[] = [];
  for (const follow of follows) {
    const user = await queryUserByAuth0Id(follow.followerId);
    if (user) {
      users.push(user);
    }
  }

  return users;
}

async function getFollowing(userId: string): Promise<User[]> {
  const where = { followerId: userId };
  const whereStr = encodeURIComponent(JSON.stringify(where));
  const res = await fetch(`${API_URL}/classes/Follow?where=${whereStr}`, {
    method: 'GET',
    headers: HEADERS,
  });

  if (!res.ok) {
    console.error('getFollowing error', res.status);
    return [];
  }

  const data = await res.json();
  const follows = data.results || [];

  const users: User[] = [];
  for (const follow of follows) {
    const user = await queryUserByAuth0Id(follow.followingId);
    if (user) {
      users.push(user);
    }
  }

  return users;
}

interface UserItemProps {
  user: User;
  onPress: () => void;
}

function UserItem({ user, onPress }: UserItemProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity style={styles.userItem} onPress={onPress}>
      {user.profilePicUrl ? (
        <Image source={{ uri: user.profilePicUrl }} style={styles.userAvatar} />
      ) : (
        <View style={[styles.userAvatarPlaceholder, { backgroundColor: colors.secondaryText }]}>
          <Ionicons name="person" size={24} color={colors.background} />
        </View>
      )}
      <View style={styles.userInfo}>
        <Text style={[styles.userUsername, { color: colors.text }]}>{user.username}</Text>
        <Text style={[styles.userBio, { color: colors.secondaryText }]} numberOfLines={1}>
          {user.bio || 'No bio'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function FollowingFollowersScreen() {
  const route = useRoute<FollowingFollowersRouteProp>();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const { userId, type, username } = route.params as Params;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        let fetchedUsers: User[] = [];
        if (type === 'followers') {
          fetchedUsers = await getFollowers(userId);
        } else if (type === 'following') {
          fetchedUsers = await getFollowing(userId);
        }
        setUsers(fetchedUsers);
      } catch (err) {
        console.error('Failed to fetch users:', err);
        setError('Failed to load list');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [userId, type]);

  const title = type === 'followers' ? 'Followers' : 'Following';

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.text} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading {title.toLowerCase()}...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {username}'s {title}
        </Text>
        <View style={styles.placeholderHeader} />
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
        </View>
      ) : users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color={colors.secondaryText} />
          <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
            No {title.toLowerCase()} yet
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.objectId}
          renderItem={({ item }) => (
            <UserItem
              user={item}
              onPress={() =>
                navigation.navigate('UserProfile', {
                  userId: item.auth0Id,
                  username: item.username,
                  profilePicUrl: item.profilePicUrl || undefined,
                  bio: item.bio || undefined,
                  height: item.height || undefined,
                })
              }
            />
          )}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  placeholderHeader: {
    width: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  } as ImageStyle,
  userAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userUsername: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  userBio: {
    fontSize: 14,
  },
});