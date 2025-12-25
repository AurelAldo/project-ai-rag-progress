document.addEventListener('DOMContentLoaded', () => {
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const chatArea = document.getElementById('chatArea');
  const fileInput = document.getElementById('fileInput');
  const fileBtn = document.getElementById('fileBtn');
  const fileUploadArea = document.getElementById('fileUploadArea');
  const fileName = document.getElementById('fileName');
  const removeFileBtn = document.getElementById('removeFileBtn');
  // History/sidebar elements removed (Supabase/workflow)

  let selectedFile = null;

  // Generate unique user_id dan session_id menggunakan UUID
  // User ID: tetap sama selama user menggunakan browser yang sama
  // Session ID: tetap sama selama session (bisa diubah jika perlu reset)
  let userId = localStorage.getItem('userId');
  let sessionId = localStorage.getItem('sessionId');

  // Jika belum ada, generate UUID baru
  if (!userId) {
    // Gunakan crypto.randomUUID() jika tersedia (browser modern)
    // Fallback ke format UUID v4 manual jika tidak tersedia
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      userId = crypto.randomUUID();
    } else {
      // Fallback: generate UUID v4 format
      userId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
    localStorage.setItem('userId', userId);
  }

  if (!sessionId) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      sessionId = crypto.randomUUID();
    } else {
      sessionId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
    localStorage.setItem('sessionId', sessionId);
  }

  // Log untuk debugging (bisa dihapus di production)
  console.log('👤 User ID:', userId);
  console.log('📋 Session ID:', sessionId);

  // Fungsi untuk menambahkan pesan ke area chat
  const addMessage = (text, sender, isLoading = false) => {
    const messageContainer = document.createElement('div');
    messageContainer.className = sender === 'user' ? 'user-message' : 'ai-message';

    if (isLoading) {
      // Tampilkan loading indicator
      messageContainer.innerHTML = `
                <div class="flex gap-4 max-w-3xl mx-auto w-full">
                    <div class="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                        AI
                    </div>
                    <div class="flex-grow">
                        <div class="loading-indicator p-4">
                            <div class="loading-dot"></div>
                            <div class="loading-dot"></div>
                            <div class="loading-dot"></div>
                        </div>
                    </div>
                </div>
            `;
    } else {
      // Sanitasi teks untuk mencegah XSS sederhana
      const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      // Mengganti baris baru (\n) dengan <br> agar respons multi-baris terlihat bagus
      const formattedText = safeText.replace(/\n/g, '<br>');

      if (sender === 'user') {
        messageContainer.innerHTML = `
                    <div class="flex gap-4 max-w-3xl mx-auto w-full justify-end">
                        <div class="flex-grow max-w-[85%]">
                            <div class="bg-primary text-white p-4 rounded-lg rounded-tr-none">
                                <div class="prose prose-invert max-w-none text-white">
                                    ${formattedText}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
      } else {
        messageContainer.innerHTML = `
                    <div class="flex gap-4 max-w-3xl mx-auto w-full">
                        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                            AI
                        </div>
                        <div class="flex-grow">
                            <div class="prose prose-invert max-w-none text-text-primary leading-relaxed">
                                ${formattedText}
                            </div>
                        </div>
                    </div>
                `;
      }
    }

    chatArea.appendChild(messageContainer);
    // Otomatis scroll ke bawah
    chatArea.scrollTop = chatArea.scrollHeight;

    return messageContainer;
  };

  // Fungsi utama untuk mengirim pesan (dengan support file upload)
  const handleSend = async () => {
    let text = userInput.value.trim();
    
    // Jika ada file, upload dulu
    if (selectedFile) {
      try {
        sendBtn.disabled = true;
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('user_id', userId);
        formData.append('session_id', sessionId);

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const uploadResult = await uploadResponse.json();

        if (!uploadResult.success) {
          addMessage(`❌ Gagal mengupload file: ${uploadResult.error}`, 'ai');
          sendBtn.disabled = false;
          return;
        }

        // Tambahkan info file ke pesan jika text kosong
        if (!text) {
          text = `📎 File: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(2)} KB)`;
        } else {
          text = `📎 File: ${selectedFile.name}\n\n${text}`;
        }

        // Reset file selection
        selectedFile = null;
        fileInput.value = '';
        fileUploadArea.classList.add('hidden');
      } catch (err) {
        console.error('❌ Error saat upload file:', err);
        addMessage(`❌ Error saat mengupload file: ${err.message}`, 'ai');
        sendBtn.disabled = false;
        return;
      }
    }

    if (!text) return;

    // 1. Tambahkan pesan user ke UI
    addMessage(text, 'user');

    // Reset input
    userInput.value = '';
    adjustTextareaHeight();

    // Nonaktifkan tombol dan tambahkan indikator loading
    sendBtn.disabled = true;

    // Tambahkan loading indicator
    const loadingMessage = addMessage('', 'ai', true);

    try {
      // 🔥 Kirim pesan ke server.js endpoint /ask
      // Server akan mengirim ke n8n webhook dengan format yang sesuai workflow
      const response = await fetch('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          user_id: userId,
          session_id: sessionId,
        }),
      });

      // Hapus loading indicator
      loadingMessage.remove();

      // Cek status HTTP
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Server Error (${response.status}): ${errorData.error || errorData.detail || 'Unknown error'}`);
      }

      const result = await response.json();

      // Logika server.js mengembalikan { success: true, reply: "..." }
      if (result.success && result.reply) {
        // 2. Tambahkan jawaban dari server ke UI
        addMessage(result.reply, 'ai');
      } else {
        console.error("Respons berhasil, tapi tidak ada properti 'reply':", result);
        addMessage('⚠️ Respons tidak terformat dengan benar dari server. Silakan coba lagi.', 'ai');
      }
    } catch (err) {
      // Hapus loading indicator jika masih ada
      if (loadingMessage && loadingMessage.parentNode) {
        loadingMessage.remove();
      }

      console.error('❌ Error saat memproses chat:', err);
      addMessage(`❌ Terjadi error: ${err.message || 'Gagal terhubung ke server. Silakan coba lagi.'}`, 'ai');
    }

    // Aktifkan kembali tombol
    sendBtn.disabled = false;
  };

  // Fungsi untuk mengatur tinggi textarea secara otomatis
  const adjustTextareaHeight = () => {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 200) + 'px';
  };

  // Event Listeners
  sendBtn.addEventListener('click', handleSend);

  userInput.addEventListener('keydown', (e) => {
    // Kirim jika Enter ditekan TANPA Shift
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  userInput.addEventListener('input', adjustTextareaHeight);
  adjustTextareaHeight();

  // Focus pada input saat halaman dimuat
  userInput.focus();

  // ========== FILE UPLOAD FUNCTIONALITY ==========
  fileBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      selectedFile = file;
      fileName.textContent = file.name;
      fileUploadArea.classList.remove('hidden');
    }
  });

  removeFileBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    fileUploadArea.classList.add('hidden');
  });

  // (History/Supabase-related UI and functions removed)

});
