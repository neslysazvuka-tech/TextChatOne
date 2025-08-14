import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, orderByChild, equalTo, query, serverTimestamp, update, remove } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCO8a9FxvyDobEWnPOStW7hYwS2wqgTDCc",
  authDomain: "textchat-9fdc0.firebaseapp.com",
  databaseURL: "https://textchat-9fdc0-default-rtdb.firebaseio.com",
  projectId: "textchat-9fdc0",
  storageBucket: "textchat-9fdc0.firebasestorage.app",
  messagingSenderId: "430049803126",
  appId: "1:430049803126:web:4d939df5d29650aa689857"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Переменные приложения
let currentUser = {
    nickname: null,
    id: null
};

document.addEventListener('DOMContentLoaded', () => {
    const nicknameModal = document.getElementById('nicknameModal');
    const chatContainer = document.getElementById('chatContainer');
    const nicknameInput = document.getElementById('nicknameInput');
    const setNicknameBtn = document.getElementById('setNickname');
    const currentNicknameSpan = document.getElementById('currentNickname');
    
    // Показать модальное окно для ввода никнейма
    nicknameModal.style.display = 'flex';
    
    // Установка никнейма
    setNicknameBtn.addEventListener('click', async () => {
        const nickname = nicknameInput.value.trim();
        if (nickname) {
            currentUser.nickname = nickname;
            currentUser.id = Date.now().toString();
            
            // Сохраняем пользователя в Firebase
            const userRef = ref(database, 'users/' + currentUser.id);
            await set(userRef, {
                nickname: currentUser.nickname,
                lastActive: serverTimestamp()
            });
            
            // Обновляем UI
            currentNicknameSpan.textContent = currentUser.nickname;
            nicknameModal.style.display = 'none';
            chatContainer.style.display = 'block';
            
            // Инициализируем чат
            initChat();
            
            // Следим за активностью пользователя
            setInterval(() => {
                update(userRef, {
                    lastActive: serverTimestamp()
                });
            }, 30000);
            
            // Обработчик выхода
            window.addEventListener('beforeunload', async () => {
                // Удаляем сообщения пользователя
                const messagesQuery = query(
                    ref(database, 'messages'),
                    orderByChild('userId'),
                    equalTo(currentUser.id)
                );
                
                const snapshot = await get(messagesQuery);
                if (snapshot.exists()) {
                    const updates = {};
                    snapshot.forEach(child => {
                        updates['messages/' + child.key] = null;
                    });
                    update(ref(database), updates);
                }
                
                // Удаляем пользователя
                remove(userRef);
            });
        }
    });
    
    function initChat() {
        const messagesContainer = document.getElementById('messages');
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        
        // Функция добавления сообщения
        function addMessage(text, userId, nickname, isCurrentUser = false) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${isCurrentUser ? 'user-message' : 'other-message'}`;
            messageDiv.style.alignSelf = isCurrentUser ? 'flex-end' : 'flex-start';
            messageDiv.style.backgroundColor = isCurrentUser ? '#6e8efb' : '#f1f1f1';
            messageDiv.style.color = isCurrentUser ? 'white' : '#333';
            
            // Добавляем информацию о сообщении
            const messageInfo = document.createElement('div');
            messageInfo.className = 'message-info';
            messageInfo.innerHTML = `
                <span>${nickname}</span>
                <span>${new Date().toLocaleTimeString()}</span>
            `;
            
            const messageText = document.createElement('div');
            messageText.textContent = text;
            
            messageDiv.appendChild(messageInfo);
            messageDiv.appendChild(messageText);
            
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            // Установка таймера на удаление через 1 минуту
            setTimeout(() => {
                messageDiv.style.opacity = '0';
                messageDiv.style.transform = 'translateY(-10px)';
                setTimeout(() => {
                    messageDiv.remove();
                }, 300);
            }, 60000);
        }
        
        // Отправка сообщения
        async function sendMessage() {
            const text = messageInput.value.trim();
            if (text) {
                // Сохраняем сообщение в Firebase
                const newMessageRef = push(ref(database, 'messages'));
                await set(newMessageRef, {
                    text: text,
                    userId: currentUser.id,
                    nickname: currentUser.nickname,
                    timestamp: serverTimestamp(),
                    expiresAt: Date.now() + 60000
                });
                
                messageInput.value = '';
            }
        }
        
        // Слушаем новые сообщения
        onValue(ref(database, 'messages'), (snapshot) => {
            messagesContainer.innerHTML = '';
            snapshot.forEach(child => {
                const message = child.val();
                if (message.expiresAt > Date.now()) {
                    addMessage(
                        message.text,
                        message.userId,
                        message.nickname,
                        message.userId === currentUser.id
                    );
                }
            });
        });
        
        // Удаляем истекшие сообщения
        onValue(ref(database, 'messages'), (snapshot) => {
            const updates = {};
            snapshot.forEach(child => {
                const message = child.val();
                if (message.expiresAt <= Date.now()) {
                    updates['messages/' + child.key] = null;
                }
            });
            if (Object.keys(updates).length > 0) {
                update(ref(database), updates);
            }
        });
        
        // Удаляем неактивных пользователей
        onValue(ref(database, 'users'), async (snapshot) => {
            const now = Date.now();
            const updates = {};
            
            snapshot.forEach(async child => {
                const user = child.val();
                if (now - user.lastActive > 120000) {
                    updates['users/' + child.key] = null;
                    
                    // Удаляем сообщения неактивного пользователя
                    const messagesQuery = query(
                        ref(database, 'messages'),
                        orderByChild('userId'),
                        equalTo(child.key)
                    );
                    
                    const messagesSnapshot = await get(messagesQuery);
                    if (messagesSnapshot.exists()) {
                        const messageUpdates = {};
                        messagesSnapshot.forEach(messageChild => {
                            messageUpdates['messages/' + messageChild.key] = null;
                        });
                        update(ref(database), messageUpdates);
                    }
                }
            });
            
            if (Object.keys(updates).length > 0) {
                update(ref(database), updates);
            }
        });
        
        sendButton.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
});
