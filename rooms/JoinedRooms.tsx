// JoinedRooms.tsx — Lists all rooms the current user has joined
import React, { useState, useEffect, } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { RootStackParamList } from '../types/navigation'; // Adjust path as needed
import { useTheme } from '../ThemeContext'; // Adjust path as needed

type JoinedRoomsRouteProp = RouteProp<RootStackParamList, 'JoinedRooms'>;
type NavigationProp = any; // Replace with proper NativeStackNavigationProp if needed

interface JoinedRoom {
  roomId: string;
  roomName: string;
  photoUrl?: string;
}

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width - 40; // Padding

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
    <TouchableOpacity style={[styles.roomItem, { backgroundColor: colors.card }]} onPress={() => handleRoomPress(item)}>
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} style={styles.roomImage} />
      ) : (
        <View style={[styles.roomImagePlaceholder, { backgroundColor: colors.placeholderBackground }]}>
          <Ionicons name="image-outline" size={40} color={colors.secondaryText} />
        </View>
      )}
      <Text style={[styles.roomName, { color: colors.text }]} numberOfLines={2}>
        {item.roomName}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.iconColor} />
        <Text style={{ color: colors.text, marginTop: 10 }}>Loading joined rooms...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={joinedRooms}
        renderItem={renderRoom}
        keyExtractor={(item) => item.roomId}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.iconColor]} tintColor={colors.iconColor} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={60} color={colors.secondaryText} />
            <Text style={[styles.emptyText, { color: colors.secondaryText }]}>No rooms joined yet.</Text>
            <Text style={[styles.emptySubtext, { color: colors.secondaryText }]}>Join some rooms to see them here!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    padding: 20,
    paddingTop: 10,
  },
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  roomImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  roomImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
    opacity: 0.8,
  },
});