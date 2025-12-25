// server.js - Integrasi dengan n8n Workflow (Workflow 2: WebApp → Pinecone)

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// ⚠️ KONFIGURASI SUPABASE - GANTI DENGAN CREDENTIALS ANDA!
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rdzhrqesxkvtyefwmtdv.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_secret_dD4r-bDsyB51_KZkHkcuig_urMyZIyL';

// Inisialisasi Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Konfigurasi multer untuk file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: function (req, file, cb) {
    // Hanya terima file tertentu
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|md/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('File type tidak didukung! Hanya jpeg, jpg, png, gif, pdf, doc, docx, txt, md yang diperbolehkan.'));
    }
  },
});

// ⚠️ GANTI DENGAN URL WEBHOOK N8N ANDA YANG AKTIF!
// Berdasarkan workflow JSON, webhook path adalah: /rag-integration
// Format lengkap: https://your-n8n-instance.com/webhook/rag-integration
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://clelia-gladiolar-paulene.ngrok-free.dev/webhook/rag-integration';

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Menyajikan file statis dari folder 'public'
app.use(express.static('public'));

// Endpoint yang dipanggil dari frontend (index.html)
// Mengikuti workflow: Webhook → Norm WebApp → Supabase → AI Agent → Respond to Webhook
app.post('/ask', async (req, res) => {
  // Ambil data dari request body sesuai format workflow
  const { question, user_id, session_id } = req.body;

  console.log('🟦 Request diterima dari WebApp:');
  console.log('   - Question:', question);
  console.log('   - User ID:', user_id);
  console.log('   - Session ID:', session_id);

  // Validasi
  if (!question || !question.toString().trim()) {
    return res.status(400).json({
      success: false,
      error: 'Pertanyaan tidak boleh kosong.',
    });
  }

  if (!user_id || !user_id.toString().trim()) {
    return res.status(400).json({
      success: false,
      error: 'User ID diperlukan dan tidak boleh kosong.',
    });
  }

  // Session ID wajib ada (tidak boleh null)
  // Jika tidak ada, generate UUID baru
  let finalSessionId = session_id;
  if (!finalSessionId || !finalSessionId.toString().trim()) {
    // Generate UUID v4 sebagai fallback
    finalSessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    console.log('⚠️  Session ID tidak ada, generate baru:', finalSessionId);
  }

  try {
    // Kirim ke n8n webhook sesuai format workflow
    // Workflow mengharapkan: { question, user_id, session_id }
    // Workflow akan set source: "web" secara otomatis di node "Norm WebApp"
    // IMPORTANT: Semua field harus string, bukan null
    const requestBody = {
      question: question.toString().trim(),
      user_id: user_id.toString().trim(),
      session_id: finalSessionId.toString().trim(), // WAJIB string, tidak boleh null
      source: 'webapp', // beri tahu n8n sumber berasal dari webapp; kirim sebagai JSON (bukan binary)
    };

    console.log('🟨 Mengirim request ke n8n:', JSON.stringify(requestBody, null, 2));

    // Pastikan kita mengirim JSON murni (string) agar n8n webhook auto-parse.
    // Jangan kirim file/binary ke webhook — biarkan n8n auto-parse JSON body di Webhook node.
    const axiosResp = await axios.post(
      N8N_WEBHOOK_URL,
      JSON.stringify(requestBody),
      {
        timeout: 60000, // 60 detik timeout (AI Agent mungkin butuh waktu lebih lama)
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('🟩 Status dari n8n:', axiosResp.status);
    console.log('🟩 Headers dari n8n:', axiosResp.headers && axiosResp.headers['content-type']);
    console.log('🟩 Body (raw) dari n8n:', JSON.stringify(axiosResp.data, null, 2));

    let answer = null;

    // --- Resilient parse: coba ambil jawaban dari berbagai properti ---
    // Workflow mengembalikan response dari "Respond to Webhook" node
    // Format yang diharapkan: { answer: "string" } atau { output: "string" }
    if (axiosResp.data && typeof axiosResp.data === 'object') {
      // Format utama yang diharapkan dari Respond to Webhook
      if (typeof axiosResp.data.answer === 'string') {
        answer = axiosResp.data.answer;
      } else if (typeof axiosResp.data.response === 'string') {
        answer = axiosResp.data.response;
      } else if (typeof axiosResp.data.output === 'string') {
        answer = axiosResp.data.output;
      } else if (axiosResp.data.data && typeof axiosResp.data.data === 'string') {
        answer = axiosResp.data.data;
      } else if (axiosResp.data.answer && typeof axiosResp.data.answer === 'object') {
        // Jika answer adalah object, extract string dari object
        answer = axiosResp.data.answer.text || axiosResp.data.answer.content || JSON.stringify(axiosResp.data.answer);
      } else if (axiosResp.data.output && typeof axiosResp.data.output === 'object') {
        // Jika output adalah object, extract string dari object
        answer = axiosResp.data.output.text || axiosResp.data.output.content || JSON.stringify(axiosResp.data.output);
      } else if (Array.isArray(axiosResp.data) && axiosResp.data.length > 0) {
        // Jika response berupa array, ambil item pertama
        const firstItem = axiosResp.data[0];
        if (typeof firstItem === 'string') {
          answer = firstItem;
        } else if (firstItem && typeof firstItem.answer === 'string') {
          answer = firstItem.answer;
        } else if (firstItem && typeof firstItem.output === 'string') {
          answer = firstItem.output;
        } else if (firstItem && typeof firstItem.answer === 'object') {
          answer = firstItem.answer.text || firstItem.answer.content || JSON.stringify(firstItem.answer);
        } else if (firstItem && typeof firstItem.output === 'object') {
          answer = firstItem.output.text || firstItem.output.content || JSON.stringify(firstItem.output);
        }
      }
    }

    // Jika tetap belum ketemu, stringify seluruh respons supaya tetap ada yang ditampilkan
    if (!answer) {
      if (typeof axiosResp.data === 'string') {
        answer = axiosResp.data;
      } else {
        // Coba extract dari nested object
        const dataStr = JSON.stringify(axiosResp.data, null, 2);
        answer = dataStr.length > 1000 ? dataStr.substring(0, 1000) + '...' : dataStr;
      }

      console.log('⚠️  Format response tidak dikenali, menggunakan raw data');
      console.log('⚠️  Raw response:', JSON.stringify(axiosResp.data, null, 2));
    }

    // Pastikan answer adalah string (bukan null/undefined)
    if (!answer || typeof answer !== 'string') {
      answer = 'Maaf, terjadi kesalahan saat memproses jawaban. Silakan coba lagi.';
      console.error('❌ Answer tidak valid setelah parsing:', answer);
    }

    // Kembalikan jawaban ke frontend
    return res.json({
      success: true,
      reply: answer,
    });
  } catch (err) {
    console.error('❌ Error saat memanggil n8n:', err.message);

    if (err.response) {
      console.error('❌ Response status dari n8n:', err.response.status);
      console.error('❌ Response body dari n8n:', JSON.stringify(err.response.data, null, 2));

      return res.status(err.response.status || 500).json({
        success: false,
        error: 'Gagal memproses permintaan ke n8n.',
        detail: err.response.data || err.message,
      });
    } else if (err.request) {
      console.error('❌ Tidak ada response (request dibuat, tapi tidak ada respons)');
      console.error('❌ Request config:', err.config);

      return res.status(503).json({
        success: false,
        error: 'Tidak dapat terhubung ke n8n. Pastikan webhook URL benar dan n8n workflow aktif.',
        detail: err.message,
      });
    } else {
      console.error('❌ Error lainnya:', err);

      return res.status(500).json({
        success: false,
        error: 'Terjadi kesalahan internal.',
        detail: err.message,
      });
    }
  }
});

// Endpoint untuk mendapatkan riwayat chat dari Supabase
app.get('/api/history', async (req, res) => {
  const { user_id, session_id, limit = 50 } = req.query;

  try {
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'User ID diperlukan.',
      });
    }

    // Query ke Supabase
    let query = supabase.from('chat_history').select('id, user_id, session_id, question, answer, created_at').eq('user_id', user_id).order('created_at', { ascending: false }).limit(parseInt(limit));

    // Filter by session_id jika ada
    if (session_id) {
      query = query.eq('session_id', session_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error dari Supabase:', error);
      return res.status(500).json({
        success: false,
        error: 'Gagal mengambil riwayat chat.',
        detail: error.message,
      });
    }

    return res.json({
      success: true,
      data: data || [],
      count: data ? data.length : 0,
    });
  } catch (err) {
    console.error('❌ Error saat mengambil riwayat:', err);
    return res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan saat mengambil riwayat.',
      detail: err.message,
    });
  }
});

// Endpoint untuk upload file
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Tidak ada file yang diupload.',
      });
    }

    const { user_id, session_id } = req.body;

    if (!user_id) {
      // Hapus file jika user_id tidak ada
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'User ID diperlukan.',
      });
    }

    // Informasi file
    const fileInfo = {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      user_id: user_id,
      session_id: session_id || null,
      uploaded_at: new Date().toISOString(),
    };

    console.log('📁 File diupload:', fileInfo);

    // TODO: Bisa dikirim ke n8n untuk processing atau disimpan ke Supabase Storage
    // Untuk sekarang, hanya return info file

    return res.json({
      success: true,
      file: {
        filename: fileInfo.filename,
        originalname: fileInfo.originalname,
        mimetype: fileInfo.mimetype,
        size: fileInfo.size,
        url: `/uploads/${fileInfo.filename}`, // URL untuk akses file
      },
    });
  } catch (err) {
    console.error('❌ Error saat upload file:', err);

    // Hapus file jika ada error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error('❌ Error saat menghapus file:', unlinkErr);
      }
    }

    return res.status(500).json({
      success: false,
      error: 'Gagal mengupload file.',
      detail: err.message,
    });
  }
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    webhook_url: N8N_WEBHOOK_URL,
    supabase_configured: !!SUPABASE_URL && SUPABASE_URL !== 'https://your-project.supabase.co',
  });
});

app.listen(port, () => {
  console.log('='.repeat(60));
  console.log(`🚀 WebApp berjalan di http://localhost:${port}`);
  console.log(`🔗 Webhook n8n: ${N8N_WEBHOOK_URL}`);
  console.log('📋 Workflow: WebApp → Workflow 2 → Pinecone RAG');
  console.log('='.repeat(60));
  console.log('\n⚠️  PASTIKAN:');
  console.log('   1. N8N workflow sudah aktif');
  console.log('   2. Webhook URL sudah benar (path: /rag-integration)');
  console.log('   3. Environment variable N8N_WEBHOOK_URL sudah di-set (opsional)\n');
});


app.get('/history/:userId', async (req, res) => {
    const { userId } = req.params;
  
    try {
      const { data, error } = await supabase
        .from('chat_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
  
      if (error) throw error;
  
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  