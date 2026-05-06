# CafeClick

배포 링크: [https://cafeclick.vercel.app/](https://cafeclick.vercel.app/)

CafeClick은 단순한 바닐라 JS 클리커 게임이 아니라, 레거시 단일 파일 게임의 버그를 분석하고 설계 문서를 남긴 뒤 테스트 코드 기반으로 리팩토링한 유지보수 프로젝트입니다.

브라우저에서 돌아가던 기존 클릭커 게임을 대상으로 상태 흐름이 깨지는 지점을 추적했고, `index.html` 단일 파일 구조는 유지한 채 렌더링 경로를 정리했습니다. 이후 `tests/cafe-clicker.test.js`에 Node `vm`과 가짜 DOM 기반 회귀 테스트를 붙여서 같은 문제가 다시 생기지 않도록 만들었습니다.

## 프로젝트 포지션

- 레거시 프런트엔드 코드의 버그 원인 분석
- 설계 문서 작성 후 리팩토링 범위 확정
- 단일 렌더링 경로로 상태 동기화 구조 재정리
- 테스트 코드로 핵심 게임 루프 회귀 검증

## 리팩토링 과정

- [버그 분석 및 설계 문서](docs/repair-design.md)
- [수정 내역 정리](docs/repair.md)

## 대표 버그 사례

문제: 자동 수입이 발생해도 누적 수입에 맞는 마일스톤 문구와 업그레이드 버튼 상태가 바로 갱신되지 않았습니다.

원인: 자동 수입 인터벌이 수치 카드만 다시 그렸고, 전체 UI를 갱신하는 `refreshAll()` 경로를 타지 않아 데이터와 화면이 분리됐습니다.

해결: 모든 상태 변경이 하나의 전체 렌더링 경로를 지나가도록 구조를 정리했고, 자동 수입 tick 이후에도 `refreshAll()`을 호출하도록 바꿨습니다. 같은 시나리오는 `tests/cafe-clicker.test.js` 회귀 테스트로 고정했습니다.

## 결과물

- `index.html` 단일 파일 구조 유지
- 클릭 수입, 자동 수입, 업그레이드, 마일스톤, 엔딩 흐름 동기화
- Node 기반 회귀 테스트로 초기 렌더, 업그레이드 구매, 가격 증가, 자동 수입, 엔딩 오버레이까지 검증
- 정적 배포용 `vercel.json` 포함

## 실행 방법

```bash
start index.html
```

로컬 서버가 필요하면 아래 명령으로 충분합니다.

```bash
python -m http.server 5500
```

브라우저에서 `http://127.0.0.1:5500`으로 열면 됩니다.

## 테스트

```bash
node tests/cafe-clicker.test.js
```

## 배포

- 정적 배포 설정은 [`vercel.json`](vercel.json)에 있습니다.
- 실제 배포 주소는 [https://cafeclick.vercel.app/](https://cafeclick.vercel.app/) 입니다.

## 파일 구성

```text
cafe-clicker/
├─ docs/
│  ├─ repair-design.md
│  └─ repair.md
├─ index.html
├─ tests/
│  └─ cafe-clicker.test.js
├─ vercel.json
└─ README.md
```
