# CafeClick Endless Idle Design

## 목표

CafeClick을 엔딩이 있는 단일 회차 클릭커 게임에서, BigInt 기반 경제와 환생 시스템을 가진 무한 방치형 게임으로 전환한다.

## 범위

- 1,000,000 누적 수입 도달 시 열리던 엔딩 오버레이와 종료 흐름을 제거한다.
- 재화, 누적 수입, 판매량, 업그레이드 단계, 비용 계산을 모두 BigInt 기반으로 바꾼다.
- 현재 회차 데이터와 환생 이후에도 남는 영구 데이터를 분리한다.
- 업그레이드 비용은 지수형 증가 공식을 유지하되, 현재 비용을 상태로 들고 가며 무한 확장에 맞게 갱신한다.
- 브라우저 렌더링은 상태 변경마다 전체 innerHTML을 다시 만드는 방식 대신, 고정 DOM과 requestAnimationFrame 기반 드로우로 최적화한다.

## 상태 구조

게임 상태는 세 영역으로 나눈다.

### runState

- `coinsRaw`
- `totalRaw`
- `cups`
- `owned`
- `costs`
- `passiveBuffer`
- `sessionStartedAt`

`coinsRaw`와 `totalRaw`는 내부 고정 소수점 스케일을 곱한 BigInt로 저장한다. `owned`와 `costs`도 업그레이드별 BigInt로 유지한다.

### prestigeState

- `goldenBeans`
- `prestigeCount`
- `bestRunRaw`

환생으로 얻는 황금 원두는 영구 수익 배율 계산의 기준이 된다. 회차 초기화 후에도 유지된다.

### viewState

- `dirty`
- `renderQueued`
- `drawCount`

뷰 최적화와 테스트 검증용 상태다. 게임 경제와 별도로 관리한다.

## 경제 모델

### 내부 수치 스케일

- 내부 수익 단위는 `SCALE = 1000n`을 기준으로 관리한다.
- 클릭 수익과 초당 수익은 모두 스케일이 적용된 BigInt를 반환한다.
- 초당 수익은 경과 시간과 곱한 뒤 `1000`으로 나누어 누적하며, 나머지는 `passiveBuffer`에 보존한다.

### 영구 배율

- 황금 원두 1개당 전체 수익에 5%를 더한다.
- 총 배율은 basis point 방식으로 계산한다.
- `10000 + goldenBeans * 500`

### 환생 보상

- 환생 보상은 현재 회차 `totalRaw`를 whole 단위로 내린 값 기준으로 계산한다.
- `gain = sqrt(total / 1000000)`
- `gain`이 1 이상일 때만 환생 버튼을 활성화한다.
- 환생 시 `runState`는 초기화하고 `prestigeState`는 누적한다.

### 비용 증가

- 각 업그레이드는 `baseCost`와 `costRatio`를 가진다.
- 현재 비용은 상태에 저장하고, 구매 시 `nextCost = currentCost * ratio / ratioScale` 방식으로 갱신한다.
- 이 구조는 무한 레벨에서도 Number 오버플로 없이 유지된다.

## 진행 구조

- 기존 커피 단계와 카페 마일스톤은 초반 성장 구간의 피드백으로 유지한다.
- 마지막 정적 단계 이후에는 현재 누적 수입을 기반으로 동적 확장 단계 이름을 만들어 무한 진행감을 준다.
- 엔딩은 없으며, 최종 단계 이후에도 플레이가 계속 이어진다.

## 렌더링 구조

- 상점 버튼과 환생 버튼은 초기화 시 한 번만 생성한다.
- 이후에는 텍스트, 비용, 비활성화 상태만 갱신한다.
- 게임 루프는 `requestAnimationFrame` 기반으로 돌고, 경제 계산과 뷰 드로우를 분리한다.
- 드로우는 `dirty`이거나 최소 드로우 간격이 지났을 때만 실행한다.

## 저장 구조

- `localStorage`에는 versioned JSON을 저장한다.
- BigInt 값은 모두 문자열로 직렬화한다.
- `runState`와 `prestigeState`를 분리 저장해 환생 이후에도 영구 데이터가 유지되게 한다.

## 테스트 전략

- 엔딩 관련 테스트는 제거한다.
- BigInt 포매팅, 환생 보상, 영구 배율 반영, 저장 복원, 지수형 비용 증가, 렌더 스로틀링을 회귀 테스트로 검증한다.
- 테스트 환경은 기존처럼 Node `vm`과 가짜 DOM을 사용하되, `requestAnimationFrame`을 수동으로 전진시키는 훅을 추가한다.
