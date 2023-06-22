import {
  AccountTokens,
  HeatProfile,
  OtaFirmware,
  PuffcoUser,
} from "../types/Puffco";

export async function getOtaLatest(serial?: string) {
  const req = await fetch(
    `https://api.puffco.app/api/ota/latest${
      serial ? `?serialNumber=${serial}` : ""
    }`,
    {
      headers: {
        "user-agent": "puff.social/1.0.0",
        "x-app-version": "2.2.0",
      },
    }
  );

  if (req.status == 404) return null;

  if (req.status != 200)
    throw { code: "failed_to_get_firmware", status: req.status };

  const json = (await req.json()) as OtaFirmware;

  return json;
}

export async function login(email: string, password: string) {
  const req = await fetch("https://api.puffco.app/api/users/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    headers: {
      "content-type": "application/json",
      "user-agent": "puff.social/1.0.0",
      "x-app-version": "2.2.0",
    },
  });

  if (req.status != 201) {
    switch (req.status) {
      case 400: {
        const json = await req.json();
        throw {
          code: "invalid_login_request",
          message: json.message,
          status: req.status,
        };
      }
      case 401: {
        const json = await req.json();
        switch (json.type) {
          case "Attempt": {
            throw {
              code: "invalid_login_credentials",
              remaining: json.remainAttempts,
              status: req.status,
            };
          }
          case "Temporary": {
            throw {
              code: "login_max_retries",
              time: json.unlockTime,
              status: req.status,
            };
          }
          default: {
            throw {
              code: "invalid_login_request",
              message: json.message,
              status: req.status,
            };
          }
        }
      }
      default: {
        throw { code: "failed_to_login", status: req.status };
      }
    }
  }

  const json: AccountTokens = await req.json();

  return json;
}

export async function fetchUser(token: string) {
  const req = await fetch("https://api.puffco.app/api/users/me", {
    headers: {
      authorization: `Bearer ${token}`,
      "user-agent": "puff.social/1.0.0",
      "x-app-version": "2.2.0",
    },
  });

  if (req.status != 200)
    throw { code: "failed_to_get_user", status: req.status };

  const json: PuffcoUser = await req.json();

  return json;
}

export async function heatProfiles(token: string) {
  const req = await fetch("https://api.puffco.app/api/users/me/heat-profiles", {
    headers: {
      authorization: `Bearer ${token}`,
      "user-agent": "puff.social/1.0.0",
      "x-app-version": "2.2.0",
    },
  });

  if (req.status != 200)
    throw { code: "failed_to_get_profiles", status: req.status };

  const json: HeatProfile[] = await req.json();

  return json;
}
