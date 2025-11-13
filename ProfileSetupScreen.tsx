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
  Platform,
} from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import type { RootStackParamList } from './types/navigation';
import { useTheme } from './ThemeContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ProfileSetupRouteProp = RouteProp<RootStackParamList, 'ProfileSetup'>;

const CLOUDINARY_CLOUD_NAME = 'deyouwm72';
const CLOUDINARY_API_KEY = '592525159367972';
const CLOUDINARY_API_SECRET = 'taAW33vQ0C69nNC5AOT8KkhR-jk';
const UPLOAD_PRESET = 'ml_default';

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

async function queryUser(auth0Id: string): Promise<any | null> {
  const where = { auth0Id };
  const whereStr = encodeURIComponent(JSON.stringify(where));
  const response = await fetch(`${API_URL}/classes/UserProfile?where=${whereStr}&limit=1`, {
    method: 'GET',
    headers: {
      'X-Parse-Application-Id': APP_ID,
      'X-Parse-Master-Key': MASTER_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Query Error:', response.status, errorText);
    throw new Error(`Query failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (data.results && data.results.length > 0) {
    return data.results[0];
  }
  return null;
}

async function queryUserByUsername(username: string): Promise<any | null> {
  const where = { username };
  const whereStr = encodeURIComponent(JSON.stringify(where));
  const response = await fetch(`${API_URL}/classes/UserProfile?where=${whereStr}&limit=1`, {
    method: 'GET',
    headers: {
      'X-Parse-Application-Id': APP_ID,
      'X-Parse-Master-Key': MASTER_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.results && data.results.length > 0 ? data.results[0] : null;
}

async function saveUser(userData: any, objectId?: string): Promise<any> {
  const url = objectId ? `${API_URL}/classes/UserProfile/${objectId}` : `${API_URL}/classes/UserProfile`;
  const method = objectId ? 'PUT' : 'POST';

  const response = await fetch(url, {
    method,
    headers: {
      'X-Parse-Application-Id': APP_ID,
      'X-Parse-Master-Key': MASTER_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Save Error:', response.status, errorText);
    throw new Error(`Save failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

export default function ProfileSetupScreen() {
  const route = useRoute<ProfileSetupRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { colors, mode } = useTheme();
  const params = route.params as any;
  const { userId, email, name, isEditMode: initialIsEditMode } = params;
  const initialUsername = params.username || '';
  const initialBio = params.bio || '';
  const initialProfilePic = params.profilePicUrl || null;
  const initialHeight = params.height || '';
  const initialGender = params.gender || '';

  const [username, setUsername] = useState(initialUsername);
  const [bio, setBio] = useState(initialBio);
  const [profilePic, setProfilePic] = useState<string | null>(initialProfilePic);
  const [uploading, setUploading] = useState(false);
  const [height, setHeight] = useState(initialHeight);
  const [gender, setGender] = useState(initialGender || '');
  const [isEditMode, setIsEditMode] = useState(initialIsEditMode || false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Prefill from DB if in edit mode
  useEffect(() => {
    const prefillIfEdit = async () => {
      if (isEditMode && (!initialUsername || !initialBio)) {
        try {
          const existing = await queryUser(userId);
          if (existing) {
            setUsername(existing.username || '');
            setBio(existing.bio || '');
            setProfilePic(existing.profilePicUrl || null);
            setHeight(existing.height || '');
            setGender(existing.gender || '');
          }
        } catch (error) {
          console.error('Prefill Error:', error);
        }
      }
    };
    prefillIfEdit();
  }, [isEditMode, userId, initialUsername, initialBio]);

  // Debounced username validation + DB check
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (username && username !== initialUsername) {
        validateAndCheckUsername(username);
      } else {
        setUsernameError(null);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [username, initialUsername]);

  const validateAndCheckUsername = async (value: string) => {
    setUsernameError(null);

    if (value.length > 20) {
      setUsernameError('Username must be 20 characters or less');
      return;
    }

    if (value.includes(' ')) {
      setUsernameError('Space is not allowed');
      return;
    }

    const allowedPattern = /^[a-zA-Z0-9.\-_]+$/;
    if (!allowedPattern.test(value)) {
      setUsernameError('Only letters, numbers , ( - )  ( _ ) (.) are allowed');
      return;
    }

    if (isEditMode && value === initialUsername) return;

    try {
      const existing = await queryUserByUsername(value);
      if (existing && existing.auth0Id !== userId) {
        setUsernameError('Username already taken');
      }
    } catch (err) {
      console.error('Username availability check failed:', err);
    }
  };

  const pickImage = () => {
    ImagePicker.openPicker({
      width: 300,
      height: 300,
      cropping: true,
      cropperCircleOverlay: true,
      mediaType: 'photo',
      compressImageQuality: 0.8,
    })
      .then((image) => {
        setProfilePic(image.path);
      })
      .catch((error) => {
        if (error.code !== 'E_PICKER_CANCELLED') {
          Alert.alert('Error', 'Failed to pick and crop image.');
        }
      });
  };

  const uploadProfilePic = async (localUri: string): Promise<string | null> => {
    setUploading(true);
    try {
      let data = new FormData();
      data.append('file', {
        uri: localUri,
        type: 'image/jpeg',
        name: `${encodeURIComponent(userId)}.jpg`,
      } as any);
      data.append('upload_preset', UPLOAD_PRESET);
      data.append('folder', 'profiles');

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
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Username is required');
      return;
    }

    if (usernameError) {
      Alert.alert('Error', usernameError);
      return;
    }

    if (!gender) {
      Alert.alert('Error', 'Please select your gender');
      return;
    }

    if (uploading) {
      Alert.alert('Info', 'Upload in progress...');
      return;
    }

    try {
      let profilePicUrl = profilePic;
      if (profilePic && !profilePic.startsWith('https://')) {
        profilePicUrl = await uploadProfilePic(profilePic);
        if (!profilePicUrl) {
          Alert.alert('Error', 'Image upload failed. Profile saved without image.');
        }
      }

      const existing = await queryUser(userId);
      let objectId: string | undefined = existing?.objectId;

      const userDoc = {
        auth0Id: userId,
        email: isEditMode ? (existing?.email || email) : email,
        name: isEditMode ? (existing?.name || name) : name,
        username,
        bio,
        height,
        gender,
        profilePicUrl: profilePicUrl || null,
      };

      const result = await saveUser(userDoc, objectId);

      const parseObjectId = objectId || result.objectId;
      if (parseObjectId) {
        await AsyncStorage.setItem('parseObjectId', parseObjectId);
      }

      Alert.alert('Success', isEditMode ? 'Profile updated!' : 'Profile created!');
      navigation.navigate('Home', {
        userId,
        username,
        bio,
        profilePicUrl,
        height,
        gender,
      } as any);
    } catch (error: any) {
      console.error('Save Profile Error:', error);
      Alert.alert('Error', `Failed to save: ${error.message}`);
    }
  };

  const ThemedButton = ({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) => (
    <TouchableOpacity
      style={[
        styles.button,
        disabled && styles.disabledButton,
        { backgroundColor: disabled ? colors.inactive : colors.accent },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={[styles.buttonText, { color: colors.buttonText }]}>{title}</Text>
    </TouchableOpacity>
  );

  const overlayBg = mode === 'light' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.3)';
  const iconColor = mode === 'light' ? '#fff' : '#000';

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>
          {isEditMode ? 'Edit Your Profile' : 'Complete Your Profile'}
        </Text>

        <View style={[styles.card, { backgroundColor: colors.background }]}>
          {/* Profile Picture */}
          <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
            {profilePic ? (
              <View style={styles.imageWrapper}>
                <Image
                  source={{ uri: profilePic }}
                  style={[styles.profileImage, { borderColor: colors.border }]}
                />
                {isEditMode && (
                  <View style={[styles.editOverlay, { backgroundColor: overlayBg }]}>
                    <Ionicons name="camera-outline" size={20} color={iconColor} />
                  </View>
                )}
              </View>
            ) : (
              <View style={[styles.placeholderImage, { backgroundColor: colors.placeholderBackground }]}>
                <Ionicons name="camera-outline" size={40} color={colors.secondaryText} />
              </View>
            )}
          </TouchableOpacity>

          {/* Username Input */}
          <TextInput
            style={[
              styles.input,
              { borderColor: usernameError ? '#ff3b30' : colors.border, backgroundColor: colors.background, color: colors.text },
            ]}
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            placeholderTextColor={colors.secondaryText}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {usernameError ? (
            <Text style={styles.errorText}>{usernameError}</Text>
          ) : null}

          {/* Height Input */}
          <TextInput
            style={[
              styles.input,
              { borderColor: colors.border, backgroundColor: colors.background, color: colors.text },
            ]}
            placeholder="Height (in cm)"
            value={height}
            onChangeText={setHeight}
            keyboardType="numeric"
            placeholderTextColor={colors.secondaryText}
          />

          {/* Gender Dropdown */}
          <View style={[styles.pickerContainer, { borderColor: colors.border }]}>
            <Picker
              selectedValue={gender}
              onValueChange={(itemValue) => setGender(itemValue)}
              style={{ color: colors.text }}
              dropdownIconColor={colors.secondaryText}
            >
              <Picker.Item label="Select Gender" value="" />
              <Picker.Item label="Male" value="male" />
              <Picker.Item label="Female" value="female" />
            </Picker>
          </View>

          {/* Bio Input */}
          <TextInput
            style={[
              styles.input,
              styles.bioInput,
              { borderColor: colors.border, backgroundColor: colors.background, color: colors.text },
            ]}
            placeholder="Short bio (optional)"
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
            placeholderTextColor={colors.secondaryText}
          />

          {/* Save Button */}
          <ThemedButton
            title={uploading ? 'Uploading...' : isEditMode ? 'Update Profile' : 'Save Profile'}
            onPress={saveProfile}
            disabled={uploading}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingVertical: 30 },
  container: { flex: 1, alignItems: 'center', paddingHorizontal: 20 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 20 },
  card: { width: '100%', borderRadius: 12, padding: 20 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 15,
    fontSize: 16,
  },
  bioInput: { height: 100, textAlignVertical: 'top' },
  imageContainer: { alignSelf: 'center', marginBottom: 20 },
  imageWrapper: { position: 'relative', width: 100, height: 100, borderRadius: 50 },
  profileImage: { width: 100, height: 100, borderRadius: 60, borderWidth: 2 },
  editOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -16 }, { translateY: -16 }],
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderImage: {
    width: 100,
    height: 100,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: { paddingVertical: 14, borderRadius: 8, marginTop: 25 },
  disabledButton: { opacity: 0.6 },
  buttonText: { textAlign: 'center', fontSize: 16, fontWeight: '600' },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 15,
    overflow: 'hidden',
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 13,
    marginTop: 5,
    marginLeft: 5,
  },
});