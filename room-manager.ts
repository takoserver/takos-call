import * as mediasoup from "mediasoup";
import { types } from "mediasoup";
import {
  ConsumerInfo,
  PeerInfo,
  ProducerInfo,
  RoomInfo,
  TransportInfo,
} from "./types";
import { config } from "./config";
import { EventEmitter } from "events";

export class RoomManager extends EventEmitter {
  private worker: mediasoup.types.Worker;
  private rooms: Map<string, Room> = new Map();

  constructor(worker: mediasoup.types.Worker) {
    super();
    this.worker = worker;
  }

  async createRoom(roomId: string, options: any = {}): Promise<RoomInfo> {
    if (this.rooms.has(roomId)) {
      throw new Error(`Room ${roomId} already exists`);
    }

    const room = new Room(roomId, this.worker, options);

    // ルームのイベントを監視して上位に伝播
    room.on("close", () => {
      this.emit("roomClosed", { roomId });
    });

    room.on("peerClosed", (data) => {
      this.emit("peerClosed", { roomId, ...data });
    });

    room.on("transportClosed", (data) => {
      this.emit("transportClosed", { roomId, ...data });
    });

    room.on("producerClosed", (data) => {
      this.emit("producerClosed", { roomId, ...data });
    });

    room.on("consumerClosed", (data) => {
      this.emit("consumerClosed", { roomId, ...data });
    });

    // 新しいイベントハンドラを追加
    room.on("transportCreated", (data) => {
      this.emit("transportCreated", { roomId, ...data });
    });

    room.on("producerCreated", (data) => {
      this.emit("producerCreated", { roomId, ...data });
    });

    room.on("consumerCreated", (data) => {
      this.emit("consumerCreated", { roomId, ...data });
    });

    await room.initialize();
    this.rooms.set(roomId, room);

    // ルーム作成イベントを発火
    this.emit("roomCreated", { roomId, roomInfo: room.getInfo() });

    return room.getInfo();
  }

  async closeRoom(roomId: string): Promise<void> {
    const room = this.getRoom(roomId);
    await room.close();
    this.rooms.delete(roomId);
  }

  // 既存の関数（エラーをスロー）
  getRoom(roomId: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }
    return room;
  }

  // 安全なバージョン（nullを返す）
  findRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) || null;
  }

  getRoomInfo(roomId: string): RoomInfo | null {
    const room = this.findRoom(roomId);
    return room ? room.getInfo() : null;
  }

  getAllRooms(): RoomInfo[] {
    return Array.from(this.rooms.values()).map((room) => room.getInfo());
  }
}

class Room extends EventEmitter {
  public id: string;
  private worker: mediasoup.types.Worker;
  private router: mediasoup.types.Router | null = null;
  private peers: Map<string, Peer> = new Map();
  private options: any;

  constructor(id: string, worker: mediasoup.types.Worker, options: any = {}) {
    super();
    this.id = id;
    this.worker = worker;
    this.options = options;
  }

  async initialize(): Promise<void> {
    this.router = await this.worker.createRouter({
      mediaCodecs: config.mediasoup.router.mediaCodecs,
      ...this.options,
    });
  }

  async close(): Promise<void> {
    // すべてのピアを閉じる
    for (const peer of this.peers.values()) {
      await peer.close();
    }
    // ルーターを閉じる
    if (this.router) {
      this.router.close();
    }
    this.emit("close");
  }

  getRouter(): mediasoup.types.Router {
    if (!this.router) {
      throw new Error("Router not initialized");
    }
    return this.router;
  }

  async addPeer(peerId: string): Promise<PeerInfo> {
    if (this.peers.has(peerId)) {
      throw new Error(`Peer ${peerId} already exists in room ${this.id}`);
    }

    const peer = new Peer(peerId, this);

    // ピアのイベントを監視して上位に伝播
    peer.on("close", () => {
      this.emit("peerClosed", { peerId });
    });

    peer.on("transportClosed", (data) => {
      this.emit("transportClosed", { peerId, ...data });
    });

    peer.on("producerClosed", (data) => {
      this.emit("producerClosed", { peerId, ...data });
    });

    peer.on("consumerClosed", (data) => {
      this.emit("consumerClosed", { peerId, ...data });
    });

    // 新しいイベントハンドラを追加
    peer.on("transportCreated", (data) => {
      this.emit("transportCreated", { peerId, ...data });
    });

    peer.on("producerCreated", (data) => {
      this.emit("producerCreated", { peerId, ...data });
    });

    peer.on("consumerCreated", (data) => {
      this.emit("consumerCreated", { peerId, ...data });
    });

    this.peers.set(peerId, peer);

    // ピア追加イベントを発火
    this.emit("peerAdded", { peerId, peerInfo: peer.getInfo() });

    return peer.getInfo();
  }

  async removePeer(peerId: string): Promise<void> {
    const peer = this.getPeer(peerId);
    await peer.close();
    this.peers.delete(peerId);
  }

  // 既存の関数（エラーをスロー）
  getPeer(peerId: string): Peer {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error(`Peer ${peerId} not found in room ${this.id}`);
    }
    return peer;
  }

  // 安全なバージョン（nullを返す）
  findPeer(peerId: string): Peer | null {
    return this.peers.get(peerId) || null;
  }

  getInfo(): RoomInfo {
    const peersInfo: { [peerId: string]: PeerInfo } = {};

    for (const [peerId, peer] of this.peers.entries()) {
      peersInfo[peerId] = peer.getInfo();
    }

    return {
      id: this.id,
      peers: peersInfo,
    };
  }

  getRtpCapabilities(): types.RtpCapabilities {
    return this.getRouter().rtpCapabilities;
  }
}

class Peer extends EventEmitter {
  public id: string;
  private room: Room;
  private transports: Map<string, mediasoup.types.Transport> = new Map();
  private producers: Map<string, mediasoup.types.Producer> = new Map();
  private consumers: Map<string, mediasoup.types.Consumer> = new Map();

  constructor(id: string, room: Room) {
    super();
    this.id = id;
    this.room = room;
  }

  async close(): Promise<void> {
    // すべてのコンシューマーを閉じる
    for (const consumer of this.consumers.values()) {
      consumer.close();
    }

    // すべてのプロデューサーを閉じる
    for (const producer of this.producers.values()) {
      producer.close();
    }

    // すべてのトランスポートを閉じる
    for (const transport of this.transports.values()) {
      transport.close();
    }

    this.consumers.clear();
    this.producers.clear();
    this.transports.clear();
    this.emit("close");
  }

  async createTransport(
    direction: "send" | "recv",
    options: any = {},
  ): Promise<TransportInfo> {
    const router = this.room.getRouter();

    const transportOptions = {
      ...config.mediasoup.webRtcTransport,
      ...options,
    };

    const transport = await router.createWebRtcTransport(transportOptions);

    this.transports.set(transport.id, transport);

    // transportのクローズイベントを監視
    transport.on("routerclose", () => {
      this.transports.delete(transport.id);
    });

    // トランスポートのクローズイベントを監視
    transport.on("@close", () => {
      this.transports.delete(transport.id);
      this.emit("transportClosed", { transportId: transport.id });
    });

    // トランスポート作成イベントを発火
    this.emit("transportCreated", {
      transportId: transport.id,
      direction,
      transportInfo: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        sctpParameters: transport.sctpParameters,
      },
    });

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    };
  }

  async connectTransport(
    transportId: string,
    dtlsParameters: types.DtlsParameters,
  ): Promise<void> {
    const transport = this.getTransport(transportId);
    await transport.connect({ dtlsParameters });
  }

  async createProducer(
    transportId: string,
    kind: "audio" | "video",
    rtpParameters: types.RtpParameters,
  ): Promise<ProducerInfo> {
    const transport = this.getTransport(transportId);

    const producer = await transport.produce({
      kind,
      rtpParameters,
    });

    this.producers.set(producer.id, producer);

    // producerのクローズイベントを監視
    producer.on("transportclose", () => {
      this.producers.delete(producer.id);
    });

    // プロデューサーのクローズイベントを監視
    producer.on("@close", () => {
      this.producers.delete(producer.id);
      this.emit("producerClosed", { producerId: producer.id });
    });

    // プロデューサー作成イベントを発火
    this.emit("producerCreated", {
      producerId: producer.id,
      transportId,
      kind,
      producerInfo: {
        id: producer.id,
        kind: producer.kind as "audio" | "video",
        rtpParameters: producer.rtpParameters,
      },
    });

    return {
      id: producer.id,
      kind: producer.kind as "audio" | "video",
      rtpParameters: producer.rtpParameters,
    };
  }

  async createConsumer(
    transportId: string,
    producerId: string,
    rtpCapabilities: types.RtpCapabilities,
  ): Promise<ConsumerInfo | null> {
    const router = this.room.getRouter();
    const transport = this.getTransport(transportId);

    // consumerを作成できるか確認
    if (
      !router.canConsume({
        producerId,
        rtpCapabilities,
      })
    ) {
      return null;
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true, // 最初はポーズ状態で作成
    });

    this.consumers.set(consumer.id, consumer);

    // consumerのクローズイベントを監視
    consumer.on("transportclose", () => {
      this.consumers.delete(consumer.id);
    });

    // コンシューマーのクローズイベントを監視
    consumer.on("@close", () => {
      this.consumers.delete(consumer.id);
      this.emit("consumerClosed", { consumerId: consumer.id });
    });

    // consumerをレジュームする
    await consumer.resume();

    // コンシューマー作成イベントを発火
    this.emit("consumerCreated", {
      consumerId: consumer.id,
      producerId,
      transportId,
      consumerInfo: {
        id: consumer.id,
        producerId,
        kind: consumer.kind as "audio" | "video",
        rtpParameters: consumer.rtpParameters,
      },
    });

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind as "audio" | "video",
      rtpParameters: consumer.rtpParameters,
    };
  }

  closeProducer(producerId: string): void {
    const producer = this.getProducer(producerId);
    producer.close();
    this.producers.delete(producerId);
  }

  closeConsumer(consumerId: string): void {
    const consumer = this.getConsumer(consumerId);
    consumer.close();
    this.consumers.delete(consumerId);
  }

  // 既存の関数（エラーをスロー）
  getTransport(transportId: string): mediasoup.types.Transport {
    const transport = this.transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport ${transportId} not found for peer ${this.id}`);
    }
    return transport;
  }

  // 安全なバージョン（nullを返す）
  findTransport(transportId: string): mediasoup.types.Transport | null {
    return this.transports.get(transportId) || null;
  }

  // 既存の関数（エラーをスロー）
  getProducer(producerId: string): mediasoup.types.Producer {
    const producer = this.producers.get(producerId);
    if (!producer) {
      throw new Error(`Producer ${producerId} not found for peer ${this.id}`);
    }
    return producer;
  }

  // 安全なバージョン（nullを返す）
  findProducer(producerId: string): mediasoup.types.Producer | null {
    return this.producers.get(producerId) || null;
  }

  // 既存の関数（エラーをスロー）
  getConsumer(consumerId: string): mediasoup.types.Consumer {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) {
      throw new Error(`Consumer ${consumerId} not found for peer ${this.id}`);
    }
    return consumer;
  }

  // 安全なバージョン（nullを返す）
  findConsumer(consumerId: string): mediasoup.types.Consumer | null {
    return this.consumers.get(consumerId) || null;
  }

  getInfo(): PeerInfo {
    const transportsInfo: { [transportId: string]: TransportInfo } = {};
    const producersInfo: { [producerId: string]: ProducerInfo } = {};
    const consumersInfo: { [consumerId: string]: ConsumerInfo } = {};

    for (const [transportId, transport] of this.transports.entries()) {
      transportsInfo[transportId] = {
        id: transport.id,
        iceParameters: (transport as any).iceParameters,
        iceCandidates: (transport as any).iceCandidates,
        dtlsParameters: (transport as any).dtlsParameters,
        sctpParameters: (transport as any).sctpParameters,
      };
    }

    for (const [producerId, producer] of this.producers.entries()) {
      producersInfo[producerId] = {
        id: producer.id,
        kind: producer.kind as "audio" | "video",
        rtpParameters: producer.rtpParameters,
      };
    }

    for (const [consumerId, consumer] of this.consumers.entries()) {
      consumersInfo[consumerId] = {
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind as "audio" | "video",
        rtpParameters: consumer.rtpParameters,
      };
    }

    return {
      id: this.id,
      transports: transportsInfo,
      producers: producersInfo,
      consumers: consumersInfo,
    };
  }
}
