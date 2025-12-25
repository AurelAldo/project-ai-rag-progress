# 📋 Setup Guide - Upload File & Riwayat Chat

## ✅ Fitur yang Ditambahkan

1. **Upload File**: User dapat mengupload file (PDF, DOC, DOCX, TXT, MD, JPG, PNG, GIF)
2. **Riwayat Chat**: User dapat melihat riwayat chat dari Supabase
3. **Akses Supabase**: Server.js terhubung langsung ke Supabase untuk membaca riwayat

---

## 🔧 Instalasi Dependencies

Jalankan command berikut untuk install dependencies baru:

```bash
npm install
```

Dependencies yang ditambahkan:
- `@supabase/supabase-js`: Untuk akses Supabase
- `multer`: Untuk handle file upload

---

## ⚙️ Konfigurasi

### 1. Supabase Configuration

Edit `server.js` dan set environment variables atau langsung edit di code:

```javascript
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key-here';
```

**Cara mendapatkan credentials:**
1. Buka Supabase Dashboard
2. Pilih project Anda
3. Settings → API
4. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon/public key** → `SUPABASE_ANON_KEY`

**Atau set via environment variables:**
```bash
# Windows (PowerShell)
$env:SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_ANON_KEY="your-anon-key"

# Linux/Mac
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
```

### 2. Pastikan Table Supabase Benar

Table `chat_history` harus memiliki struktur:

```sql
CREATE TABLE chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index untuk performa query
CREATE INDEX idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX idx_chat_history_session_id ON chat_history(session_id);
CREATE INDEX idx_chat_history_created_at ON chat_history(created_at DESC);
```

---

## 📁 Struktur File Upload

File yang diupload akan disimpan di folder `uploads/` di root project.

**Pastikan folder `uploads/` ada:**
- Folder akan dibuat otomatis saat pertama kali upload
- File disimpan dengan format: `timestamp-random.ext`

**File yang didukung:**
- Documents: PDF, DOC, DOCX, TXT, MD
- Images: JPG, JPEG, PNG, GIF
- Max size: 10MB

---

## 🚀 Cara Menggunakan

### 1. Upload File

1. Klik tombol **📎** (paperclip icon) di input area
2. Pilih file yang ingin diupload
3. File akan muncul di atas input area
4. Ketik pesan (opsional) atau kirim langsung
5. Klik tombol **Send** untuk mengirim

### 2. Lihat Riwayat Chat

1. Klik tombol **📋** (history icon) di header
2. Sidebar akan muncul di kanan
3. Klik salah satu item riwayat untuk memuat ke chat area
4. Klik **X** atau klik di luar sidebar untuk menutup

---

## 🔌 API Endpoints

### 1. GET `/api/history`

Mengambil riwayat chat dari Supabase.

**Query Parameters:**
- `user_id` (required): User ID
- `session_id` (optional): Filter by session ID
- `limit` (optional): Max number of items (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "string",
      "session_id": "string",
      "question": "string",
      "answer": "string",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 10
}
```

### 2. POST `/api/upload`

Upload file ke server.

**Form Data:**
- `file` (required): File yang diupload
- `user_id` (required): User ID
- `session_id` (optional): Session ID

**Response:**
```json
{
  "success": true,
  "file": {
    "filename": "1234567890-123456789.ext",
    "originalname": "document.pdf",
    "mimetype": "application/pdf",
    "size": 1024,
    "url": "/uploads/1234567890-123456789.ext"
  }
}
```

---

## 🧪 Testing

### Test Upload File

1. Buka webapp
2. Klik tombol upload (📎)
3. Pilih file (PDF, DOC, atau image)
4. File akan muncul di atas input
5. Ketik pesan dan kirim
6. Cek console server untuk melihat log upload

### Test Riwayat Chat

1. Kirim beberapa pesan terlebih dahulu
2. Klik tombol riwayat (📋) di header
3. Pastikan riwayat muncul di sidebar
4. Klik salah satu item untuk memuat ke chat area

### Test Supabase Connection

1. Cek console server saat startup
2. Pastikan tidak ada error Supabase
3. Test endpoint: `GET http://localhost:3000/api/history?user_id=YOUR_USER_ID`
4. Pastikan response berisi data dari Supabase

---

## ⚠️ Troubleshooting

### Error: "Supabase client not initialized"

**Solusi**: Pastikan `SUPABASE_URL` dan `SUPABASE_ANON_KEY` sudah di-set dengan benar.

### Error: "relation 'chat_history' does not exist"

**Solusi**: Pastikan table `chat_history` sudah dibuat di Supabase dengan struktur yang benar.

### Error: "File upload failed"

**Solusi**: 
- Cek ukuran file (max 10MB)
- Cek tipe file (hanya PDF, DOC, DOCX, TXT, MD, JPG, PNG, GIF)
- Pastikan folder `uploads/` bisa diakses (permissions)

### Riwayat tidak muncul

**Solusi**:
- Pastikan `user_id` di localStorage sama dengan yang di Supabase
- Cek console browser untuk error
- Cek console server untuk error Supabase
- Pastikan ada data di table `chat_history` dengan `user_id` yang sesuai

---

## 📝 Catatan Penting

1. **File Upload**: File disimpan di server lokal (folder `uploads/`). Untuk production, pertimbangkan menggunakan Supabase Storage atau cloud storage lainnya.

2. **Security**: 
   - File upload hanya menerima tipe file tertentu
   - Max file size: 10MB
   - File disimpan dengan nama random untuk mencegah conflict

3. **Supabase RLS (Row Level Security)**: 
   - Pastikan RLS policy di Supabase mengizinkan read untuk `chat_history` table
   - Atau gunakan service role key untuk bypass RLS (tidak disarankan untuk production)

4. **Performance**: 
   - Riwayat dibatasi 50 item default
   - Bisa diubah via query parameter `limit`

---

## 🔄 Next Steps (Opsional)

1. **Integrasi dengan n8n untuk file processing**: Kirim file ke n8n untuk extract text atau process
2. **Supabase Storage**: Simpan file ke Supabase Storage instead of local storage
3. **Pagination**: Tambahkan pagination untuk riwayat chat
4. **Search**: Tambahkan fitur search di riwayat
5. **Export**: Tambahkan fitur export riwayat ke PDF/CSV

