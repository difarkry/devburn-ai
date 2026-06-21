const messagesEl = document.getElementById('chat-messages');
const inputEl = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

document.getElementById('logout-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  await apiFetch('/auth/logout', { method: 'POST' });
  window.location.href = 'login.html';
});

document.getElementById('clear-btn').addEventListener('click', async () => {
  if (!confirm('Hapus semua riwayat chat?')) return;
  const res = await apiFetch('/chat/history', { method: 'DELETE' });
  if (res && res.success) {
    const notif = document.createElement('div');
    notif.style.cssText = 'text-align:center;color:#888;font-size:0.85rem;padding:20px 0;';
    notif.textContent = 'Riwayat chat telah dihapus.';
    messagesEl.innerHTML = '';
    messagesEl.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
  }
});

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/`(.*?)`/g, '$1');
}

function formatMessage(text) {
  text = stripMarkdown(text);
  // Convert numbered list to line breaks: " 1. " -> "\n1. "
  text = text.replace(/\s(\d+)\.\s/g, '\n$1. ');
  text = text.trim();
  return text;
}

function addBubble(text, role, meta = '') {
  text = formatMessage(text);
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = role === 'user' ? 'flex-end' : 'flex-start';

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  bubble.style.whiteSpace = 'pre-wrap';
  bubble.textContent = text;

  const metaEl = document.createElement('div');
  metaEl.className = 'msg-meta';
  metaEl.textContent = meta;

  wrap.appendChild(bubble);
  if (meta) wrap.appendChild(metaEl);
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Load history on page load
(async () => {
  const res = await apiFetch('/chat/history');
  if (res && res.success && res.data.length > 0) {
    // Clear placeholder
    messagesEl.innerHTML = '';
    for (const msg of res.data) {
      addBubble(msg.userMessage, 'user', new Date(msg.createdAt).toLocaleTimeString('id-ID'));
      const meta = msg.ragSource ? `Sumber: ${msg.ragSource} | Confidence: ${msg.ragConfidence}%` : '';
      addBubble(msg.assistantResponse, 'assistant', meta);
    }
  }
})();

async function sendMessage() {
  const message = inputEl.value.trim();
  if (!message) return;

  inputEl.value = '';
  sendBtn.disabled = true;
  addBubble(message, 'user', new Date().toLocaleTimeString('id-ID'));

  // Typing indicator
  const typingWrap = document.createElement('div');
  typingWrap.id = 'typing';
  typingWrap.style.cssText = 'display:flex;align-items:flex-start;';
  typingWrap.innerHTML = '<div class="chat-bubble assistant" style="opacity:0.6;">...</div>';
  messagesEl.appendChild(typingWrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    const res = await apiFetch('/chat', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
    document.getElementById('typing')?.remove();

    if (res && res.success) {
      const { response, ragConfidence, ragSource } = res.data;
      const meta = ragSource ? `Sumber: ${ragSource} | Confidence: ${ragConfidence}%` : '';
      addBubble(response, 'assistant', meta);
    } else {
      addBubble(res?.message || 'Gagal mendapatkan jawaban.', 'assistant');
    }
  } catch (_) {
    document.getElementById('typing')?.remove();
    addBubble('Terjadi kesalahan. Coba lagi.', 'assistant');
  } finally {
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

sendBtn.addEventListener('click', sendMessage);
inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
