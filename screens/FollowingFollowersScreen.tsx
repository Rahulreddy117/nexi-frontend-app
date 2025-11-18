// screens/FollowingFollowersScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { RootStackParamList } from '../types/navigation';
import { useTheme } from '../ThemeContext';

type FollowingFollowersParams = {
  userAuth0Id: string;
  type: 'followers' | 'following';
};

type FollowingFollowersRouteProp = RouteProp<
  RootStackParamList & { FollowingFollowers: FollowingFollowersParams },
  'FollowingFollowers'
>;

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';
const HEADERS = {
  'X-Parse-Application-Id': APP_ID,
  'X-Parse-Master-Key': MASTER_KEY,
  'Content-Type': 'application/json',
};

async function fetchFollowers(userAuth0Id: string): Promise<any[]> {
  const where = { followingId: userAuth0Id };
  const whereStr = encodeURIComponent(JSON.stringify(where));
  const res = await fetch(`${API_URL}/classes/Follow?where=${whereStr}`, {
    method: 'GET',
    headers: HEADERS,
  });
  if (!res.ok) return [];
  const data = await res.json();
  const follows = data.results || [];
  const followerIds = follows.map((f: any) => f.followerId);
  if (followerIds.length === 0) return [];
  const usersWhere = { auth0Id: { $in: followerIds } };
  const usersWhereStr = encodeURIComponent(JSON.stringify(usersWhere));
  const usersRes = await fetch(`${API_URL}/classes/UserProfile?where=${usersWhereStr}`, {
    method: 'GET',
    headers: HEADERS,
  });
  if (!usersRes.ok) return [];
  const usersData = await usersRes.json();
  return usersData.results || [];
}

async function fetchFollowing(userAuth0Id: string): Promise<any[]> {
  const where = { followerId: userAuth0Id };
  const whereStr = encodeURIComponent(JSON.stringify(where));
  const res = await fetch(`${API_URL}/classes/Follow?where=${whereStr}`, {
    method: 'GET',
    headers: HEADERS,
  });
  if (!res.ok) return [];
  const data = await res.json();
  const follows = data.results || [];
  const followingIds = follows.map((f: any) => f.followingId);
  if (followingIds.length === 0) return [];
  const usersWhere = { auth0Id: { $in: followingIds } };
  const usersWhereStr = encodeURIComponent(JSON.stringify(usersWhere));
  const usersRes = await fetch(`${API_URL}/classes/UserProfile?where=${usersWhereStr}`, {
    method: 'GET',
    headers: HEADERS,
  });
  if (!usersRes.ok) return [];
  const usersData = await usersRes.json();
  return usersData.results || [];
}

export default function FollowingFollowersScreen() {
  const route = useRoute<FollowingFollowersRouteProp>();
  const navigation = useNavigation<any>();
  const { userAuth0Id, type } = route.params;
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();
  const title = type === 'followers' ? 'Followers' : 'Following';

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        let data: any[] = [];
        if (type === 'followers') {
          data = await fetchFollowers(userAuth0Id);
        } else {
          data = await fetchFollowing(userAuth0Id);
        }
        setUsers(data);
      } catch (err) {
        console.error('Failed to fetch list:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userAuth0Id, type]);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.item}
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
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person" size={40} color={colors.secondaryText} />
        </View>
      )}
      <View style={styles.userInfo}>
        <Text style={[styles.username, { color: colors.text }]}>{item.username}</Text>
        {item.bio ? <Text style={[styles.bio, { color: colors.secondaryText }]}>{item.bio}</Text> : null}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <View style={styles.placeholderHeader} />
      </View>
      {users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color={colors.secondaryText} />
          <Text style={[styles.emptyText, { color: colors.secondaryText }]}>No {type} yet</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderItem}
          keyExtractor={(item) => item.objectId}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: { padding: 4 },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold' },
  placeholderHeader: { width: 24, height: 24 }, // Placeholder for alignment
  list: { padding: 16 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: { width: 60, height: 60, borderRadius: 30, marginRight: 16 },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userInfo: { flex: 1 },
  username: { fontSize: 16, fontWeight: 'bold' },
  bio: { fontSize: 14, marginTop: 2 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: { fontSize: 16, marginTop: 8, textAlign: 'center' },
});