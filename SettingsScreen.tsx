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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';

import type { RootStackParamList } from './types/navigation';
import { useTheme } from './ThemeContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { LocationModule } = NativeModules;

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { mode, colors, toggleTheme } = useTheme();

  const ThemedButton = ({
    title,
    onPress,
    disabled,
  }: {
    title: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: disabled ? colors.secondaryText : colors.accent },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <Text style={[styles.buttonText, { color: colors.buttonText }]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove(['idToken', 'parseObjectId']);

      // Stop native location service if running
      if (Platform.OS === 'android' && LocationModule?.stopLocationSharing) {
        await LocationModule.stopLocationSharing();
      }

      // Fully typed reset to Login screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login', params: undefined }],
      });
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      <Text style={[styles.info, { color: colors.secondaryText }]}>
        Configure your app settings here.
      </Text>

      {/* Dark Mode Toggle */}
      <View style={[styles.toggleContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.toggleLabel, { color: colors.text }]}>Dark Mode</Text>
        <Switch
          value={mode === 'dark'}
          onValueChange={toggleTheme}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={mode === 'dark' ? '#f5dd4b' : '#f4f3f4'}
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <ThemedButton title="Back" onPress={() => navigation.goBack()} />

        <ThemedButton
          title="Logout"
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
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 20,
  },
  info: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  toggleLabel: {
    fontSize: 18,
    fontWeight: '500',
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});