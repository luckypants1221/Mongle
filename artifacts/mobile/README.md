# 몽글 - 수면 측정 앱

Expo React Native로 만든 수면 측정 앱입니다.  
백엔드 없이 기기 내 로컬 저장소(AsyncStorage)만 사용합니다.

## 실행 방법

### 준비물
- [Node.js](https://nodejs.org/) 22.13 이상
- [Expo Go](https://expo.dev/go) 앱 (스마트폰에 설치)

### 설치 및 실행

```bash
# 1. 저장소 루트에서 pnpm으로 패키지 설치 (npm과 혼용하지 않음)
pnpm install

# 2. 모바일 폴더로 이동
cd artifacts/mobile

# 3. Expo Go로 실행 (이전 SDK 캐시 초기화)
pnpm start --clear
```

터미널에 QR코드가 뜨면 스마트폰의 **Expo Go** 앱으로 스캔하세요.

Expo Go는 SDK 57을 지원하는 버전이어야 합니다. Health Connect는 Expo Go에서
호출하지 않으며, 워치 연동 테스트는 네이티브 모듈을 포함한 개발 빌드를 사용하세요.
개발 빌드에 연결할 때는 `pnpm start:dev`를 실행합니다.

### 갤럭시 워치 심박수·REM 그래프

1. 워치의 삼성 헬스 수면·심박수 기록을 휴대폰 삼성 헬스에 동기화합니다.
2. 삼성 헬스 설정의 Health Connect에서 수면·심박수 쓰기 권한을 허용합니다.
3. Android 개발 환경과 연결된 휴대폰을 준비한 뒤 이 폴더에서 `pnpm android`로 개발 빌드를 설치합니다. Expo Go에서는 Health Connect를 사용할 수 없습니다.
4. 홈의 `워치 심박수·수면 단계 불러오기`를 누르고 몽글의 수면·심박수 읽기 권한을 허용합니다.

앱 측정 구간의 데이터를 우선 읽고, 없으면 최근 7일의 삼성 헬스 수면을 조회합니다.
REM·깊은 수면·얕은 수면·깨어있음은 워치의 실제 단계 기록을 표시하며, 심박수는
시간대별 평균·최저·최고로 따로 표시합니다. 심박수만으로 REM을 만들어내지 않습니다.
데이터는 계정별 기기 저장소에 보관하며 그래프에 실제 조회 구간을 표시합니다.

### 웹 브라우저에서 보기

```bash
npx expo start --web
```

## 기술 스택

- Expo SDK 57 + Expo Router
- React Native + react-native-web
- AsyncStorage (로컬 저장)
- react-native-svg (아이콘)
- expo-linear-gradient, expo-haptics
