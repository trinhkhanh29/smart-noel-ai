const admin = require('firebase-admin');
const path = require('path');

// Đường dẫn đến file khóa serviceAccountKey.json
// Dùng path.join và __dirname để đảm bảo đường dẫn luôn đúng
const serviceAccountPath = path.join(__dirname, '../../firebase_credentials.json');

let db; // Biến để lưu kết nối Firestore

const initializeFirebase = () => {
  try {
    // Kiểm tra xem đã khởi tạo chưa để tránh khởi tạo lại nhiều lần
    if (admin.apps.length === 0) {
      const serviceAccount = require(serviceAccountPath);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        // Nếu bạn cần dùng Storage từ backend thì thêm dòng dưới (tùy chọn)
        // storageBucket: 'tên-project-của-bạn.appspot.com'
      });

      console.log("🔥 Firebase Admin initialized successfully!");
    } else {
      console.log("⚠️ Firebase Admin already initialized.");
    }

    // Lấy instance của Firestore
    db = admin.firestore();
    return db;

  } catch (error) {
    console.error("❌ Error initializing Firebase Admin:", error);
    // Nếu lỗi khởi tạo thì nên dừng chương trình để báo động
    process.exit(1);
  }
};

// Hàm tiện ích để lấy DB instance ở các file khác
const getDB = () => {
  if (!db) {
    throw new Error("Firestore DB has not been initialized. Call initializeFirebase() first.");
  }
  return db;
};

// Export các hàm cần thiết
module.exports = {
  initializeFirebase,
  getDB,
  admin // Export luôn object admin nếu cần dùng các dịch vụ khác (Auth, Messaging...)
};