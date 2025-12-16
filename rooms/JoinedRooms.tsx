// JoinedRooms.tsx — Lists all rooms the current user has joined
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import type { RootStackParamList } from '../types/navigation';
import { useTheme } from '../ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

type JoinedRoomsRouteProp = RouteProp<RootStackParamList, 'JoinedRooms'>;
type NavigationProp = any;

interface JoinedRoom {
  roomId: string;
  roomName: string;
  photoUrl?: string;
}

export default function JoinedRoomsScreen() {
  const route = useRoute<JoinedRoomsRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
  const { userParseObjectId } = route.params as { userParseObjectId: string };

  const [joinedRooms, setJoinedRooms] = useState<JoinedRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const API_URL = 'https://nexi-server.onrender.com/parse';
  const APP_ID = 'myAppId';
  const MASTER_KEY = 'myMasterKey';
  const HEADERS = {
    'X-Parse-Application-Id': APP_ID,
    'X-Parse-Master-Key': MASTER_KEY,
    'Content-Type': 'application/json',
  };

  const fetchJoinedRooms = async () => {
    try {
      const where = {
        user: {
          __type: 'Pointer',
          className: 'UserProfile',
          objectId: userParseObjectId,
        },
      };
      const whereStr = encodeURIComponent(JSON.stringify(where));
      const response = await fetch(
        `${API_URL}/classes/RoomMember?where=${whereStr}&include=room&limit=100`,
        { method: 'GET', headers: HEADERS }
      );
      if (!response.ok) throw new Error('Failed to fetch joined rooms');
      const data = await response.json();
      const rooms: JoinedRoom[] = data.results.map((member: any) => ({
        roomId: member.room.objectId,
        roomName: member.room.name,
        photoUrl: member.room.photoUrl,
      }));
      setJoinedRooms(rooms);
    } catch (err) {
      console.error('Failed to load joined rooms:', err);
      setJoinedRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJoinedRooms();
  }, [userParseObjectId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchJoinedRooms();
    setRefreshing(false);
  };

  const handleRoomPress = (room: JoinedRoom) => {
    navigation.navigate('RoomUserProfile', {
      roomId: room.roomId,
      roomName: room.roomName,
    });
  };

  const renderRoom = ({ item }: { item: JoinedRoom }) => (
    <TouchableOpacity
      style={[styles.roomItem, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => handleRoomPress(item)}
      activeOpacity={0.7}
    >
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} style={styles.roomImage} />
      ) : (
        <View style={[styles.roomImagePlaceholder, { backgroundColor: colors.placeholderBackground }]}>
          <Ionicons name="people-outline" size={moderateScale(28)} color={colors.secondaryText} />
        </View>
      )}
      <View style={styles.roomInfo}>
        <Text style={[styles.roomName, { color: colors.text }]} numberOfLines={2}>
          {item.roomName}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={moderateScale(20)} color={colors.secondaryText} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.secondaryText }]}>
            Loading joined rooms...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>My Rooms</Text>
        {joinedRooms.length > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={styles.badgeText}>{joinedRooms.length}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={joinedRooms}
        renderItem={renderRoom}
        keyExtractor={(item) => item.roomId}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.accent]}
            progressBackgroundColor="#fff"

          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.iconContainer, { backgroundColor: colors.card }]}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={moderateScale(56)}
                color={colors.secondaryText}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No rooms joined yet</Text>
            <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
              Join some rooms to see them here!
            </Text>
          </View>
        }
      />
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
    justifyContent: 'center',
    marginBottom: hp('2%'),
    paddingHorizontal: wp('4%'),
    paddingTop: hp('1.8%'),
    gap: wp('2%'),
  },
  title: {
    fontSize: moderateScale(28),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badge: {
    minWidth: moderateScale(28),
    height: moderateScale(28),
    borderRadius: moderateScale(14),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(8),
  },
  badgeText: {
    color: '#fff',
    fontSize: moderateScale(13),
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: wp('4%'),
    paddingBottom: hp('2%'),
    flexGrow: 1,
  },
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(11),
    marginBottom: hp('1.2%'),
    borderRadius: moderateScale(16),
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  roomImage: {
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: moderateScale(25),
    marginRight: wp('3%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  roomImagePlaceholder: {
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: moderateScale(25),
    marginRight: wp('3%'),
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  roomName: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: hp('2%'),
  },
  loadingText: {
    fontSize: moderateScale(15),
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: hp('12%'),
    gap: hp('1.5%'),
  },
  iconContainer: {
    width: moderateScale(120),
    height: moderateScale(120),
    borderRadius: moderateScale(60),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  emptyTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  emptyText: {
    fontSize: moderateScale(15),
    textAlign: 'center',
    lineHeight: moderateScale(22),
    paddingHorizontal: wp('10%'),
    fontWeight: '500',
  },
});