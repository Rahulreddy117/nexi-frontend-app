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
} from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { RouteProp } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
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
  const [showInFeed, setShowInFeed] = useState<'yes' | 'no'>('yes'); // default Yes
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

  const handleNext = async () => {
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

      // 3. Save post directly (no temp, no location, no caption)
      const postData = {
        imageUrls: [cloudinaryUrl],
        user: {
          __type: 'Pointer',
          className: 'UserProfile',
          objectId: userObjectId,
        },
        showInFeed: showInFeed === 'yes',
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Upload New Post</Text>

      {/* Image Picker */}
      <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
        {image ? (
          <Image source={{ uri: image }} style={styles.previewImage} />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: colors.placeholderBackground }]}>
            <Ionicons name="camera-outline" size={50} color={colors.secondaryText} />
            <Text style={[styles.placeholderText, { color: colors.secondaryText }]}>
              Tap to select photo
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Radio Buttons */}
      {image && (
        <View style={styles.radioContainer}>
          <Text style={[styles.radioLabel, { color: colors.text }]}>
            Show in users feed?
          </Text>

          <TouchableOpacity
            style={styles.radioOption}
            onPress={() => setShowInFeed('yes')}
          >
            <Ionicons
              name={showInFeed === 'yes' ? 'radio-button-on' : 'radio-button-off'}
              size={24}
              color={colors.accent}
            />
            <Text style={[styles.radioText, { color: colors.text }]}>Yes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.radioOption}
            onPress={() => setShowInFeed('no')}
          >
            <Ionicons
              name={showInFeed === 'no' ? 'radio-button-on' : 'radio-button-off'}
              size={24}
              color={colors.accent}
            />
            <Text style={[styles.radioText, { color: colors.text }]}>No</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Next Button */}
      {image && (
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: colors.accent }]}
          onPress={handleNext}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <Text style={[styles.nextButtonText, { color: colors.buttonText }]}>
              Upload Post
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Cancel */}
      <TouchableOpacity
        style={[styles.cancelButton, { borderColor: colors.border }]}
        onPress={() => navigation.goBack()}
        disabled={uploading}
      >
        <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 30,
  },
  imagePicker: {
    width: '100%',
    height: 400,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#ddd',
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
  },
  placeholderText: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
  },

  // Radio
  radioContainer: {
    width: '100%',
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  radioLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'left',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  radioText: {
    fontSize: 16,
    marginLeft: 10,
  },

  // Buttons
  nextButton: {
    paddingVertical: 16,
    paddingHorizontal: 50,
    borderRadius: 30,
    minWidth: 200,
    alignItems: 'center',
    marginBottom: 20,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderWidth: 1,
    borderRadius: 25,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
});