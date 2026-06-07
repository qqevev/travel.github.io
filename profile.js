// profile.js - Страница профиля пользователя (с Supabase)

// Глобальные настройки Supabase (должны быть определены в index.html)
// Если нет - пропиши здесь свои данные
const SUPABASE_URL = 'https://eibahaogtrwdqyprsmzz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qiYrU8QkIDiZCM_Z1qzd-w_xk0cMb9Q';

document.addEventListener('DOMContentLoaded', function() {
    // Проверка авторизации
    checkProfileAuth();
    
    // Загрузка данных профиля
    loadProfileData();
    
    // Инициализация вкладок
    initProfileTabs();
    
    // Инициализация кнопки редактирования
    initEditProfileButton();
});

// Проверка авторизации для профиля
function checkProfileAuth() {
    const userData = localStorage.getItem('travelUser');
    const token = localStorage.getItem('travelToken');
    
    if (!userData || !token) {
        window.location.href = 'login.html';
        return;
    }
}

// Загрузка данных профиля
function loadProfileData() {
    const userData = JSON.parse(localStorage.getItem('travelUser'));
    
    if (!userData) return;
    
    // Заполняем поля профиля
    document.getElementById('profileName').textContent = `${userData.firstName} ${userData.lastName}`;
    document.getElementById('profileEmail').textContent = userData.email;
    
    if (userData.avatar) {
        document.getElementById('profileAvatar').src = userData.avatar;
    } else {
        // Аватар по умолчанию с инициалами
        const initials = `${userData.firstName?.charAt(0) || ''}${userData.lastName?.charAt(0) || ''}`;
        document.getElementById('profileAvatar').src = `https://ui-avatars.com/api/?name=${initials}&background=4361ee&color=fff&bold=true`;
    }
    
    // Загружаем поездки пользователя из базы
    loadUserTripsFromDB(userData.id);
    
    // Загружаем друзей
    loadUserFriends();
}

// ЗАГРУЗКА ПОЕЗДОК ИЗ БАЗЫ ДАННЫХ
async function loadUserTripsFromDB(userId) {
    const container = document.getElementById('userTripsContainer');
    if (!container) return;
    
    try {
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        
        // Получаем поездки, где пользователь организатор
        const { data: ownedTrips, error: ownedError } = await supabase
            .from('trips')
            .select('*')
            .eq('owner_id', userId);
        
        if (ownedError) throw ownedError;
        
        // Получаем поездки, где пользователь участник
        const { data: memberTrips, error: memberError } = await supabase
            .from('trip_members')
            .select('trip_id, trips(*)')
            .eq('user_id', userId);
        
        if (memberError) throw memberError;
        
        // Объединяем поездки
        let allTrips = [...(ownedTrips || [])];
        
        if (memberTrips) {
            memberTrips.forEach(member => {
                if (member.trips) {
                    allTrips.push(member.trips);
                }
            });
        }
        
        if (allTrips.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-suitcase"></i><p>У вас пока нет поездок</p><button class="btn btn-primary" onclick="window.location.href=\'index.html\'">Создать поездку</button></div>';
            document.getElementById('tripsCount').textContent = '0';
            return;
        }
        
        container.innerHTML = '';
        
        allTrips.forEach(trip => {
            const isOwner = trip.owner_id === userId;
            const tripCard = createUserTripCard({
                id: trip.id,
                name: trip.name,
                image: trip.image || 'images/destinations/default.jpg',
                status: trip.status || 'planned',
                dates: trip.start_date && trip.end_date ? `${formatDate(trip.start_date)} - ${formatDate(trip.end_date)}` : 'Даты не указаны',
                members: 0, // Пока не считаем
                progress: trip.progress || 0,
                role: isOwner ? 'организатор' : 'участник'
            });
            container.appendChild(tripCard);
        });
        
        // Обновляем счетчик поездок
        document.getElementById('tripsCount').textContent = allTrips.length;
        
    } catch (error) {
        console.error('Ошибка загрузки поездок:', error);
        container.innerHTML = '<div class="error-state"><i class="fas fa-exclamation-triangle"></i><p>Ошибка загрузки поездок</p></div>';
    }
}

// Создание карточки поездки для профиля
function createUserTripCard(trip) {
    const card = document.createElement('div');
    card.className = 'trip-card';
    card.setAttribute('data-trip-id', trip.id);
    
    // Статус на русском
    let statusText = 'Запланировано';
    let statusColor = '#f59e0b';
    
    if (trip.status === 'active') {
        statusText = 'Активно';
        statusColor = '#10b981';
    } else if (trip.status === 'completed') {
        statusText = 'Завершено';
        statusColor = '#8b5cf6';
    }
    
    // Картинка по умолчанию
    const imageUrl = trip.image && trip.image !== 'images/destinations/default.jpg' 
        ? trip.image 
        : 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&h=200&fit=crop';
    
    card.innerHTML = `
        <div class="trip-card-header" style="background-image: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url('${imageUrl}'); background-size: cover; background-position: center; height: 180px; position: relative;">
            <div class="trip-status" style="position: absolute; top: 12px; right: 12px; background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 600;">
                ${statusText}
            </div>
            <div class="trip-title" style="position: absolute; bottom: 12px; left: 12px; right: 12px; color: white;">
                <h3 style="margin: 0 0 5px 0; font-size: 1.1rem; font-weight: 600;">${escapeHtml(trip.name)}</h3>
                <div class="trip-meta" style="display: flex; gap: 12px; font-size: 0.7rem;">
                    <span><i class="fas fa-calendar"></i> ${trip.dates || 'Даты не указаны'}</span>
                    <span><i class="fas fa-user-tag"></i> ${trip.role === 'организатор' ? 'Организатор' : 'Участник'}</span>
                </div>
            </div>
        </div>
        <div class="trip-card-body" style="padding: 15px;">
            <div class="trip-progress" style="margin-bottom: 12px;">
                <div class="progress-header" style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 5px;">
                    <span>Прогресс планирования</span>
                    <span>${trip.progress || 0}%</span>
                </div>
                <div class="progress-bar" style="background: #e2e8f0; border-radius: 10px; height: 6px; overflow: hidden;">
                    <div class="progress-fill" style="background: linear-gradient(90deg, #e07a5f, #81b29a); width: ${trip.progress || 0}%; height: 100%;"></div>
                </div>
            </div>
            <div class="trip-actions" style="display: flex; gap: 8px; margin-top: 12px;">
                <button class="btn-details-profile" data-id="${trip.id}" style="flex: 1; padding: 8px; background: #e07a5f; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 0.75rem;">
                    <i class="fas fa-eye"></i> Детали
                </button>
                ${trip.role === 'организатор' ? `<button class="btn-edit-profile" data-id="${trip.id}" style="flex: 1; padding: 8px; background: #e0e7ff; color: #4f46e5; border: none; border-radius: 8px; cursor: pointer; font-size: 0.75rem;">
                    <i class="fas fa-edit"></i> Редактировать
                </button>` : ''}
            </div>
        </div>
    `;
    
    // Обработчик для кнопки "Детали"
    const detailsBtn = card.querySelector('.btn-details-profile');
    if (detailsBtn) {
        detailsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Открываем детали поездки (используем глобальную функцию из script.js)
            if (typeof window.openTripDetails === 'function') {
                window.openTripDetails(trip.id);
            } else {
                alert(`Детали поездки #${trip.id} будут доступны на главной странице`);
                window.location.href = `index.html?trip=${trip.id}`;
            }
        });
    }
    
    // Обработчик для кнопки "Редактировать"
    const editBtn = card.querySelector('.btn-edit-profile');
    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.editTrip === 'function') {
                window.editTrip(trip.id);
            } else {
                alert(`Редактирование поездки #${trip.id}`);
                window.location.href = `index.html?edit=${trip.id}`;
            }
        });
    }
    
    return card;
}

// Загрузка друзей пользователя
function loadUserFriends() {
    const container = document.getElementById('friendsContainer');
    if (!container) return;
    
    // Mock данные (позже заменим на реальные из БД)
    const friends = [
        {
            id: 1,
            name: 'Мария Петрова',
            avatar: 'https://ui-avatars.com/api/?name=Мария+Петрова&background=8b5cf6&color=fff',
            location: 'Москва',
            mutualTrips: 3
        },
        {
            id: 2,
            name: 'Иван Сидоров',
            avatar: 'https://ui-avatars.com/api/?name=Иван+Сидоров&background=10b981&color=fff',
            location: 'Санкт-Петербург',
            mutualTrips: 2
        },
        {
            id: 3,
            name: 'Ольга Николаева',
            avatar: 'https://ui-avatars.com/api/?name=Ольга+Николаева&background=f59e0b&color=fff',
            location: 'Казань',
            mutualTrips: 1
        }
    ];
    
    if (friends.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>У вас пока нет друзей</p></div>';
        document.getElementById('friendsCount').textContent = '0';
        return;
    }
    
    container.innerHTML = '';
    
    friends.forEach(friend => {
        const friendCard = createFriendCard(friend);
        container.appendChild(friendCard);
    });
    
    // Обновляем счетчик друзей
    document.getElementById('friendsCount').textContent = friends.length;
}

// Создание карточки друга
function createFriendCard(friend) {
    const card = document.createElement('div');
    card.className = 'traveler-card';
    
    card.innerHTML = `
        <div class="traveler-header">
            <div class="traveler-avatar">
                <img src="${friend.avatar}" alt="${friend.name}">
            </div>
            <div class="traveler-info">
                <h4>${friend.name}</h4>
                <div class="traveler-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${friend.location}</span>
                </div>
            </div>
        </div>
        <div class="traveler-mutual">
            <i class="fas fa-suitcase"></i>
            <span>Совместных поездок: ${friend.mutualTrips}</span>
        </div>
        <div class="traveler-actions">
            <button class="btn btn-small" onclick="messageFriend(${friend.id})">
                <i class="fas fa-comment"></i> Написать
            </button>
            <button class="btn btn-small btn-outline" onclick="removeFriend(${friend.id})">
                <i class="fas fa-user-minus"></i> Удалить
            </button>
        </div>
    `;
    
    return card;
}

// Инициализация вкладок профиля
function initProfileTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            // Обновляем активную вкладку
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Показываем соответствующий контент
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) {
                    content.classList.add('active');
                }
            });
        });
    });
}

// Инициализация кнопки редактирования профиля
function initEditProfileButton() {
    const editBtn = document.getElementById('editProfileBtn');
    if (!editBtn) return;
    
    editBtn.addEventListener('click', () => {
        showEditProfileModal();
    });
}

// Показ модального окна редактирования профиля
function showEditProfileModal() {
    const userData = JSON.parse(localStorage.getItem('travelUser'));
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3><i class="fas fa-user-edit"></i> Редактировать профиль</h3>
                <button class="modal-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <form id="editProfileForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="editFirstName">Имя</label>
                            <input type="text" id="editFirstName" value="${escapeHtml(userData.firstName)}" required>
                        </div>
                        <div class="form-group">
                            <label for="editLastName">Фамилия</label>
                            <input type="text" id="editLastName" value="${escapeHtml(userData.lastName)}" required>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="editEmail">Email</label>
                        <input type="email" id="editEmail" value="${escapeHtml(userData.email)}" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="editBio">О себе</label>
                        <textarea id="editBio" placeholder="Расскажите о себе..." rows="3">${escapeHtml(userData.bio || '')}</textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="editLocation">Местоположение</label>
                        <input type="text" id="editLocation" placeholder="Город, страна" value="${escapeHtml(userData.location || '')}">
                    </div>
                    
                    <div class="form-group">
                        <label>Интересы</label>
                        <div class="interests-tags">
                            <span class="tag ${userData.interests && userData.interests.includes('mountains') ? 'active' : ''}" data-interest="mountains">Горы</span>
                            <span class="tag ${userData.interests && userData.interests.includes('beach') ? 'active' : ''}" data-interest="beach">Пляж</span>
                            <span class="tag ${userData.interests && userData.interests.includes('city') ? 'active' : ''}" data-interest="city">Город</span>
                            <span class="tag ${userData.interests && userData.interests.includes('nature') ? 'active' : ''}" data-interest="nature">Природа</span>
                            <span class="tag ${userData.interests && userData.interests.includes('extreme') ? 'active' : ''}" data-interest="extreme">Экстрим</span>
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline cancel-btn">Отмена</button>
                        <button type="submit" class="btn btn-primary">Сохранить изменения</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    // Обработка выбора интересов
    modal.querySelectorAll('.tag').forEach(tag => {
        tag.addEventListener('click', function() {
            this.classList.toggle('active');
        });
    });
    
    // Закрытие модального окна
    const closeModal = () => {
        modal.remove();
        document.body.style.overflow = '';
    };
    
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.cancel-btn').addEventListener('click', closeModal);
    
    // Обработка отправки формы
    modal.querySelector('#editProfileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveProfileChanges();
        closeModal();
    });
    
    // Закрытие при клике вне модального окна
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

// СОХРАНЕНИЕ ИЗМЕНЕНИЙ ПРОФИЛЯ В SUPABASE
async function saveProfileChanges() {
    const userData = JSON.parse(localStorage.getItem('travelUser'));
    
    // Собираем интересы
    const interests = [];
    document.querySelectorAll('.interests-tags .tag.active').forEach(tag => {
        interests.push(tag.dataset.interest);
    });
    
    // Собираем данные из формы
    const updatedData = {
        first_name: document.getElementById('editFirstName').value,
        last_name: document.getElementById('editLastName').value,
        email: document.getElementById('editEmail').value,
        bio: document.getElementById('editBio').value,
        location: document.getElementById('editLocation').value,
        interests: interests,
        updated_at: new Date().toISOString()
    };
    
    try {
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        
        // Обновляем в Supabase
        const { error } = await supabase
            .from('users')
            .update(updatedData)
            .eq('id', userData.id);
        
        if (error) throw error;
        
        // Обновляем localStorage
        const updatedUser = {
            ...userData,
            firstName: updatedData.first_name,
            lastName: updatedData.last_name,
            email: updatedData.email,
            bio: updatedData.bio,
            location: updatedData.location,
            interests: interests,
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem('travelUser', JSON.stringify(updatedUser));
        
        // Обновляем интерфейс
        loadProfileData();
        
        alert('✅ Изменения профиля сохранены в базе данных!');
        
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('❌ Ошибка сохранения: ' + error.message);
    }
}

// Вспомогательные функции
function getStatusText(status) {
    const statusMap = {
        'active': 'Активно',
        'planned': 'Запланировано',
        'completed': 'Завершено'
    };
    return statusMap[status] || status;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Глобальные функции для кнопок
window.openTrip = function(tripId) {
    alert(`Открывается поездка #${tripId}`);
};

window.editTrip = function(tripId) {
    alert(`Редактирование поездки #${tripId}`);
};

window.messageFriend = function(friendId) {
    alert(`Отправка сообщения другу #${friendId}`);
};

window.removeFriend = function(friendId) {
    if (confirm('Вы уверены, что хотите удалить этого друга?')) {
        alert(`Друг #${friendId} удален`);
        loadUserFriends();
    }
};