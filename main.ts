import * as mediasoup from "mediasoup";
import { types } from "mediasoup";
import express from "express";
import * as http from "http";
import { WebSocket, WebSocketServer } from "ws";
import { RoomManager } from "./room-manager";
import { MessageHandler } from "./message-handler";
import { config } from "./config";

// WebSocketクライアント管理用のマップ
const clients = new Map<WebSocket, { roomSubscriptions: Set<string> }>();

async function main() {
  // Expressアプリケーションを作成
  const app = express();
  const server = http.createServer(app);

  // Worker設定
  const worker = await mediasoup.createWorker({
    logLevel: config.mediasoup.worker.logLevel,
    logTags: config.mediasoup.worker.logTags as types.WorkerLogTag[],
    rtcMinPort: config.mediasoup.worker.rtcMinPort,
    rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
  });

  console.log(`mediasoup Worker pid: ${worker.pid}`);

  worker.on("died", () => {
    console.error("mediasoup Worker died, exiting...");
    process.exit(1);
  });

  // ルームマネージャーの初期化
  const roomManager = new RoomManager(worker);

  // WebSocket サーバーの初期化
  const wss = new WebSocketServer({ server, path: "/takos-api" });

  // WebSocketハンドラの設定
  const messageHandler = new MessageHandler(roomManager);

  // イベント通知用の関数
  function broadcastEvent(event: { type: string; data: any }): void {
    for (const [client, _] of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(event));
      }
    }
  }

  // ルームイベントをクライアントに通知
  roomManager.on("transportClosed", (data) => {
    broadcastEvent({
      type: "event",
      data: {
        event: "transportClosed",
        ...data,
      },
    });
  });

  roomManager.on("producerClosed", (data) => {
    broadcastEvent({
      type: "event",
      data: {
        event: "producerClosed",
        ...data,
      },
    });
  });

  roomManager.on("consumerClosed", (data) => {
    broadcastEvent({
      type: "event",
      data: {
        event: "consumerClosed",
        ...data,
      },
    });
  });

  roomManager.on("peerClosed", (data) => {
    broadcastEvent({
      type: "event",
      data: {
        event: "peerClosed",
        ...data,
      },
    });
  });

  roomManager.on("roomClosed", (data) => {
    broadcastEvent({
      type: "event",
      data: {
        event: "roomClosed",
        ...data,
      },
    });
  });

  // 新しいイベントハンドラを追加
  roomManager.on("roomCreated", (data) => {
    broadcastEvent({
      type: "event",
      data: {
        event: "roomCreated",
        ...data,
      },
    });
  });

  roomManager.on("peerAdded", (data) => {
    broadcastEvent({
      type: "event",
      data: {
        event: "peerAdded",
        ...data,
      },
    });
  });

  roomManager.on("transportCreated", (data) => {
    broadcastEvent({
      type: "event",
      data: {
        event: "transportCreated",
        ...data,
      },
    });
  });

  roomManager.on("producerCreated", (data) => {
    broadcastEvent({
      type: "event",
      data: {
        event: "producerCreated",
        ...data,
      },
    });
  });

  roomManager.on("consumerCreated", (data) => {
    broadcastEvent({
      type: "event",
      data: {
        event: "consumerCreated",
        ...data,
      },
    });
  });

  wss.on("connection", (socket, request) => {
    console.log("New WebSocket connection");

    // 認証処理
    // URLからAPIキーを取得
    const url = new URL(request.url!, `http://${request.headers.host}`);
    const apiKey = url.searchParams.get("api_key") ||
      request.headers["api-key"];

    if (apiKey !== config.apiKey) {
      console.log("Invalid API Key");
      socket.close(1008, "Invalid API Key");
      return;
    }

    // クライアントを管理対象に追加
    clients.set(socket, {
      roomSubscriptions: new Set(),
    });

    socket.on("message", async (message) => {
      try {
        const parsedMessage = JSON.parse(message.toString());
        const response = await messageHandler.handleMessage(parsedMessage);
        socket.send(JSON.stringify(response));
      } catch (error) {
        console.error("Error handling message:", error);
        socket.send(JSON.stringify({
          type: "response",
          id: "unknown",
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Internal server error",
          },
        }));
      }
    });

    socket.on("close", () => {
      console.log("WebSocket connection closed");
      // クライアント管理から削除
      clients.delete(socket);
    });
  });

  // HTTPサーバーを起動
  server.listen(config.port, () => {
    console.log(`Server is running on http://localhost:${config.port}`);
  });
}

// プログラム実行
main().catch((error) => {
  console.error("Error starting the server:", error);
  process.exit(1);
});
