# backend-socket-io-gateway

Socket.IO 연결을 받는 채팅 게이트웨이입니다. 브라우저와 WebSocket/Socket.IO 세션을 유지하고, 방 입장/퇴장, Redis Pub/Sub 구독, 로컬 소켓 fan-out을 담당합니다.

## 역할

- Socket.IO endpoint `/api/socket`를 제공합니다.
- 클라이언트의 `ENTER`, `TALK`, `QUIT` 이벤트를 처리합니다.
- TALK 메시지는 `backend-chat-service`의 `/message`로 HTTP 전달합니다.
- `chat-service`가 Redis Pub/Sub에 발행한 메시지를 구독해 같은 방의 로컬 소켓에 fan-out합니다.
- 방별 접속자 수를 Redis `sessions:count:{roomId}`에 기록합니다.

메시지 저장은 직접 하지 않습니다. 저장 경로는 `chat-service -> Redis Stream -> backend-redis-stream-mongo-consumer -> MongoDB`입니다.

## 기술 스택

- Node.js
- Socket.IO 4
- ioredis Redis Cluster
- Axios

## Socket.IO 이벤트

### Client -> Server

| Event | Payload | 설명 |
| --- | --- | --- |
| `ENTER` | `{ "roomId": "...", "sender": "alice" }` | 방 입장 |
| `TALK` | `{ "roomId": "...", "sender": "alice", "message": "hello" }` | 채팅 메시지 전송 |
| `QUIT` | `{ "roomId": "...", "sender": "alice" }` | 방 퇴장 |

### Server -> Client

| Event | Payload | 설명 |
| --- | --- | --- |
| `ENTER_ACK` | `{ "roomId": "..." }` | 입장 처리 확인 |
| `QUIT_ACK` | `{ "roomId": "..." }` | 퇴장 처리 확인 |
| `TALK` | ChatMessage payload | 같은 방 메시지 fan-out |
| `error` | `{ "code": "...", "message": "..." }` | 유효하지 않은 요청 또는 내부 오류 |

## 환경변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PORT` | `3000` | HTTP 및 Socket.IO 서버 포트 |
| `REDIS_NODES` | `127.0.0.1:7000` | Redis Cluster 노드 목록. comma-separated |
| `SOCKET_PATH` | `/socket.io` | Socket.IO path |
| `CHAT_SERVICE_URL` | `http://127.0.0.1:8083/api/chat` | chat-service base URL |
| `CHAT_SERVICE_TIMEOUT_MS` | `3000` | chat-service 호출 timeout |
| `CLIENT_ORIGIN` | `*` | Socket.IO CORS 허용 origin |
| `DRAIN_TIMEOUT_MS` | `5000` | 종료 시 connection drain 대기 시간 |

예:

```bash
PORT=3000 \
REDIS_NODES=127.0.0.1:7000,127.0.0.1:7001 \
CHAT_SERVICE_URL=http://localhost:8083/api/chat \
npm start
```

## 로컬 실행

```bash
npm install
npm start
```

Docker 이미지 빌드:

```bash
docker build -t team9-socket-io-gateway:local .
```

## Redis 규칙

| Key / Channel | Type | 설명 |
| --- | --- | --- |
| `sessions:count:{roomId}` | String | 방별 접속자 수 |
| `chat:msg:{roomId}` | Pub/Sub channel | chat-service가 발행하는 TALK 메시지 |

각 gateway 인스턴스는 로컬에 해당 room socket이 있을 때만 Pub/Sub 채널을 구독합니다. 마지막 로컬 사용자가 나가면 구독을 해제합니다.

## Kubernetes / Ingress

- Service port는 `3000`입니다.
- Ingress는 `/api/socket`를 이 서비스로 라우팅해야 합니다.
- WebSocket upgrade header와 충분한 proxy timeout이 필요합니다.
- 여러 pod로 scale out해도 Redis Pub/Sub를 통해 방 메시지가 각 gateway로 전달됩니다.

## 주의점

- Socket.IO Redis Adapter는 사용하지 않습니다. 인스턴스 간 fan-out은 Redis Pub/Sub로 처리합니다.
- Gateway pod가 죽으면 해당 pod에 붙어 있던 클라이언트는 재접속해야 합니다.
- `ENTER_ACK`는 Redis subscription 완료 전에 먼저 보낼 수 있습니다. 구독 실패 시 `error` 이벤트가 추가로 전달됩니다.
