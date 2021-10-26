import axios from 'axios';

export interface IPInfo {
  ip: string;
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  org: string;
  postal: string;
  timezone: string;
}

function emptyIPInfo(): IPInfo {
  return {
    ip: null,
    city: null,
    region: null,
    country: null,
    latitude: null,
    longitude: null,
    org: null,
    postal: null,
    timezone: null
  };
}

export async function getIPInfo(ip: string): Promise<IPInfo> {
  try {
    const res = await axios.get(`https://ipinfo.io/${ip}?token=e3d628d0022526`);
    const data = (res.data as any);
    const location = data.loc.split(',');
    return {
      ip: data.ip,
      city: data.city,
      region: data.region,
      country: data.country,
      latitude: Number(location[0]),
      longitude: Number(location[1]),
      org: data.org,
      postal: data.postal,
      timezone: data.timezone
    };
  } catch (err) {
    console.error(err);
  }

  return emptyIPInfo();
}