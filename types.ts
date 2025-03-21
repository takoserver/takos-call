export type MessageType =
  | "createRoom"
  | "closeRoom"
  | "addPeer"
  | "removePeer"
  | "createTransport"
  | "connectTransport"
  | "createProducer"
  | "createConsumer"
  | "closeProducer"
  | "closeConsumer"
  | "getRouterRtpCapabilities"
  // 情報取得用のメッセージタイプ
  | "getRoomInfo"
  | "getAllRooms"
  | "getPeerInfo"
  | "getTransportInfo"
  | "getProducerInfo"
  | "getConsumerInfo"
  // レスポンス用のメッセージタイプ
  | "response";

export interface Message {
  type: MessageType;
  id: string;
  data?: any;
}

export interface Response extends Message {
  type: "response";
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
}

export interface TransportInfo {
  id: string;
  iceParameters: any;
  iceCandidates: any;
  dtlsParameters: any;
  sctpParameters?: any;
}

export interface ProducerInfo {
  id: string;
  kind: "audio" | "video";
  rtpParameters: any;
}

export interface ConsumerInfo {
  id: string;
  producerId: string;
  kind: "audio" | "video";
  rtpParameters: any;
}

export interface RoomInfo {
  id: string;
  peers: { [peerId: string]: PeerInfo };
}

export interface PeerInfo {
  id: string;
  transports: { [transportId: string]: TransportInfo };
  producers: { [producerId: string]: ProducerInfo };
  consumers: { [consumerId: string]: ConsumerInfo };
}
