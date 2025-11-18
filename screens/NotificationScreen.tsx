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
      fetchNotifications();   // ← only this, NO polling
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
          { backgroundColor: item.read ? 'transparent' : 'rgba(99, 102, 241, 0.12)' },
        ]}
        onPress={() => markAsRead(item.objectId)}
      >
        <Image source={{ uri: picUrl }} style={styles.avatar} />
        <View style={styles.textContainer}>
          <Text style={[styles.username, { color: colors.text }]}>{username}</Text>
          <Text style={[styles.message, { color: colors.secondaryText }]}>
            started following you · {timeAgo(item.createdAt)}
          </Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
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
        refreshing={loading}                 // ← add this
        onRefresh={fetchNotifications}
        ListEmptyComponent={
          <Text style={{ color: colors.secondaryText, textAlign: 'center', marginTop: 50 }}>
            No notifications yet
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  item: {
    flexDirection: 'row',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 16 },              
  textContainer: { flex: 1 },   
  username: { fontWeight: '600', fontSize: 16 },   
  message: { fontSize: 14, marginTop: 4, opacity: 0.8 },        
  unreadDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#6366f1' },     
});