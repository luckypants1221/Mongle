// 가습기 원격 제어 API (서버: humidifier_router.py)
//   앱 -> PUT /humidifier (모드, 목표 습도 저장) -> 아두이노가 5초마다 받아 가서 적용
import axios from "axios";

export type HumidifierMode = "auto" | "on" | "off";

export interface HumidifierState {
  id: number;
  mode: HumidifierMode;
  target_hum: number;
  updated_at: string | null;
  device_on: boolean | null;   // 가습기 실제 켜짐 여부 (아두이노 보고)
  device_hum: number | null;   // 아두이노가 잰 현재 습도
  device_temp: number | null;
  last_seen: string | null;    // 아두이노 마지막 접속 시각
  online: boolean;             // 30초 안에 아두이노가 접속했는지
}

const api = axios.create({
  baseURL: "http://13.125.10.228",
  timeout: 8000,
});

export async function getHumidifierApi(userId: string | number): Promise<HumidifierState> {
  const res = await api.get("/humidifier", { params: { id: userId } });
  return res.data as HumidifierState;
}

export async function setHumidifierApi(
  userId: string | number,
  mode: HumidifierMode,
  targetHum: number,
): Promise<HumidifierState> {
  const res = await api.put("/humidifier", {
    id: Number(userId),
    mode,
    target_hum: Math.max(30, Math.min(70, Math.round(targetHum))),
  });
  return res.data as HumidifierState;
}
