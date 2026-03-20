import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert, Animated, Dimensions } from 'react-native';
import Auth0 from 'react-native-auth0';
import { jwtDecode } from 'jwt-decode';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import EncryptedStorage from 'react-native-encrypted-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RootStackParamList } from './types/navigation';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

const auth0 = new Auth0({
  domain: 'nexi.us.auth0.com',
  clientId: 'k7J1eXJXuPXSNrdqlYhOQN2J9PWNIIvb',
});

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Auth0IdToken {
  sub: string;
  name: string;
  picture: string;
  email: string;
  email_verified: boolean;
}

const PARSE_URL = 'https://nexi-server.onrender.com/parse';
const APP_ID = 'myAppId';

const words = [
  { text: 'Find', bgColor: '#FFE5B4', textColor: '#fff' },
  { text: 'Discover', bgColor: '#000', textColor: '#fff' },
  { text: 'Explore in one place', bgColor: '#E5DFFB', textColor: '#fff' },
];

const TYPING_SPEED = 70;
const DELETING_SPEED = 10;
const PAUSE_DURATION = 1000;

interface StarData {
  id: number;
  left: number;
  top: number;
  size: number;
}

interface StarProps {
  style: any;
}

const Star = ({ style }: StarProps) => {
  const opacity = useRef(new Animated.Value(Math.random())).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const twinkle = () => {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: Math.random() * 0.8 + 0.2,
          duration: Math.random() * 2000 + 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: Math.random() * 0.8 + 0.2,
          duration: Math.random() * 2000 + 1000,
          useNativeDriver: true,
        }),
      ]).start(() => twinkle());
    };

    const move = () => {
      const animate = () => {
        translateY.setValue(-Math.random() * 200 - 100);
        Animated.timing(translateY, {
          toValue: Dimensions.get('window').height + 100,
          duration: Math.random() * 6000 + 4000,
          useNativeDriver: true,
        }).start(() => {
          animate();
        });
      };

      animate();
    };

    twinkle();
    move();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    />
  );
};

const UniverseBackground = () => {
  const [stars, setStars] = useState<StarData[]>([]);

  useEffect(() => {
    const { width, height } = Dimensions.get('window');
    const starCount = 100;
    const newStars = [];

    for (let i = 0; i < starCount; i++) {
      newStars.push({
        id: i,
        left: Math.random() * width,
        top: Math.random() * height,
        size: Math.random() * 4 + 2,
      });
    }
    setStars(newStars);
  }, []);

  return (
    <View style={styles.universeContainer}>
      {stars.map((star) => (
        <Star
          key={star.id}
          style={[
            styles.star,
            {
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
            },
          ]}
        />
      ))}
    </View>
  );
};

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayText, setDisplayText] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = words[wordIndex].text;

    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting) {
      if (charIndex < currentWord.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentWord.slice(0, charIndex + 1));
          setCharIndex(charIndex + 1);
        }, TYPING_SPEED);
      } else {
        timeout = setTimeout(() => setIsDeleting(true), PAUSE_DURATION);
      }
    } else {
      if (charIndex > 0) {
        timeout = setTimeout(() => {
          setDisplayText(currentWord.slice(0, charIndex - 1));
          setCharIndex(charIndex - 1);
        }, DELETING_SPEED);
      } else {
        setIsDeleting(false);
        setWordIndex((wordIndex + 1) % words.length);
      }
    }

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, wordIndex]);

    const onLogin = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('Starting Auth0 login...');
        const credentials = await auth0.webAuth.authorize({
          scope: 'openid profile email',
          
          redirectUrl: 'nexi://nexi.us.auth0.com/android/com.nexi/callback',
          additionalParameters: {
      prompt: 'login',  // forces showing the login page (ignores existing SSO session)
    },
        });

      const idToken = credentials.idToken;
      if (!idToken) throw new Error('No ID token received from Auth0');

      await EncryptedStorage.setItem('idToken', idToken);

      const userInfo: Auth0IdToken = jwtDecode(idToken);
      console.log('Auth0 User Info:', userInfo);

      const username = userInfo.sub;
      const password = idToken;

      let sessionToken = '';

      // STEP 1: Try to log in first
      const loginUrl = `${PARSE_URL}/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
      const loginRes = await fetch(loginUrl, {
        method: 'GET',
        headers: {
          'X-Parse-Application-Id': APP_ID,
        },
      });

      if (loginRes.ok) {
        const data = await loginRes.json();
        sessionToken = data.sessionToken;
        console.log('Logged in existing dummy user');
      } else {
        const loginErr = await loginRes.json();
        console.log('Login failed:', loginErr);
      }

      // STEP 2: If login failed (user doesn't exist), sign up
      if (!sessionToken) {
        const signupRes = await fetch(`${PARSE_URL}/users`, {
          method: 'POST',
          headers: {
            'X-Parse-Application-Id': APP_ID,
            'X-Parse-Revocable-Session': '1',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username,
            password,
            email: userInfo.email,
            auth0Id: userInfo.sub,
          }),
        });

        if (signupRes.ok) {
          const data = await signupRes.json();
          sessionToken = data.sessionToken;
          console.log('Created new dummy user');
        } else {
          const signupErr = await signupRes.json();
          if (signupErr.code === 202) {
            const retryLogin = await fetch(loginUrl, {
              method: 'GET',
              headers: {
                'X-Parse-Application-Id': APP_ID,
              },
            });
            if (retryLogin.ok) {
              const data = await retryLogin.json();
              sessionToken = data.sessionToken;
              console.log('Retry login succeeded after 202');
            }
          } else {
            throw new Error(signupErr.error || 'Signup failed');
          }
        }
      }

      if (!sessionToken) {
        throw new Error('Failed to get session token');
      }

      await AsyncStorage.setItem('parseSessionToken', sessionToken);
      await AsyncStorage.setItem('auth0Id', userInfo.sub);

      console.log('🔐 SESSION TOKEN SAVED SUCCESSFULLY!');
      console.log('Token (first 30 chars):', sessionToken.substring(0, 30) + '...');

      const where = encodeURIComponent(JSON.stringify({ auth0Id: userInfo.sub }));
      const profileRes = await fetch(`${PARSE_URL}/classes/UserProfile?where=${where}`, {
        method: 'GET',
        headers: {
          'X-Parse-Application-Id': APP_ID,
          'X-Parse-Session-Token': sessionToken,
        },
      });

      const profileData = await profileRes.json();

      if (profileData.results.length === 0) {
        navigation.replace('ProfileSetup', {
          userId: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          username: userInfo.name.split(' ')[0] || 'User',
          bio: '',
          profilePicUrl: userInfo.picture,
          height: '',
          gender: '',
          isEditMode: false,
        });
      } else {
        const profile = profileData.results[0];
        await AsyncStorage.setItem('parseObjectId', profile.objectId);
        await AsyncStorage.setItem('currentUserId', profile.objectId);

        navigation.replace('Home', {
          userId: userInfo.sub,
          username: profile.username || userInfo.name,
          bio: profile.bio || '',
          profilePicUrl: profile.profilePicUrl || userInfo.picture,
          height: profile.height || '',
          gender: '',
        });
      }

    } catch (e: any) {
      console.error('Login failed:', e);
      setError(e.message || 'Login failed');
      Alert.alert('Error', e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <UniverseBackground />
      
      <View style={styles.typingContainer}>
        <Text style={[styles.typingText, { color: words[wordIndex].textColor || '#fff' }]}>
          {displayText}
          <Text style={styles.cursor}>|</Text>
        </Text>
      </View>

      <View style={styles.bottomPanel}>
        {loading ? (
          <ActivityIndicator size="large" color="#fff" style={{ marginBottom: 20 }} />
        ) : (
          <>
            <TouchableOpacity
              style={styles.buttonTertiary}
              onPress={onLogin}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonTextTertiary}>Log in</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.buttonSecondary}
              onPress={onLogin}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonTextSecondary}>Sign up</Text>
            </TouchableOpacity>
          </>
        )}
        
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </View>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  universeContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#5170ff',
  },
  star: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: moderateScale(50),
  },
  typingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp('5%'),
  },
  typingText: {
    fontSize: moderateScale(50),
    fontWeight: '600',
    textAlign: 'center',
  },
  cursor: {
    color: '#fff',
    fontWeight: '900',
  },
  bottomPanel: {
    width: '100%',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('3%'),
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderTopLeftRadius: moderateScale(20),
    borderTopRightRadius: moderateScale(20),
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#ff6b6b',
    borderRadius: moderateScale(25),
    paddingVertical: hp('2%'),
    paddingHorizontal: wp('6%'),
    width: wp('90%'),
    marginTop: hp('1.5%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scale(2) },
    shadowOpacity: 0.3,
    shadowRadius: scale(3),
    elevation: 5,
  },
  buttonTextSecondary: {
    fontSize: moderateScale(16),
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  buttonTertiary: {
    backgroundColor: 'transparent',
    borderColor: '#fff',
    borderWidth: scale(1),
    borderRadius: moderateScale(25),
    paddingVertical: hp('2%'),
    paddingHorizontal: wp('6%'),
    width: wp('90%'),
    marginBottom: hp('1%'),
  },
  buttonTextTertiary: {
    fontSize: moderateScale(16),
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  errorText: {
    color: '#ff6b6b',
    marginTop: hp('2%'),
    textAlign: 'center',
    fontSize: moderateScale(14),
  },
});