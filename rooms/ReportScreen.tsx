// rooms/ReportScreen.tsx — Reusable Report Modal Component (Updated)
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useTheme } from '../ThemeContext'; // Adjust path as needed

const API_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';
const MASTER_KEY = 'myMasterKey';

interface Post {
  objectId: string;
  text?: string;
  imageUrls: string[];
  user: {
    objectId: string;
    username: string;
    profilePicUrl?: string;
    auth0Id: string;
  };
  createdAt: string;
}

interface ReportScreenProps {
  visible: boolean;
  onClose: () => void;
  type: 'post' | 'room' | 'userprofile';
  post?: Post | undefined;
  roomId?: string;
  roomName?: string;
  reporterObjectId: string;
  // NEW: For userprofile reports
  targetUserAuth0Id?: string;
  targetUserObjectId?: string;
  targetUsername?: string;
}

const ReportScreen: React.FC<ReportScreenProps> = ({
  visible,
  onClose,
  type,
  post,
  roomId,
  roomName,
  reporterObjectId,
  targetUserAuth0Id,
  targetUserObjectId,
  targetUsername,
}) => {
  const { colors } = useTheme();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');

  const reasons = [
    { id: 'spam', label: 'Spam' },
    { id: 'inappropriate', label: 'Inappropriate content' },
    { id: 'harassment', label: 'Harassment' },
    { id: 'other', label: 'Other' },
  ];

  const submitReport = async () => {
    let finalReason = selectedReason;
    if (selectedReason === 'other') {
      finalReason = customReason.trim();
      if (!finalReason) {
        Alert.alert('Error', 'Please provide a reason for "Other"');
        return;
      }
    }

    if (!finalReason) {
      Alert.alert('Error', 'Please select a reason');
      return;
    }

    try {
      // === PREVENT DUPLICATE REPORTS ===
      const where: any = {
        reporter: { __type: 'Pointer', className: 'UserProfile', objectId: reporterObjectId },
        type,
      };

      if (type === 'post' && post) {
        where.post = { __type: 'Pointer', className: 'RoomPost', objectId: post.objectId };
        where.room = { __type: 'Pointer', className: 'Room', objectId: roomId };
      } else if (type === 'room' && roomId) {
        where.room = { __type: 'Pointer', className: 'Room', objectId: roomId };
        where.post = { $exists: false };
      } else if (type === 'userprofile' && targetUserObjectId) {
        where.targetUser = { __type: 'Pointer', className: 'UserProfile', objectId: targetUserObjectId };
      }

      const checkUrl = `${API_URL}/classes/Report?where=${encodeURIComponent(JSON.stringify(where))}&limit=1`;

      const checkRes = await fetch(checkUrl, {
        headers: {
          'X-Parse-Application-Id': APP_ID,
          'X-Parse-Master-Key': MASTER_KEY,
        },
      });

      const checkData = await checkRes.json();

      if (checkData.results && checkData.results.length > 0) {
        Alert.alert('Already Reported', 'You have already reported this. Thank you!');
        onClose();
        return;
      }

      // === PREVENT SELF-REPORTING ===
      if (type === 'post' && post) {
        if (post.user.objectId === reporterObjectId) {
          Alert.alert('Cannot Report', 'You cannot report your own post.');
          onClose();
          return;
        }
      } else if (type === 'userprofile' && targetUserObjectId) {
        if (targetUserObjectId === reporterObjectId) {
          Alert.alert('Cannot Report', 'You cannot report yourself.');
          onClose();
          return;
        }
      }

      // === SUBMIT THE REPORT ===
      const basePayload = {
        reporter: { __type: 'Pointer', className: 'UserProfile', objectId: reporterObjectId },
        type,
        reason: finalReason,
        reviewed: false,
      };

      const payload: any = { ...basePayload };

      if (type === 'post' && post && roomId) {
        payload.post = { __type: 'Pointer', className: 'RoomPost', objectId: post.objectId };
        payload.room = { __type: 'Pointer', className: 'Room', objectId: roomId };
      } else if (type === 'room' && roomId) {
        payload.room = { __type: 'Pointer', className: 'Room', objectId: roomId };
      } else if (type === 'userprofile' && targetUserObjectId) {
        payload.targetUser = { __type: 'Pointer', className: 'UserProfile', objectId: targetUserObjectId };
      }

      const res = await fetch(`${API_URL}/classes/Report`, {
        method: 'POST',
        headers: {
          'X-Parse-Application-Id': APP_ID,
          'X-Parse-Master-Key': MASTER_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Submit failed: ${errorText}`);
      }

      Alert.alert('Thank You', 'Report submitted successfully. We will review it soon.');
      onClose();
      setSelectedReason('');
      setCustomReason('');
    } catch (err: any) {
      console.error('Report submit error:', err);
      Alert.alert('Error', err.message || 'Failed to submit report. Please try again.');
    }
  };

  // Generate title based on type
  const getTitle = () => {
    if (type === 'post') return 'Report this post';
    if (type === 'room') return `Report this room: ${roomName}`;
    if (type === 'userprofile') return `Report user: ${targetUsername}`;
    return 'Report';
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.reportContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.reportTitle, { color: colors.text }]}>
            {getTitle()}
          </Text>
          <ScrollView style={styles.reportReasonsScroll} showsVerticalScrollIndicator={false}>
            {reasons.map((reason) => (
              <TouchableOpacity
                key={reason.id}
                style={[
                  styles.reasonItem,
                  selectedReason === reason.id && { backgroundColor: `${colors.primary}20` },
                ]}
                onPress={() => {
                  setSelectedReason(reason.id);
                  if (reason.id !== 'other') setCustomReason('');
                }}
              >
                <Ionicons
                  name={selectedReason === reason.id ? 'checkmark-circle' : 'radio-button-off'}
                  size={moderateScale(20)}
                  color={selectedReason === reason.id ? colors.primary : colors.secondaryText}
                />
                <Text style={[styles.reasonLabel, { color: colors.text }]}>{reason.label}</Text>
              </TouchableOpacity>
            ))}
            {selectedReason === 'other' && (
              <View style={styles.customReasonContainer}>
                <TextInput
                  style={[styles.customReasonInput, { backgroundColor: colors.background, color: colors.text }]}
                  placeholder="Describe the issue..."
                  placeholderTextColor={colors.secondaryText}
                  multiline
                  maxLength={500}
                  value={customReason}
                  onChangeText={setCustomReason}
                />
                <Text style={[styles.charCount, { color: colors.secondaryText }]}>
                  {customReason.length}/500
                </Text>
              </View>
            )}
          </ScrollView>
          <View style={styles.reportButtons}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary },
                (!selectedReason || (selectedReason === 'other' && !customReason.trim())) && { backgroundColor: colors.secondaryText },
              ]}
              disabled={!selectedReason || (selectedReason === 'other' && !customReason.trim())}
              onPress={submitReport}
            >
              <Text style={styles.buttonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  reportContainer: {
    borderRadius: moderateScale(16),
    padding: scale(20),
    width: wp('85%'),
    maxHeight: hp('70%'),
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  reportTitle: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: verticalScale(16),
  },
  reportReasonsScroll: {
    maxHeight: hp('40%'),
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(8),
    borderRadius: moderateScale(8),
    marginBottom: verticalScale(4),
  },
  reasonLabel: {
    fontSize: moderateScale(16),
    marginLeft: scale(12),
    flex: 1,
  },
  customReasonContainer: {
    marginTop: verticalScale(8),
    paddingHorizontal: scale(4),
  },
  customReasonInput: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: moderateScale(8),
    padding: scale(12),
    minHeight: verticalScale(80),
    fontSize: moderateScale(14),
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: moderateScale(12),
    textAlign: 'right',
    marginTop: verticalScale(4),
  },
  reportButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: verticalScale(16),
    paddingTop: verticalScale(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    alignItems: 'center',
    marginRight: scale(8),
  },
  submitButton: {
    flex: 1,
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(8),
    alignItems: 'center',
    marginLeft: scale(8),
  },
  buttonText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: 'white',
  },
});

export default ReportScreen;