// popup.js - Phiên bản cuối cùng: Hỗ trợ lưu trạng thái và gửi nhiều ảnh

const mainContent = document.getElementById('main-content');
const sendBtn = document.getElementById('send-btn');
const inputBox = document.getElementById('input-box');
const chatHistory = document.getElementById('chat-history');
const clearBtn = document.getElementById('clear-btn');

let unlocked = false;
let enterPressCount = 0;
let currentConversation = [];

//--- CÁC HÀM XỬ LÝ ---

function unlockExtension() {
    if (unlocked) return;
    unlocked = true;
    
    // Tải lịch sử chat
    chrome.storage.local.get(['conversation', 'inputContent'], (result) => {
        if (result.conversation) {
            currentConversation = result.conversation;
            renderChatHistory();
        }
        // [NEW] Khôi phục nội dung ô nhập liệu đã lưu
        if (result.inputContent) {
            inputBox.innerHTML = result.inputContent;
        }
    });

    document.body.classList.add('unlocked');
    mainContent.style.display = 'flex';
    inputBox.focus();
}

function renderChatHistory() {
    chatHistory.innerHTML = '';
    currentConversation.forEach(message => {
        const messageDiv = document.createElement('div');
        const role = message.role === 'user' ? 'user' : 'gemini';
        messageDiv.classList.add('message', `${role}-message`);

        let contentHTML = '';
        message.parts.forEach(part => {
            if (part.text) {
                let formattedText = part.text
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/\n/g, '<br>');
                formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                contentHTML += formattedText;
            } else if (part.inlineData) {
                contentHTML += `<img src="data:${part.inlineData.mimeType};base64,${part.inlineData.data}" alt="user image">`;
            }
        });
        messageDiv.innerHTML = contentHTML;
        chatHistory.appendChild(messageDiv);
    });
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

async function sendMessage() {
    if (!unlocked) return;

    const newUserMessage = { role: 'user', parts: [] };
    const nodes = Array.from(inputBox.childNodes);

    let currentText = '';
    for (const node of nodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            currentText += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'BR') {
                currentText += '\n';
            } else if (node.tagName === 'IMG') {
                if (currentText.trim()) {
                    newUserMessage.parts.push({ text: currentText.trim() });
                }
                currentText = ''; 
                const base64Data = node.src.split(',')[1];
                const mimeTypeMatch = node.src.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
                if (mimeTypeMatch && mimeTypeMatch[1]) {
                    newUserMessage.parts.push({ inlineData: { mimeType: mimeTypeMatch[1], data: base64Data } });
                }
            } else {
                 currentText += node.textContent;
            }
        }
    }
    if (currentText.trim()) {
        newUserMessage.parts.push({ text: currentText.trim() });
    }

    if (newUserMessage.parts.length === 0) return;

    currentConversation.push(newUserMessage);
    renderChatHistory();

    const thinkingDiv = document.createElement('div');
    thinkingDiv.classList.add('message', 'gemini-message', 'thinking');
    thinkingDiv.innerHTML = 'Đang suy nghĩ...';
    chatHistory.appendChild(thinkingDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    // [MODIFIED] Dọn dẹp ô nhập liệu và bộ nhớ đã lưu
    inputBox.innerHTML = '';
    chrome.storage.local.remove('inputContent');

    chrome.runtime.sendMessage({
        action: 'sendMessageToGemini',
        payload: { conversationHistory: currentConversation }
    });
}

function handleStorageChange(changes, namespace) {
    if (changes.conversation && unlocked) {
        const newConversation = changes.conversation.newValue || [];
        if (JSON.stringify(currentConversation) !== JSON.stringify(newConversation)) {
            currentConversation = newConversation;
            renderChatHistory();
        }
    }
}

function handlePaste(e) {
    e.preventDefault(); 
    const items = (e.clipboardData || window.clipboardData).items;

    for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
            const file = item.getAsFile();
            const reader = new FileReader();
            reader.onload = function(event) {
                const img = document.createElement('img');
                img.src = event.target.result;
                inputBox.appendChild(img);
                 // Sau khi thêm ảnh, gọi sự kiện input để lưu lại
                inputBox.dispatchEvent(new Event('input', { bubbles: true }));
            };
            reader.readAsDataURL(file);
        } else if (item.type === 'text/plain') {
            item.getAsString(function (text) {
                document.execCommand('insertText', false, text);
            });
        }
    }
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

inputBox.addEventListener('paste', handlePaste);

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
        inputBox.innerHTML = '';
        renderChatHistory();
        // [MODIFIED] Dọn dẹp cả bộ nhớ đã lưu
        chrome.storage.local.remove(['conversation', 'inputContent']);
    }
});

chrome.storage.onChanged.addListener(handleStorageChange);

// [NEW] Tự động lưu nội dung ô nhập liệu khi có thay đổi
inputBox.addEventListener('input', () => {
    if (unlocked) {
        chrome.storage.local.set({ inputContent: inputBox.innerHTML });
    }
});

// Ban đầu chỉ cần gọi unlockExtension
unlockExtension();