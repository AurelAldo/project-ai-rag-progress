document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatArea = document.getElementById('chatArea');

    // Fungsi untuk menambahkan pesan ke area chat
    const addMessage = (text, sender) => {
        const messageContainer = document.createElement('div');
        messageContainer.className = sender === 'user' ? "user-message" : "ai-message";

        // Sanitasi teks untuk mencegah XSS sederhana (walaupun ini bukan solusi lengkap)
        const safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        // Mengganti baris baru (\n) dengan <br> agar respons multi-baris terlihat bagus
        const formattedText = safeText.replace(/\n/g, '<br>');

        messageContainer.innerHTML = `
            <div class="max-w-lg p-3 sm:p-4 rounded-xl ${
                sender === 'user'
                    ? 'rounded-br-none bg-chat-user text-white shadow-lg'
                    : 'rounded-tl-none bg-chat-ai text-gray-800 border border-gray-100 shadow-md'
            }">
                ${formattedText}
            </div>
        `;

        chatArea.appendChild(messageContainer);
        // Otomatis scroll ke bawah
        chatArea.scrollTop = chatArea.scrollHeight;
    };

    // Fungsi utama untuk mengirim pesan
    const handleSend = async () => {
        const text = userInput.value.trim();
        if (!text) return;

        // 1. Tambahkan pesan user ke UI
        addMessage(text, 'user');

        // Reset input
        userInput.value = '';
        adjustTextareaHeight();

        // Nonaktifkan tombol dan tambahkan indikator loading
        sendBtn.disabled = true;

        try {
            // 🔥 Kirim pesan ke server.js endpoint /ask
            const response = await fetch('/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            // Cek status HTTP
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Server Error (${response.status}): ${errorData.error || errorData.detail}`);
            }

            const result = await response.json();
            
            // Logika server.js mengembalikan { success: true, reply: "..." }
            if (result.success && result.reply) {
                // 2. Tambahkan jawaban dari server (n8n) ke UI
                addMessage(result.reply, 'ai');
            } else {
                console.error("Respons berhasil, tapi tidak ada properti 'reply':", result);
                addMessage("⚠️ Respons tidak terformat dengan benar dari server.", 'ai');
            }

        } catch (err) {
            console.error('❌ Error saat memproses chat:', err);
            addMessage(`❌ Terjadi error koneksi atau server: ${err.message || 'Cek console server/browser Anda.'}`, 'ai');
        }

        // Aktifkan kembali tombol
        sendBtn.disabled = false;
    };

    // Fungsi untuk mengatur tinggi textarea secara otomatis
    const adjustTextareaHeight = () => {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
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
});