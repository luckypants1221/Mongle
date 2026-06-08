# 몽글 - 수면 측정 앱

Expo React Native로 만든 수면 측정 앱입니다.  
프론트 앱은 REST API 서버에서 사용자, 수면 기록, 알람 설정 데이터를 가져옵니다.

## 실행 방법

### 준비물
- [Node.js](https://nodejs.org/) 18 이상
- [Expo Go](https://expo.dev/go) 앱 (스마트폰에 설치)

### 설치 및 실행

```bash
# 1. 이 폴더로 이동
cd artifacts/mobile

# 2. 패키지 설치
npm install

# 3. 앱 실행
npx expo start
```

터미널에 QR코드가 뜨면 스마트폰의 **Expo Go** 앱으로 스캔하세요.

### 웹 브라우저에서 보기

```bash
npx expo start --web
```

## 기술 스택

- Expo SDK 54 + Expo Router
- React Native + react-native-web
- REST API (`GET`, `POST`, `PUT`)

## Run with an API server

```sh
set EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api
corepack pnpm --filter mongle-sleep-app web
```

The mobile app uses `http://localhost:3000/api` by default on web. Override it with `EXPO_PUBLIC_API_BASE_URL` when pointing at the team's existing server. See `API_CONTRACT.md` for the endpoints the frontend calls.
- react-native-svg (아이콘)
- expo-linear-gradient, expo-haptics
