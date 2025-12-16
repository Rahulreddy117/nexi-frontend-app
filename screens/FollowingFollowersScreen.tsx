// screens/FollowingFollowersScreen.tsx - RESPONSIVE UI
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
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
  const insets = useSafeAreaInsets();
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
      style={[styles.item, { borderBottomColor: colors.border }]}
      onPress={() =>
        navigation.navigate('UserProfile', {
          userId: item.auth0Id,
          username: item.username,
          profilePicUrl: item.profilePicUrl,
          bio: item.bio,
          height: item.height,
        })
      }
      activeOpacity={0.7}
    >
      <View style={styles.itemContent}>
        {item.profilePicUrl ? (
          <Image source={{ uri: item.profilePicUrl }} style={[styles.avatar, { borderColor: colors.border }]} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.placeholderBackground }]}>
            <Ionicons name="person" size={moderateScale(32)} color={colors.placeholderText} />
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
            {item.username}
          </Text>
          {item.bio ? (
            <Text style={[styles.bio, { color: colors.secondaryText }]} numberOfLines={2}>
              {item.bio}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={moderateScale(20)} color={colors.secondaryText} />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['left', 'right', 'bottom']}>
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.iconColor} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading {type}...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['left', 'right', 'bottom']}>
      <View style={styles.container}>
        {/* Top Bar */}
        <View
          style={[
            styles.topBar,
            {
              backgroundColor: colors.background,
              borderBottomColor: colors.border,
              paddingTop: insets.top + hp('0%'),
            },
          ]}
        >
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={moderateScale(28)} color={colors.iconColor} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
          </View>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        {users.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconContainer, { backgroundColor: colors.card }]}>
              <Ionicons name="people-outline" size={moderateScale(64)} color={colors.secondaryText} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No {type} yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>
              {type === 'followers' ? 'No one is following this user yet' : 'This user is not following anyone yet'}
            </Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Top Bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingBottom: hp('1.8%'),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    padding: scale(6),
  },
  titleContainer: {
    flex: 1,
    marginLeft: wp('2%'),
    marginRight: wp('8%'),
    alignItems: 'center',
  },
  title: {
    fontSize: moderateScale(19),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  placeholder: {
    width: moderateScale(40),
  },
  // List
  list: {
    paddingHorizontal: wp('4%'),
    paddingTop: hp('1%'),
    paddingBottom: hp('2%'),
  },
  // List Item
  item: {
    paddingVertical: hp('1.8%'),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    borderWidth: 1.5,
  },
  avatarPlaceholder: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: wp('3.5%'),
    marginRight: wp('2%'),
  },
  username: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: hp('0.3%'),
  },
  bio: {
    fontSize: moderateScale(13),
    lineHeight: moderateScale(18),
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: hp('1.5%'),
  },
  loadingText: {
    fontSize: moderateScale(15),
    fontWeight: '500',
  },
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp('10%'),
  },
  emptyIconContainer: {
    width: moderateScale(120),
    height: moderateScale(120),
    borderRadius: moderateScale(60),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  emptyTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    marginBottom: hp('0.8%'),
  },
  emptySubtitle: {
    fontSize: moderateScale(15),
    textAlign: 'center',
    lineHeight: moderateScale(22),
  },
});