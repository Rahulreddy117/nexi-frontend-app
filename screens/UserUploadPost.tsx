// screens/UserUploadPost.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../types/navigation';
import { useTheme } from '../ThemeContext';

type UserUploadPostRouteProp = RouteProp<RootStackParamList, 'UserUploadPost'>;

const CLOUDINARY_CLOUD_NAME = 'deyouwm72';
const UPLOAD_PRESET = 'ml_default';

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

const HEADERS = {
  'X-Parse-Application-Id': APP_ID,
  'X-Parse-Master-Key': MASTER_KEY,
  'Content-Type': 'application/json',
};

async function getUserParseObjectId(auth0Id: string): Promise<string> {
  const where = { auth0Id };
  const whereStr = encodeURIComponent(JSON.stringify(where));
  const response = await fetch(
    `${API_URL}/classes/UserProfile?where=${whereStr}&limit=1`,
    { method: 'GET', headers: HEADERS }
  );
  if (!response.ok) throw new Error('Failed to fetch user');
  const data = await response.json();
  const user = data.results?.[0];
  if (!user?.objectId) throw new Error('User not found');
  return user.objectId;
}

async function uploadToCloudinary(uri: string): Promise<string> {
  const data = new FormData();
  data.append('file', {
    uri,
    type: 'image/jpeg',
    name: `post_${Date.now()}.jpg`,
  } as any);
  data.append('upload_preset', UPLOAD_PRESET);
  data.append('folder', 'posts');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: data }
  );
  if (!response.ok) throw new Error('Upload failed');
  const json = await response.json();
  return json.secure_url;
}

export default function UserUploadPostScreen() {
  const route = useRoute<UserUploadPostRouteProp>();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const { auth0Id } = route.params;
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickImage = () => {
    ImagePicker.openPicker({
      width: 800,
      height: 800,
      cropping: true,
      cropperCircleOverlay: false,
      compressImageQuality: 0.8,
      mediaType: 'photo',
    })
      .then((img) => setImage(img.path))
      .catch((err) => {
        if (err.code !== 'E_PICKER_CANCELLED') {
          Alert.alert('Error', 'Failed to pick image');
        }
      });
  };

  const handleUpload = async () => {
    if (!image) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }

    setUploading(true);
    try {
      // 1. Upload to Cloudinary
      const cloudinaryUrl = await uploadToCloudinary(image);

      // 2. Get user objectId
      const userObjectId = await getUserParseObjectId(auth0Id);

      // 3. Save post directly (showInFeed defaults to true)
      const postData = {
        imageUrls: [cloudinaryUrl],
        user: {
          __type: 'Pointer',
          className: 'UserProfile',
          objectId: userObjectId,
        },
        showInFeed: true,
      };

      const response = await fetch(`${API_URL}/classes/Post`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(postData),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Save failed: ${err}`);
      }

      const savedPost = await response.json();

      // 4. Success and navigate to Home > ViewProfile
      Alert.alert('Success', 'Post uploaded!', [
        {
          text: 'OK',
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [
                {
                  name: 'Home',
                  state: {
                    routes: [{ name: 'ViewProfile' }],
                    index: 0,
                  },
                },
              ],
            });
          },
        },
      ]);

    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', error.message || 'Failed to upload');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      edges={['top', 'bottom']}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
          disabled={uploading}
        >
          <Ionicons name="arrow-back" size={moderateScale(24)} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Upload New Post
        </Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Image Picker */}
        <TouchableOpacity 
          onPress={pickImage} 
          style={[
            styles.imagePicker, 
            { borderColor: colors.border }
          ]}
          activeOpacity={0.8}
          disabled={uploading}
        >
          {image ? (
            <Image source={{ uri: image }} style={styles.previewImage} />
          ) : (
            <View style={[styles.placeholder, { backgroundColor: colors.card }]}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons 
                  name="camera-outline" 
                  size={moderateScale(40)} 
                  color={colors.primary} 
                />
              </View>
              <Text style={[styles.placeholderText, { color: colors.text }]}>
                Tap to select photo
              </Text>
              <Text style={[styles.placeholderSubtext, { color: colors.secondaryText }]}>
                Choose from your gallery
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Upload Button */}
        {image && (
          <TouchableOpacity
            style={[
              styles.uploadButton, 
              { backgroundColor: colors.primary },
              uploading && styles.uploadButtonDisabled
            ]}
            onPress={handleUpload}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {uploading ? (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.uploadButtonText}>Uploading...</Text>
              </View>
            ) : (
              <View style={styles.uploadingContainer}>
                <Ionicons name="cloud-upload-outline" size={moderateScale(22)} color="#fff" />
                <Text style={styles.uploadButtonText}>Upload Post</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Change Photo Button */}
        {image && !uploading && (
          <TouchableOpacity
            style={[styles.changeButton, { borderColor: colors.border }]}
            onPress={pickImage}
            activeOpacity={0.7}
          >
            <Ionicons name="images-outline" size={moderateScale(20)} color={colors.text} />
            <Text style={[styles.changeButtonText, { color: colors.text }]}>
              Change Photo
            </Text>
          </TouchableOpacity>
        )}
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
    fontSize: moderateScale(18),
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: moderateScale(40),
  },
  scrollContent: {
    padding: wp('5%'),
    paddingBottom: hp('3%'),
  },
  imagePicker: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    marginBottom: hp('2.5%'),
    borderWidth: 2,
    borderStyle: 'dashed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp('6%'),
  },
  iconCircle: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(40),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  placeholderText: {
    fontSize: moderateScale(17),
    fontWeight: '600',
    marginTop: hp('1%'),
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: moderateScale(14),
    marginTop: hp('0.5%'),
    textAlign: 'center',
    fontWeight: '400',
  },
  uploadButton: {
    paddingVertical: hp('2%'),
    borderRadius: moderateScale(28),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp('1.5%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  uploadButtonDisabled: {
    opacity: 0.7,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('2.5%'),
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: moderateScale(17),
    fontWeight: '600',
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.6%'),
    borderWidth: 1.5,
    borderRadius: moderateScale(24),
    gap: wp('2%'),
  },
  changeButtonText: {
    fontSize: moderateScale(16),
    fontWeight: '500',
  },
});