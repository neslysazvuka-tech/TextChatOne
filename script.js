import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, orderByChild, equalTo, query, serverTimestamp, update, remove, get } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCO8a9FxvyDobEWnPOStW7hYwS2wqgTDCc",
  authDomain: "textchat-9fdc0.firebaseapp.com",
  databaseURL: "https://textchat-9fdc0-default-rtdb.firebaseio.com",
  projectId: "textchat-9fdc0",
  storageBucket: "textchat-9fdc0.firebasestorage.app",
  messagingSenderId: "430049803126",
  appId: "1:430049803126:web:4d939df5d29650aa689857"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

let currentUser = {
    nickname: null,
    id: null
};

function scrollToBottom() {
    const messagesContainer = document.getElementById('messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    if ('scrollBehavior' in document.documentElement.style) {
        messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: 'smooth'
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const nicknameModal = document.getElementById('nicknameModal');
    const chatContainer = document.getElementById('chatContainer');
    const nicknameInput = document.getElementById('nicknameInput');
    const setNicknameBtn = document.getElementById('setNickname');
    const currentNicknameSpan = document.getElementById('currentNickname');
    
    nicknameModal.style.display = 'flex';
    
    setNicknameBtn.addEventListener('click', async () => {
        const nickname = nicknameInput.value.trim();
        if (nickname) {
            currentUser.nickname = nickname;
            currentUser.id = Date.now().toString();
            
            const userRef = ref(database, 'users/' + currentUser.id);
            await set(userRef, {
                nickname: currentUser.nickname,
                lastActive: serverTimestamp()
            });
            
            currentNicknameSpan.textContent = currentUser.nickname;
            nicknameModal.style.display = 'none';
            chatContainer.style.display = 'block';
            
            initChat();
            
            setInterval(() => {
                update(userRef, {
                    lastActive: serverTimestamp()
                });
            }, 30000);
            
            window.addEventListener('beforeunload', async () => {
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
                
                remove(userRef);
            });
        }
    });
    
    function initChat() {
        const messagesContainer = document.getElementById('messages');
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        
        function addMessage(text, userId, nickname, isCurrentUser = false) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${isCurrentUser ? 'user-message' : 'other-message'}`;
            
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
            scrollToBottom();
            
            setTimeout(() => {
                messageDiv.style.opacity = '0';
                messageDiv.style.transform = 'translateY(-10px)';
                setTimeout(() => {
                    messageDiv.remove();
                }, 300);
            }, 60000);
        }
        
        async function sendMessage() {
            const text = messageInput.value.trim();
            if (text) {
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
        
        onValue(ref(database, 'users'), async (snapshot) => {
            const now = Date.now();
            const updates = {};
            
            snapshot.forEach(async child => {
                const user = child.val();
                if (now - user.lastActive > 120000) {
                    updates['users/' + child.key] = null;
                    
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
