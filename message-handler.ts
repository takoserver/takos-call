import { RoomManager } from "./room-manager";
import { Message, Response } from "./types";

export class MessageHandler {
  private roomManager: RoomManager;

  constructor(roomManager: RoomManager) {
    this.roomManager = roomManager;
  }

  async handleMessage(message: Message): Promise<Response> {
    try {
      switch (message.type) {
        case "createRoom":
          return await this.handleCreateRoom(message);
        case "closeRoom":
          return await this.handleCloseRoom(message);
        case "addPeer":
          return await this.handleAddPeer(message);
        case "removePeer":
          return await this.handleRemovePeer(message);
        case "createTransport":
          return await this.handleCreateTransport(message);
        case "connectTransport":
          return await this.handleConnectTransport(message);
        case "createProducer":
          return await this.handleCreateProducer(message);
        case "createConsumer":
          return await this.handleCreateConsumer(message);
        case "closeProducer":
          return await this.handleCloseProducer(message);
        case "closeConsumer":
          return await this.handleCloseConsumer(message);
        case "getRouterRtpCapabilities":
          return await this.handleGetRouterRtpCapabilities(message);
        // 新しい情報取得コマンド
        case "getRoomInfo":
          return await this.handleGetRoomInfo(message);
        case "getAllRooms":
          return await this.handleGetAllRooms(message);
        case "getPeerInfo":
          return await this.handleGetPeerInfo(message);
        case "getTransportInfo":
          return await this.handleGetTransportInfo(message);
        case "getProducerInfo":
          return await this.handleGetProducerInfo(message);
        case "getConsumerInfo":
          return await this.handleGetConsumerInfo(message);
        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error("Error handling message:", error);
      return {
        type: "response",
        id: message.id,
        success: false,
        error: {
          code: "COMMAND_ERROR",
          // @ts-ignore
          message: error!.message! || "Unknown error",
        },
      };
    }
  }

  private async handleCreateRoom(message: Message): Promise<Response> {
    const { roomId, options } = message.data;
    const roomInfo = await this.roomManager.createRoom(roomId, options);
    return {
      type: "response",
      id: message.id,
      success: true,
      data: roomInfo,
    };
  }

  private async handleCloseRoom(message: Message): Promise<Response> {
    const { roomId } = message.data;
    await this.roomManager.closeRoom(roomId);
    return {
      type: "response",
      id: message.id,
      success: true,
    };
  }

  private async handleAddPeer(message: Message): Promise<Response> {
    const { roomId, peerId } = message.data;
    const room = this.roomManager.getRoom(roomId);
    const peerInfo = await room.addPeer(peerId);
    return {
      type: "response",
      id: message.id,
      success: true,
      data: peerInfo,
    };
  }

  private async handleRemovePeer(message: Message): Promise<Response> {
    const { roomId, peerId } = message.data;
    const room = this.roomManager.getRoom(roomId);
    await room.removePeer(peerId);
    return {
      type: "response",
      id: message.id,
      success: true,
    };
  }

  private async handleCreateTransport(message: Message): Promise<Response> {
    const { roomId, peerId, direction, options } = message.data;
    const room = this.roomManager.getRoom(roomId);
    const peer = room.getPeer(peerId);
    const transportInfo = await peer.createTransport(direction, options);
    return {
      type: "response",
      id: message.id,
      success: true,
      data: transportInfo,
    };
  }

  private async handleConnectTransport(message: Message): Promise<Response> {
    const { roomId, peerId, transportId, dtlsParameters } = message.data;
    const room = this.roomManager.getRoom(roomId);
    const peer = room.getPeer(peerId);
    await peer.connectTransport(transportId, dtlsParameters);
    return {
      type: "response",
      id: message.id,
      success: true,
    };
  }

  private async handleCreateProducer(message: Message): Promise<Response> {
    const { roomId, peerId, transportId, kind, rtpParameters } = message.data;
    const room = this.roomManager.getRoom(roomId);
    const peer = room.getPeer(peerId);
    const producerInfo = await peer.createProducer(
      transportId,
      kind,
      rtpParameters,
    );
    return {
      type: "response",
      id: message.id,
      success: true,
      data: producerInfo,
    };
  }

  private async handleCreateConsumer(message: Message): Promise<Response> {
    const { roomId, peerId, transportId, producerId, rtpCapabilities } =
      message.data;
    const room = this.roomManager.getRoom(roomId);
    const peer = room.getPeer(peerId);
    const consumerInfo = await peer.createConsumer(
      transportId,
      producerId,
      rtpCapabilities,
    );

    if (!consumerInfo) {
      return {
        type: "response",
        id: message.id,
        success: false,
        error: {
          code: "CONSUMER_ERROR",
          message: "Could not create consumer",
        },
      };
    }

    return {
      type: "response",
      id: message.id,
      success: true,
      data: consumerInfo,
    };
  }

  private async handleCloseProducer(message: Message): Promise<Response> {
    const { roomId, peerId, producerId } = message.data;
    const room = this.roomManager.getRoom(roomId);
    const peer = room.getPeer(peerId);
    peer.closeProducer(producerId);
    return {
      type: "response",
      id: message.id,
      success: true,
    };
  }

  private async handleCloseConsumer(message: Message): Promise<Response> {
    const { roomId, peerId, consumerId } = message.data;
    const room = this.roomManager.getRoom(roomId);
    const peer = room.getPeer(peerId);
    peer.closeConsumer(consumerId);
    return {
      type: "response",
      id: message.id,
      success: true,
    };
  }

  private async handleGetRouterRtpCapabilities(
    message: Message,
  ): Promise<Response> {
    const { roomId } = message.data;
    const room = this.roomManager.getRoom(roomId);
    const rtpCapabilities = room.getRtpCapabilities();
    return {
      type: "response",
      id: message.id,
      success: true,
      data: { rtpCapabilities },
    };
  }

  // 情報取得用のハンドラメソッドを更新
  private async handleGetRoomInfo(message: Message): Promise<Response> {
    const { roomId } = message.data;
    const roomInfo = this.roomManager.getRoomInfo(roomId);

    return {
      type: "response",
      id: message.id,
      success: true,
      data: roomInfo, // nullの場合もそのまま返す
    };
  }

  private async handleGetAllRooms(message: Message): Promise<Response> {
    const rooms = this.roomManager.getAllRooms();
    return {
      type: "response",
      id: message.id,
      success: true,
      data: { rooms },
    };
  }

  private async handleGetPeerInfo(message: Message): Promise<Response> {
    const { roomId, peerId } = message.data;
    const room = this.roomManager.findRoom(roomId);

    if (!room) {
      return {
        type: "response",
        id: message.id,
        success: true,
        data: null,
      };
    }

    const peer = room.findPeer(peerId);
    const peerInfo = peer ? peer.getInfo() : null;

    return {
      type: "response",
      id: message.id,
      success: true,
      data: peerInfo,
    };
  }

  private async handleGetTransportInfo(message: Message): Promise<Response> {
    const { roomId, peerId, transportId } = message.data;
    const room = this.roomManager.findRoom(roomId);

    if (!room) {
      return {
        type: "response",
        id: message.id,
        success: true,
        data: null,
      };
    }

    const peer = room.findPeer(peerId);
    if (!peer) {
      return {
        type: "response",
        id: message.id,
        success: true,
        data: null,
      };
    }

    const transport = peer.findTransport(transportId);
    if (!transport) {
      return {
        type: "response",
        id: message.id,
        success: true,
        data: null,
      };
    }

    // トランスポート情報を抽出
    const transportInfo = {
      id: transport.id,
      iceParameters: (transport as any).iceParameters,
      iceCandidates: (transport as any).iceCandidates,
      dtlsParameters: (transport as any).dtlsParameters,
      sctpParameters: (transport as any).sctpParameters,
    };

    return {
      type: "response",
      id: message.id,
      success: true,
      data: transportInfo,
    };
  }

  private async handleGetProducerInfo(message: Message): Promise<Response> {
    const { roomId, peerId, producerId } = message.data;
    const room = this.roomManager.findRoom(roomId);

    if (!room) {
      return {
        type: "response",
        id: message.id,
        success: true,
        data: null,
      };
    }

    const peer = room.findPeer(peerId);
    if (!peer) {
      return {
        type: "response",
        id: message.id,
        success: true,
        data: null,
      };
    }

    const producer = peer.findProducer(producerId);
    if (!producer) {
      return {
        type: "response",
        id: message.id,
        success: true,
        data: null,
      };
    }

    // プロデューサー情報を抽出
    const producerInfo = {
      id: producer.id,
      kind: producer.kind,
      rtpParameters: producer.rtpParameters,
      paused: producer.paused,
    };

    return {
      type: "response",
      id: message.id,
      success: true,
      data: producerInfo,
    };
  }

  private async handleGetConsumerInfo(message: Message): Promise<Response> {
    const { roomId, peerId, consumerId } = message.data;
    const room = this.roomManager.findRoom(roomId);

    if (!room) {
      return {
        type: "response",
        id: message.id,
        success: true,
        data: null,
      };
    }

    const peer = room.findPeer(peerId);
    if (!peer) {
      return {
        type: "response",
        id: message.id,
        success: true,
        data: null,
      };
    }

    const consumer = peer.findConsumer(consumerId);
    if (!consumer) {
      return {
        type: "response",
        id: message.id,
        success: true,
        data: null,
      };
    }

    // コンシューマー情報を抽出
    const consumerInfo = {
      id: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      paused: consumer.paused,
    };

    return {
      type: "response",
      id: message.id,
      success: true,
      data: consumerInfo,
    };
  }
}
