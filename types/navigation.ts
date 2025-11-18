// types/navigation.ts (Updated: userId Optional in UserProfile)
export type RootStackParamList = {
  Login: undefined;

  ProfileSetup: {
    userId: string;
    email: string;
    name: string;
    /** Optional fields that may come from Home when editing */
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
    gender?: string;        // ← ADDED: now allowed
  };

  SearchBar: {
    initialQuery?: string;
  };

  UserProfile: {
    userId?: string;        // ← CHANGED: Optional (for auth0Id from Search/Home)
    username: string;
    profilePicUrl?: string | null;
    bio?: string;
    height?: string;
    gender?: string;  
    objectId?: string;      // ← For Maps (objectId from Marker)
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
  }
};