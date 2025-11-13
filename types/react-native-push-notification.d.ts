// src/types/react-native-push-notification.d.ts
declare module 'react-native-push-notification' {
  export interface PushNotificationObject {
    title?: string;
    message: string;
    channelId?: string;
    smallIcon?: string;
    largeIcon?: string;
    playSound?: boolean;
    soundName?: string;
    importance?: string;
    vibrate?: boolean;
    userInfo?: any;
    // …add any other props you use
  }

  export interface PushNotification {
    configure(options: any): void;
    localNotification(details: PushNotificationObject): void;
    createChannel(channel: any, callback?: (created: boolean) => void): void;
    // add more methods you call
  }

  const PushNotification: PushNotification;
  export default PushNotification;
}