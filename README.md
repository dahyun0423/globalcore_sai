# 혼자옵서예 필드킷

아동 돌봄공백·통학안전 현장 인터뷰 도구 (Global CORE 프로젝트).
아이폰 Safari에서 쓰는 걸 기준으로 만들었어요. 인터뷰 데이터는 **폰 안에만** 저장되고, 위험지점·사진·경로는 팀 코드를 넣으면 팀원끼리 공유됩니다.

## 무엇을 하는 앱인가

| 탭 | 하는 일 |
|---|---|
| 인터뷰 | 동의 확인 → 질문별 녹음·자동 받아쓰기 → 하루 타임라인 그리기 → 대상자에게 서비스 컨셉 보여주고 반응 받기 → AI 정리 |
| 위험지도 | **여기 기록**(현재 위치에 사진·태그·메모) · 지도 눌러 위험지점 추가 · **경로 그리기**(점을 이어 통학길) · **걸으며 기록**(GPS로 실제 걸은 길·시간) · **장소 검색**(학교·센터·학원). 한국은 카카오맵, 대만은 구글 지도 |
| 보드 | 지역별 평균 공백 시간, 시간대별 공백 히트맵, 돌봄 구성, 컨셉 반응, 제주 vs 대만 AI 비교 초안 |
| 데이터 | **팀 코드 입력(공유)** / JSON 백업 / 인터뷰·위험지점·경로 CSV 내보내기 / 다른 폰 JSON 합치기 |

## 시작하기

```bash
npm install
cp .env.example .env.local   # 키 채우기 (아래 참고)
npm run dev
```

`http://localhost:3000` — 아이폰에서 테스트하려면 같은 와이파이에서 `npm run dev -- -H 0.0.0.0` 로 띄우고
맥의 IP(`ipconfig getifaddr en0`)로 접속하세요. **단, 마이크와 받아쓰기는 https에서만 동작**하므로
실제 녹음 테스트는 Vercel에 올린 주소로 하는 게 편합니다.

### 키

| 환경변수 | 어디서 | 없으면 |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 저장소 `globalcore-share`(비공개). `vercel env pull`로 받아짐 | 팀 공유가 안 됨 (기록은 폰에 남음) |
| `TEAM_CODE` | 팀원만 아는 공유 코드. 서버에만 있음 (`NEXT_PUBLIC_` 붙이지 말 것) | 팀 공유 API가 503 |
| `ANTHROPIC_API_KEY` | console.anthropic.com | AI 정리·비교 버튼이 503 안내 메시지를 띄움 (나머지는 정상 작동) |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 카카오 개발자 > 앱 > **JavaScript 키**. 플랫폼 > Web에 `http://localhost:3000`과 배포 도메인 등록 필수 | 한국 지역도 OpenStreetMap으로 표시 |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Google Cloud > Maps JavaScript API + **Places API (New)**(장소 검색). 결제 계정 필요, HTTP 리퍼러 제한 필수 | 대만도 OpenStreetMap으로 표시 |

`ANTHROPIC_API_KEY`는 서버에서만 읽습니다(`NEXT_PUBLIC_` 절대 붙이지 마세요). 지도 키는 브라우저에 노출되는 게
정상이라, 반드시 **도메인/리퍼러 제한**을 걸어 두세요.

### 배포 (Vercel)

```bash
npx vercel            # 미리보기
npx vercel --prod     # 실제 주소
```

Vercel 대시보드 > Settings > Environment Variables에 위 키를 넣고, 카카오·구글 콘솔에 **배포 도메인을 추가**하세요.
아이폰 Safari에서 배포 주소를 열고 `공유 > 홈 화면에 추가`를 하면 앱처럼 전체화면으로 뜹니다.

## 현장에서 쓰기 전 확인할 것

- [ ] **자기 아이폰에서 녹음·받아쓰기 한 번 돌려보기.** iOS Safari의 음성 인식은 첫 실행 때 마이크·음성 인식 권한을
      묻습니다. 녹음과 받아쓰기를 동시에 쓰면 기기에 따라 마이크 충돌이 날 수 있어서, 그럴 땐 상단에서
      `받아쓰기만` 또는 `녹음만` 모드로 바꾸세요.
- [ ] 받아쓰기는 **인터넷이 필요**하고 오인식이 있습니다. 중요한 말은 메모로도 남기세요.
- [ ] 인터뷰 끝날 때마다 데이터 탭에서 **JSON 백업**. 사파리 데이터 삭제·개인정보보호 모드에서는 저장이 날아갈 수 있어요.
- [ ] 녹음 파일은 인터뷰 `정리` 단계에서 개별로 내려받아 따로 보관.
- [ ] **팀 코드를 데이터 탭에 넣기.** 넣어야 위험지점·사진·경로가 팀 지도에 모입니다.
- [ ] **걸으며 기록은 화면을 켜 둔 채로.** 브라우저는 화면이 꺼지면 위치를 멈춥니다(앱이 화면 켜짐을 요청하지만 기기에 따라 안 될 수 있음).
- [ ] **사진은 장소만.** 사람·아이 얼굴, 차량 번호판이 나오면 다시 찍기. 사진 속 위치정보(EXIF)는 저장 전에 지워집니다.

## 데이터가 어디에 있나

| 데이터 | 저장 위치 | 서버로 나가나 |
|---|---|---|
| 인터뷰·타임라인 | 브라우저 `localStorage` | 아니오 |
| 위험지점·경로 | 브라우저 `localStorage` | 팀 코드를 넣으면 **비공개 Vercel Blob**(`share/pins|routes/{id}.json`)에 올라감. 팀 코드 없이는 읽을 수 없음 |
| 위험지점 사진 | 브라우저 `IndexedDB` (1600px로 줄이고 EXIF 제거) | 팀 코드를 넣으면 비공개 Blob(`photos/{id}.jpg`) |
| 녹음 파일 | 브라우저 `IndexedDB` | **아니오** |
| 받아쓰기 텍스트 | localStorage | AI 정리를 누를 때만. 전화번호·이메일·학교명·호칭은 가린 뒤 전송 (`src/lib/mask.ts`) |
| 받아쓰기 음성 | — | 자동 받아쓰기는 브라우저(iOS/구글) 음성 인식 서버를 거칩니다. 동의 항목에 포함해 설명하세요 |

이름·연락처 입력칸은 아예 없습니다. 아동 직접 응답 모드도 없습니다(보호자·교사·기관 담당자만).

## 구조

```
src/
  app/            page(클라이언트 전용 셸) · api/analyze · api/compare · manifest
  components/     AppShell · InterviewList · InterviewEditor · Recorder · Timeline
                  ServicePreview(대상자에게 보여주는 컨셉 화면) · MapView · Board · DataPanel
  lib/
    types.ts      데이터 모델
    constants.ts  타임라인 색·질문·태그·컨셉 목록  ← 문구 수정은 대부분 여기
    store.tsx     localStorage 기반 전역 상태
    audio-db.ts   녹음 IndexedDB
    stats.ts      공백 분 계산·지역 집계
    ai.ts         Claude 호출 + 출력 스키마
    maps/         kakao · google · leaflet(OSM) 어댑터
```

## 디자인 시스템

색·모서리·그림자는 전부 `src/app/globals.css` 의 토큰 하나로 모여 있다. 컴포넌트에 색을 직접 적지 말고 토큰 이름을 쓴다.

| 쓰는 곳 | 클래스 | 값 |
|---|---|---|
| 배경 / 카드 | `bg-bg` `bg-card` `bg-surface-2` | grey-50 / white / grey-50 |
| 글자 | `text-ink` `text-ink-2` `text-ink-3` | grey-900 / 700 / 500 |
| 선 | `border-line` `border-line-strong` | grey-200 / 300 |
| 주 동작 | `bg-accent` `text-accent` `bg-accent-soft` | blue-500 / blue-50 |
| 경고 | `text-danger` `bg-danger-soft` | red-500 / red-50 |
| 모서리 | `rounded-card` `rounded-field` `rounded-chip` | 20 / 12 / 10px |
| 그림자 | `shadow-card` `shadow-float` `shadow-pop` | — |

원색 스케일(`bg-blue-50`, `text-grey-600` …)도 열려 있지만, 되도록 위의 의미 이름을 쓴다.
버튼은 `<Button variant="accent">`(주 동작·파랑) / `primary`(먹색) / `secondary` / `danger` 네 가지.

타임라인·핀 색(`src/lib/constants.ts`)은 **데이터 색**이라 브랜드 색과 별개로 둔다 — 빨강=공백처럼 뜻이 붙어 있어서 함부로 바꾸면 안 된다.

서체는 Pretendard(CDN, `src/app/layout.tsx`). 못 받아오면 Apple SD Gothic Neo로 떨어진다.

## 문구 수정

인터뷰 질문(`CORE_QUESTIONS`), 위험 태그(`PIN_TAGS`), 보여줄 컨셉(`CONCEPTS`)은 `src/lib/constants.ts`에서 바꾸면
앱 전체(입력 화면·CSV·AI 프롬프트)에 같이 반영됩니다.

## 한계

이건 **리서치용 v0**이고 서비스가 아닙니다. 계정·서버·실시간 위치 추적·알림은 없습니다.
발표에서도 "현장에서 쓴 도구 + 컨셉 프로토타입"으로 소개하고, 실제 서비스는 Program D에서 따로 개발합니다.
# globalcore_sai
