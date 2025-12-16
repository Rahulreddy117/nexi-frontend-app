// rooms/RoomPostUpload.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useRoute } from '@react-navigation/native';
import ImagePicker from 'react-native-image-crop-picker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import type { RootStackParamList } from '../types/navigation';
import { useTheme } from '../ThemeContext';

const CLOUDINARY_CLOUD_NAME = 'deyouwm72';
const CLOUDINARY_API_KEY = '592525159367972';
const CLOUDINARY_API_SECRET = 'taAW33vQ0C69nNC5AOT8KkhR-jk';
const UPLOAD_PRESET = 'ml_default';

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RoomPostUploadRouteProp = RouteProp<RootStackParamList, 'RoomPostUpload'>;

interface RouteParams {
  roomId: string;
  roomName: string;
}

export default function RoomPostUpload() {
  const route = useRoute<RoomPostUploadRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
  const { roomId, roomName } = route.params as RouteParams;

  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [myParseObjectId, setMyParseObjectId] = useState<string | null>(null);

  // Load myParseObjectId
  React.useEffect(() => {
    const loadUserId = async () => {
      const parseId = await AsyncStorage.getItem('parseObjectId');
      setMyParseObjectId(parseId);
    };
    loadUserId();
  }, []);

  const pickImage = () => {
    ImagePicker.openPicker({
      mediaType: 'photo',
      compressImageQuality: 0.8,
      multiple: true,
    })
      .then((results) => {
        const newImages = results.map((r) => r.path);
        setImages((prev) => [...prev, ...newImages]);
      })
      .catch((error) => {
        if (error.code !== 'E_PICKER_CANCELLED') {
          Alert.alert('Error', 'Failed to pick images.');
        }
      });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImage = async (localUri: string): Promise<string | null> => {
    try {
      let data = new FormData();
      data.append('file', {
        uri: localUri,
        type: 'image/jpeg',
        name: `${Date.now()}.jpg`,
      } as any);
      data.append('upload_preset', UPLOAD_PRESET);
      data.append('folder', 'posts');

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: data,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const json = await res.json();
      return json.secure_url || null;
    } catch (error) {
      console.error('Upload Error:', error);
      return null;
    }
  };

  const handlePost = async () => {
    if (!myParseObjectId || (!text.trim() && images.length === 0)) {
      Alert.alert('Error', 'Post must have text or at least one image.');
      return;
    }

    if (uploading) return;

    setUploading(true);
    try {
      let imageUrls: string[] = [];
      if (images.length > 0) {
        const uploadPromises = images.map(uploadImage);
        const uploadedUrls = await Promise.all(uploadPromises);
        imageUrls = uploadedUrls.filter((url): url is string => url !== null);
        if (imageUrls.length === 0) {
          Alert.alert('Error', 'Failed to upload images.');
          return;
        }
      }

      await fetch(`${API_URL}/classes/RoomPost`, {
        method: 'POST',
        headers: {
          'X-Parse-Application-Id': APP_ID,
          'X-Parse-Master-Key': MASTER_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim() || undefined,
          imageUrls,
          user: { __type: 'Pointer', className: 'UserProfile', objectId: myParseObjectId },
          room: { __type: 'Pointer', className: 'Room', objectId: roomId },
        }),
      });

      Alert.alert('Success', 'Post created!');
      navigation.goBack();
    } catch (err: any) {
      console.error('Post error:', err);
      Alert.alert('Error', 'Failed to create post.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={moderateScale(26)} color={colors.text} />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={[styles.roomName, { color: colors.text }]} numberOfLines={1}>
              {roomName}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.secondaryText }]}>
              Create Post
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.postButton, 
              { 
                backgroundColor: uploading || (!text.trim() && images.length === 0) 
                  ? colors.border 
                  : colors.primary 
              }
            ]}
            onPress={handlePost}
            disabled={uploading || (!text.trim() && images.length === 0)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.postButtonText,
              { opacity: uploading || (!text.trim() && images.length === 0) ? 0.5 : 1 }
            ]}>
              {uploading ? 'Posting...' : 'Post'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Text Input */}
          <View style={styles.inputSection}>
            <TextInput
              style={[
                styles.textInput, 
                { 
                  borderColor: colors.border, 
                  backgroundColor: colors.card, 
                  color: colors.text 
                }
              ]}
              placeholder="What's on your mind?"
              placeholderTextColor={colors.secondaryText}
              value={text}
              onChangeText={setText}
              multiline
              textAlignVertical="top"
              maxLength={5000}
            />
            {text.length > 0 && (
              <Text style={[styles.charCount, { color: colors.secondaryText }]}>
                {text.length} / 5000
              </Text>
            )}
          </View>

          {/* Images Preview */}
          {images.length > 0 && (
            <View style={styles.imagesSection}>
              <View style={styles.imagesSectionHeader}>
                <Ionicons name="images" size={moderateScale(18)} color={colors.text} />
                <Text style={[styles.imagesSectionTitle, { color: colors.text }]}>
                  Images ({images.length})
                </Text>
              </View>
              
              <View style={styles.imagesPreview}>
                {images.map((img, idx) => (
                  <View key={idx} style={styles.imageWrapper}>
                    <Image source={{ uri: img }} style={styles.previewImage} />
                    <TouchableOpacity
                      style={styles.removeImage}
                      onPress={() => removeImage(idx)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close" size={moderateScale(16)} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Add Image Button */}
          <TouchableOpacity 
            style={[styles.addImageButton, { borderColor: colors.primary }]} 
            onPress={pickImage}
            activeOpacity={0.7}
          >
            <View style={[styles.addImageIconContainer, { backgroundColor: colors.primary }]}>
              <Ionicons name="image-outline" size={moderateScale(22)} color="#fff" />
            </View>
            <View style={styles.addImageTextContainer}>
              <Text style={[styles.addImageText, { color: colors.text }]}>
                Add Images
              </Text>
              <Text style={[styles.addImageSubtext, { color: colors.secondaryText }]}>
                Upload photos to your post
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={moderateScale(20)} color={colors.secondaryText} />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: wp('3%'),
  },
  roomName: {
    fontSize: moderateScale(17),
    fontWeight: '700',
    marginBottom: hp('0.3%'),
  },
  headerSubtitle: {
    fontSize: moderateScale(12),
    fontWeight: '500',
  },
  postButton: {
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.2%'),
    borderRadius: moderateScale(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  postButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: moderateScale(15),
  },
  scrollContent: {
    padding: wp('4%'),
    paddingBottom: hp('10%'),
  },
  inputSection: {
    marginBottom: hp('2%'),
  },
  textInput: {
    borderWidth: 1,
    borderRadius: moderateScale(16),
    padding: wp('4%'),
    minHeight: hp('20%'),
    fontSize: moderateScale(16),
    lineHeight: moderateScale(22),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  charCount: {
    fontSize: moderateScale(11),
    marginTop: hp('0.8%'),
    marginRight: wp('2%'),
    alignSelf: 'flex-end',
    fontWeight: '500',
  },
  imagesSection: {
    marginBottom: hp('2%'),
  },
  imagesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1.5%'),
    gap: wp('2%'),
  },
  imagesSectionTitle: {
    fontSize: moderateScale(15),
    fontWeight: '600',
  },
  imagesPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp('2.5%'),
  },
  imageWrapper: {
    position: 'relative',
    marginBottom: hp('1%'),
  },
  previewImage: {
    width: wp('28%'),
    height: wp('28%'),
    borderRadius: moderateScale(12),
    backgroundColor: '#f0f0f0',
  },
  removeImage: {
    position: 'absolute',
    top: -hp('0.8%'),
    right: -wp('1.5%'),
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: moderateScale(15),
    width: moderateScale(30),
    height: moderateScale(30),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp('4%'),
    borderWidth: 2,
    borderRadius: moderateScale(16),
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    gap: wp('3%'),
  },
  addImageIconContainer: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageTextContainer: {
    flex: 1,
  },
  addImageText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    marginBottom: hp('0.3%'),
  },
  addImageSubtext: {
    fontSize: moderateScale(12),
    fontWeight: '500',
  },
});