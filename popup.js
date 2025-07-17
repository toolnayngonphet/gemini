// popup.js - Phiên bản hỗ trợ trò chuyện liên tục

// !!! DÁN API KEY CỦA BẠN VÀO ĐÂY
const API_KEY = 'AIzaSyCTPYOSSmKSpQuOiSSvZkObNVvX9wYQFxg';

const mainContent = document.getElementById('main-content');
const sendBtn = document.getElementById('send-btn');
const inputBox = document.getElementById('input-box');
const chatHistory = document.getElementById('chat-history');
const clearBtn = document.getElementById('clear-btn');

let unlocked = false;
let enterPressCount = 0;
let currentConversation = []; // Mảng lưu trữ cuộc trò chuyện

//--- CÁC HÀM XỬ LÝ ---

function unlockExtension() {
    if (unlocked) return;
    unlocked = true;
    
    // Tải lịch sử từ storage khi mở khóa
    chrome.storage.local.get('conversation', (result) => {
        if (result.conversation) {
            currentConversation = result.conversation;
            renderChatHistory();
        }
    });

    document.body.classList.add('unlocked');
    mainContent.style.display = 'flex';
    inputBox.focus();
}

// Hàm render lại toàn bộ lịch sử chat từ mảng `currentConversation`
function renderChatHistory() {
    chatHistory.innerHTML = ''; // Xóa sạch giao diện cũ
    currentConversation.forEach(message => {
        const messageDiv = document.createElement('div');
        const role = message.role === 'user' ? 'user' : 'gemini';
        messageDiv.classList.add('message', `${role}-message`);
        
        let contentHTML = '';
        message.parts.forEach(part => {
            if (part.text) {
                contentHTML += part.text.replace(/\n/g, '<br>');
            } else if (part.inlineData) {
                contentHTML += `<img src="data:${part.inlineData.mimeType};base64,${part.inlineData.data}" style="max-width:100%; border-radius: 8px;">`;
            }
        });
        messageDiv.innerHTML = contentHTML;
        chatHistory.appendChild(messageDiv);
    });

    if (chatHistory.innerHTML) {
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
}

async function sendMessage() {
    if (!unlocked || inputBox.innerHTML.trim() === '') return;
    if (API_KEY === 'DÁN_API_KEY_CỦA_BẠN_VÀO_ĐÂY') {
        alert('Lỗi: Vui lòng thêm API Key vào file popup.js và background.js');
        return;
    }

    const newUserMessage = { role: 'user', parts: [] };
    
    inputBox.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE || node.nodeName === 'P' || node.nodeName === 'DIV') {
            const textContent = (node.textContent || node.innerText || "").trim();
            if (textContent) newUserMessage.parts.push({ text: textContent });
        } else if (node.nodeName === 'IMG') {
            const img = node;
            const base64Data = img.src.split(',')[1];
            const mimeType = img.src.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)[1];
            newUserMessage.parts.push({ inlineData: { mimeType, data: base64Data } });
        }
    });

    if (newUserMessage.parts.length === 0) return;

    // Cập nhật giao diện ngay lập tức
    currentConversation.push(newUserMessage);
    renderChatHistory();
    
    // Thêm tin nhắn "Đang suy nghĩ..." (chỉ trên giao diện, không lưu vào lịch sử)
    const thinkingDiv = document.createElement('div');
    thinkingDiv.classList.add('message', 'gemini-message');
    thinkingDiv.innerHTML = 'Đang suy nghĩ...';
    chatHistory.appendChild(thinkingDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    inputBox.innerHTML = '';

    // Gửi toàn bộ lịch sử và tin nhắn mới cho background
    chrome.runtime.sendMessage({
        action: 'sendMessageToGemini',
        payload: {
            conversationHistory: currentConversation.slice(0, -1), // Lịch sử cũ
            newUserMessage: newUserMessage // Tin nhắn mới
        }
    });
}

//--- CÁC EVENT LISTENER ---

document.addEventListener('keydown', (e) => {
    if (unlocked) return;
    if (e.key === 'Enter') {
        enterPressCount++;
        if (enterPressCount >= 2) unlockExtension();
    } else {
        enterPressCount = 0;
    }
});

sendBtn.addEventListener('click', sendMessage);
inputBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

clearBtn.addEventListener('click', () => {
    if (unlocked) {
        currentConversation = [];
        renderChatHistory();
        chrome.storage.local.remove('conversation');
    }
});

// Lắng nghe thay đổi từ background script và render lại
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.conversation && unlocked) {
        currentConversation = changes.conversation.newValue || [];
        renderChatHistory();
    }
});