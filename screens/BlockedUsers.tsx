// screens/BlockedUsers.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../ThemeContext';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';
const HEADERS = {
  'X-Parse-Application-Id': APP_ID,
  'X-Parse-Master-Key': MASTER_KEY,
  'Content-Type': 'application/json',
};

interface BlockedUser {
  objectId: string;
  auth0Id: string;
  username?: string;
  profilePicUrl?: string;
}

export default function BlockedUsersScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [myObjectId, setMyObjectId] = useState<string | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const parseId = await AsyncStorage.getItem('parseObjectId');
      setMyObjectId(parseId);

      if (!parseId) {
        Alert.alert('Error', 'User not found');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/classes/UserProfile/${parseId}`, {
          method: 'GET',
          headers: HEADERS,
        });

        if (!res.ok) throw new Error('Failed to load profile');

        const data = await res.json();
        const blockedIds: string[] = data.blocked || [];

        if (blockedIds.length === 0) {
          setBlockedUsers([]);
          setLoading(false);
          return;
        }

        // Fetch each blocked user's profile
        const users = await Promise.all(
          blockedIds.map(async (auth0Id: string) => {
            const where = { auth0Id };
            const whereStr = encodeURIComponent(JSON.stringify(where));
            const userRes = await fetch(
              `${API_URL}/classes/UserProfile?where=${whereStr}&limit=1`,
              { headers: HEADERS }
            );

            if (!userRes.ok) return null;

            const userData = await userRes.json();
            return userData.results[0] || null;
          })
        );

        setBlockedUsers(users.filter(Boolean) as BlockedUser[]);
      } catch (err) {
        console.error('Failed to load blocked users:', err);
        Alert.alert('Error', 'Could not load blocked users');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleUnblock = async (blockedAuth0Id: string, blockedObjectId: string) => {
  if (!myObjectId) return;

  Alert.alert(
    'Unblock User',
    'Are you sure you want to unblock this user?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        style: 'destructive',
        onPress: async () => {
          setUnblockingId(blockedAuth0Id);
          try {
            // ONLY remove from MY blocked list — one-way unblock
            await fetch(`${API_URL}/classes/UserProfile/${myObjectId}`, {
              method: 'PUT',
              headers: HEADERS,
              body: JSON.stringify({
                blocked: {
                  __op: 'Remove',
                  objects: [blockedAuth0Id],
                },
              }),
            });

            // DO NOT touch the other user's blocked list
            // They may still have you blocked — that's their choice

            setBlockedUsers(prev => prev.filter(u => u.auth0Id !== blockedAuth0Id));
            Alert.alert('Success', 'User has been unblocked');
          } catch (err) {
            console.error('Unblock error:', err);
            Alert.alert('Error', 'Failed to unblock user');
          } finally {
            setUnblockingId(null);
          }
        },
      },
    ]
  );
};

  const renderHeader = () => (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={moderateScale(24)} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.text }]}>
        Blocked Users
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconContainer, { backgroundColor: colors.card }]}>
        <Ionicons name="ban-outline" size={moderateScale(60)} color={colors.secondaryText} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Blocked Users
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.secondaryText}]}>
        
      </Text>
    </View>
  );

  const renderUserItem = ({ item }: { item: BlockedUser }) => {
    const isUnblocking = unblockingId === item.auth0Id;

    return (
      <View style={[styles.userItem, { borderBottomColor: colors.border }]}>
        <View style={styles.userInfo}>
          {item.profilePicUrl ? (
            <Image
              source={{ uri: item.profilePicUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.card }]}>
              <Ionicons name="person" size={moderateScale(24)} color={colors.secondaryText} /> 
            </View>
          )}
          <View style={styles.userTextContainer}>
            <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
              {item.username || 'Unknown User'}
            </Text>
            <Text style={[styles.blockedLabel, { color: colors.primary }]}>
              Blocked
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => handleUnblock(item.auth0Id, item.objectId)}
          style={[
            styles.unblockBtn,
            { backgroundColor: colors.card },
            isUnblocking && styles.unblockBtnDisabled,
          ]}
          activeOpacity={0.7}
          disabled={isUnblocking}
        >
          {isUnblocking ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.unblockText, { color: colors.primary }]}>
              Unblock
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.primary}]}>
            Loading blocked users...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {renderHeader()}
      
      {blockedUsers.length === 0 ? (
        renderEmptyState()
      ) : (
        <View style={styles.listContainer}>
          <Text style={[styles.countText, { color: colors.primary }]}>
            {blockedUsers.length} {blockedUsers.length === 1 ? 'user' : 'users'} blocked
          </Text>
          <FlatList
            data={blockedUsers}
            keyExtractor={item => item.objectId}
            renderItem={renderUserItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </SafeAreaView>
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
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  backButton: {
    padding: scale(4),
  },
  headerTitle: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: moderateScale(32),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: hp('2%'),
    fontSize: moderateScale(15),
    fontWeight: '500',
  },
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
    marginBottom: hp('3%'),
  },
  emptyTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    marginBottom: hp('1%'),
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: moderateScale(15),
    textAlign: 'center',
    lineHeight: moderateScale(22),
  },
  listContainer: {
    flex: 1,
  },
  countText: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.5%'),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: wp('4%'),
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: hp('2%'),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: wp('3%'),
  },
  avatar: {
    width: moderateScale(52),
    height: moderateScale(52),
    borderRadius: moderateScale(26),
  },
  avatarPlaceholder: {
    width: moderateScale(52),
    height: moderateScale(52),
    borderRadius: moderateScale(26),
    justifyContent: 'center',
    alignItems: 'center',
  },
  userTextContainer: {
    flex: 1,
    gap: hp('0.3%'),
  },
  username: {
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
  blockedLabel: {
    fontSize: moderateScale(13),
    fontWeight: '500',
  },
  unblockBtn: {
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.2%'),
    borderRadius: moderateScale(20),
    minWidth: moderateScale(90),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  unblockBtnDisabled: {
    opacity: 0.6,
  },
  unblockText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
  },
});