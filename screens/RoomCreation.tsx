// screens/RoomCreation.tsx (updated with responsive design)
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

const UPLOAD_PRESET = 'ml_default';
const CLOUDINARY_CLOUD_NAME = 'deyouwm72';

export default function RoomCreationScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const [roomName, setRoomName] = useState('');
  const [roomPhoto, setRoomPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (roomName.length > 20) setNameError('Max 20 characters');
      else if (/\s/.test(roomName)) setNameError('No spaces allowed');
      else setNameError(null);
    }, 500);
    return () => clearTimeout(t);
  }, [roomName]);

  const pickImage = () => {
    ImagePicker.openPicker({
      width: 600,
      height: 600,
      cropping: true,
      mediaType: 'photo',
    })
      .then(img => setRoomPhoto(img.path))
      .catch(err => {
        if (err.code !== 'E_PICKER_CANCELLED') Alert.alert('Error', 'Failed to pick image');
      });
  };

  const uploadPhoto = async (uri: string, name: string): Promise<string | null> => {
    setUploading(true);
    try {
      const data = new FormData();
      data.append('file', { uri, type: 'image/jpeg', name: `${name}.jpg` } as any);
      data.append('upload_preset', UPLOAD_PRESET);
      data.append('folder', 'rooms');

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: data,
      });
      const json = await res.json();
      return json.secure_url || null;
    } catch (e) {
      console.error(e);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const goToLocationScreen = async () => {
    if (!roomName.trim()) return Alert.alert('Error', 'Room name is required');
    if (nameError) return Alert.alert('Error', nameError);
    if (!roomPhoto) return Alert.alert('Error', 'Please upload image');

    let finalPhotoUrl: string | null = roomPhoto;

    if (roomPhoto && !roomPhoto.startsWith('http')) {
      finalPhotoUrl = await uploadPhoto(roomPhoto, roomName);
      if (!finalPhotoUrl) {
        return Alert.alert('Error', 'Photo upload failed. Please try again.');
      }
    }

    proceed(finalPhotoUrl);
  };

  const proceed = (photoUrl: string | null) => {
    navigation.navigate('RoomLocation', {
      roomName: roomName.trim(),
      roomPhotoUrl: photoUrl,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Create New Room</Text>
          <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
            Set up your room in a few simple steps
          </Text>
        </View>

        {/* Photo Section */}
        <View style={styles.photoSection}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Room Photo</Text>
          <TouchableOpacity
            onPress={pickImage}
            style={styles.photoBtn}
            activeOpacity={0.7}
          >
            {roomPhoto ? (
              <View style={styles.photoWrapper}>
                <Image source={{ uri: roomPhoto }} style={styles.photo} />
                <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
                  <Ionicons name="camera" size={moderateScale(18)} color="#fff" />
                </View>
              </View>
            ) : (
              <View style={[styles.placeholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.iconCircle, { backgroundColor: colors.background }]}>
                  <Ionicons name="image-outline" size={moderateScale(36)} color={colors.primary} />
                </View>
                <Text style={[styles.placeholderText, { color: colors.text }]}>Add Photo</Text>
                <Text style={[styles.placeholderSubtext, { color: colors.secondaryText }]}>
                  Tap to select
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Room Name Section */}
        <View style={styles.inputSection}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Room Name</Text>
          <View style={[
            styles.inputWrapper,
            { 
              borderColor: nameError ? '#EF4444' : colors.border,
              backgroundColor: colors.card 
            }
          ]}>
            <Ionicons name="chatbubbles-outline" size={moderateScale(20)} color={colors.secondaryText} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Enter room name"
              placeholderTextColor={colors.secondaryText}
              value={roomName}
              onChangeText={setRoomName}
              autoCapitalize="none"
              maxLength={20}
            />
            <Text style={[styles.charCount, { color: colors.secondaryText }]}>
              {roomName.length}/20
            </Text>
          </View>
          {nameError ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={moderateScale(14)} color="#EF4444" />
              <Text style={styles.errorText}>{nameError}</Text>
            </View>
          ) : (
            <Text style={[styles.helperText, { color: colors.secondaryText }]}>
              No spaces • Max 20 characters
            </Text>
          )}
        </View>

        {/* Next Button */}
        <TouchableOpacity
          style={[
            styles.nextBtn,
            { backgroundColor: colors.primary },
            (uploading || !roomName.trim() || nameError || !roomPhoto) && styles.nextBtnDisabled
          ]}
          onPress={goToLocationScreen}
          disabled={uploading || !roomName.trim() || !!nameError || !roomPhoto}
          activeOpacity={0.8}
        >
          {uploading ? (
            <View style={styles.btnContent}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.nextBtnText}>Uploading...</Text>
            </View>
          ) : (
            <View style={styles.btnContent}>
              <Text style={styles.nextBtnText}>Next Step</Text>
              <Ionicons name="arrow-forward" size={moderateScale(20)} color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        <Text style={[styles.footerText, { color: colors.secondaryText }]}>
          Next: Choose location for your room
        </Text>
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
    paddingHorizontal: wp('5%'),
    paddingBottom: hp('3%'),
  },
  header: {
    alignItems: 'center',
    paddingTop: hp('1.8%'),
    marginBottom: hp('4%'),
  },
  title: {
    fontSize: moderateScale(28),
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: verticalScale(6),
  },
  subtitle: {
    fontSize: moderateScale(14),
    fontWeight: '500',
    opacity: 0.8,
  },
  photoSection: {
    marginBottom: hp('3.5%'),
  },
  sectionLabel: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    marginBottom: hp('1.5%'),
    letterSpacing: 0.2,
  },
  photoBtn: {
    alignSelf: 'center',
  },
  photoWrapper: {
    position: 'relative',
  },
  photo: {
    width: moderateScale(140),
    height: moderateScale(140),
    borderRadius: moderateScale(20),
  },
  editBadge: {
    position: 'absolute',
    bottom: scale(8),
    right: scale(8),
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  placeholder: {
    width: moderateScale(140),
    height: moderateScale(140),
    borderRadius: moderateScale(20),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: moderateScale(2),
    borderStyle: 'dashed',
    gap: verticalScale(8),
  },
  iconCircle: {
    width: moderateScale(60),
    height: moderateScale(60),
    borderRadius: moderateScale(30),
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  placeholderSubtext: {
    fontSize: moderateScale(13),
    fontWeight: '500',
    opacity: 0.7,
  },
  inputSection: {
    marginBottom: hp('3%'),
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: moderateScale(1.5),
    borderRadius: moderateScale(14),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(12),
    gap: scale(10),
  },
  input: {
    flex: 1,
    fontSize: moderateScale(16),
    fontWeight: '500',
    paddingVertical: 0,
  },
  charCount: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    opacity: 0.6,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(6),
    gap: scale(6),
  },
  errorText: {
    color: '#EF4444',
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  helperText: {
    fontSize: moderateScale(13),
    fontWeight: '500',
    marginTop: verticalScale(6),
    opacity: 0.7,
  },
  nextBtn: {
    marginTop: hp('2%'),
    paddingVertical: verticalScale(16),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  nextBtnDisabled: {
    opacity: 0.5,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  nextBtnText: {
    color: '#fff',
    fontSize: moderateScale(17),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  footerText: {
    fontSize: moderateScale(13),
    fontWeight: '500',
    textAlign: 'center',
    marginTop: hp('2%'),
    opacity: 0.7,
  },
});