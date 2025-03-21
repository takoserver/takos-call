import * as mediasoup from "mediasoup";
import { types } from "mediasoup";
import express from "express";
import * as http from "http";
import { WebSocketServer } from "ws";
import { RoomManager } from "./room-manager";
import { MessageHandler } from "./message-handler";
import { config } from "./config";

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
