// PersonalInfo.tsx — FIXED VERSION with Responsive Design
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../ThemeContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.secondaryText }]}>
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Personal Info</Text>
        </View>

        <View style={styles.avatarContainer}>
          {user.profilePicUrl ? (
            <Image source={{ uri: user.profilePicUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.card }]}>
              <Ionicons name="person" size={moderateScale(56)} color={colors.secondaryText} />
            </View>
          )}
        </View>

        <View style={styles.infoContainer}>
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.infoRow}>
              <View style={[styles.iconContainer, { backgroundColor: colors.background }]}>
                <Ionicons name="person-outline" size={moderateScale(22)} color={colors.primary} />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={[styles.infoLabel, { color: colors.secondaryText }]}>Username</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{user.username}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.infoRow}>
              <View style={[styles.iconContainer, { backgroundColor: colors.background }]}>
                <Ionicons name="mail-outline" size={moderateScale(22)} color={colors.primary} />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={[styles.infoLabel, { color: colors.secondaryText }]}>Email</Text>
                <Text
  style={[styles.infoValue, { color: colors.text }]}
  numberOfLines={2}
  ellipsizeMode="tail"
>
  {user.email}
</Text>

              </View>
            </View>
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.infoRow}>
              <View style={[styles.iconContainer, { backgroundColor: '#FEF3F2' }]}>
                <Ionicons name="logo-google" size={moderateScale(22)} color="#DB4437" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={[styles.infoLabel, { color: colors.secondaryText }]}>Connected Account</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>Google</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: wp('4%'),
    paddingBottom: hp('3%'),
  },
  header: {
    alignItems: 'center',
    paddingTop: hp('1.8%'),
    marginBottom: hp('3%'),
  },
  title: {
    fontSize: moderateScale(28),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: hp('4%'),
  },
  avatar: {
    width: moderateScale(110),
    height: moderateScale(110),
    borderRadius: moderateScale(55),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarPlaceholder: {
    width: moderateScale(110),
    height: moderateScale(110),
    borderRadius: moderateScale(55),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
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
  infoContainer: {
    gap: hp('1.5%'),
  },
  infoCard: {
    borderRadius: moderateScale(16),
    padding: scale(14),
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp('3.5%'),
  },
  infoTextContainer: {
    flex: 1,
    gap: verticalScale(3),
  },
  infoLabel: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    opacity: 0.8,
  },
  infoValue: {
    fontSize: moderateScale(14),
    fontWeight: '400',
    letterSpacing: 0.2,
  },
});