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
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../ThemeContext';

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';
const HEADERS = {
  'X-Parse-Application-Id': APP_ID,
  'X-Parse-Master-Key': MASTER_KEY,
  'Content-Type': 'application/json',
};

// Helper: "X minutes ago", "1 hour ago", "3 days ago"
const timeAgo = (dateString: string): string => {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

export default function NotificationScreen() {
  const { colors } = useTheme();
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
        { headers: HEADERS }
      );
      const data = await res.json();
      setNotifications(data.results || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`${API_URL}/classes/FollowNotification/${id}`, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({ read: true }),
      });
      setNotifications(prev =>
        prev.map(n => (n.objectId === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const profile = item.followerProfile;
    const username = profile?.username || 'Someone';
    const picUrl =
      profile?.profilePicUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=6366f1&color=fff`;
    const time = item.createdAt ? timeAgo(item.createdAt) : 'just now';

    return (
      <TouchableOpacity
        style={[
          styles.item,
          {
            backgroundColor: item.read
              ? 'transparent'
              : colors.notificationBg || 'rgba(99, 102, 241, 0.1)',
          },
        ]}
        onPress={() => markAsRead(item.objectId)}
      >
        <Image source={{ uri: picUrl }} style={styles.avatar} />
        <View style={styles.textContainer}>
          <Text style={[styles.username, { color: colors.text }]}>
            {username}
          </Text>
          <Text style={[styles.message, { color: colors.secondaryText }]}>
            started following you · {time}
          </Text>
        </View>
        {!item.read && <View style={styles.dot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
      <FlatList
        data={notifications}
        keyExtractor={item => item.objectId}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text
            style={{
              color: colors.secondaryText,
              textAlign: 'center',
              marginTop: 20,
            }}
          >
            No notifications yet
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  item: {
    flexDirection: 'row',
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 14 },
  textContainer: { flex: 1 },
  username: { fontWeight: '600', fontSize: 16 },
  message: { fontSize: 13.5, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#6366f1' },
});