// src/events/eventBus.js
// Singleton Node EventEmitter — decouples service side-effects from core logic

import { EventEmitter } from 'events';

const eventBus = new EventEmitter();
eventBus.setMaxListeners(20);

export default eventBus;
