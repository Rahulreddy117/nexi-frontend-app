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
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.roomName, { color: colors.text }]}>{roomName}</Text>
          <TouchableOpacity
            style={[styles.postButton, { backgroundColor: colors.primary }]}
            onPress={handlePost}
            disabled={uploading}
          >
            <Text style={styles.postButtonText}>Post</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[styles.textInput, { borderColor: colors.border, backgroundColor: colors.card, color: colors.text }]}
          placeholder="What's on your mind?"
          placeholderTextColor={colors.secondaryText}
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
        />

        {images.length > 0 && (
          <View style={styles.imagesPreview}>
            {images.map((img, idx) => (
              <View key={idx} style={styles.imageWrapper}>
                <Image source={{ uri: img }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeImage}
                  onPress={() => removeImage(idx)}
                >
                  <Ionicons name="close" size={16} color="white" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
          <Ionicons name="image-outline" size={24} color={colors.primary} />
          <Text style={[styles.addImageText, { color: colors.primary }]}>Add Images</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  roomName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 12,
  },
  postButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    fontSize: 16,
    marginBottom: 16,
  },
  imagesPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  imageWrapper: {
    position: 'relative',
    marginRight: 8,
    marginBottom: 8,
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeImage: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    borderStyle: 'dashed',  
  },
  addImageText: {
    marginLeft: 8,
    fontSize: 16,
  },
});