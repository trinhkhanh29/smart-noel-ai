import { io } from 'socket.io-client';

// Kết nối tới Backend (mặc định localhost:5000 nếu không có biến môi trường)
// Khi deploy lên Render/Vercel sẽ dùng biến môi trường NEXT_PUBLIC_API_URL
const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  autoConnect: true,
  reconnection: true,
});