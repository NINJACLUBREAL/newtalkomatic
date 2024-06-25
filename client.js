document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    const modMode = getCookie('modMode') === 'true';
    const defaultUsername = modMode ? '<' : getCookie('username') || '';
    const defaultLocation = modMode ? 'dev>' : getCookie('location') || '';

    document.getElementById('name').value = defaultUsername;
    document.getElementById('location').value = defaultLocation;
    
    let selectedColor = getCookie('userColor') || "#FFFFFF"; // Default color

    let userId = getCookie('userId');
    if (!userId) {
        userId = generateUserId();
        setCookie('userId', userId, 30);
    }

    socket.emit('userConnected', { userId });

    window.addEventListener('beforeunload', () => {
        socket.emit('userDisconnected', { userId });
    });

    socket.on('userBanned', (banExpiration) => {
        const banDuration = Math.floor((banExpiration - Date.now()) / 1000);
        setCookie('banned', 'true', banDuration / 86400);
        setCookie('banExpiration', banExpiration, banDuration / 86400);
        window.location.href = 'removed.html';
    });
    
    if (getCookie('banned') === 'true') {
        const banExpiration = getCookie('banExpiration');
        const remainingTime = Math.floor((banExpiration - Date.now()) / 1000);
        if (remainingTime > 0) {
            window.location.href = 'removed.html';
        } else {
            deleteCookie('banned');
            deleteCookie('banExpiration');
        }
    }

    socket.on('duplicateUser', (data) => {
        toastr.error(data.message);
        setTimeout(() => {
            window.location.href = data.redirectUrl;
        }, 3000); // Wait for 3 seconds to show the toastr message
    });

    socket.on('offensiveWordError', (message) => {
        toastr.error(message);
    });

    const createRoomBtn = document.getElementById('createRoomBtn');
    const roomList = document.getElementById('roomList');
    const roomsCountElement = document.getElementById('roomsCount');
    const usersCountElement = document.getElementById('usersCount');
    const searchRoomBtn = document.getElementById('searchRoomBtn');
    const refreshRoomsBtn = document.getElementById('refreshRoomsBtn');
    const searchRoomIdInput = document.getElementById('searchRoomId');
    const noRoomsMessage = document.createElement('div');
    noRoomsMessage.id = 'noRoomsMessage';
    noRoomsMessage.className = 'no-rooms-message';
    noRoomsMessage.innerText = 'No active public rooms right now. Create a new room and start the conversation!';

    function generateUserId() {
        return 'user_' + Math.random().toString(36).substr(2, 9);
    }

    function setCookie(name, value, days) {
        var expires = "";
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + expires + "; path=/";
    }

    function getCookie(name) {
        let cookieArray = document.cookie.split(';');
        for (let i = 0; i < cookieArray.length; i++) {
            let cookiePair = cookieArray[i].split('=');
            if (name == cookiePair[0].trim()) {
                return decodeURIComponent(cookiePair[1]);
            }
        }
        return null;
    }

    function deleteCookie(name) {
        document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    }

    function containsOffensiveWord(text) {
        const OFFENSIVE_WORDS = ['badword']; // Ensure this matches the server list
        return OFFENSIVE_WORDS.some(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            return regex.test(text);
        });
    }

    // Update any function that deals with colors to use color names instead of hex values
    function updateSelectedColor(color) {
        selectedColor = color; // This is now a color name, not a hex value
        // Update UI elements if needed
    }

    window.updateUsername = function () {
        const oldUsername = getCookie('username');
        const oldLocation = getCookie('location');
        const username = document.getElementById('name').value.trim();
        const location = document.getElementById('location').value.trim();
        let updateMessage = [];

        if (containsOffensiveWord(username)) {
            toastr.error('Username contains offensive words.');
            return;
        }

        if (containsOffensiveWord(location)) {
            toastr.error('Location contains offensive words.');
            return;
        }

        if (username !== oldUsername) {
            setCookie('username', username, 30);
            updateMessage.push('username');
        }
        if (location !== oldLocation) {
            setCookie('location', location, 30);
            updateMessage.push('location');
        }

        if (updateMessage.length > 0) {
            toastr.success(updateMessage.join(' and ') + ' updated.');
        } else {
            toastr.info('No changes were made.');
        }
    };

    window.signOut = function () {
        deleteCookie('username');
        deleteCookie('location');
        deleteCookie('userId');
        document.getElementById('name').value = '';
        document.getElementById('location').value = '';
        toastr.success('Username, location, and user ID have been removed.');
        socket.emit('userDisconnected', { userId });
    };

    createRoomBtn.addEventListener('click', () => {
        const username = document.getElementById('name').value.trim();
        const location = document.getElementById('location').value.trim();
        const roomName = document.getElementById('roomName').value.trim();
        const roomType = document.querySelector('input[name="roomType"]:checked').value;

        if (!username) {
            toastr.error('Please enter your username.');
            console.log('Room creation failed - missing username');
            return;
        }

        if (!location) {
            toastr.error('Please enter your location.');
            console.log('Room creation failed - missing location');
            return;
        }

        if (!roomName) {
            toastr.error('Please enter a room name.');
            console.log('Room creation failed - missing room name');
            return;
        }

        if (containsOffensiveWord(username)) {
            toastr.error('Username contains offensive words.');
            return;
        }

        if (containsOffensiveWord(location)) {
            toastr.error('Location contains offensive words.');
            return;
        }

        if (containsOffensiveWord(roomName)) {
            toastr.error('Room name contains offensive words.');
            return;
        }

        socket.emit('createRoom', {
            username: username,
            location: location,
            userId: userId,
            name: roomName,
            type: roomType,
            color: selectedColor // This is now the color name, not a hex value
        });

        console.log('Sending room creation request:', roomData);
        socket.emit('createRoom', roomData);
    });

    roomList.addEventListener('click', (event) => {
        if (event.target.classList.contains('enter-chat-button')) {
            const username = document.getElementById('name').value.trim();
            const location = document.getElementById('location').value.trim();

            if (!username) {
                toastr.error('Please enter your username.');
                console.log('Room joining failed - missing username');
                return;
            }

            if (!location) {
                toastr.error('Please enter your location.');
                console.log('Room joining failed - missing location');
                return;
            }

            if (containsOffensiveWord(username)) {
                toastr.error('Username contains offensive words.');
                return;
            }

            if (containsOffensiveWord(location)) {
                toastr.error('Location contains offensive words.');
                return;
            }

            const roomId = event.target.dataset.roomId;
            const roomType = event.target.dataset.roomType;
            const roomName = event.target.dataset.roomName;
            const userColor = getCookie('userColor') || 'white'; // Get color from cookie
            socket.emit('joinRoom', { roomId, username, location, userId, color: userColor });
            console.log('Room joining request sent:', { roomId, username, location, userId, color: userColor });

            socket.on('roomJoined', (data) => {
                if (data.roomId === roomId) {
                    window.location.href = `chat_room.html?roomId=${roomId}&username=${username}&location=${location}&userId=${userId}&roomType=${roomType}&roomName=${roomName}&txtclr=${encodeURIComponent(userColor)}`;
                }
            });
        }
    });

    // Add a socket event listener for color changes
    socket.on('colorChanged', (data) => {
        const { userId, color } = data;
        // Update UI or other necessary changes when a user's color changes
        // This might be needed if you want to reflect color changes in real-time
    });

    searchRoomBtn.addEventListener('click', () => {
        const searchRoomId = searchRoomIdInput.value.trim();
        if (searchRoomId) {
            socket.emit('searchRoom', searchRoomId);
        } else {
            socket.emit('getExistingRooms');
        }
    });

    refreshRoomsBtn.addEventListener('click', () => {
        const searchRoomId = searchRoomIdInput.value.trim();
        if (searchRoomId) {
            socket.emit('searchRoom', searchRoomId);
        } else {
            socket.emit('getExistingRooms');
        }
    });

    searchRoomIdInput.addEventListener('input', () => {
        if (!searchRoomIdInput.value.trim()) {
            socket.emit('getExistingRooms');
        }
    });

    socket.on('roomCreated', (room, creatorSocketId) => {
        const existingRoomElement = document.getElementById(`room-${room.id}`);
        if (existingRoomElement) {
            existingRoomElement.remove(); // Remove existing room element if it exists
        }
        if (room.type === 'public') {
            const roomElement = createRoomElement(room);
            roomList.appendChild(roomElement);
            console.log('Room created:', room);
            updateRoomCount();
        }

        if (socket.id === creatorSocketId) {
            window.location.href = `chat_room.html?roomId=${room.id}&username=${room.users[0].username}&location=${room.users[0].location}&userId=${room.users[0].userId}&roomType=${room.type}&roomName=${room.name}&txtclr=${encodeURIComponent(selectedColor)}`;
        }
    });

    // Initialize the color of the preview textarea
    document.addEventListener('DOMContentLoaded', function() {
        const savedColor = getCookie('userColor');
        if (savedColor) {
            previewTextarea.style.color = savedColor;
        }
    });

    socket.on('existingRooms', (rooms) => {
        roomList.innerHTML = '';
        rooms.forEach(room => {
            if (room.type === 'public') {
                const roomElement = createRoomElement(room);
                roomList.appendChild(roomElement);
            }
        });
        console.log('Existing rooms received:', rooms);
        updateRoomCount();
    });

    socket.on('searchResult', (room) => {
        roomList.innerHTML = '';
        if (room) {
            const roomElement = createRoomElement(room);
            roomList.appendChild(roomElement);
            console.log('Search result received:', room);
        } else {
            toastr.error('Room not found');
            console.log('Room not found');
        }
        updateRoomCount();
    });

    socket.on('roomRemoved', (roomId) => {
        const roomElement = document.getElementById(`room-${roomId}`);
        if (roomElement) {
            roomElement.remove();
            console.log('Room removed:', roomId);
        }
        updateRoomCount();
    });

    // Update the roomJoined event handler
    socket.on('roomJoined', (data) => {
        window.location.href = `chat_room.html?roomId=${data.roomId}&username=${data.username}&location=${data.location}&userId=${data.userId}&roomType=${data.roomType}&roomName=${data.roomName}&txtclr=${encodeURIComponent(data.color)}`;
    });

    socket.on('roomUpdated', (room) => {
        const existingRoomElement = document.getElementById(`room-${room.id}`);
        const searchRoomId = searchRoomIdInput.value.trim();
        if (room.type === 'public' && (!searchRoomId || (searchRoomId && room.id === searchRoomId))) {
            if (existingRoomElement) {
                existingRoomElement.replaceWith(createRoomElement(room));
                console.log('Room updated:', room);
            } else {
                const roomElement = createRoomElement(room);
                roomList.appendChild(roomElement);
                console.log('Room added:', room);
            }
            updateRoomCount();
        }
    });

    socket.on('userJoined', (data) => {
        const { roomId, username, location, userId } = data;
        const existingRoomElement = document.getElementById(`room-${roomId}`);
        if (existingRoomElement) {
            const userInfoElement = existingRoomElement.querySelector('.user-info');
            const userCount = userInfoElement.children.length + 1;
            const userDetailElement = document.createElement('div');
            userDetailElement.classList.add('user-detail');
            userDetailElement.dataset.userId = userId;
            userDetailElement.innerHTML = 
                `<img src="icons/chatbubble.png" alt="Chat" class="details-icon"> ${userCount}. ${username} / ${location}`;
            userInfoElement.appendChild(userDetailElement);

            const roomHeaderElement = existingRoomElement.querySelector('.room-header');
            roomHeaderElement.textContent = `${existingRoomElement.dataset.roomName} (${userCount}/5)`;

            const enterChatButton = existingRoomElement.querySelector('.enter-chat-button');
            if (userCount === 5) {
                enterChatButton.disabled = true;
                enterChatButton.textContent = 'Room Full';
            }
            console.log('User joined room:', data);
        } else {
            console.log('Room not found for user joining:', roomId);
        }
    });

    socket.on('userLeft', (data) => {
        const { roomId, userId } = data;
        const existingRoomElement = document.getElementById(`room-${roomId}`);
        if (existingRoomElement) {
            const userInfoElement = existingRoomElement.querySelector('.user-info');
            const userDetailElements = userInfoElement.querySelectorAll('.user-detail');
            userDetailElements.forEach((userDetailElement, index) => {
                if (userDetailElement.dataset.userId === userId) {
                    userDetailElement.remove();
                } else {
                    userDetailElement.querySelector('.details-icon').textContent = `${index + 1}.`;
                }
            });

            const roomHeaderElement = existingRoomElement.querySelector('.room-header');
            const userCount = userInfoElement.children.length;
            roomHeaderElement.textContent = `${existingRoomElement.dataset.roomName} (${userCount}/5)`;

            const enterChatButton = existingRoomElement.querySelector('.enter-chat-button');
            if (userCount < 5) {
                enterChatButton.disabled = false;
                enterChatButton.innerHTML = `Enter <img src="icons/chatbubble.png" alt="Chat" class="button-icon">`;
            }
            console.log('User left room:', data);
        } else {
            console.log('Room not found for user leaving:', roomId);
        }
    });

    function createRoomElement(room) {
        const roomElement = document.createElement('div');
        roomElement.id = `room-${room.id}`;
        roomElement.dataset.roomName = room.name;
        roomElement.classList.add('room-details-container');
        roomElement.innerHTML = 
            `<div class="room-details">
                <div class="room-info">
                    <div class="room-header">${room.name} (${room.users.length}/5)</div>
                    <div class="public-room-info">
                        (${room.type.charAt(0).toUpperCase() + room.type.slice(1)} Room) <img src="icons/handshake.png" alt="${room.type} Room" class="room-icon">
                    </div>
                </div>
                <div class="user-info">
                    ${room.users.map((user, index) => 
                        `<div class="user-detail" data-user-id="${user.userId}"><img src="icons/chatbubble.png" alt="Chat" class="details-icon"> ${index + 1}. ${user.username} / ${user.location}</div>`
                    ).join('')}
                </div>
            </div>
            <div class="chat-button-container">
                ${room.users.length < 5 ? 
                    `<button class="enter-chat-button" data-room-id="${room.id}" data-room-type="${room.type}" data-room-name="${room.name}">
                        Enter <img src="icons/chatbubble.png" alt="Chat" class="button-icon">
                    </button>` 
                 : 
                    `<button class="enter-chat-button" disabled>
                        Room Full
                    </button>`
                }
            </div>`;
        return roomElement;
    }

    function updateRoomCount() {
        const publicRoomElements = Array.from(document.querySelectorAll('.room-details-container')).filter(room => !room.classList.contains('private'));
        const roomCount = publicRoomElements.length;
        roomsCountElement.textContent = `${roomCount} room(s) available`;
        if (roomCount === 0) {
            if (!document.getElementById('noRoomsMessage')) {
                roomList.appendChild(noRoomsMessage);
            }
        } else {
            const noRoomsMessageElement = document.getElementById('noRoomsMessage');
            if (noRoomsMessageElement) {
                noRoomsMessageElement.remove();
            }
        }
    }

    socket.on('updateCounts', ({ roomsCount, usersCount }) => {
        roomsCountElement.textContent = `${roomsCount} room(s) available`;
        usersCountElement.textContent = `${usersCount} user(s) online`;
        if (roomsCount === 0) {
            if (!document.getElementById('noRoomsMessage')) {
                roomList.appendChild(noRoomsMessage);
            }
        } else {
            const noRoomsMessageElement = document.getElementById('noRoomsMessage');
            if (noRoomsMessageElement) {
                noRoomsMessageElement.remove();
            }
        }
    });
});
