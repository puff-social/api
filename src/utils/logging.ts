import { env } from "../env";

export enum LogTypes {
  NewUser,
  NewDevice,
  DeviceNewOwner,
  SiteFeedback,
  DeviceDabsUpdate,
  DeviceConnection,
}

export interface NewUser {
  id: string;
  name: string;
  display_name: string;
  auth_type: string;
}

export interface NewDevice {
  id: string;
  name: string;
  device_model: string;
  dabs: number;
  firmware: string;
  serial_number?: string;
  mac: string;
}

export interface Owner {
  id: string;
  name: string;
  display_name: string;
}

export interface DeviceNewOwner {
  id: string;
  name: string;
  old_owner: Owner;
  new_owner: Owner;
}

export interface SiteFeedback {
  id: string;
  message: string;
  ip: string;
}

export interface DeviceConnection {
  id: string;
  name: string;
}

export interface DeviceDabsUpdate {
  id: string;
  name: string;
  dabs: number;
}

export async function trackLog(
  type: LogTypes,
  channel: string,
  data:
    | NewUser
    | NewDevice
    | DeviceNewOwner
    | SiteFeedback
    | DeviceConnection
    | DeviceDabsUpdate
) {
  try {
    console.log(
      await fetch(`${env.DASH_API_HOST}/log?type=${type}&channel=${channel}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json())
    );
  } catch (error) {
    console.error(error);
  }
}
