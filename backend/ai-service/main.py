import face_recognition
import cv2
import numpy as np
import firebase_admin
from firebase_admin import credentials, firestore
from flask import Flask, request, jsonify
from flask_cors import CORS
import urllib.request
import ssl
import os

# --- CẤU HÌNH ---
app = Flask(__name__)
# Cho phép mọi nguồn (CORS) để Frontend/Nodejs gọi vào dễ dàng
CORS(app, resources={r"/*": {"origins": "*"}})

print("🔥 Đang khởi động AI Service...")

# 1. KẾT NỐI FIREBASE
# Đường dẫn trỏ ra thư mục cha để lấy file key
cred_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "serviceAccountKey.json")

try:
    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    print(f"✅ Firebase connected successfully! Key path: {cred_path}")
except Exception as e:
    print(f"❌ Firebase Connect Error. Kiểm tra lại đường dẫn file key!\nPath: {cred_path}\nError: {e}")
    exit(1) # Dừng chương trình nếu không kết nối được

# 2. BỘ NHỚ TẠM (RAM) ĐỂ LƯU KHUÔN MẶT
# Giúp nhận diện cực nhanh, không cần đọc DB mỗi lần
KNOWN_FACES_ENCODINGS = []   # Chứa vector 128 chiều của khuôn mặt
KNOWN_FACES_METADATA = []    # Chứa thông tin (tên, avatar...) tương ứng

# Sửa lỗi SSL khi tải ảnh từ một số nguồn (tùy chọn)
ssl._create_default_https_context = ssl._create_unverified_context

def reload_database_internal():
    """Hàm nội bộ: Tải dữ liệu từ Firestore và học khuôn mặt"""
    global KNOWN_FACES_ENCODINGS, KNOWN_FACES_METADATA
    
    print("\n🔄 BẮT ĐẦU ĐỒNG BỘ DỮ LIỆU TỪ FIREBASE...")
    try:
        # Chỉ lấy những user có avatarUrl
        users_ref = db.collection('users').where(u'avatarUrl', u'!=', None)
        docs = users_ref.stream()
        
        new_encodings = []
        new_metadata = []
        count_success = 0
        count_fail = 0

        print("   Đang tải và xử lý ảnh...")
        for doc in docs:
            data = doc.to_dict()
            name = data.get('name', 'Unknown User')
            img_url = data.get('avatarUrl')
            
            try:
                # Tải ảnh từ URL về bộ nhớ đệm (không lưu file)
                with urllib.request.urlopen(img_url, timeout=10) as resp:
                    image_array = np.asarray(bytearray(resp.read()), dtype="uint8")
                    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
                    
                    # Chuyển sang RGB (face_recognition yêu cầu RGB)
                    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                    
                    # Tìm và mã hóa khuôn mặt (Face Encoding)
                    # model='hog' nhanh hơn, 'cnn' chính xác hơn nhưng cần GPU
                    encodings = face_recognition.face_encodings(rgb_image, model='hog')
                    
                    if len(encodings) > 0:
                        # Chỉ lấy khuôn mặt đầu tiên tìm thấy trong ảnh đăng ký
                        new_encodings.append(encodings[0])
                        # Lưu metadata để trả về khi nhận diện được
                        new_metadata.append({
                            "id": doc.id,
                            "name": name,
                            "noelEmoji": data.get('noelEmoji', '🎄'),
                            "avatarUrl": img_url
                        })
                        print(f"   ✅ [OK] Đã học: {name}")
                        count_success += 1
                    else:
                        print(f"   ⚠️ [SKIP] Không thấy mặt trong ảnh của: {name}")
                        count_fail += 1
            except Exception as e:
                print(f"   ❌ [ERROR] Lỗi xử lý {name}: {str(e)}")
                count_fail += 1

        # Cập nhật vào biến toàn cục
        KNOWN_FACES_ENCODINGS = new_encodings
        KNOWN_FACES_METADATA = new_metadata
        print(f"🎉 HOÀN TẤT ĐỒNG BỘ! Đã học {count_success} khuôn mặt. (Lỗi/Bỏ qua: {count_fail})\n")
        return count_success

    except Exception as e:
        print(f"❌ Lỗi nghiêm trọng khi đồng bộ database: {e}")
        return 0

# --- CÁC API ENDPOINTS ---

@app.route('/', methods=['GET'])
def health_check():
    """API kiểm tra server còn sống không"""
    return jsonify({
        "status": "AI Service is Running",
        "loaded_faces": len(KNOWN_FACES_ENCODINGS)
    })

@app.route('/reload', methods=['GET', 'POST'])
def api_reload():
    """API để Frontend/Nodejs gọi kích hoạt việc học lại dữ liệu"""
    count = reload_database_internal()
    return jsonify({"status": "success", "message": "Database reloaded", "count": count})

@app.route('/detect', methods=['POST'])
def api_detect():
    """API nhận diện khuôn mặt từ ảnh gửi lên"""
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
         return jsonify({"error": "No selected file"}), 400

    try:
        # 1. Đọc ảnh upload từ form-data
        img_bytes = file.read()
        np_arr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        # Resize nhỏ lại để tăng tốc độ nhận diện (tùy chọn)
        # img = cv2.resize(img, (0, 0), fx=0.5, fy=0.5)
        
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # 2. Tìm vị trí tất cả khuôn mặt trong ảnh
        face_locations = face_recognition.face_locations(rgb_img, model='hog')
        
        # 3. Mã hóa các khuôn mặt tìm thấy
        face_encodings = face_recognition.face_encodings(rgb_img, face_locations)

        results = []

        # 4. So sánh từng mặt tìm được với database trong RAM
        for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
            name = "Người lạ"
            info = {}
            confidence = 0.0
            
            if len(KNOWN_FACES_ENCODINGS) > 0:
                # Tính khoảng cách (sai số) giữa mặt hiện tại và tất cả mặt đã biết
                face_distances = face_recognition.face_distance(KNOWN_FACES_ENCODINGS, face_encoding)
                
                # Tìm người có sai số nhỏ nhất (giống nhất)
                best_match_index = np.argmin(face_distances)
                distance = face_distances[best_match_index]
                
                # Ngưỡng chấp nhận: 0.5 (càng nhỏ càng khắt khe). 
                # Nếu sai số < 0.5 thì coi là nhận diện thành công.
                if distance < 0.5:
                    name = KNOWN_FACES_METADATA[best_match_index]["name"]
                    info = KNOWN_FACES_METADATA[best_match_index]
                    # Tính độ tin cậy giả định (chỉ để tham khảo)
                    confidence = round((1.0 - distance) * 100, 2)

            results.append({
                "name": name,
                "confidence": confidence,
                "box": [top, right, bottom, left], # Trả về tọa độ để vẽ khung (nếu cần)
                "info": info # Trả về đầy đủ thông tin (avatar, id...)
            })

        return jsonify({"count": len(results), "matches": results})

    except Exception as e:
        print(f"Lỗi khi nhận diện: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Chạy lần đầu khi khởi động server
    reload_database_internal()
    
    # Chạy server Flask tại port 5001
    # host='0.0.0.0' để các máy khác trong mạng LAN có thể gọi vào
    print("🚀 AI Service đang chạy trên cổng 5001...")
    app.run(host='0.0.0.0', port=5001, debug=False)