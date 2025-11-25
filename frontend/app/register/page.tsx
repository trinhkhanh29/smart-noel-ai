//register/page.tsx
"use client";
import React, { useState, useRef } from 'react';
import { Camera, Upload, Sparkles, Gift, Check, RefreshCw, AlertCircle } from 'lucide-react';
import SnowEffect from '@/components/SnowEffect';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from '@/lib/firebase';

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [nickname, setNickname] = useState('');
  
  // Dữ liệu ảnh
  const [imageFile, setImageFile] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [selectedAvatar, setSelectedAvatar] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const noelAvatars = [
    { id: 1, emoji: '🎅', name: 'Santa' }, { id: 2, emoji: '🎄', name: 'Tree' },
    { id: 3, emoji: '⛄', name: 'Snowman' }, { id: 4, emoji: '🦌', name: 'Reindeer' },
    { id: 5, emoji: '🎁', name: 'Gift' }, { id: 6, emoji: '⭐', name: 'Star' },
    { id: 7, emoji: '🔔', name: 'Bell' }, { id: 8, emoji: '🕯️', name: 'Candle' },
    { id: 9, emoji: '🧦', name: 'Sock' }, { id: 10, emoji: '🍪', name: 'Cookie' }
  ];

  // --- HÀM NÉN ẢNH (Quan trọng) ---
  // Giúp giảm dung lượng ảnh xuống < 500KB và resize về max-width 1024px
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024; // Resize về 1024px chiều ngang
          const scaleSize = MAX_WIDTH / img.width;
          
          // Chỉ resize nếu ảnh lớn hơn 1024px
          if (scaleSize < 1) {
              canvas.width = MAX_WIDTH;
              canvas.height = img.height * scaleSize;
          } else {
              canvas.width = img.width;
              canvas.height = img.height;
          }

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Xuất ra Blob JPEG chất lượng 0.8
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Lỗi nén ảnh"));
          }, 'image/jpeg', 0.8);
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Validate Loại File (Chỉ cho phép ảnh)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      alert("❌ Vui lòng chỉ tải lên file ảnh (JPG, PNG, WEBP).");
      return;
    }

    // 2. Validate Kích thước (Chặn file quá lớn > 10MB ngay từ đầu)
    if (file.size > 10 * 1024 * 1024) {
      alert("❌ Ảnh quá lớn! Vui lòng chọn ảnh dưới 10MB.");
      return;
    }

    try {
      setLoading(true); // Hiển thị loading nhẹ khi đang nén
      
      // 3. Thực hiện nén ảnh
      const compressedBlob = await compressImage(file);
      
      setImageFile(compressedBlob);
      // Tạo URL preview từ blob đã nén
      setImagePreview(URL.createObjectURL(compressedBlob));
      
    } catch (error) {
      alert("Lỗi khi xử lý ảnh. Vui lòng thử ảnh khác.");
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (e) { 
      alert('Không thể mở Camera. Hãy kiểm tra quyền truy cập hoặc dùng HTTPS.'); 
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    // Set kích thước canvas vừa phải để không bị quá nặng
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    // Vẽ video lên canvas
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    
    // Chuyển canvas thành Blob JPEG 0.8 ngay lập tức
    canvas.toBlob((blob) => {
      if (blob) {
        setImageFile(blob);
        setImagePreview(canvas.toDataURL('image/jpeg', 0.8));
      }
    }, 'image/jpeg', 0.8);

    const stream = videoRef.current.srcObject as MediaStream;
    stream?.getTracks().forEach(t => t.stop());
    setCameraActive(false);
  };

  const handleSubmit = async () => {
    if (!nickname || !imageFile || !selectedAvatar) return alert('Vui lòng điền đủ thông tin!');
    
    // Sanitize nickname: Xóa ký tự đặc biệt để an toàn cho tên file
    const safeNickname = nickname.replace(/[^a-zA-Z0-9]/g, '_');
    
    setLoading(true);

    try {
      // Tên file: timestamp_nickname.jpg
      const fileName = `${Date.now()}_${safeNickname}.jpg`;
      
      // Upload vào thư mục 'raw_faces'
      const storageRef = ref(storage, `raw_faces/${fileName}`);
      
      // Metadata để Firebase biết đây là ảnh (quan trọng cho bảo mật)
      const metadata = { contentType: 'image/jpeg' };

      console.log("Đang upload ảnh đã nén...");
      const snapshot = await uploadBytes(storageRef, imageFile, metadata);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log("Upload OK:", downloadURL);

      // Gửi xuống Backend (Mock)
      const userData = {
        name: nickname,
        avatarUrl: downloadURL,
        noelAvatarId: selectedAvatar,
        noelEmoji: noelAvatars.find(a => a.id === selectedAvatar)?.emoji
      };
      console.log("Dữ liệu User:", userData);

      await new Promise(resolve => setTimeout(resolve, 1000));
      setSuccess(true);
    } catch (error: any) {
      console.error("Lỗi:", error);
      // Xử lý thông báo lỗi thân thiện
      if (error.code === 'storage/unauthorized') {
        alert("Lỗi quyền truy cập! Vui lòng kiểm tra Firebase Rules.");
      } else {
        alert(`Lỗi: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };


  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-red-900 to-green-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-500 rounded-full mx-auto flex items-center justify-center animate-bounce">
              <Check className="w-10 h-10 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            🎉 Registration Complete!
          </h2>
          <p className="text-gray-600 mb-4">
            Welcome, <span className="font-bold text-green-600">{nickname}</span>!
          </p>
          <p className="text-2xl mb-6">{noelAvatars.find(a => a.id === selectedAvatar)?.emoji}</p>
          <p className="text-gray-500 text-sm mb-6">
            Walk in front of the camera and your Noel avatar will appear on the dashboard!
          </p>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="bg-red-500 text-white px-6 py-3 rounded-full font-semibold hover:bg-red-600 transition"
          >
            View Dashboard →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-green-900 to-red-900 p-4">
      {/* Snow effect */}
      <div className="fixed inset-0 pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute text-white opacity-60"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-10%`,
              animation: `fall ${5 + Math.random() * 5}s linear infinite`,
              animationDelay: `${Math.random() * 5}s`,
              fontSize: `${10 + Math.random() * 15}px`
            }}
          >
            ❄
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes fall {
          to { transform: translateY(110vh); }
        }
      `}</style>

      <div className="max-w-2xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            🎄 Smart Noel AI
          </h1>
          <p className="text-green-200">Register to join the celebration!</p>
        </div>

        {/* Progress */}
        <div className="flex justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                step >= s ? 'bg-green-500 text-white' : 'bg-white/20 text-white/50'
              }`}>
                {s}
              </div>
              {s < 3 && <div className={`w-16 h-1 ${step > s ? 'bg-green-500' : 'bg-white/20'}`} />}
            </div>
          ))}
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                <Sparkles className="mr-2 text-yellow-500" />
                What's your name?
              </h2>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter your nickname"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-lg focus:border-green-500 focus:outline-none"
                maxLength={20}
              />
              <button
                onClick={() => nickname && setStep(2)}
                disabled={!nickname}
                className="w-full mt-6 bg-green-500 text-white py-3 rounded-xl font-semibold hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                <Camera className="mr-2 text-blue-500" />
                Take a selfie
              </h2>
              
              {!imagePreview && !cameraActive && (
                <div className="space-y-4">
                  <button
                    onClick={startCamera}
                    className="w-full bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition flex items-center justify-center"
                  >
                    <Camera className="mr-2" />
                    Open Camera
                  </button>
                  <button
                    onClick={() => fileInputRef.current.click()}
                    className="w-full bg-gray-500 text-white py-3 rounded-xl font-semibold hover:bg-gray-600 transition flex items-center justify-center"
                  >
                    <Upload className="mr-2" />
                    Upload Photo
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              )}

              {cameraActive && (
                <div className="space-y-4">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-xl"
                  />
                  <button
                    onClick={capturePhoto}
                    className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold hover:bg-green-600 transition"
                  >
                    📸 Capture
                  </button>
                </div>
              )}

              {imagePreview && (
                <div className="space-y-4">
                  <img src={imagePreview} alt="Preview" className="w-full rounded-xl" />
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setImagePreview(null);
                        setImageFile(null);
                      }}
                      className="flex-1 bg-gray-500 text-white py-3 rounded-xl font-semibold hover:bg-gray-600 transition"
                    >
                      Retake
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      className="flex-1 bg-green-500 text-white py-3 rounded-xl font-semibold hover:bg-green-600 transition"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                <Gift className="mr-2 text-red-500" />
                Choose your Noel avatar
              </h2>
              <div className="grid grid-cols-5 gap-4 mb-6">
                {noelAvatars.map((avatar) => (
                  <button
                    key={avatar.id}
                    onClick={() => setSelectedAvatar(avatar.id)}
                    className={`aspect-square rounded-xl flex items-center justify-center text-4xl transition transform hover:scale-110 ${
                      selectedAvatar === avatar.id
                        ? 'bg-green-500 ring-4 ring-green-300'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {avatar.emoji}
                  </button>
                ))}
              </div>
              <button
                onClick={handleSubmit}
                disabled={!selectedAvatar || loading}
                className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '⏳ Registering...' : '🎉 Complete Registration'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}