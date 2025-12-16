import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Linking,
  ScrollView,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RootStackParamList } from '../types/navigation';
import Ionicons from 'react-native-vector-icons/Ionicons';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function TermsAndConditionsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [isCheckboxChecked, setIsCheckboxChecked] = useState(false);

  const handleAcceptTerms = async () => {
    try {
      await AsyncStorage.setItem('termsAccepted', 'true');
      navigation.replace('Login');
    } catch (e) {
      console.error('Error saving terms acceptance:', e);
      Alert.alert('Error', 'Failed to save terms acceptance');
    }
  };

  const openPrivacyPolicy = () => {
    Linking.openURL('https://example.com/privacy-policy');
  };

  const openTermsAndConditions = () => {
    Linking.openURL('https://example.com/terms-and-conditions');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Welcome Header */}
        <Text style={styles.welcomeTitle}>Welcome to Nexi! 🎉</Text>
        
        <Text style={styles.welcomeText}>
          Before continuing, please confirm that you have read and agree to our Privacy Policy and Terms & Conditions.
        </Text>

        {/* Links */}
        <View style={styles.linksContainer}>
          <TouchableOpacity onPress={openPrivacyPolicy} style={styles.linkButton}>
            <Ionicons name="document-text-outline" size={20} color="#6366f1" />
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={openTermsAndConditions} style={styles.linkButton}>
            <Ionicons name="document-text-outline" size={20} color="#6366f1" />
            <Text style={styles.linkText}>Terms & Conditions</Text>
          </TouchableOpacity>
        </View>

        {/* Checkbox */}
        <TouchableOpacity 
          style={styles.checkboxContainer}
          onPress={() => setIsCheckboxChecked(!isCheckboxChecked)}
        >
          <View style={[styles.checkbox, isCheckboxChecked && styles.checkboxChecked]}>
            {isCheckboxChecked && (
              <Ionicons name="checkmark" size={18} color="#fff" />
            )}
          </View>
          <Text style={styles.checkboxLabel}>
            I agree to the Privacy Policy and Terms & Conditions
          </Text>
        </TouchableOpacity>

        {/* Continue Button */}
        <TouchableOpacity
          style={[
            styles.continueButton,
            !isCheckboxChecked && styles.continueButtonDisabled
          ]}
          onPress={handleAcceptTerms}
          disabled={!isCheckboxChecked}
        >
          <Text style={[
            styles.continueButtonText,
            !isCheckboxChecked && styles.continueButtonTextDisabled
          ]}>
            Continue
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  linksContainer: {
    marginBottom: 24,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    marginBottom: 12,
  },
  linkText: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '600',
    marginLeft: 10,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#4b5563',
    flex: 1,
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  continueButtonDisabled: {
    backgroundColor: '#d1d5db',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  continueButtonTextDisabled: {
    color: '#9ca3af',
  },
});