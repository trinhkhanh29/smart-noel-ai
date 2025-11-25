/**
 * MQTT Client for receiving data from Jetson
 */

const mqtt = require('mqtt');
const EventEmitter = require('events');

class MQTTClient extends EventEmitter {
  constructor() {
    super();
    
    this.broker = process.env.MQTT_BROKER || 'mqtt://broker.emqx.io';
    this.client = null;
    this.connected = false;
    
    this.topics = {
      face: 'smartnoel/face',
      pose: 'smartnoel/pose',
      count: 'smartnoel/count'
    };
    
    this.connect();
  }
  
  connect() {
    console.log('📡 Connecting to MQTT broker:', this.broker);
    
    const options = {
      clientId: `noel-backend-${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      connectTimeout: 4000,
      username: process.env.MQTT_USERNAME || '',
      password: process.env.MQTT_PASSWORD || '',
      reconnectPeriod: 1000,
    };
    
    this.client = mqtt.connect(this.broker, options);
    
    this.client.on('connect', () => {
      console.log('✅ MQTT connected');
      this.connected = true;
      
      // Subscribe to all topics
      Object.values(this.topics).forEach(topic => {
        this.client.subscribe(topic, (err) => {
          if (err) {
            console.error(`❌ Failed to subscribe to ${topic}:`, err);
          } else {
            console.log(`📬 Subscribed to ${topic}`);
          }
        });
      });
    });
    
    this.client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Emit events based on topic
        if (topic === this.topics.face) {
          this.emit('face', data);
        } else if (topic === this.topics.pose) {
          this.emit('pose', data);
        } else if (topic === this.topics.count) {
          this.emit('count', data);
        }
        
      } catch (error) {
        console.error('❌ Error parsing MQTT message:', error);
      }
    });
    
    this.client.on('error', (error) => {
      console.error('❌ MQTT error:', error);
      this.connected = false;
    });
    
    this.client.on('close', () => {
      console.log('📡 MQTT connection closed');
      this.connected = false;
    });
    
    this.client.on('reconnect', () => {
      console.log('🔄 MQTT reconnecting...');
    });
  }
  
  isConnected() {
    return this.connected;
  }
  
  publish(topic, message) {
    if (!this.connected) {
      console.warn('⚠️ MQTT not connected, cannot publish');
      return false;
    }
    
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    
    this.client.publish(topic, payload, { qos: 0 }, (error) => {
      if (error) {
        console.error('❌ Failed to publish:', error);
      }
    });
    
    return true;
  }
  
  disconnect() {
    if (this.client) {
      console.log('📡 Disconnecting MQTT...');
      this.client.end();
      this.connected = false;
    }
  }
}

// Create singleton instance
const mqttClient = new MQTTClient();

module.exports = mqttClient;