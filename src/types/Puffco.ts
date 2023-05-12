export interface OtaFirmware {
  id: number;
  releaseNotes: string;
  version: string;
  fileMedia: FileMedia;
}

export interface FileMedia {
  id: number;
  filename: string;
  originalUrl: string;
  smallUrl: string;
  mediumUrl: string;
  largeUrl: string;
  created: string;
  modified: string;
}

export interface AccountTokens {
  refreshToken: string;
  accessToken: string;
}

export interface PuffcoUser {
  tempPreference: string;
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  defaultUsername: boolean;
  email: string;
  verified: boolean;
  pushNotifications: boolean;
  marketOptIn: null;
  enableBugfender: boolean;
  created: string;
  roles: UserRole[];
  profileMedia: null;
  locked: boolean;
}

export interface UserRole {
  id: number;
  name: string;
}

export interface HeatProfile {
  id: string;
  name: string;
  temperature: number;
  duration: number;
  color: string;
  order: number;
  lighting: number;
  units: string;
  created: string;
  modified: string;
  version: string;
  isMoodLight: boolean;
  moodLightId: null;
  wasSyncedWithActive: boolean;
  userId: number;
  shareProfile: null;
}
