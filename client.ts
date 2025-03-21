export interface ClientConfig {
    url: string;
    apiKey: string;
    autoReconnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
}

export interface Message {
    type: string;
    id: string;
    data: any;
}

export interface Response {
    type: "response";
    id: string;
    success: boolean;
    data?: any;
    error?: {
        code: string;
        message: string;
    };
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

export interface TransportInfo {
    id: string;
    iceParameters: any;
    iceCandidates: any[];
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

export type EventCallback = (data: any) => void;

export class TakosCallClient {
    private config: ClientConfig;
    private ws: WebSocket | null = null;
    private connected: boolean = false;
    private reconnectAttempts: number = 0;
    private messageQueue: Message[] = [];
    private messageIdCounter: number = 0;
    private pendingRequests: Map<
        string,
        { resolve: Function; reject: Function }
    > = new Map();
    private eventListeners: Map<string, EventCallback[]> = new Map();

    constructor(config: ClientConfig) {
        this.config = {
            autoReconnect: true,
            reconnectInterval: 3000,
            maxReconnectAttempts: 5,
            ...config,
        };
    }

    // WebSocket接続関連のメソッド
    public connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.connected && this.ws) {
                resolve();
                return;
            }

            try {
                // URLにAPIキーをクエリパラメータとして追加
                const wsUrl = new URL(this.config.url);
                wsUrl.searchParams.append("api_key", this.config.apiKey);
                this.ws = new WebSocket(wsUrl.toString());

                this.ws.onopen = () => {
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    this.processQueue();
                    this.emit("connected", null);
                    resolve();
                };

                this.ws.onclose = (event) => {
                    this.connected = false;
                    this.emit("disconnected", event);

                    if (
                        this.config.autoReconnect &&
                        (this.config.maxReconnectAttempts === undefined ||
                            this.reconnectAttempts <
                                this.config.maxReconnectAttempts!)
                    ) {
                        setTimeout(
                            () => this.reconnect(),
                            this.config.reconnectInterval,
                        );
                    }

                    if (!this.connected) {
                        reject(new Error("WebSocket connection failed"));
                    }
                };

                this.ws.onerror = (error) => {
                    this.emit("error", error);
                    reject(error);
                };

                this.ws.onmessage = (event) => {
                    try {
                        const response = JSON.parse(
                            event.data as string,
                        ) as Response;
                        this.handleResponse(response);
                    } catch (error) {
                        console.error(
                            "Error parsing WebSocket message:",
                            error,
                        );
                    }
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    private reconnect(): void {
        this.reconnectAttempts++;
        this.emit("reconnecting", { attempt: this.reconnectAttempts });
        this.connect().catch(() => {});
    }

    private processQueue(): void {
        if (!this.connected || !this.ws) return;

        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message) {
                this.ws.send(JSON.stringify(message));
            }
        }
    }

    private handleResponse(response: Response): void {
        const { id, success, data, error } = response;
        const pending = this.pendingRequests.get(id);

        if (pending) {
            this.pendingRequests.delete(id);
            if (success) {
                pending.resolve(data);
            } else {
                pending.reject(error || new Error("Request failed"));
            }
        }

        // カスタムイベントを発火
        this.emit("message", response);
    }

    public disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.connected = false;
        }
    }

    // メッセージ送信と応答処理
    private sendRequest(type: string, data: any = {}): Promise<any> {
        return new Promise((resolve, reject) => {
            const id = `${Date.now()}-${this.messageIdCounter++}`;
            const message: Message = { type, id, data };

            this.pendingRequests.set(id, { resolve, reject });

            if (this.connected && this.ws) {
                this.ws.send(JSON.stringify(message));
            } else {
                this.messageQueue.push(message);
                if (!this.connected) {
                    this.connect().catch(reject);
                }
            }
        });
    }

    // イベント処理
    public on(event: string, callback: EventCallback): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(callback);
    }

    public off(event: string, callback?: EventCallback): void {
        if (!this.eventListeners.has(event)) return;

        if (callback) {
            const callbacks = this.eventListeners.get(event)!;
            this.eventListeners.set(
                event,
                callbacks.filter((cb) => cb !== callback),
            );
        } else {
            this.eventListeners.delete(event);
        }
    }

    private emit(event: string, data: any): void {
        if (!this.eventListeners.has(event)) return;

        for (const callback of this.eventListeners.get(event)!) {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in ${event} event handler:`, error);
            }
        }
    }

    // MediaSoup関連のAPI
    public async createRoom(
        roomId: string,
        options: any = {},
    ): Promise<RoomInfo> {
        return this.sendRequest("createRoom", { roomId, options });
    }

    public async closeRoom(roomId: string): Promise<void> {
        return this.sendRequest("closeRoom", { roomId });
    }

    public async addPeer(roomId: string, peerId: string): Promise<PeerInfo> {
        return this.sendRequest("addPeer", { roomId, peerId });
    }

    public async removePeer(roomId: string, peerId: string): Promise<void> {
        return this.sendRequest("removePeer", { roomId, peerId });
    }

    public async createTransport(
        roomId: string,
        peerId: string,
        direction: "send" | "recv",
        options: any = {},
    ): Promise<TransportInfo> {
        return this.sendRequest("createTransport", {
            roomId,
            peerId,
            direction,
            options,
        });
    }

    public async connectTransport(
        roomId: string,
        peerId: string,
        transportId: string,
        dtlsParameters: any,
    ): Promise<void> {
        return this.sendRequest("connectTransport", {
            roomId,
            peerId,
            transportId,
            dtlsParameters,
        });
    }

    public async createProducer(
        roomId: string,
        peerId: string,
        transportId: string,
        kind: "audio" | "video",
        rtpParameters: any,
    ): Promise<ProducerInfo> {
        return this.sendRequest("createProducer", {
            roomId,
            peerId,
            transportId,
            kind,
            rtpParameters,
        });
    }

    public async createConsumer(
        roomId: string,
        peerId: string,
        transportId: string,
        producerId: string,
        rtpCapabilities: any,
    ): Promise<ConsumerInfo | null> {
        return this.sendRequest("createConsumer", {
            roomId,
            peerId,
            transportId,
            producerId,
            rtpCapabilities,
        });
    }

    public async closeProducer(
        roomId: string,
        peerId: string,
        producerId: string,
    ): Promise<void> {
        return this.sendRequest("closeProducer", {
            roomId,
            peerId,
            producerId,
        });
    }

    public async closeConsumer(
        roomId: string,
        peerId: string,
        consumerId: string,
    ): Promise<void> {
        return this.sendRequest("closeConsumer", {
            roomId,
            peerId,
            consumerId,
        });
    }

    public async getRouterRtpCapabilities(roomId: string): Promise<any> {
        const response = await this.sendRequest("getRouterRtpCapabilities", {
            roomId,
        });
        return response.rtpCapabilities;
    }

    // 情報取得用の新しいAPI

    /**
     * 特定のルーム情報を取得
     * 存在しない場合はnullを返します
     */
    public async getRoomInfo(roomId: string): Promise<RoomInfo | null> {
        return this.sendRequest("getRoomInfo", { roomId });
    }

    /**
     * すべてのアクティブなルーム情報を取得
     */
    public async getAllRooms(): Promise<RoomInfo[]> {
        const response = await this.sendRequest("getAllRooms");
        return response.rooms;
    }

    /**
     * 特定のピア情報を取得
     * 存在しない場合はnullを返します
     */
    public async getPeerInfo(
        roomId: string,
        peerId: string,
    ): Promise<PeerInfo | null> {
        return this.sendRequest("getPeerInfo", { roomId, peerId });
    }

    /**
     * 特定のトランスポート情報を取得
     * 存在しない場合はnullを返します
     */
    public async getTransportInfo(
        roomId: string,
        peerId: string,
        transportId: string,
    ): Promise<TransportInfo | null> {
        return this.sendRequest("getTransportInfo", {
            roomId,
            peerId,
            transportId,
        });
    }

    /**
     * 特定のプロデューサー情報を取得
     * 存在しない場合はnullを返します
     */
    public async getProducerInfo(
        roomId: string,
        peerId: string,
        producerId: string,
    ): Promise<ProducerInfo | null> {
        return this.sendRequest("getProducerInfo", {
            roomId,
            peerId,
            producerId,
        });
    }

    /**
     * 特定のコンシューマー情報を取得
     * 存在しない場合はnullを返します
     */
    public async getConsumerInfo(
        roomId: string,
        peerId: string,
        consumerId: string,
    ): Promise<ConsumerInfo | null> {
        return this.sendRequest("getConsumerInfo", {
            roomId,
            peerId,
            consumerId,
        });
    }
}
