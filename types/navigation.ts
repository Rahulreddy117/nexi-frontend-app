// types/navigation.ts
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
    isEditMode?: boolean;
  };
  Home: {
    userId: string;
    username: string;
    bio: string;
    profilePicUrl: string | null;
    height?: string;
  };
  SearchBar: { initialQuery?: string };          // ← NEW
  UserProfile: {                                 // ← NEW
    userId: string;
    username: string;
    profilePicUrl?: string | null;
    bio?: string;
    height?: string;
  };
  Settings: undefined;    
  Inbox: undefined;  // ← NEW
  Chat: {
    receiverId: string;
    receiverName: string;
    receiverPic?: string;
  };// <-- R

  
  
};