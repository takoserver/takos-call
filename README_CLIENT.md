# Takos Call Client

WebRTCベースのビデオ通話サービス「Takos Call」のクライアントライブラリです。
外部依存関係なしで、ネイティブWebSocket APIを使用してTakos
Callサーバーと通信します。

## インストール方法

```bash
# npmの場合
npm install takos-call-client

# yarnの場合
yarn add takos-call-client
```

## 基本的な使い方

### クライアントの初期化

```typescript
import { TakosCallClient } from "takos-call-client";

const client = new TakosCallClient({
  url: "ws://localhost:3000/takos-api",
  apiKey: "your-api-key",
});

// サーバーに接続
await client.connect();
```

### ルーム作成と参加

```typescript
// 新しいルームを作成
const room = await client.createRoom("my-room");

// ピアをルームに追加（各ユーザーは一意のピアID必要）
const peerInfo = await client.addPeer("my-room", "user1");
```

### メディアの送受信

```typescript
// 1. RTCPeerConnectionのための機能情報を取得
const rtpCapabilities = await client.getRouterRtpCapabilities("my-room");

// 2. 送信用トランスポート作成
const sendTransport = await client.createTransport("my-room", "user1", "send");

// 3. トランスポートイベントハンドラ設定と接続（WebRTC）
// ここではlibwebrtcのようなライブラリと組み合わせて使用します
const peerConnection = new RTCPeerConnection();
// DTLSパラメータを設定（詳細は実装例を参照）
await client.connectTransport(
  "my-room",
  "user1",
  sendTransport.id,
  dtlsParameters,
);

// 4. メディアプロデューサー作成（音声や映像の送信）
const producer = await client.createProducer(
  "my-room",
  "user1",
  sendTransport.id,
  "video",
  rtpParameters,
);

// 5. 受信用トランスポート作成とコンシューマー作成（他のユーザーのメディアを受信）
const recvTransport = await client.createTransport("my-room", "user1", "recv");
await client.connectTransport(
  "my-room",
  "user1",
  recvTransport.id,
  dtlsParameters,
);

const consumer = await client.createConsumer(
  "my-room",
  "user1",
  recvTransport.id,
  "other-user-producer-id",
  rtpCapabilities,
);
```

### イベントリスナー

```typescript
// 接続イベント
client.on("connected", () => {
  console.log("サーバーに接続しました");
});

// 切断イベント
client.on("disconnected", (event) => {
  console.log("サーバーから切断されました", event);
});

// エラーイベント
client.on("error", (error) => {
  console.error("エラーが発生しました", error);
});

// メッセージイベント
client.on("message", (message) => {
  console.log("サーバーからメッセージを受信しました", message);
});

// mediasoup関連のイベント
// ルーム作成イベント
client.on("roomCreated", ({ roomId, roomInfo }) => {
  console.log(`新しいルームが作成されました: ${roomId}`, roomInfo);
});

// ピア追加イベント
client.on("peerAdded", ({ roomId, peerId, peerInfo }) => {
  console.log(
    `新しいピアが追加されました: ルーム=${roomId}, ピア=${peerId}`,
    peerInfo,
  );
});

// トランスポート作成イベント
client.on(
  "transportCreated",
  ({ roomId, peerId, transportId, direction, transportInfo }) => {
    console.log(
      `新しいトランスポートが作成されました: ルーム=${roomId}, ピア=${peerId}, 方向=${direction}`,
      transportInfo,
    );
  },
);

// プロデューサー作成イベント
client.on(
  "producerCreated",
  ({ roomId, peerId, producerId, transportId, kind, producerInfo }) => {
    console.log(
      `新しいプロデューサーが作成されました: ルーム=${roomId}, ピア=${peerId}, 種類=${kind}`,
      producerInfo,
    );
  },
);

// コンシューマー作成イベント
client.on(
  "consumerCreated",
  ({ roomId, peerId, consumerId, producerId, transportId, consumerInfo }) => {
    console.log(
      `新しいコンシューマーが作成されました: ルーム=${roomId}, ピア=${peerId}, プロデューサー=${producerId}`,
      consumerInfo,
    );
  },
);

// トランスポート切断イベント
client.on("transportClosed", ({ roomId, peerId, transportId }) => {
  console.log(
    `トランスポート切断: ルーム=${roomId}, ピア=${peerId}, トランスポート=${transportId}`,
  );
});

// プロデューサー切断イベント
client.on("producerClosed", ({ roomId, peerId, producerId }) => {
  console.log(
    `プロデューサー切断: ルーム=${roomId}, ピア=${peerId}, プロデューサー=${producerId}`,
  );
});

// コンシューマー切断イベント
client.on("consumerClosed", ({ roomId, peerId, consumerId }) => {
  console.log(
    `コンシューマー切断: ルーム=${roomId}, ピア=${peerId}, コンシューマー=${consumerId}`,
  );
});

// ピア切断イベント
client.on("peerClosed", ({ roomId, peerId }) => {
  console.log(`ピア切断: ルーム=${roomId}, ピア=${peerId}`);
});

// ルーム切断イベント
client.on("roomClosed", ({ roomId }) => {
  console.log(`ルーム切断: ルーム=${roomId}`);
});
```

### リモート切断の検出の実装例

以下は、リモートでトランスポートやプロデューサーが切断された場合の処理例です：

```typescript
// UIコンポーネントを更新する例
const videoGrid = document.getElementById("video-grid");

// プロデューサー切断イベント
client.on("producerClosed", ({ roomId, peerId, producerId }) => {
  console.log(`プロデューサー ${producerId} が切断されました`);

  // UIから対応する映像要素を削除
  const videoElement = document.getElementById(`video-${producerId}`);
  if (videoElement) {
    videoElement.remove();
  }

  // 状態管理を更新
  updateParticipantState(peerId, { hasVideo: false });
});

// ピア切断イベント
client.on("peerClosed", ({ roomId, peerId }) => {
  console.log(`ピア ${peerId} が切断されました`);

  // ピアに関連するすべての映像/音声要素を削除
  const peerElements = document.querySelectorAll(`[data-peer-id="${peerId}"]`);
  peerElements.forEach((element) => element.remove());

  // 参加者リストからユーザーを削除
  removeParticipantFromList(peerId);
});
```

## 完全な使用例

以下は、WebRTCの基本的な接続を行う例です。

```typescript
import { TakosCallClient } from "takos-call-client";
import { Device } from "mediasoup-client";

async function startCall() {
  // クライアント初期化と接続
  const client = new TakosCallClient({
    url: "ws://localhost:3000/takos-api",
    apiKey: "your-api-key",
  });

  await client.connect();

  // ルーム作成
  const room = await client.createRoom("test-room");

  // ピア追加
  const peer = await client.addPeer("test-room", "user1");

  // mediasoup-clientのデバイスを初期化
  const device = new Device();

  // ルーターの機能情報をロード
  const routerRtpCapabilities = await client.getRouterRtpCapabilities(
    "test-room",
  );
  await device.load({ routerRtpCapabilities });

  // 送信用トランスポート作成
  const sendTransportInfo = await client.createTransport(
    "test-room",
    "user1",
    "send",
  );

  // mediasoup-clientでトランスポートを作成
  const sendTransport = device.createSendTransport(sendTransportInfo);

  // トランスポートの接続イベントを処理
  sendTransport.on("connect", async ({ dtlsParameters }, callback, errback) => {
    try {
      await client.connectTransport(
        "test-room",
        "user1",
        sendTransportInfo.id,
        dtlsParameters,
      );
      callback();
    } catch (error) {
      errback(error);
    }
  });

  // プロデューサーの作成イベントを処理
  sendTransport.on(
    "produce",
    async ({ kind, rtpParameters, appData }, callback, errback) => {
      try {
        const producer = await client.createProducer(
          "test-room",
          "user1",
          sendTransportInfo.id,
          kind,
          rtpParameters,
        );
        callback({ id: producer.id });
      } catch (error) {
        errback(error);
      }
    },
  );

  // カメラとマイクのメディアを取得
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  // ビデオトラックを送信
  const videoTrack = stream.getVideoTracks()[0];
  const videoProducer = await sendTransport.produce({ track: videoTrack });

  // オーディオトラックを送信
  const audioTrack = stream.getAudioTracks()[0];
  const audioProducer = await sendTransport.produce({ track: audioTrack });

  console.log("メディア送信を開始しました");
}

startCall().catch(console.error);
```

## API リファレンス

### TakosCallClient

#### コンストラクタ

```typescript
new TakosCallClient(config: ClientConfig)
```

##### ClientConfig

- `url`: WebSocketサーバーのURL
- `apiKey`: 認証用APIキー
- `autoReconnect`: 自動再接続するかどうか (デフォルト: `true`)
- `reconnectInterval`: 再接続の間隔（ミリ秒）(デフォルト: `3000`)
- `maxReconnectAttempts`: 最大再接続試行回数 (デフォルト: `5`)

#### メソッド

- `connect()`: サーバーに接続します
- `disconnect()`: サーバーから切断します
- `on(event, callback)`: イベントリスナーを登録します
- `off(event, callback?)`: イベントリスナーを削除します

#### ルーム操作

- `createRoom(roomId, options?)`: 新しいルームを作成します
- `closeRoom(roomId)`: ルームを閉じます
- `addPeer(roomId, peerId)`: ピアをルームに追加します
- `removePeer(roomId, peerId)`: ピアをルームから削除します
- `getRouterRtpCapabilities(roomId)`: ルーターのRTP機能を取得します

#### トランスポート操作

- `createTransport(roomId, peerId, direction, options?)`:
  WebRTCトランスポートを作成します
- `connectTransport(roomId, peerId, transportId, dtlsParameters)`:
  トランスポートを接続します

#### メディア操作

- `createProducer(roomId, peerId, transportId, kind, rtpParameters)`:
  メディアプロデューサーを作成します
- `createConsumer(roomId, peerId, transportId, producerId, rtpCapabilities)`:
  メディアコンシューマーを作成します
- `closeProducer(roomId, peerId, producerId)`: プロデューサーを閉じます
- `closeConsumer(roomId, peerId, consumerId)`: コンシューマーを閉じます

#### 情報取得

- `getRoomInfo(roomId)`: 特定のルームの詳細情報を取得します
- `getAllRooms()`: 全てのアクティブなルーム情報を取得します
- `getPeerInfo(roomId, peerId)`: 特定のピアの詳細情報を取得します
- `getTransportInfo(roomId, peerId, transportId)`:
  特定のトランスポートの詳細を取得します
- `getProducerInfo(roomId, peerId, producerId)`:
  特定のプロデューサーの詳細を取得します
- `getConsumerInfo(roomId, peerId, consumerId)`:
  特定のコンシューマーの詳細を取得します

## 情報取得の使用例

```typescript
// ルームの情報を取得 (存在しない場合はnull)
const roomInfo = await client.getRoomInfo("room-123");
if (roomInfo) {
  console.log(`ルーム内のピア数: ${Object.keys(roomInfo.peers).length}`);
} else {
  console.log("ルームが見つかりません");
}

// 全てのアクティブなルームを取得
const allRooms = await client.getAllRooms();
console.log(`アクティブなルーム数: ${allRooms.length}`);

// 特定のピアの情報を取得 (存在しない場合はnull)
const peerInfo = await client.getPeerInfo("room-123", "user-456");
if (peerInfo) {
  console.log(
    `ピアが持つプロデューサー: ${Object.keys(peerInfo.producers).join(", ")}`,
  );
} else {
  console.log("ピアが見つかりません");
}

// トランスポートの情報を取得 (存在しない場合はnull)
const transportInfo = await client.getTransportInfo(
  "room-123",
  "user-456",
  "transport-789",
);
if (transportInfo) {
  console.log("ICE候補:", transportInfo.iceCandidates);
} else {
  console.log("トランスポートが見つかりません");
}

// プロデューサーの情報を取得 (存在しない場合はnull)
const producerInfo = await client.getProducerInfo(
  "room-123",
  "user-456",
  "producer-abc",
);
if (producerInfo) {
  console.log(
    `種類: ${producerInfo.kind}, パラメータ:`,
    producerInfo.rtpParameters,
  );
} else {
  console.log("プロデューサーが見つかりません");
}

// コンシューマーの情報を取得 (存在しない場合はnull)
const consumerInfo = await client.getConsumerInfo(
  "room-123",
  "user-456",
  "consumer-xyz",
);
if (consumerInfo) {
  console.log(`元プロデューサー: ${consumerInfo.producerId}`);
} else {
  console.log("コンシューマーが見つかりません");
}
```

## システム状態の監視例

以下は、システム全体の状態を定期的に監視する例です：

```typescript
async function monitorSystem() {
  const client = new TakosCallClient({
    url: "ws://localhost:3000/takos-api",
    apiKey: "your-api-key",
  });

  await client.connect();

  // 5秒ごとにシステム状態を確認
  setInterval(async () => {
    try {
      const allRooms = await client.getAllRooms();

      console.log(`==== システム状態 ====`);
      console.log(`アクティブルーム数: ${allRooms.length}`);

      for (const room of allRooms) {
        console.log(`\nルームID: ${room.id}`);
        const peerCount = Object.keys(room.peers).length;
        console.log(`参加者数: ${peerCount}`);

        // 各ピアの状態を確認
        for (const peerId in room.peers) {
          const detailedPeerInfo = await client.getPeerInfo(room.id, peerId);

          // nullチェックを追加
          if (detailedPeerInfo) {
            const producerCount =
              Object.keys(detailedPeerInfo.producers).length;
            const consumerCount =
              Object.keys(detailedPeerInfo.consumers).length;

            console.log(`  ピアID: ${peerId}`);
            console.log(
              `    送信中: ${producerCount}, 受信中: ${consumerCount}`,
            );
          } else {
            console.log(`  ピアID: ${peerId} (情報取得不可)`);
          }
        }
      }
      console.log(`=====================\n`);
    } catch (error) {
      console.error("監視エラー:", error);
    }
  }, 5000);
}

monitorSystem().catch(console.error);
```

### リアルタイム更新の実装例

以下は、リアルタイムでの参加者やメディアの追加を検出して処理する例です：

```typescript
// 新規参加者の検出
client.on("peerAdded", ({ roomId, peerId, peerInfo }) => {
  console.log(`新しい参加者が入室しました: ${peerId}`);

  // UI上に新しい参加者を表示
  addParticipantToUI(peerId, peerInfo);

  // 必要に応じて接続処理を開始
  setupConnectionWith(peerId);
});

// 新しいビデオ/音声の検出
client.on(
  "producerCreated",
  ({ roomId, peerId, producerId, kind, producerInfo }) => {
    console.log(`${peerId} が新しい ${kind} ストリームを公開しました`);

    if (peerId !== myPeerId) {
      // このプロデューサーからの映像/音声を受信するためのコンシューマー作成
      createConsumerForProducer(roomId, myPeerId, producerId);
    }
  },
);

// UIに新しいビデオ要素を追加する例
function createConsumerForProducer(roomId, myPeerId, producerId) {
  async function subscribe() {
    try {
      // 受信用トランスポートがなければ作成
      if (!recvTransport) {
        recvTransport = await setupReceiveTransport(roomId, myPeerId);
      }

      // コンシューマー作成してメディアを受信
      const consumer = await client.createConsumer(
        roomId,
        myPeerId,
        recvTransport.id,
        producerId,
        device.rtpCapabilities,
      );

      if (consumer) {
        // mediasoup-clientを使用してコンシューマーを作成
        const msConsumer = await recvTransport.consume({
          id: consumer.id,
          producerId: consumer.producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        });

        // 映像/音声要素に接続
        const mediaElement = consumer.kind === "video"
          ? document.createElement("video")
          : document.createElement("audio");

        mediaElement.id = `media-${consumer.id}`;
        mediaElement.autoplay = true;
        mediaElement.srcObject = new MediaStream([msConsumer.track]);

        // UIに追加
        document.getElementById("media-container").appendChild(mediaElement);
      }
    } catch (error) {
      console.error("コンシューマー作成エラー:", error);
    }
  }

  subscribe();
}
```

## ライセンス

MIT
