# socket-io-gateway

`socket-io-gateway`는 Socket.IO 연결을 받아서 방 단위 채팅 이벤트를 Redis Pub/Sub로 전달하고, 같은 인스턴스에 붙어 있는 로컬 소켓에만 다시 fan-out 하는 최소 게이트웨이입니다.

## 로컬 실행 방법

1. `npm install`
2. `.env.example`을 참고해 `.env`를 만듭니다.
3. `npm start`

기본 포트는 `3000`입니다.

## 환경변수

- `PORT`: HTTP 및 Socket.IO 서버 포트
- `REDIS_NODES`: Redis Cluster 노드 목록
- `CHAT_SERVICE_URL`: Chat Service 베이스 URL
- `CHAT_SERVICE_TIMEOUT_MS`: Chat Service 호출 타임아웃
- `CLIENT_ORIGIN`: Socket.IO CORS 허용 Origin
- `DRAIN_TIMEOUT_MS`: 종료 시 드레인 타임아웃

## 주요 Socket.IO 이벤트

- `ENTER`: `{ roomId }` 형태로 방에 참여합니다.
- `TALK`: `{ roomId, message }` 형태로 메시지를 보냅니다.
- `QUIT`: `{ roomId }` 형태로 방에서 나갑니다.
- `ENTER_ACK`: 서버가 방 참여를 확인할 때 보냅니다.
- `QUIT_ACK`: 서버가 방 이탈을 확인할 때 보냅니다.

## Redis 규칙

- 참여자 수는 `sessions:count:{roomId}` 키에 저장합니다.
- 채널은 `chat:msg:{roomId}` 형식으로 생성합니다.
- 인스턴스는 로컬 소켓이 있을 때만 해당 채널을 구독합니다.
- 마지막 로컬 사용자가 나가면 채널 구독을 해제합니다.
- TALK 메시지는 Chat Service로 HTTP 전달한 뒤, Chat Service가 Redis에 발행합니다.

## Nginx 설정

`nginx/nginx.conf`를 upstream 예시로 사용합니다.

- `ip_hash`를 사용해 sticky session을 유지합니다.
- `/socket.io/` 경로는 WebSocket upgrade 헤더를 전달합니다.
- `/health`는 드레인 상태 확인용으로 프록시합니다.

## 현재 스캐폴드의 범위

이 저장소는 최소 실행 골격만 포함합니다.

- Socket.IO Redis Adapter는 사용하지 않습니다.
- 인증, DB 연동, 메시지 영속화는 포함하지 않습니다.
- 테스트 파일과 배포 스크립트는 아직 추가하지 않았습니다.
