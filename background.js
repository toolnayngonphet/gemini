// background.js - Phiên bản cuối cùng, hỗ trợ tự động xoay vòng API key

// [NEW] DÁN DANH SÁCH API KEY CỦA BẠN VÀO ĐÂY
const API_KEYS = [
    'AIzaSyCTPYOSSmKSpQuOiSSvZkObNVvX9wYQFxg', // Key thứ nhất
    'AIzaSyArQC2oILv_9wDI1tJP6bOGoqRTeavUhi0', // Key thứ hai
    // Thêm bao nhiêu key tùy thích vào đây, mỗi key trong một cặp dấu nháy đơn '' và cách nhau bởi dấu phẩy ,
];
let currentApiIndex = 0; // Bắt đầu với key đầu tiên (chỉ số 0)

const MODEL_NAME = 'gemini-1.5-flash';

// Lắng nghe tin nhắn từ popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'sendMessageToGemini') {
        callGeminiAPI(request.payload.conversationHistory);
        return true; // Báo hiệu sẽ trả lời bất đồng bộ
    }
});

// [MODIFIED] Hàm gọi API được nâng cấp để thử lại với key mới khi cần
async function callGeminiAPI(conversationHistory, retryCount = 0) {
    // Nếu đã thử hết tất cả các key mà vẫn lỗi, thì báo lỗi cuối cùng
    if (retryCount >= API_KEYS.length) {
        console.error('All API keys have exceeded their quota.');
        const errorMessage = {
            role: 'model',
            parts: [{ text: '<strong>Lỗi:</strong> Tất cả các API key đều đã hết hạn mức. Vui lòng thử lại sau hoặc thêm key mới.' }]
        };
        const finalHistory = [...conversationHistory, errorMessage];
        chrome.storage.local.set({ conversation: finalHistory });
        return;
    }

    const currentKey = API_KEYS[currentApiIndex];
    console.log(`Attempting to use API key at index: ${currentApiIndex}`);

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${currentKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: conversationHistory
            })
        });

        const data = await response.json();

        if (!response.ok) {
            // Ném lỗi để khối catch có thể xử lý
            const errorDetails = data?.error?.message || `Lỗi không xác định. HTTP status: ${response.status}`;
            throw new Error(errorDetails);
        }

        const geminiResponsePart = data.candidates?.[0]?.content?.parts?.[0];
        if (!geminiResponsePart || !data.candidates?.[0]?.content) {
            throw new Error('API không trả về nội dung hợp lệ.');
        }

        const geminiMessage = data.candidates[0].content;
        const finalHistory = [...conversationHistory, geminiMessage];
        chrome.storage.local.set({ conversation: finalHistory });

    } catch (error) {
        console.error('Gemini API Error:', error.message);

        // [NEW] Kiểm tra xem có phải lỗi quota không để xoay vòng key
        if (error.message.includes('quota')) {
            console.log(`Key at index ${currentApiIndex} exceeded quota. Switching to the next key.`);
            // Chuyển sang key tiếp theo, nếu hết thì quay về key đầu tiên
            currentApiIndex = (currentApiIndex + 1) % API_KEYS.length;
            
            // Tự động thử lại yêu cầu với key mới
            callGeminiAPI(conversationHistory, retryCount + 1);
        } else {
            // Đối với các lỗi khác (như sai key, lỗi mạng), hiển thị lỗi ra cho người dùng
            const errorMessage = {
                role: 'model',
                parts: [{ text: `<strong>Lỗi API:</strong> ${error.message}` }]
            };
            const finalHistory = [...conversationHistory, errorMessage];
            chrome.storage.local.set({ conversation: finalHistory });
        }
    }
}