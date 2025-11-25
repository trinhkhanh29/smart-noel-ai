/**
 * Smart Noel AI - Backend Server
 * Handles MQTT, API endpoints, Socket.io, and Firebase
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

// Import modules
const mqttClient = require('../src/mqtt/mqttClient');
const { initializeFirebase, db, storage } = require('../src/firebase/firebaseAdmin');
const { findMatchingFace } = require('../src/utils/faceMatch');

// Initialize Express
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Initialize Firebase
initializeFirebase();

// ========== Real-time State ==========
let currentState = {
  peopleCount: 0,
  activeFaces: [],
  latestPoses: [],
  checkins: [],
  lastUpdate: Date.now()
};

// ========== MQTT Event Handlers ==========
mqttClient.on('face', async (data) => {
  try {
    console.log('📸 Face data received:', data.faces.length, 'faces');
    
    for (const face of data.faces) {
      // Find matching user in database
      const match = await findMatchingFace(face.embedding);
      
      if (match) {
        // User recognized!
        const checkin = {
          userId: match.userId,
          nickname: match.nickname,
          avatarUrl: match.avatarUrl,
          timestamp: Date.now(),
          confidence: match.similarity
        };
        
        // Add to checkins (prevent duplicates within 30 seconds)
        const recentCheckin = currentState.checkins.find(
          c => c.userId === match.userId && 
          (Date.now() - c.timestamp) < 30000
        );
        
        if (!recentCheckin) {
          currentState.checkins.unshift(checkin);
          currentState.checkins = currentState.checkins.slice(0, 50); // Keep last 50
          
          // Save to Firestore
          await db.collection('checkins').add(checkin);
          
          // Emit to frontend
          io.emit('checkin', checkin);
          
          console.log('✅ Check-in:', match.nickname);
        }
      }
    }
    
    currentState.activeFaces = data.faces;
    currentState.lastUpdate = Date.now();
    
  } catch (error) {
    console.error('❌ Error processing face data:', error);
  }
});

mqttClient.on('pose', (data) => {
  currentState.latestPoses = data.poses;
  io.emit('pose', data.poses);
});

mqttClient.on('count', (data) => {
  currentState.peopleCount = data.count;
  io.emit('count', data.count);
});

// ========== API Endpoints ==========

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mqtt: mqttClient.isConnected(),
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// Get current state
app.get('/api/state', (req, res) => {
  res.json(currentState);
});

// Register new user
app.post('/api/register', async (req, res) => {
  try {
    const { nickname, avatarUrl, faceEmbedding } = req.body;
    
    if (!nickname || !avatarUrl || !faceEmbedding) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Save to Firestore
    const userRef = await db.collection('users').add({
      nickname,
      avatarUrl,
      faceEmbedding,
      createdAt: Date.now()
    });
    
    res.json({
      success: true,
      userId: userRef.id,
      message: '🎄 Registration successful!'
    });
    
    console.log('✅ New user registered:', nickname);
    
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get recent checkins
app.get('/api/checkins', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const snapshot = await db.collection('checkins')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    const checkins = [];
    snapshot.forEach(doc => {
      checkins.push({ id: doc.id, ...doc.data() });
    });
    
    res.json(checkins);
    
  } catch (error) {
    console.error('❌ Error fetching checkins:', error);
    res.status(500).json({ error: 'Failed to fetch checkins' });
  }
});

// Get user stats
app.get('/api/stats', async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').count().get();
    const checkinsSnapshot = await db.collection('checkins').count().get();
    
    res.json({
      totalUsers: usersSnapshot.data().count,
      totalCheckins: checkinsSnapshot.data().count,
      currentPeople: currentState.peopleCount,
      uptime: process.uptime()
    });
    
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ========== Socket.io Events ==========
io.on('connection', (socket) => {
  console.log('👤 Client connected:', socket.id);
  
  // Send current state to new client
  socket.emit('state', currentState);
  
  socket.on('disconnect', () => {
    console.log('👋 Client disconnected:', socket.id);
  });
});

// ========== Start Server ==========
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log('🎄 Smart Noel AI Backend');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 MQTT connected to ${process.env.MQTT_BROKER}`);
  console.log(`🔥 Firebase initialized`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    mqttClient.disconnect();
    console.log('✅ Server closed');
    process.exit(0);
  });
});