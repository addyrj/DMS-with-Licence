// src/config/mqtt.js
// MQTT client — non-blocking, does NOT crash app if broker unreachable

import mqtt   from 'mqtt';
import env    from './env.js';
import logger from '../utils/logger.js';

let client      = null;
let isConnected = false;

export const connectMqtt = () => {
  // If broker not set at all, skip silently
  if (!env.mqtt.broker) {
    logger.warn('⚠️  MQTT_BROKER not set — publish calls will be skipped');
    return;
  }

  const connectOptions = {
    reconnectPeriod:  5000,
    connectTimeout:   15000,
    keepalive:        30,
    clean:            true,
    clientId:         `dms_server_${Math.random().toString(16).slice(2, 8)}`,
  };

  // Only add credentials if username is set (local broker has no auth)
  if (env.mqtt.username) {
    connectOptions.username = env.mqtt.username;
    connectOptions.password = env.mqtt.password;
  }

  client = mqtt.connect(`mqtt://${env.mqtt.broker}:${env.mqtt.port}`, connectOptions);

  client.on('connect', () => {
    isConnected = true;
    logger.info(`✅ MQTT connected → ${env.mqtt.broker}:${env.mqtt.port}`);
  });

  client.on('error', (err) => {
    isConnected = false;
    // Absorb the error — MQTT failure must never crash the HTTP server
    logger.warn(`⚠️  MQTT error (will retry): ${err.message}`);
    // Prevent unhandledRejection by catching the emitted error
    if (client) client.removeAllListeners('error');
    if (client) client.on('error', (e) => logger.warn(`⚠️  MQTT: ${e.message}`));
  });

  client.on('offline',   () => { isConnected = false; logger.warn('⚠️  MQTT offline'); });
  client.on('reconnect', () => logger.info('🔄 MQTT reconnecting...'));
};

export const publish = (topic, payload, options = { retain: true }) =>
  new Promise((resolve) => {
    if (!client || !isConnected) {
      logger.warn(`⚠️  MQTT not connected — skipping publish to [${topic}]`);
      return resolve(false);
    }
    const msg = typeof payload === 'string' ? payload : JSON.stringify(payload);
    client.publish(topic, msg, options, (err) => {
      if (err) { logger.error(`MQTT publish error [${topic}]: ${err.message}`); return resolve(false); }
      logger.info(`📡 MQTT → ${topic}`);
      resolve(true);
    });
  });

export const disconnectMqtt = () =>
  new Promise((resolve) => {
    if (client) { client.end(false, {}, () => { isConnected = false; resolve(); }); }
    else resolve();
  });
