"""
Smart Noel AI - Jetson Client
Main entry point for face detection, pose estimation, and MQTT publishing
"""

import cv2
import numpy as np
import time
import json
from threading import Thread
from queue import Queue

from astra.init_astra import init_astra_camera
from astra.depth_stream import get_depth_frame
from face_encoder import FaceEncoder
from pose_estimation import PoseEstimator
from mqtt_publisher import MQTTPublisher
from config import *

class NoelAIClient:
    def __init__(self):
        print("🎄 Initializing Smart Noel AI Client...")
        
        # Initialize camera
        self.camera = init_astra_camera()
        
        # Initialize AI models
        self.face_encoder = FaceEncoder(MODEL_PATH_FACE)
        self.pose_estimator = PoseEstimator(MODEL_PATH_POSE)
        
        # Initialize MQTT
        self.mqtt = MQTTPublisher(MQTT_BROKER, MQTT_PORT)
        
        # Processing queues
        self.frame_queue = Queue(maxsize=5)
        
        # Stats
        self.fps = 0
        self.last_fps_time = time.time()
        self.frame_count = 0
        
        print("✅ Initialization complete!")
    
    def process_frame(self, rgb_frame, depth_frame):
        """Process single frame for face and pose detection"""
        results = {
            'timestamp': time.time(),
            'people_count': 0,
            'faces': [],
            'poses': []
        }
        
        # Detect faces
        faces = self.face_encoder.detect_faces(rgb_frame)
        
        for face in faces:
            bbox = face['bbox']
            embedding = face['embedding']
            
            results['faces'].append({
                'bbox': bbox.tolist(),
                'embedding': embedding.tolist(),
                'confidence': float(face['confidence'])
            })
            
            # Draw face bbox
            x1, y1, x2, y2 = bbox
            cv2.rectangle(rgb_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        
        # Estimate poses
        poses = self.pose_estimator.estimate(rgb_frame)
        
        for pose in poses:
            keypoints = pose['keypoints']
            results['poses'].append({
                'keypoints': keypoints.tolist(),
                'confidence': float(pose['confidence'])
            })
            
            # Draw skeleton
            self.draw_skeleton(rgb_frame, keypoints)
        
        results['people_count'] = max(len(faces), len(poses))
        
        return results, rgb_frame
    
    def draw_skeleton(self, frame, keypoints):
        """Draw pose skeleton on frame"""
        # Define skeleton connections
        connections = [
            (0, 1), (1, 2), (2, 3), (3, 4),  # Head to shoulders
            (1, 5), (5, 6), (6, 7),          # Left arm
            (1, 8), (8, 9), (9, 10),         # Right arm
            (1, 11), (11, 12), (12, 13),     # Left leg
            (1, 14), (14, 15), (15, 16)      # Right leg
        ]
        
        # Draw keypoints
        for kp in keypoints:
            x, y, conf = int(kp[0]), int(kp[1]), kp[2]
            if conf > 0.5:
                cv2.circle(frame, (x, y), 4, (0, 255, 255), -1)
        
        # Draw connections
        for conn in connections:
            if conn[0] < len(keypoints) and conn[1] < len(keypoints):
                kp1, kp2 = keypoints[conn[0]], keypoints[conn[1]]
                if kp1[2] > 0.5 and kp2[2] > 0.5:
                    x1, y1 = int(kp1[0]), int(kp1[1])
                    x2, y2 = int(kp2[0]), int(kp2[1])
                    cv2.line(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
    
    def publish_results(self, results):
        """Publish results to MQTT broker"""
        try:
            # Publish face data
            if results['faces']:
                self.mqtt.publish(MQTT_TOPIC_FACE, json.dumps({
                    'timestamp': results['timestamp'],
                    'faces': results['faces']
                }))
            
            # Publish pose data
            if results['poses']:
                self.mqtt.publish(MQTT_TOPIC_POSE, json.dumps({
                    'timestamp': results['timestamp'],
                    'poses': results['poses']
                }))
            
            # Publish people count
            self.mqtt.publish(MQTT_TOPIC_COUNT, json.dumps({
                'timestamp': results['timestamp'],
                'count': results['people_count']
            }))
            
        except Exception as e:
            print(f"❌ MQTT publish error: {e}")
    
    def update_fps(self):
        """Calculate and update FPS"""
        self.frame_count += 1
        current_time = time.time()
        
        if current_time - self.last_fps_time >= 1.0:
            self.fps = self.frame_count / (current_time - self.last_fps_time)
            self.frame_count = 0
            self.last_fps_time = current_time
    
    def run(self):
        """Main processing loop"""
        print("🚀 Starting main processing loop...")
        
        try:
            while True:
                # Get frames from camera
                ret, rgb_frame = self.camera.read()
                if not ret:
                    print("⚠️ Failed to read frame")
                    continue
                
                # Get depth frame (optional)
                depth_frame = get_depth_frame(self.camera)
                
                # Process frame
                results, annotated_frame = self.process_frame(rgb_frame, depth_frame)
                
                # Publish to MQTT
                self.publish_results(results)
                
                # Update FPS
                self.update_fps()
                
                # Draw info overlay
                cv2.putText(annotated_frame, f"FPS: {self.fps:.1f}", 
                           (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                cv2.putText(annotated_frame, f"People: {results['people_count']}", 
                           (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                
                # Display frame
                cv2.imshow('Smart Noel AI', annotated_frame)
                
                # Exit on 'q' key
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
                
        except KeyboardInterrupt:
            print("\n🛑 Stopping...")
        
        finally:
            self.cleanup()
    
    def cleanup(self):
        """Cleanup resources"""
        print("🧹 Cleaning up...")
        self.camera.release()
        cv2.destroyAllWindows()
        self.mqtt.disconnect()
        print("✅ Cleanup complete")

if __name__ == "__main__":
    client = NoelAIClient()
    client.run()