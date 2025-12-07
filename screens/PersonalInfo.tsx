// PersonalInfo.tsx — FIXED VERSION
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../ThemeContext';
import Ionicons from 'react-native-vector-icons/Ionicons';

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

export default function PersonalInfo() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{
    username?: string;
    email?: string;
    profilePicUrl?: string;
  }>({});

  useEffect(() => {
    (async () => {
      try {
        const auth0Id = await AsyncStorage.getItem('auth0Id');
        if (!auth0Id) {
          Alert.alert('Error', 'Not logged in');
          setLoading(false);
          return;
        }

        const response = await fetch(
          `${API_URL}/classes/UserProfile?where=${encodeURIComponent(
            JSON.stringify({ auth0Id })
          )}`,
          {
            headers: {
              'X-Parse-Application-Id': APP_ID,
              'X-Parse-Master-Key': MASTER_KEY,
            },
          }
        );

        const data = await response.json();
        const profile = data.results?.[0];

        if (!profile) {
          Alert.alert('Error', 'Profile not found');
          setLoading(false);
          return;
        }

        setUser({
          username: profile.username || 'No username',
          email: profile.email || 'No email',
          profilePicUrl: profile.profilePicUrl || undefined,
        });
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Personal Info</Text>

      <View style={styles.avatarContainer}>
        {user.profilePicUrl ? (
          <Image source={{ uri: user.profilePicUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.secondaryText }]}>
            <Ionicons name="person" size={60} color={colors.background} />
          </View>
        )}
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="person-outline" size={24} color={colors.secondaryText} />
        <Text style={[styles.label, { color: colors.text }]}>{user.username}</Text>
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="mail-outline" size={24} color={colors.secondaryText} />
        <Text style={[styles.label, { color: colors.text }]}>{user.email}</Text>
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="logo-google" size={24} color="#DB4437" />
        <Text style={[styles.label, { color: colors.text }]}>Google</Text>
      </View>
    </View>
  );
}

// styles stay exactly the same
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    marginBottom: 40,
    marginTop: 30,
  },
  avatarContainer: {
    marginBottom: 40,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 16,
  },
  label: {
    fontSize: 18,
  },
});