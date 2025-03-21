# Takos-Call: mediasoupリモート操作API仕様書

## 概要

このプロジェクトは、WebRTC
SFU「mediasoup」を外部プログラムから操作するためのAPIを提供します。mediasoupサーバーをラップし、WebSocketを通じて外部プログラムからの指示を受け付けることができます。

## システムアーキテクチャ

```
外部アプリケーション <--WebSocket--> Takos-Call API サーバー <--> mediasoup
```

- **外部アプリケーション**: コントロール命令を送信
- **Takos-Call API**: WebSocketでコマンドを受信し、mediasoupを操作
- **mediasoup**: 実際のWebRTC処理を担当

## API仕様

### 接続方法

WebSocketで接続します。

```
ws://[サーバーアドレス]:[ポート番号]/takos-api
```

### メッセージフォーマット

すべてのメッセージはJSONフォーマットで送受信されます。

```json
{
  "type": "コマンド名",
  "id": "メッセージID",
  "data": {
    // コマンド固有のパラメータ
  }
}
```

### 主要コマンド

#### 1. ルーム作成

```json
{
  "type": "createRoom",
  "id": "msg-001",
  "data": {
    "roomId": "room-xyz",
    "options": {
      "maxPeers": 10,
      "codecs": [...],
      ...
    }
  }
}
```

#### 2. ピア追加

```json
{
  "type": "addPeer",
  "id": "msg-002",
  "data": {
    "roomId": "room-xyz",
    "peerId": "peer-123",
    "options": {
      ...
    }
  }
}
```

#### 3. トランスポート作成

```json
{
  "type": "createTransport",
  "id": "msg-003",
  "data": {
    "roomId": "room-xyz",
    "peerId": "peer-123",
    "direction": "send", // "send" または "recv"
    "options": {
      ...
    }
  }
}
```

#### 4. プロデューサー作成

```json
{
  "type": "createProducer",
  "id": "msg-004",
  "data": {
    "roomId": "room-xyz",
    "peerId": "peer-123",
    "transportId": "transport-abc",
    "kind": "audio", // "audio" または "video"
    "rtpParameters": {
      ...
    }
  }
}
```

#### 5. コンシューマー作成

```json
{
  "type": "createConsumer",
  "id": "msg-005",
  "data": {
    "roomId": "room-xyz",
    "peerId": "peer-123",
    "transportId": "transport-def",
    "producerId": "producer-xyz",
    "rtpCapabilities": {
      ...
    }
  }
}
```

#### 6. ピア削除

```json
{
  "type": "removePeer",
  "id": "msg-006",
  "data": {
    "roomId": "room-xyz",
    "peerId": "peer-123"
  }
}
```

### レスポンスフォーマット

```json
{
  "type": "response",
  "id": "msg-001", // リクエストと同じID
  "success": true,
  "data": {
    // レスポンス固有のデータ
  }
}
```

### エラーレスポンス

```json
{
  "type": "response",
  "id": "msg-001", // リクエストと同じID
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ"
  }
}
```

## セキュリティ

- WebSocket接続にはAPIキーによる認証を実装
- 特定IPアドレスからのみ接続を許可する機能
- SSL/TLS暗号化による通信の保護

## 実装計画

1. Node.jsベースのサーバー実装
2. mediasoupラッパーの作成
3. WebSocketサーバーの実装
4. 認証とセキュリティ対策の実装
5. サンプルクライアントの作成

## 依存関係

- mediasoup
- ws (WebSocketライブラリ)
- express (オプション: HTTP API用)
- dotenv (環境変数管理)
