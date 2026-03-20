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
import { SafeAreaView } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

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
    Linking.openURL('https://sites.google.com/view/nexi-privacy-policy/home');
  };

  const openTermsAndConditions = () => {
    Linking.openURL('https://sites.google.com/view/nexi-privacy-policy/termsconditions');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Section with Icon */}
        <View style={styles.topSection}>
          <View style={styles.iconCircle}>
            <View style={styles.iconInnerCircle}>
              <Ionicons name="shield-checkmark-outline" size={moderateScale(42)} color="#3b82f6" />
            </View>
          </View>
          
          <Text style={styles.welcomeTitle}>Welcome to Nexi!</Text>
          <Text style={styles.subtitle}>Let's get you started 🚀</Text>
        </View>

        {/* Main Content Card */}
        <View style={styles.mainCard}>
          <Text style={styles.cardTitle}>Review & Accept</Text>
          <Text style={styles.cardDescription}>
            Please take a moment to review our policies before continuing.
          </Text>

          {/* Policy Links */}
          <View style={styles.linksContainer}>
            <TouchableOpacity 
              onPress={openPrivacyPolicy} 
              style={styles.policyCard}
              activeOpacity={0.7}
            >
              <View style={styles.policyIconWrapper}>
                <Ionicons name="lock-closed" size={moderateScale(22)} color="#3b82f6" />
              </View>
              <View style={styles.policyTextContainer}>
                <Text style={styles.policyTitle}>Privacy Policy</Text>
                <Text style={styles.policySubtext}>How we protect your data</Text>
              </View>
              <Ionicons name="arrow-forward" size={moderateScale(20)} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={openTermsAndConditions} 
              style={styles.policyCard}
              activeOpacity={0.7}
            >
              <View style={styles.policyIconWrapper}>
                <Ionicons name="document-text" size={moderateScale(22)} color="#8b5cf6" />
              </View>
              <View style={styles.policyTextContainer}>
                <Text style={styles.policyTitle}>Terms & Conditions</Text>
                <Text style={styles.policySubtext}>Our service agreement</Text>
              </View>
              <Ionicons name="arrow-forward" size={moderateScale(20)} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Agreement Checkbox */}
          <TouchableOpacity 
            style={styles.agreementContainer}
            onPress={() => setIsCheckboxChecked(!isCheckboxChecked)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, isCheckboxChecked && styles.checkboxChecked]}>
              {isCheckboxChecked && (
                <Ionicons name="checkmark" size={moderateScale(16)} color="#fff" />
              )}
            </View>
            <Text style={styles.agreementText}>
              I have read and agree to the Privacy Policy and Terms & Conditions
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
            activeOpacity={0.85}
          >
            <Text style={[
              styles.continueButtonText,
              !isCheckboxChecked && styles.continueButtonTextDisabled
            ]}>
              Continue to App
            </Text>
            <Ionicons 
              name="arrow-forward-circle" 
              size={moderateScale(24)} 
              color={isCheckboxChecked ? '#fff' : '#cbd5e1'} 
            />
          </TouchableOpacity>
        </View>

        {/* Bottom Spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: wp('5%'),
    paddingTop: hp('3%'),
  },
  topSection: {
    alignItems: 'center',
    marginBottom: hp('3%'),
  },
  iconCircle: {
    width: moderateScale(90),
    height: moderateScale(90),
    borderRadius: moderateScale(45),
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp('2%'),
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  iconInnerCircle: {
    width: moderateScale(75),
    height: moderateScale(75),
    borderRadius: moderateScale(37.5),
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: moderateScale(28),
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: hp('0.5%'),
  },
  subtitle: {
    fontSize: moderateScale(16),
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
  },
  mainCard: {
    backgroundColor: '#ffffff',
    borderRadius: moderateScale(20),
    padding: wp('6%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  cardTitle: {
    fontSize: moderateScale(20),
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: hp('0.8%'),
  },
  cardDescription: {
    fontSize: moderateScale(14),
    color: '#64748b',
    lineHeight: moderateScale(20),
    marginBottom: hp('3%'),
  },
  linksContainer: {
    gap: hp('1.5%'),
    marginBottom: hp('3%'),
  },
  policyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingVertical: hp('2%'),
    paddingHorizontal: wp('4%'),
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  policyIconWrapper: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(12),
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp('3%'),
  },
  policyTextContainer: {
    flex: 1,
  },
  policyTitle: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: hp('0.3%'),
  },
  policySubtext: {
    fontSize: moderateScale(12),
    color: '#64748b',
  },
  agreementContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: wp('4%'),
    backgroundColor: '#f1f5f9',
    borderRadius: moderateScale(12),
    marginBottom: hp('3%'),
  },
  checkbox: {
    width: moderateScale(22),
    height: moderateScale(22),
    borderRadius: moderateScale(6),
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    marginRight: wp('3%'),
    marginTop: hp('0.2%'),
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  agreementText: {
    flex: 1,
    fontSize: moderateScale(13),
    color: '#475569',
    lineHeight: moderateScale(19),
    fontWeight: '500',
  },
  continueButton: {
    flexDirection: 'row',
    backgroundColor: '#3b82f6',
    paddingVertical: hp('2%'),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp('2%'),
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  continueButtonDisabled: {
    backgroundColor: '#e2e8f0',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: moderateScale(16),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  continueButtonTextDisabled: {
    color: '#94a3b8',
  },
  bottomSpacer: {
    height: hp('2%'),
  },
});