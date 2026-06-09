import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { useAuth } from "@/context/AuthContext";

import type { SleepRecord } from "@/lib/api";

import {
  getSleepInfoApi,
  createSleepInfoApi,
} from "@/services/authApi";

export type { SleepRecord } from "@/lib/api";

interface SleepContextType {
  monthlyAverageDuration: number;
  monthlyAverageScore: number;

  records: SleepRecord[];
  activeSession: {
    startTime: Date;
    temperature: number;
    humidity: number;
  } | null;

  startSleep: () => void;
  endSleep: () => Promise<SleepRecord | null>;

  updateMemo: (
    id: string,
    memo: string
  ) => Promise<void>;

  getRecordByDate: (
    date: string
  ) => SleepRecord | undefined;

  weeklyRecords: SleepRecord[];

  averageDuration: number;
  averageScore: number;

  alarmHour: number;
  alarmMin: number;
  alarmOn: boolean;

  setAlarm: (
    hour: number,
    min: number
  ) => Promise<void>;

  setAlarmOn: (
    on: boolean
  ) => Promise<void>;
}

const SleepContext =
  createContext<SleepContextType | null>(
    null
  );

export function SleepProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  const [records, setRecords] = useState<
    SleepRecord[]
  >([]);

  const [activeSession, setActiveSession] =
    useState<
      SleepContextType["activeSession"]
    >(null);

  // 임시 알람 상태
  const [alarmHour, setAlarmHour] =
    useState(7);

  const [alarmMin, setAlarmMin] =
    useState(0);

  const [alarmOn, setAlarmOnState] =
    useState(true);

  useEffect(() => {
    if (!user) {
      setRecords([]);
      setActiveSession(null);

      setAlarmHour(7);
      setAlarmMin(0);
      setAlarmOnState(true);

      return;
    }

    loadRecords(user.id);
  }, [user?.id]);

  async function loadRecords(userId: string) {
    try {
      const res = await getSleepInfoApi(userId);

      console.log(
        "수면 기록 조회:",
        JSON.stringify(res.data, null, 2)
      );

      const data = res.data;

      const converted = data.map((item: any) => ({
        id: String(userId),
        date: item.day,
        durationMinutes: item.duration,
        score: item.sleep_score,
        startTime: item.start_sleep,
        endTime: item.end_sleep,
        temperature: item.temp_avg,
        humidity: item.hum_avg,
      }));

      console.log(
        "변환 후 records",
        JSON.stringify(converted, null, 2)
      );

      setRecords(converted);
      console.log(
        "records 개수",
        converted.length
      );
      console.log("총 기록", records.length);
      console.log(
        "월 평균 수면",
        monthlyAverageDuration
      );
      console.log(
        "월 평균 점수",
        monthlyAverageScore
      );

    } catch (error) {
      console.log("수면 기록 조회 실패");
      console.log(error);
    }
  }
  useEffect(() => {
    console.log("records 변경됨");
    console.log(records);
  }, [records]);


  async function setAlarm(
    hour: number,
    min: number
  ) {
    setAlarmHour(hour);
    setAlarmMin(min);

    // 서버 API 없음
  }

  async function setAlarmOn(
    on: boolean
  ) {
    setAlarmOnState(on);

    // 서버 API 없음
  }

  function startSleep() {
    setActiveSession({
      startTime: new Date(),
      temperature:
        22 +
        Math.floor(Math.random() * 5),
      humidity:
        50 +
        Math.floor(Math.random() * 20),
    });
  }

  async function endSleep(): Promise<SleepRecord | null> {
    if (!activeSession || !user)
      return null;

    try {
      const endTime = new Date();

      const durationMinutes =
        Math.round(
          (endTime.getTime() -
            activeSession.startTime.getTime()) /
          60000
        );

      const score = Math.min(
        100,
        Math.max(
          40,
          70 +
          Math.floor(
            durationMinutes / 10
          )
        )
      );

      const payload = {
        id: Number(user.id),

        sleep_score: score,

        start_sleep:
          activeSession.startTime.toISOString(),

        end_sleep:
          endTime.toISOString(),

        temp_avg:
          activeSession.temperature,

        hum_avg:
          activeSession.humidity,

        audio_path: "",

        duration:
          Math.max(
            1,
            durationMinutes
          ),

        snoring_count: 0,
      };

      const res =
        await createSleepInfoApi(
          payload
        );

      console.log(
        "수면 저장 응답",
        JSON.stringify(
          res.data,
          null,
          2
        )
      );

      // 저장 후 서버에서 다시 조회
      await loadRecords(user.id);

      setActiveSession(null);

      return null;
    } catch (error: any) {
      console.log(
        "수면 기록 저장 실패"
      );

      console.log(
        error.response?.status
      );

      console.log(
        JSON.stringify(
          error.response?.data,
          null,
          2
        )
      );

      return null;
    }
  }

  async function updateMemo(
    id: string,
    memo: string
  ) {
    console.log(
      "메모 수정 API 없음"
    );

    console.log(id, memo);
  }

  const getRecordByDate =
    useCallback(
      (date: string) =>
        records.find(
          (r) => r.date === date
        ),
      [records]
    );

  const oneMonthRecords =
    records.filter((r) => {
      const recordDate = new Date(r.date);
      const now = new Date();

      const diff =
        now.getTime() -
        recordDate.getTime();

      return (
        diff <=
        30 * 24 * 60 * 60 * 1000
      );
    });

  const monthlyAverageDuration =
    oneMonthRecords.length > 0
      ? Math.round(
        oneMonthRecords.reduce(
          (sum, r) =>
            sum +
            r.durationMinutes,
          0
        ) /
        oneMonthRecords.length
      )
      : 0;

  const monthlyAverageScore =
    oneMonthRecords.length > 0
      ? Math.round(
        oneMonthRecords.reduce(
          (sum, r) =>
            sum + r.score,
          0
        ) /
        oneMonthRecords.length
      )
      : 0;


  const weeklyRecords =
    records.slice(-7);

  const averageDuration =
    records.length > 0
      ? Math.round(
        records.reduce(
          (sum, r) =>
            sum +
            r.durationMinutes,
          0
        ) / records.length
      )
      : 0;

  const averageScore =
    records.length > 0
      ? Math.round(
        records.reduce(
          (sum, r) =>
            sum + r.score,
          0
        ) / records.length
      )
      : 0;

  return (
    <SleepContext.Provider
      value={{
        monthlyAverageDuration,
        monthlyAverageScore,

        records,
        activeSession,

        startSleep,
        endSleep,

        updateMemo,

        getRecordByDate,

        weeklyRecords,

        averageDuration,
        averageScore,

        alarmHour,
        alarmMin,
        alarmOn,

        setAlarm,
        setAlarmOn,
      }}
    >
      {children}
    </SleepContext.Provider>
  );
}

export function useSleep() {
  const ctx =
    useContext(SleepContext);

  if (!ctx) {
    throw new Error(
      "useSleep must be used within SleepProvider"
    );
  }

  return ctx;
}

