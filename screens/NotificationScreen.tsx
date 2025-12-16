// screens/NotificationScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

const timeAgo = (dateString: string): string => {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

export default function NotificationScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    const auth0Id = await AsyncStorage.getItem('auth0Id');
    if (!auth0Id) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `${API_URL}/classes/FollowNotification?where=${encodeURIComponent(
          JSON.stringify({ followedId: auth0Id })
        )}&order=-createdAt&include=followerProfile`,
        {
          headers: {
            'X-Parse-Application-Id': APP_ID,
            'X-Parse-Master-Key': MASTER_KEY,
          },
        }
      );
      const data = await res.json();
      setNotifications(data.results || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  const markAsRead = async (id: string) => {
    try {
      await fetch(`${API_URL}/classes/FollowNotification/${id}`, {
        method: 'PUT',
        headers: {
          'X-Parse-Application-Id': APP_ID,
          'X-Parse-Master-Key': MASTER_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ read: true }),
      });

      setNotifications(prev =>
        prev.map(n => (n.objectId === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error('Mark as read failed:', err);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const profile = item.followerProfile;
    const username = profile?.username || 'Someone';
    const picUrl = profile?.profilePicUrl || `https://ui-avatars.com/api/?name=${username}&background=6366f1&color=fff`;

    return (
      <TouchableOpacity
        style={[
          styles.item,
          { 
            backgroundColor: item.read ? colors.card : 'rgba(99, 102, 241, 0.12)',
            borderColor: colors.border,
          },
        ]}
        onPress={() => {
          markAsRead(item.objectId);
          if (profile) {
            navigation.navigate('UserProfile', {
              userId: profile.auth0Id,
              username: profile.username,
              profilePicUrl: profile.profilePicUrl,
              bio: profile.bio,
              height: profile.height,
            });
          }
        }}
        activeOpacity={0.7}
      >
        <Image source={{ uri: picUrl }} style={styles.avatar} />
        <View style={styles.textContainer}>
          <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
            {username}
          </Text>
          <View style={styles.messageRow}>
            <Ionicons 
              name="person-add" 
              size={moderateScale(14)} 
              color={colors.secondaryText} 
              style={styles.followIcon}
            />
            <Text style={[styles.message, { color: colors.secondaryText }]}>
              started following you
            </Text>
          </View>
          <Text style={[styles.timeText, { color: colors.secondaryText }]}>
            {timeAgo(item.createdAt)}
          </Text>
        </View>
        {!item.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.secondaryText }]}>
            Loading notifications...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
        {notifications.length > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={styles.badgeText}>{notifications.filter(n => !n.read).length}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={item => item.objectId}
        renderItem={renderItem}
        refreshing={loading}
        onRefresh={fetchNotifications}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.iconContainer, { backgroundColor: colors.card }]}>
              <Ionicons name="notifications-outline" size={moderateScale(56)} color={colors.secondaryText} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Notifications Yet!</Text>
            
          </View>
        }
      />
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
    justifyContent: 'center',
    marginBottom: hp('2%'),
    paddingHorizontal: wp('4%'),
    paddingTop: hp('1.8%'),
    gap: wp('2%'),
  },
  title: { 
    fontSize: moderateScale(28), 
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badge: {
    minWidth: moderateScale(28),
    height: moderateScale(28),
    borderRadius: moderateScale(14),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(8),
  },
  badgeText: {
    color: '#fff',
    fontSize: moderateScale(13),
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: wp('4%'),
    paddingBottom: hp('2%'),
    flexGrow: 1,
  },
  item: {
    flexDirection: 'row',
    padding: scale(11),
    marginBottom: hp('1.2%'),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: { 
    width: moderateScale(50), 
    height: moderateScale(50), 
    borderRadius: moderateScale(28), 
    marginRight: wp('3%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  textContainer: { 
    flex: 1,
    gap: verticalScale(3),
  },
  username: { 
    fontWeight: '700', 
    fontSize: moderateScale(16),
    letterSpacing: 0.2,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  followIcon: {
    marginRight: wp('1.5%'),
  },
  message: { 
    fontSize: moderateScale(14),
    fontWeight: '500',
  },
  timeText: {
    fontSize: moderateScale(12),
    fontWeight: '500',
    opacity: 0.7,
  },
  unreadDot: { 
    width: moderateScale(12), 
    height: moderateScale(12), 
    borderRadius: moderateScale(6),
    marginLeft: wp('2%'),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: hp('2%'),
  },
  loadingText: {
    fontSize: moderateScale(15),
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: hp('12%'),
    gap: hp('1.5%'),
  },
  iconContainer: {
    width: moderateScale(120),
    height: moderateScale(120),
    borderRadius: moderateScale(60),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  emptyTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  emptyText: {
    fontSize: moderateScale(15),
    textAlign: 'center',
    lineHeight: moderateScale(22),
    paddingHorizontal: wp('10%'),
    fontWeight: '500',
  },
});