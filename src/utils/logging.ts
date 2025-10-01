import { ProductSeries } from "@puff-social/commons/dist/puffco";
import { env } from "../env";

export enum LogTypes {
  NewUser,
  NewDevice,
  DeviceNewOwner,
  SiteFeedback,
  DeviceDabsUpdate,
  DeviceConnection,
  NewDebuggingSession,
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
  series: ProductSeries;
  dabs: number;
  firmware: string;
  serial_number?: string;
  mac: string;
}

export interface Owner {
  id: string;
  name: string;
  display_name: string | null;
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

export interface DebuggingSession {
  id: string;
  identifier: string;
  data: Record<string, any>;
  ip: string;
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
    | DebuggingSession,
) {
  try {
    await fetch(`${env.DASH_API_HOST}/log?type=${type}&channel=${channel}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error(
      `Logging > Failed to send log event to internal api host`,
      error,
    );
  }
}
