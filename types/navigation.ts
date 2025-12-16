// types/navigation.ts
export type RootStackParamList = {
  Login: undefined;

  ProfileSetup: {
    userId: string;
    email: string;
    name: string;
    username?: string;
    bio?: string;
    profilePicUrl?: string | null;
    height?: string;
    gender?: string;
    isEditMode?: boolean;
  };

  Home: {
    userId: string;
    username: string;
    bio: string;
    profilePicUrl: string | null;
    height?: string;
    gender?: string;
  };

  SearchBar: {
    initialQuery?: string;
  };

  UserProfile: {
    userId?: string;
    username: string;
    profilePicUrl?: string | null;
    bio?: string;
    height?: string;
    gender?: string;
    objectId?: string;
  };

  Settings: undefined;
  Inbox: undefined;

  Chat: {
    receiverId: string;
    receiverName: string;
    receiverPic?: string;
  };

  FollowingFollowers: {
    userId: string;
    type: 'followers' | 'following';
  };

  UserUploadPost: { auth0Id: string };

  // Rooms Flow
  RoomCreation: undefined;
  RoomLocation: {
    roomName: string;
    roomPhotoUrl: string | null;
  };
  RoomUserProfile: {
    roomId: string;
    roomName: string;
  };

  // ADD THIS LINE — This was missing!
  RoomPostUpload: {
    roomId: string;
    roomName: string;
  };
  JoinedRooms: {
    userParseObjectId: string; 
         // Parse objectId of the current user
  };
  PersonalInfo: undefined;
  BlockedUsers: undefined;
  RoomSettings: { roomId: string; roomName: string };
    TermsAndConditions: undefined;  // 👈 ADD THIS LINE


  

  
  // (Optional: you can keep these commented if you plan to re-add map posts later)
  /*
  MapPostScreen: {
    postId: string;
    imageUrl: string;
    caption: string;
    markerPosition: { latitude: number; longitude: number };
    region?: {
      latitude: number;
      longitude: number;
      latitudeDelta: number;
      longitudeDelta: number;
    };
    locationName?: string;
    searchQuery?: string;
    showInFeed: boolean;
    auth0Id: string;
  };    
  
  MapsUploadPost: {
    postId: string;
    imageUrl: string;
    auth0Id: string;
    showInFeed: boolean;
  };
  */

  
};