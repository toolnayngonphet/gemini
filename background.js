// background.js - Phiên bản hỗ trợ trò chuyện liên tục

// !!! DÁN API KEY CỦA BẠN VÀO ĐÂY
const API_KEY = 'AIzaSyCTPYOSSmKSpQuOiSSvZkObNVvX9wYQFxg';
const MODEL_NAME = 'gemini-1.5-flash';

// Lắng nghe tin nhắn từ popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'sendMessageToGemini') {
        callGeminiAPI(request.payload);
        return true; // Báo hiệu sẽ trả lời bất đồng bộ
    }
});

async function callGeminiAPI(payload) {
    const { conversationHistory, newUserMessage } = payload;

    // Thêm tin nhắn mới của người dùng vào lịch sử
    const fullHistory = [...conversationHistory, newUserMessage];

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // Gửi toàn bộ lịch sử để có ngữ cảnh
                contents: fullHistory
            })
        });

        const data = await response.json();

        if (!response.ok) {
            const errorDetails = data?.error?.message || `Lỗi không xác định. HTTP status: ${response.status}`;
            throw new Error(errorDetails);
        }

        const geminiResponsePart = data.candidates?.[0]?.content?.parts?.[0];
        if (!geminiResponsePart) {
            throw new Error('API không trả về nội dung hợp lệ.');
        }

        // Tạo tin nhắn phản hồi của model
        const geminiMessage = {
            role: 'model',
            parts: [geminiResponsePart]
        };
        
        // Thêm phản hồi của Gemini vào lịch sử và lưu lại
        const finalHistory = [...fullHistory, geminiMessage];
        chrome.storage.local.set({ conversation: finalHistory });

    } catch (error) {
        console.error('Gemini API Error:', error);
        // Nếu có lỗi, tạo một tin nhắn báo lỗi và lưu lại
        const errorMessage = {
            role: 'model',
            parts: [{ text: `<strong>Lỗi API:</strong> ${error.message}` }]
        };
        const finalHistory = [...fullHistory, errorMessage];
        chrome.storage.local.set({ conversation: finalHistory });
    }
}