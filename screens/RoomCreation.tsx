// screens/RoomCreation.tsx (updated)
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

    let finalPhotoUrl = roomPhoto;

    if (roomPhoto && !roomPhoto.startsWith('http')) {
      setUploading(true);
      finalPhotoUrl = await uploadPhoto(roomPhoto, roomName);
      if (!finalPhotoUrl) {
        setUploading(false);
        return Alert.alert('Warning', 'Photo upload failed. Continue without photo?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => proceed(finalPhotoUrl) },
        ]);
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
    <ScrollView contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.background }}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>Create New Room</Text>

        {/* Photo */}
        <TouchableOpacity onPress={pickImage} style={styles.photoBtn}>
          {roomPhoto ? (
            <Image source={{ uri: roomPhoto }} style={styles.photo} />
          ) : (
            <View style={[styles.placeholder, { backgroundColor: colors.card }]}>
              <Ionicons name="image-outline" size={40} color={colors.secondaryText} />
              <Text style={{ color: colors.secondaryText, marginTop: 8 }}>Add Photo</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Room Name */}
        <TextInput
          style={[styles.input, { borderColor: nameError ? 'red' : colors.border, color: colors.text }]}
          placeholder="Room name (no spaces, max 20)"
          placeholderTextColor={colors.secondaryText}
          value={roomName}
          onChangeText={setRoomName}
          autoCapitalize="none"
          maxLength={20}
        />
        {nameError && <Text style={styles.error}>{nameError}</Text> }

        {/* Next Button */}
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: colors.accent, opacity: uploading ? 0.6 : 1 }]}
          onPress={goToLocationScreen}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextBtnText}>Next → Choose Location</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginVertical: 30 },
  photoBtn: { alignSelf: 'center', marginBottom: 30 },
  photo: { width: 160, height: 160, borderRadius: 20 },
  placeholder: {
    width: 160,
    height: 160,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#888',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  error: { color: 'red', marginBottom: 16 },
  nextBtn: {
    marginTop: 30,
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  nextBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});