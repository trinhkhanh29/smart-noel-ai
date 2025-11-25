"""
Configuration file for Smart Noel AI Jetson Client
"""

import os

# ========== MQTT Configuration ==========
MQTT_BROKER = os.getenv('MQTT_BROKER', 'broker.emqx.io')  # or your own broker
MQTT_PORT = int(os.getenv('MQTT_PORT', 1883))
MQTT_USERNAME = os.getenv('MQTT_USERNAME', '')
MQTT_PASSWORD = os.getenv('MQTT_PASSWORD', '')

# MQTT Topics
MQTT_TOPIC_FACE = 'smartnoel/face'
MQTT_TOPIC_POSE = 'smartnoel/pose'
MQTT_TOPIC_COUNT = 'smartnoel/count'

# ========== Camera Configuration ==========
CAMERA_WIDTH = 640
CAMERA_HEIGHT = 480
CAMERA_FPS = 30

# ========== Model Paths ==========
MODEL_PATH_FACE = './models/buffalo_l/det_10g.onnx'  # InsightFace detector
MODEL_PATH_FACE_REC = './models/buffalo_l/w600k_r50.onnx'  # Recognition model
MODEL_PATH_POSE = './models/movenet_lightning.tflite'  # or yolov8-pose.onnx

# ========== Detection Thresholds ==========
FACE_CONFIDENCE_THRESHOLD = 0.5
POSE_CONFIDENCE_THRESHOLD = 0.3
MIN_FACE_SIZE = 30  # pixels

# ========== Processing Configuration ==========
PROCESS_EVERY_N_FRAMES = 1  # Process every frame (1) or skip frames (2, 3, etc.)
MAX_FACES_PER_FRAME = 10
MAX_POSES_PER_FRAME = 10

# ========== Debug Mode ==========
DEBUG = True
SHOW_VISUALIZATION = True
SAVE_DEBUG_FRAMES = False
DEBUG_FRAME_DIR = './debug_frames'

# Create debug directory if needed
if SAVE_DEBUG_FRAMES and not os.path.exists(DEBUG_FRAME_DIR):
    os.makedirs(DEBUG_FRAME_DIR)

# ========== Performance Settings ==========
USE_GPU = True  # Use CUDA if available
GPU_ID = 0
NUM_THREADS = 4

print("✅ Configuration loaded")
print(f"📡 MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")
print(f"🎥 Camera: {CAMERA_WIDTH}x{CAMERA_HEIGHT} @ {CAMERA_FPS}fps")
print(f"🔧 GPU Enabled: {USE_GPU}")