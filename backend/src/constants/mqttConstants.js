// src/constants/mqttConstants.js
export const MQTT_TOPIC_PREFIX = 'tv';
export const tvTopic = (tvId) => `${MQTT_TOPIC_PREFIX}/${tvId}/command`;
