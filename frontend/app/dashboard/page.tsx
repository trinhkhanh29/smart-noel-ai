"use client";
import React, { useState, useEffect, useRef } from 'react';
import SnowEffect from '@/components/SnowEffect';
import RealtimeCounter from '@/components/RealtimeCounter';
import CheckinCard, { UserCheckin } from '@/components/CheckinCard';
import { socket } from '@/lib/socket';
import { db } from '@/lib/firebase'; // Import Firestore
import { collection, query, orderBy, limit, onSnapshot, getDocs } from "firebase/firestore";

export default function DashboardPage() {
  const [peopleCount, setPeopleCount] = useState(0);
  const [recentCheckins, setRecentCheckins] = useState<UserCheckin[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Danh sách người dùng thật đã đăng ký (lấy từ DB để giả lập nhận diện)
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);

  // --- 1. LOGIC CAMERA LUÔN BẬT ---
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Lỗi mở camera Dashboard:", err);
      }
    };

    startCamera();

    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // --- 2. LẤY DỮ LIỆU THẬT TỪ FIRESTORE (Để hiển thị tên đúng) ---
  useEffect(() => {
    // A. Lấy danh sách user đã đăng ký để làm "nguồn" cho việc giả lập nhận diện
    // (Nếu bạn chưa có Backend AI, hệ thống sẽ random từ danh sách này)
    const fetchRegisteredUsers = async () => {
      try {
        const q = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(20));
        const querySnapshot = await getDocs(q);
        const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (users.length > 0) {
          setRegisteredUsers(users);
          console.log("Đã tải danh sách người dùng thật:", users.length);
        }
      } catch (error) {
        console.log("Chưa có collection 'users', dùng dữ liệu mẫu.");
      }
    };

    fetchRegisteredUsers();

    // B. Lắng nghe realtime collection 'checkins' (Nếu Backend ghi vào đây)
    const qCheckins = query(collection(db, "checkins"), orderBy("timestamp", "desc"), limit(5));
    const unsubscribe = onSnapshot(qCheckins, (snapshot) => {
      // Nếu có dữ liệu checkin thật từ DB, ưu tiên hiển thị
      if (!snapshot.empty) {
        const realCheckins = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                avatarUrl: data.avatarUrl,
                noelAvatar: data.noelEmoji || "🎄",
                checkinTime: data.timestamp?.toDate().toLocaleTimeString() || new Date().toLocaleTimeString()
            } as UserCheckin;
        });
        // Chỉ cập nhật nếu có dữ liệu mới, tránh xung đột với socket/mock
        if (realCheckins.length > 0) {
             // setRecentCheckins(realCheckins); // Bỏ comment dòng này nếu muốn ưu tiên DB tuyệt đối
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // --- 3. LOGIC SOCKET (Nhận diện từ Jetson) ---
  useEffect(() => {
    socket.on('new-checkin', (data: any) => {
      const newUser: UserCheckin = {
        id: Date.now().toString(),
        name: data.name || "Người lạ",
        avatarUrl: data.avatarUrl,
        noelAvatar: data.noelAvatar || "🎄",
        checkinTime: new Date().toLocaleTimeString(),
      };
      setRecentCheckins(prev => [newUser, ...prev].slice(0, 5));
    });

    socket.on('people-count', (count: number) => {
      setPeopleCount(count);
    });

    return () => {
      socket.off('new-checkin');
      socket.off('people-count');
    };
  }, []);

  // --- 4. MOCK DATA THÔNG MINH (Tự nhận diện người trong DB) ---
  useEffect(() => {
    const interval = setInterval(() => {
      // Nếu có người dùng thật trong DB, hãy giả vờ nhận diện họ!
      let mockUser: UserCheckin;

      if (registeredUsers.length > 0) {
          // Lấy ngẫu nhiên 1 người thật từ DB
          const randomRealUser = registeredUsers[Math.floor(Math.random() * registeredUsers.length)];
          mockUser = {
            id: Date.now().toString(),
            name: randomRealUser.name, // TÊN THẬT
            avatarUrl: randomRealUser.avatarUrl, // ẢNH THẬT
            noelAvatar: randomRealUser.noelEmoji || "🎅",
            checkinTime: new Date().toLocaleTimeString('vi-VN'),
          };
      } else {
          // Fallback nếu DB trống
          const mockNames = ["Tuần Lộc Nhỏ", "Bà Noel", "Cậu Bé Tuyết", "Chú Lính Chì", "Công Chúa Tuyết"];
          const mockAvatars = ["🦌", "🤶", "⛄", "💂", "👸"];
          const randomIdx = Math.floor(Math.random() * mockNames.length);
          mockUser = {
            id: Date.now().toString(),
            name: mockNames[randomIdx],
            noelAvatar: mockAvatars[randomIdx],
            checkinTime: new Date().toLocaleTimeString('vi-VN'),
          };
      }
      
      // Tự động đẩy người mới vào danh sách bên phải
      setRecentCheckins(prev => [mockUser, ...prev].slice(0, 5));
      setPeopleCount(prev => prev + Math.floor(Math.random() * 3) - 1 > 0 ? prev + 1 : prev);
    }, 6000); // 6 giây hiện 1 người

    return () => clearInterval(interval);
  }, [registeredUsers]); // Chạy lại khi danh sách user thật thay đổi

  return (
    <div className="min-h-screen bg-black text-white p-6 relative overflow-hidden flex flex-col">
      <SnowEffect />
      <RealtimeCounter count={peopleCount} />

    

      {/* Header */}
      <div className="z-10 text-center mb-8 pt-4">
        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-green-500 to-red-500 drop-shadow-lg">
          SMART NOEL DASHBOARD
        </h1>
        <p className="text-green-400 mt-2 font-mono text-sm tracking-widest animate-pulse">
          ● LIVE SYSTEM ACTIVE
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 z-10 max-w-7xl mx-auto w-full">
        
        {/* Left: AI Camera View (Realtime Video) */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-gray-900/80 backdrop-blur-md rounded-3xl border border-gray-700 p-2 h-[500px] relative overflow-hidden group shadow-2xl shadow-green-900/20">
            
            {/* VIDEO FEED */}
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover rounded-2xl transform scale-x-[-1]" 
            />
            
            {/* Hiệu ứng thanh quét AI */}
            <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden">
                <div className="absolute left-0 w-full h-1 bg-green-500/80 shadow-[0_0_20px_#22c55e] scan-line z-20"></div>
                {/* Grid Overlay mờ mờ */}
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10 z-10"></div>
            </div>

            {/* Overlay thông tin góc cam */}
            <div className="absolute top-4 left-4 bg-black/70 px-4 py-2 rounded-lg text-xs font-mono text-green-400 border border-green-500/30 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              CAM_01 • DETECTING FACE...
            </div>
            
            {/* Khung Focus giả lập (ở giữa màn hình) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-green-500/30 rounded-lg pointer-events-none">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-green-500"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-green-500"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-green-500"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-green-500"></div>
            </div>

            <div className="absolute bottom-4 right-4 flex gap-2 items-center bg-black/60 px-3 py-1 rounded-full">
               <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
               <span className="text-xs font-bold text-red-500 tracking-wider">REC</span>
            </div>
          </div>
          
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-red-900/10 border border-red-500/20 p-4 rounded-2xl text-center backdrop-blur-sm">
              <div className="text-3xl font-black text-red-500">{peopleCount}</div>
              <div className="text-xs text-red-300 opacity-60 font-bold tracking-widest">VISITORS</div>
            </div>
            <div className="bg-green-900/10 border border-green-500/20 p-4 rounded-2xl text-center backdrop-blur-sm">
              <div className="text-3xl font-black text-green-500">99%</div>
              <div className="text-xs text-green-300 opacity-60 font-bold tracking-widest">ACCURACY</div>
            </div>
            <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-2xl text-center backdrop-blur-sm">
              <div className="text-3xl font-black text-blue-500">Active</div>
              <div className="text-xs text-blue-300 opacity-60 font-bold tracking-widest">STATUS</div>
            </div>
          </div>
        </div>

        {/* Right: Recent Check-ins */}
        <div className="flex flex-col h-full bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
            <span className="text-2xl">🎅</span> 
            <span>Danh sách Check-in</span>
            <span className="ml-auto text-xs bg-green-600 px-2 py-1 rounded text-white animate-pulse">Live</span>
          </h2>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 max-h-[600px] scrollbar-hide">
            {recentCheckins.map((user) => (
              <CheckinCard key={user.id} user={user} />
            ))}
            
            {recentCheckins.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-gray-500 italic">
                <span className="text-4xl mb-2">❄️</span>
                Đang chờ khách đầu tiên...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}