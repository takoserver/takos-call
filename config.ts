import * as dotenv from "./$node_modules/dotenv/lib/main.js";
import { types } from "./$node_modules/mediasoup/node/lib/index.js";

dotenv.config();

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  apiKey: process.env.API_KEY || "default_api_key",

  mediasoup: {
    worker: {
      logLevel: (process.env.MEDIASOUP_LOG_LEVEL as types.WorkerLogLevel) ||
        "warn",
      logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
      rtcMinPort: process.env.MEDIASOUP_RTC_MIN_PORT
        ? parseInt(process.env.MEDIASOUP_RTC_MIN_PORT)
        : 10000,
      rtcMaxPort: process.env.MEDIASOUP_RTC_MAX_PORT
        ? parseInt(process.env.MEDIASOUP_RTC_MAX_PORT)
        : 10100,
    },
    router: {
      mediaCodecs: [
        {
          kind: "audio",
          mimeType: "audio/opus",
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: "video",
          mimeType: "video/VP8",
          clockRate: 90000,
          parameters: {
            "x-google-start-bitrate": 1000,
          },
        },
        {
          kind: "video",
          mimeType: "video/H264",
          clockRate: 90000,
          parameters: {
            "packetization-mode": 1,
            "profile-level-id": "4d0032",
            "level-asymmetry-allowed": 1,
          },
        },
      ] as types.RtpCodecCapability[],
    },
    webRtcTransport: {
      listenIps: [
        {
          ip: process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0",
          announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1",
        },
      ],
      initialAvailableOutgoingBitrate: 1000000,
      minimumAvailableOutgoingBitrate: 600000,
      maximumAvailableOutgoingBitrate: 10000000,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    },
  },
};
