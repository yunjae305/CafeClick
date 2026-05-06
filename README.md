# CafeClick

## CafeClick 한눈에 보기

| 항목 | CafeClick |
| --- | --- |
| 프로젝트 한 줄 설명 | 엔딩이 있는 클릭커 게임을 BigInt 기반 무한 방치형 게임으로 전환하면서 환생 시스템, 영구 버프, 지수형 비용 증가, 렌더 최적화를 구현한 유지보수 프로젝트 |
| 배포/실행 링크 | [https://cafeclick.vercel.app/](https://cafeclick.vercel.app/) / `start index.html` |
| 스크린샷 or GIF | 시작 화면 `docs/screenshots/cafe-start.png`, 성장 화면 `docs/screenshots/cafe-growth.png`, 후반 운영 비교 화면 `docs/screenshots/cafe-ending.png` |
| 기술 스택 및 이유 | HTML, CSS, JavaScript 단일 파일 구조를 유지하면서 BigInt 경제 시스템, `requestAnimationFrame` 기반 렌더링, Node `vm` 회귀 테스트로 무한 확장과 상태 관리를 직접 제어 |
| 핵심 구조 설명 | `index.html` 안에서 `runState`와 `prestigeState`를 분리하고, `tests/cafe-clicker.test.js`에서 BigInt 포매팅, 환생, 저장 복원, 비용 증가, 드로우 스로틀링을 검증 |
| 트러블슈팅 기록 | 엔딩 조건과 Number 기반 상태 때문에 무한 확장이 막히던 구조를 제거하고, BigInt 저장 포맷과 환생 초기화 경계를 다시 설계해 무한 진행 가능한 게임 루프로 재구성 |

배포 링크: [https://cafeclick.vercel.app/](https://cafeclick.vercel.app/)

CafeClick은 단순한 바닐라 JS 클리커 게임이 아니라, 레거시 단일 파일 게임을 무한 방치형 구조로 전환하면서 대용량 숫자 처리, 장기 상태 관리, 렌더링 최적화를 함께 다룬 유지보수 프로젝트입니다.

기존에는 1,000,000 누적 수입에서 엔딩이 열리는 일회성 성장 구조였지만, 현재는 `index.html` 단일 파일 구조를 유지한 채 BigInt 기반 경제 시스템과 환생 루프를 넣어 끝없이 확장 가능한 방향으로 재설계했습니다. `tests/cafe-clicker.test.js`에는 Node `vm`과 가짜 DOM 기반 회귀 테스트를 두어 큰 수 포매팅, 영구 버프, 지수형 비용 증가, 저장 복원, 드로우 스로틀링이 계속 유지되도록 만들었습니다.

## 프로젝트 포지션

- 엔딩이 있는 클릭커 게임을 무한 방치형 엔진으로 재설계
- BigInt 기반 재화 연산과 한국어 단위 포매팅 구현
- 회차 데이터와 영구 데이터가 섞이지 않도록 환생 상태 분리
- `requestAnimationFrame` 기반 뷰 갱신으로 잦은 DOM 업데이트 최적화
- 회귀 테스트로 핵심 경제 시스템과 저장 구조를 검증

## 리팩토링 과정

- [기존 버그 분석 및 설계 문서](docs/repair-design.md)
- [기존 수정 내역 정리](docs/repair.md)
- [무한 방치형 전환 설계 문서](docs/endless-idle-design.md)
- [무한 방치형 구현 계획](docs/endless-idle-plan.md)

## 대표 전환 사례

문제: 기존 구조는 누적 수입 1,000,000에서 엔딩이 열리고, Number 기반 상태와 저장 구조를 전제로 하고 있어 무한 방치형 게임으로 확장하기 어려웠습니다.

원인: 재화, 누적 수입, 업그레이드 비용이 일반 Number와 일회성 엔딩 흐름에 맞춰 설계되어 있었고, 회차 초기화 상태와 영구 상태가 구분되어 있지 않았습니다.

해결: 엔딩 오버레이와 종료 조건을 제거하고, 재화와 비용을 BigInt 기반으로 옮긴 뒤 `runState`와 `prestigeState`를 분리했습니다. 여기에 환생 보상과 영구 버프, 지수형 비용 증가, `requestAnimationFrame` 기반 드로우 스로틀링을 추가해 무한 확장 구조로 바꿨습니다.

## 결과물

- `index.html` 단일 파일 구조 유지
- BigInt 기반 클릭 수입, 자동 수입, 누적 수입, 업그레이드 비용 처리
- 환생 이후에도 유지되는 황금 원두와 영구 수익 버프
- 지수형 비용 증가 공식과 무한 진행 가능한 마일스톤 구조
- Node 기반 회귀 테스트로 BigInt 포매팅, 환생, 저장 복원, 비용 증가, 드로우 스로틀링 검증
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
│  ├─ endless-idle-design.md
│  ├─ endless-idle-plan.md
│  ├─ repair-design.md
│  └─ repair.md
├─ index.html
├─ tests/
│  └─ cafe-clicker.test.js
├─ vercel.json
└─ README.md
```
