import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
  NativeModules,
  ScrollView,
  Linking, // ← Add this
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

import type { RootStackParamList } from './types/navigation';
import { useTheme } from './ThemeContext';

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { LocationModule } = NativeModules;

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { mode, colors, toggleTheme } = useTheme();

  const handlePersonalInfo = () => {
    navigation.navigate('PersonalInfo' as never);
  };


    const openPrivacyPolicy = () => {
    Linking.openURL('https://your-app.com/privacy-policy'); // ← Replace with your real URL
  };

  const openTermsAndConditions = () => {
    Linking.openURL('https://your-app.com/terms-and-conditions'); // ← Replace with your real URL
  };

  const handleJoinedRooms = async () => {
    try {
      const parseObjectId = await AsyncStorage.getItem('parseObjectId');
      if (!parseObjectId) {
        Alert.alert('Error', 'User data not found. Please log in again.');
        return;
      }
      navigation.navigate('JoinedRooms', { userParseObjectId: parseObjectId });
    } catch (err) {
      Alert.alert('Error', 'Could not open Joined Rooms');
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove(['idToken', 'parseObjectId', 'sessionToken']);

      if (Platform.OS === 'android' && LocationModule?.stopLocationSharing) {
        await LocationModule.stopLocationSharing();
      }

      navigation.reset({
        index: 0,
        routes: [{ name: 'Login', params: undefined }],
      });
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  const handleDeleteAccount = async () => {
    const auth0Id = await AsyncStorage.getItem('auth0Id');
    const parseObjectId = await AsyncStorage.getItem('parseObjectId');

    if (!auth0Id || !parseObjectId) {
      Alert.alert('Error', 'Not logged in');
      return;
    }

    Alert.alert(
      'Delete Account',
      'This will permanently delete:\n• Your profile\n• All messages\n• All follows\n• All your rooms and posts\n\nThis action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const headers = {
                'X-Parse-Application-Id': APP_ID,
                'X-Parse-Master-Key': MASTER_KEY,
                'Content-Type': 'application/json',
              };

              const deleteAll = async (className: string, where: any) => {
                const query = new URLSearchParams({
                  where: JSON.stringify(where),
                  limit: '1000',
                });
                const res = await fetch(`${API_URL}/classes/${className}?${query}`, { headers });
                const json = await res.json();
                const ids = json.results?.map((o: any) => o.objectId).filter(Boolean);
                if (ids?.length > 0) {
                  await fetch(`${API_URL}/batch`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                      requests: ids.map((id: string) => ({
                        method: 'DELETE',
                        path: `/parse/classes/${className}/${id}`,
                      })),
                    }),
                  });
                }
                return ids?.length || 0;
              };

              await fetch(`${API_URL}/classes/UserProfile/${parseObjectId}`, {
                method: 'DELETE',
                headers,
              });

              await deleteAll('Message', { $or: [{ senderId: auth0Id }, { receiverId: auth0Id }] });
              await deleteAll('Follow', { $or: [{ followerId: auth0Id }, { followingId: auth0Id }] });
              await deleteAll('FollowNotification', { $or: [{ followerId: auth0Id }, { followedId: auth0Id }] });

              const roomRes = await fetch(
                `${API_URL}/classes/Room?where=${encodeURIComponent(
                  JSON.stringify({
                    creator: {
                      __type: 'Pointer',
                      className: 'UserProfile',
                      objectId: parseObjectId,
                    },
                  })
                )}&limit=1000`,
                { headers }
              );
              const roomData = await roomRes.json();
              const roomIds = roomData.results?.map((r: any) => r.objectId).filter(Boolean);

              if (roomIds?.length > 0) {
                for (const roomId of roomIds) {
                  await deleteAll('RoomPost', {
                    room: { __type: 'Pointer', className: 'Room', objectId: roomId },
                  });
                }

                for (const roomId of roomIds) {
                  await deleteAll('RoomMember', {
                    room: { __type: 'Pointer', className: 'Room', objectId: roomId },
                  });
                }

                await fetch(`${API_URL}/batch`, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({
                    requests: roomIds.map((id: string) => ({
                      method: 'DELETE',
                      path: `/parse/classes/Room/${id}`,
                    })),
                  }),
                });
              }

              await deleteAll('RoomMember', {
                user: { __type: 'Pointer', className: 'UserProfile', objectId: parseObjectId },
              });

              await AsyncStorage.clear();

              Alert.alert('Success', 'Your account has been deleted.');
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            } catch (err: any) {
              console.error('Delete failed:', err);
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          },
        },
      ]
    );
  };

  const SettingItem = ({
    icon,
    title,
    subtitle,
    onPress,
    rightElement,
    danger = false,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    danger?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.settingItem, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: danger ? '#ff444420' : colors.background }]}>
        <Ionicons name={icon as any} size={moderateScale(22)} color={danger ? '#ff4444' : colors.primary} />
      </View>
      
      <View style={styles.settingTextContainer}>
        <Text style={[styles.settingTitle, { color: danger ? '#ff4444' : colors.text }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.settingSubtitle, { color: colors.secondaryText }]}>
            {subtitle}
          </Text>
        )}
      </View>

      {rightElement || (
        <Ionicons name="chevron-forward" size={moderateScale(20)} color={colors.secondaryText} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={moderateScale(24)} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>APPEARANCE</Text>
          
          <View style={[styles.settingItem, { backgroundColor: colors.card }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.background }]}>
              <Ionicons name="moon" size={moderateScale(22)} color={colors.primary} />
            </View>
            
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Dark Mode</Text>
              {mode === 'light' && (
                <Text style={[styles.settingSubtitle, { color: colors.secondaryText }]}>
                  Light mode coming soon!
                </Text>
              )}
            </View>

            <Switch
              value={mode === 'dark'}
              onValueChange={(newValue) => {
                if (newValue) {
                  toggleTheme();
                } else {
                  Alert.alert(
                    'Coming Soon',
                    'Light mode is under development. Stay tuned!',
                    [{ text: 'OK' }]
                  );
                }
              }}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={mode === 'dark' ? '#f5dd4b' : '#f4f3f4'}
              ios_backgroundColor="#767577"
            />
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>ACCOUNT</Text>
          
          <SettingItem
            icon="person-outline"
            title="Personal Info"
            subtitle="View and edit your profile"
            onPress={handlePersonalInfo}
          />
          
          <SettingItem
            icon="home-outline"
            title="Joined Rooms"
            subtitle="Manage your room memberships"
            onPress={handleJoinedRooms}
          />
          
          <SettingItem
            icon="ban-outline"
            title="Blocked Users"
            subtitle="Manage blocked accounts"
            onPress={() => navigation.navigate('BlockedUsers')}
          />
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>LEGAL</Text>
          
          <SettingItem
            icon="document-text-outline"
            title="Privacy Policy"
            subtitle="Read our privacy policy"
            onPress={openPrivacyPolicy}
          />
          
          <SettingItem
            icon="shield-checkmark-outline"
            title="Terms & Conditions"
            subtitle="Read our terms of service"
            onPress={openTermsAndConditions}
          />
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>ACTIONS</Text>
          
          <SettingItem
            icon="log-out-outline"
            title="Logout"
            subtitle="Sign out of your account"
            onPress={() => {
              Alert.alert(
                'Confirm Logout',
                'Are you sure you want to log out? This will stop location sharing and clear your session.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: handleLogout,
                  },
                ]
              );
            }}
          />
          
          <SettingItem
            icon="trash-outline"
            title="Delete Account"
            subtitle="Permanently delete your account"
            onPress={handleDeleteAccount}
            danger
          />
        </View>

        {/* Version Info */}
        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, { color: colors.secondaryText }]}>
            Version 1.0.0
          </Text>
        </View>
      </ScrollView>
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
    width: moderateScale(40),
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontWeight: '600',
    textAlign: 'center',
  },
  headerSpacer: {
    width: moderateScale(40),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: wp('4%'),
    paddingTop: hp('2%'),
    paddingBottom: hp('4%'),
  },
  section: {
    marginBottom: hp('3%'),
  },
  sectionTitle: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: hp('1.2%'),
    marginLeft: wp('1%'),
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.8%'),
    borderRadius: moderateScale(12),
    marginBottom: hp('1%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp('3%'),
  },
  settingTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  settingTitle: {
    fontSize: moderateScale(16),
    fontWeight: '500',
    marginBottom: hp('0.3%'),
  },
  settingSubtitle: {
    fontSize: moderateScale(13),
    lineHeight: moderateScale(18),
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: hp('2%'),
    paddingVertical: hp('2%'),
  },
  versionText: {
    fontSize: moderateScale(13),
    fontWeight: '500',
  },
});