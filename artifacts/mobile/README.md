# 몽글 - 수면 측정 앱

## 수면 음악과 코골이 예측

- 홈의 기존 음악 칸은 **코골이 예측**으로 변경했습니다. 오늘의 음주, 운동, 코막힘, 수면 자세에 모두 답하면 참고용 추정치를 표시합니다.
- 전날은 기기의 현지 날짜로 계산합니다. 홈 달력에서 다른 날짜를 선택해도 예측에는 실제 전날 기록만 사용합니다. 기록 또는 점수가 없으면 임의의 점수를 만들지 않고 설문만 반영합니다.
- 설문 응답은 현재 앱 실행 중 유지되며, 사용자가 바뀌거나 날짜가 바뀌면 초기화됩니다. 서버에 설문을 저장하는 API는 추가하지 않았습니다.
- 측정 화면에서 **자연음 / 빗소리 / 백색소음**을 선택하면 포함된 WAV 파일을 반복 재생합니다. 일시정지, 재생, 3단계 음량 조절 및 끄기를 지원합니다. 화면을 닫았다가 다시 열어도 측정 중 재생 상태를 유지하며, 측정 종료·로그아웃 시 소리를 중지하고 해제합니다.
- 재생 소리가 기존 마이크 음량 기반 코골이 감지에 포함되지 않도록, 음악 재생 중에는 감지 횟수 집계를 일시정지하고 정지 후 약 3.5초 뒤 재개합니다. 수면 시간과 센서 측정은 계속 진행합니다.
- iOS 빌드에는 배경 오디오 설정을 포함했습니다. 실제 기기의 화면 잠금·오디오 경로·동시 녹음은 기기에서 추가 확인해야 합니다. iOS Expo Go의 배경 오디오는 지원되지 않습니다. [Expo 오디오 문서](https://docs.expo.dev/versions/v54.0.0/sdk/audio-av/)

### 추정치의 범위

이 기능은 학습 데이터 없이 만든 **제품 시연용 규칙 기반 추정**입니다. 퍼센트는 통계적으로 보정된 실제 발생 확률이 아니며 의료 진단에 사용할 수 없습니다. 음주·코막힘·수면 자세 등의 설문 요인은 [NHS 코골이 안내](https://www.nhs.uk/symptoms/snoring/)를 참고했지만, 아래 가중치와 전날 점수의 기여도는 자체 설계한 값입니다. 오늘 하루의 운동 효과나 수면점수와 코골이 사이의 관계도 임상적으로 검증하지 않았습니다.

`기본 20 + 음주 25 + 코막힘 20 + 똑바로 눕기 15 - 운동 5 + round((70 - 전날 점수) × 0.2)`

점수가 없으면 마지막 항은 제외합니다. 결과는 5~95 범위에 제한하고, 35 미만 / 65 미만 / 65 이상을 낮음 / 보통 / 높음으로 표시합니다. 실제 확률 예측으로 발전시키려면 설문과 코골이 측정 결과를 모아 모델 학습 및 별도 검증이 필요합니다.

### 개발 검증

프로젝트 루트에서 실행합니다.

```sh
pnpm install --frozen-lockfile --ignore-scripts --filter mongle-sleep-app --filter workspace
node --test scripts/test-sleep-features.cjs
node node_modules/typescript/bin/tsc -p artifacts/mobile/tsconfig.json --noEmit
```

포함된 소리는 직접 생성한 12초 PCM 반복 음원이며, 외부 음원 주소나 라이선스에 의존하지 않습니다. 다시 생성하려면 `node scripts/generate-sleep-audio.cjs`를 실행합니다.

새 설치에서 발견된 Babel 선언 누락, Worklets 변환 설정 및 중복 React 실행 오류도 보완했습니다. 모바일 앱의 React/Expo 모듈을 일관되게 사용하도록 Metro를 설정했고, 기존 라이브러리 버전은 유지했습니다.

웹 미리보기는 `artifacts/mobile`에서 `node node_modules/expo/bin/cli export --platform web --output-dir web-build`로 빌드한 뒤, 프로젝트 루트에서 `node scripts/preview-mobile-web.cjs`를 실행하고 `http://localhost:8087/`를 열면 됩니다. 로그인과 저장된 수면 기록 조회에는 API 서버가 필요합니다.

### 휴대폰에서 확인하기

안드로이드에서 SDK 54 호환 [Expo Go](https://expo.dev/go?device=true&platform=android&sdkVersion=54)를 설치하고, PC와 같은 Wi-Fi에서 개발 서버의 QR을 스캔합니다. `artifacts/mobile`에서 다음 명령으로 실행할 수 있습니다.

```sh
node node_modules/expo/bin/cli start --go --lan --port 8081
```

실제 API 주소는 `EXPO_PUBLIC_API_BASE_URL`로 지정할 수 있습니다. 응답이 없으면 요청은 8초 후 종료하며, 로그인 실패 안내도 화면에 표시합니다.

Expo React Native로 만든 수면 측정 앱입니다.  
프론트 앱은 REST API 서버에서 사용자, 수면 기록, 알람 설정 데이터를 가져옵니다.

## 실행 방법

### 준비물
- [Node.js](https://nodejs.org/) 20.19 이상
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

## API 서버 설정

```powershell
$env:EXPO_PUBLIC_API_BASE_URL = 'http://13.125.10.228/'
cd artifacts/mobile
node node_modules/expo/bin/cli start --go --lan --port 8081
```

로그인과 수면 기록 API의 기본 주소는 `http://13.125.10.228/`입니다. 다른 서버를 사용할 때는 실행 전에 `EXPO_PUBLIC_API_BASE_URL`을 지정하세요.
- react-native-svg (아이콘)
- expo-linear-gradient, expo-haptics
