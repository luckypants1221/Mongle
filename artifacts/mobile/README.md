# 몽글 - 수면 측정 앱

Expo React Native로 만든 수면 측정 앱입니다.  
백엔드 없이 기기 내 로컬 저장소(AsyncStorage)만 사용합니다.

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
- AsyncStorage (로컬 저장)
- react-native-svg (아이콘)
- expo-linear-gradient, expo-haptics
