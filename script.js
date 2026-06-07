// ===== SUPABASE ФУНКЦИИ =====

// Вспомогательная функция для Supabase запросов
async function supabaseRequest(table, action, data = null, id = null) {
    const supabase = window.supabase?.createClient?.(window.SUPABASE_URL, window.SUPABASE_KEY);
    if (!supabase) return { error: 'Supabase не инициализирован' };
    
    try {
        switch(action) {
            case 'select':
                return await supabase.from(table).select('*');
            case 'insert':
                return await supabase.from(table).insert(data);
            case 'update':
                return await supabase.from(table).update(data).eq('id', id);
            case 'delete':
                return await supabase.from(table).delete().eq('id', id);
            default:
                return { error: 'Неизвестное действие' };
        }
    } catch (error) {
        return { error: error.message };
    }
}

// ЗАГРУЗКА ПОЕЗДОК ИЗ БАЗЫ ДАННЫХ
async function loadTripsFromDB() {
    const container = document.getElementById('tripsContainer');
    if (!container) return;
    
    const userData = JSON.parse(localStorage.getItem('travelUser'));
    if (!userData) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-lock"></i><p>Войдите, чтобы увидеть свои поездки</p><a href="login.html" class="btn btn-primary">Войти</a></div>';
        return;
    }
    
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        const { data: ownedTrips, error: ownedError } = await supabase
            .from('trips')
            .select('*')
            .eq('owner_id', userData.id);
        
        if (ownedError) throw ownedError;
        
        const { data: memberTrips, error: memberError } = await supabase
            .from('trip_members')
            .select('trip_id, trips(*)')
            .eq('user_id', userData.id);
        
        if (memberError) throw memberError;
        
        let allTrips = [...(ownedTrips || [])];
        
        if (memberTrips) {
            memberTrips.forEach(member => {
                if (member.trips && !allTrips.find(t => t.id === member.trips.id)) {
                    allTrips.push(member.trips);
                }
            });
        }
        
        if (allTrips.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-suitcase"></i><p>У вас пока нет поездок</p><button class="btn btn-primary" id="emptyCreateTripBtn">Создать первую поездку</button></div>';
            const emptyBtn = document.getElementById('emptyCreateTripBtn');
            if (emptyBtn) emptyBtn.addEventListener('click', () => showCreateTripModal());
            return;
        }
        
        container.innerHTML = '';
        allTrips.forEach(trip => {
            const tripCard = createTripCardFromDB({
                id: trip.id,
                name: trip.name,
                destination: trip.destination,
                image: trip.image || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&h=200&fit=crop',
                status: trip.status || 'planned',
                dates: formatTripDates(trip.start_date, trip.end_date),
                budget: trip.budget ? `${trip.budget.toLocaleString()} ₽` : 'Не указан',
                progress: trip.progress || 0
            });
            container.appendChild(tripCard);
        });
        
        if (typeof filterTrips === 'function') filterTrips();
        
    } catch (error) {
        console.error('Ошибка загрузки поездок:', error);
        container.innerHTML = '<div class="error-state"><i class="fas fa-exclamation-triangle"></i><p>Ошибка загрузки поездок</p><button onclick="location.reload()">Обновить</button></div>';
    }
}

// СОЗДАНИЕ КАРТОЧКИ ПОЕЗДКИ
function createTripCardFromDB(trip) {
    const card = document.createElement('div');
    card.className = 'trip-card';
    card.setAttribute('data-trip-id', trip.id);
    
    let statusText = 'Запланировано';
    let statusColor = '#f59e0b';
    
    if (trip.status === 'active') {
        statusText = 'Активно';
        statusColor = '#10b981';
    } else if (trip.status === 'completed') {
        statusText = 'Завершено';
        statusColor = '#8b5cf6';
    }
    
    card.innerHTML = `
        <div class="trip-card-header" style="background-image: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url('${trip.image}'); background-size: cover; background-position: center; height: 160px; border-radius: 12px 12px 0 0; position: relative;">
            <div style="position: absolute; top: 12px; right: 12px; background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 600;">
                ${statusText}
            </div>
            <div style="position: absolute; bottom: 12px; left: 12px; right: 12px; color: white;">
                <h3 style="margin: 0 0 5px 0; font-size: 1.1rem; font-weight: 600;">${escapeHtml(trip.name)}</h3>
                <div style="display: flex; gap: 12px; font-size: 0.7rem;">
                    <span><i class="fas fa-map-marker-alt"></i> ${escapeHtml(trip.destination || 'Не указано')}</span>
                    <span><i class="fas fa-wallet"></i> ${trip.budget}</span>
                </div>
            </div>
        </div>
        <div style="padding: 15px;">
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 5px;">
                    <span>Прогресс</span>
                    <span>${trip.progress}%</span>
                </div>
                <div style="background: #e2e8f0; border-radius: 10px; height: 6px; overflow: hidden;">
                    <div style="background: linear-gradient(90deg, #6c63ff, #36d1dc); width: ${trip.progress}%; height: 100%;"></div>
                </div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn-details" data-id="${trip.id}" style="flex: 1; padding: 8px; background: #6c63ff; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 0.75rem;">
                    <i class="fas fa-eye"></i> Детали
                </button>
                <button class="btn-edit" data-id="${trip.id}" style="padding: 8px 12px; background: #e0e7ff; border: none; border-radius: 8px; cursor: pointer; color: #4f46e5;">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-share" data-id="${trip.id}" style="padding: 8px 12px; background: #f0f0f0; border: none; border-radius: 8px; cursor: pointer;">
                    <i class="fas fa-share-alt"></i>
                </button>
                <button class="btn-delete-trip" data-id="${trip.id}" style="padding: 8px 12px; background: #fee2e2; border: none; border-radius: 8px; cursor: pointer; color: #ef4444;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    
    card.querySelector('.btn-details').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openTripDetails(trip.id);
    });
    
    const editBtn = card.querySelector('.btn-edit');
    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            editTrip(trip.id);
        });
    }
    
    card.querySelector('.btn-share').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        shareTrip(trip.id);
    });
    
    card.querySelector('.btn-delete-trip').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteTrip(trip.id);
    });
    
    return card;
}

// Форматирование дат
function formatTripDates(start, end) {
    if (!start && !end) return 'Даты не указаны';
    if (start === end) return start;
    if (start && !end) return start;
    if (!start && end) return end;
    return `${start} - ${end}`;
}

// СОЗДАНИЕ НОВОЙ ПОЕЗДКИ (УПРОЩЁННАЯ РАБОЧАЯ ВЕРСИЯ)
async function createNewTrip() {
    console.log("🔵 createNewTrip вызвана");
    
    // Проверяем авторизацию
    const userDataRaw = localStorage.getItem('travelUser');
    if (!userDataRaw) {
        alert('Пожалуйста, войдите в аккаунт');
        window.location.href = 'login.html';
        return;
    }
    
    const userData = JSON.parse(userDataRaw);
    console.log("👤 Пользователь:", userData.id);
    
    // Собираем данные из формы
    const tripName = document.getElementById('tripName')?.value;
    const tripDestination = document.getElementById('tripDestination')?.value;
    
    console.log("📝 Название:", tripName, "Направление:", tripDestination);
    
    if (!tripName || !tripDestination) {
        alert('Заполните название и направление поездки!');
        return;
    }
    
    try {
        const supabase = window.supabase.createClient(
            window.SUPABASE_URL,
            window.SUPABASE_KEY
        );
        
        console.log("🔄 Отправляем запрос в Supabase...");
        
        // ПРОСТАЯ ВСТАВКА - только название и направление
        const { data: tripData, error: tripError } = await supabase
            .from('trips')
            .insert({
                name: tripName,
                destination: tripDestination,
                owner_id: userData.id
            })
            .select();
        
        if (tripError) {
            console.error("❌ Ошибка Supabase:", tripError);
            alert("Ошибка: " + tripError.message);
            return;
        }
        
        console.log("✅ Поездка создана:", tripData);
        
        alert(`✅ Поездка "${tripName}" создана!`);
        
        // Обновляем список поездок
        await loadTripsFromDB();
        
        // Закрываем модальное окно
        const modal = document.getElementById('createTripModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        alert('Ошибка: ' + error.message);
    }
}

// Экранирование HTML
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ===== ФУНКЦИИ ДЛЯ ФОТОГРАФИЙ =====

async function loadTripPhotos(tripId) {
    const container = document.getElementById('tripPhotosContainer');
    if (!container) return;
    
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        const { data: photos, error } = await supabase
            .from('trip_photos')
            .select('*')
            .eq('trip_id', tripId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (!photos || photos.length === 0) {
            container.innerHTML = '<div style="color: #999; font-size: 0.8rem;">Нет фото. Загрузите первое!</div>';
            return;
        }
        
        container.innerHTML = '';
        photos.forEach(photo => {
            const imgDiv = document.createElement('div');
            imgDiv.style.position = 'relative';
            imgDiv.style.display = 'inline-block';
            imgDiv.style.margin = '5px';
            imgDiv.innerHTML = `
                <img src="${photo.image_url}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; cursor: pointer;" onclick="window.open('${photo.image_url}', '_blank')">
                <button onclick="deletePhoto(${photo.id}, ${tripId})" style="position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 22px; height: 22px; font-size: 12px; cursor: pointer;">×</button>
            `;
            container.appendChild(imgDiv);
        });
        
    } catch (error) {
        console.error('Ошибка загрузки фото:', error);
        container.innerHTML = '<div style="color: #999; font-size: 0.8rem;">Ошибка загрузки фото</div>';
    }
}

async function uploadPhoto(tripId) {
    const fileInput = document.getElementById('photoUpload');
    if (!fileInput || !fileInput.files[0]) return;
    
    const file = fileInput.files[0];
    if (!file.type.startsWith('image/')) {
        showNotification('Пожалуйста, выберите изображение', 'error');
        return;
    }
    
    const userData = JSON.parse(localStorage.getItem('travelUser'));
    if (!userData) return;
    
    try {
        showNotification('Загрузка...', 'info');
        
        const reader = new FileReader();
        reader.onloadend = async function() {
            const base64String = reader.result;
            
            const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
            
            const { error } = await supabase
                .from('trip_photos')
                .insert({
                    trip_id: tripId,
                    user_id: userData.id,
                    image_url: base64String
                });
            
            if (error) throw error;
            
            showNotification('Фото загружено!', 'success');
            fileInput.value = '';
            await loadTripPhotos(tripId);
        };
        reader.readAsDataURL(file);
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        showNotification('Ошибка загрузки фото', 'error');
    }
}

async function deletePhoto(photoId, tripId) {
    if (!confirm('Удалить фото?')) return;
    
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        const { error } = await supabase
            .from('trip_photos')
            .delete()
            .eq('id', photoId);
        
        if (error) throw error;
        
        showNotification('Фото удалено', 'success');
        await loadTripPhotos(tripId);
        
    } catch (error) {
        console.error('Ошибка удаления:', error);
        showNotification('Ошибка удаления', 'error');
    }
}

// ===== ЭКСПОРТ В PDF =====

async function exportTripToPDF(tripId) {
    const userData = JSON.parse(localStorage.getItem('travelUser'));
    if (!userData) return;
    
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        const { data: trip, error } = await supabase
            .from('trips')
            .select('*')
            .eq('id', tripId)
            .single();
        
        if (error) throw error;
        
        const statusText = trip.status === 'active' ? 'Активно' : trip.status === 'completed' ? 'Завершено' : 'Запланировано';
        const statusColor = trip.status === 'active' ? '#10b981' : trip.status === 'completed' ? '#8b5cf6' : '#f59e0b';
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${trip.name} - Поездка</title>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Poppins', Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                    h1 { color: #e07a5f; border-bottom: 3px solid #e07a5f; padding-bottom: 10px; }
                    .info { margin: 20px 0; background: #f8f9fa; padding: 20px; border-radius: 12px; }
                    .info p { margin: 12px 0; }
                    .status { display: inline-block; padding: 5px 15px; border-radius: 20px; background: ${statusColor}; color: white; }
                    hr { margin: 30px 0; }
                    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; }
                    @media print {
                        body { padding: 20px; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <h1>✈️ ${escapeHtml(trip.name)}</h1>
                <div class="info">
                    <p><strong>📍 Направление:</strong> ${escapeHtml(trip.destination || 'Не указано')}</p>
                    <p><strong>📅 Даты:</strong> ${formatTripDates(trip.start_date, trip.end_date)}</p>
                    <p><strong>💰 Бюджет:</strong> ${trip.budget?.toLocaleString() || 0} ₽</p>
                    <p><strong>📊 Прогресс:</strong> ${trip.progress || 0}%</p>
                    <p><strong>🏷️ Статус:</strong> <span class="status">${statusText}</span></p>
                </div>
                <hr>
                <p style="color: #666;">Создано в TravelTogether - платформе для планирования путешествий</p>
                <div class="footer">
                    <p>© TravelTogether | Дата создания: ${new Date().toLocaleDateString()}</p>
                </div>
                <button onclick="window.print()" style="margin-top: 30px; padding: 12px 24px; background: #e07a5f; color: white; border: none; border-radius: 8px; cursor: pointer;">🖨️ Печать / Сохранить PDF</button>
            </body>
            </html>
        `);
        printWindow.document.close();
        
        showNotification('Открыто окно для сохранения PDF', 'success');
        
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка создания PDF', 'error');
    }
}

// ===== ОСНОВНЫЕ ФУНКЦИИ ПОЕЗДОК =====

// Открыть детали поездки
window.openTripDetails = async function(tripId) {
    console.log("🔍 Открываем детали поездки:", tripId);
    
    const userData = JSON.parse(localStorage.getItem('travelUser'));
    if (!userData) {
        showNotification('Войдите в аккаунт', 'error');
        return;
    }
    
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        const { data: trip, error } = await supabase
            .from('trips')
            .select('*')
            .eq('id', tripId)
            .single();
        
        if (error) throw error;
        
        const { data: members } = await supabase
            .from('trip_members')
            .select('user_id, role')
            .eq('trip_id', tripId);
        
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.display = 'flex';
        
        const isOwner = trip.owner_id === userData.id;
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid #eee;">
                    <h3><i class="fas fa-suitcase"></i> ${escapeHtml(trip.name)}</h3>
                    <button class="modal-close" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div style="margin-bottom: 20px;">
                        <p><i class="fas fa-map-marker-alt"></i> <strong>Направление:</strong> ${escapeHtml(trip.destination || 'Не указано')}</p>
                        <p><i class="fas fa-calendar"></i> <strong>Даты:</strong> ${formatTripDates(trip.start_date, trip.end_date)}</p>
                        <p><i class="fas fa-wallet"></i> <strong>Бюджет:</strong> ${trip.budget?.toLocaleString() || 0} ₽</p>
                        <p><i class="fas fa-chart-line"></i> <strong>Прогресс:</strong> ${trip.progress || 0}%</p>
                        <p><i class="fas fa-users"></i> <strong>Участников:</strong> ${members?.length || 1}</p>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label>Прогресс планирования:</label>
                        <input type="range" id="progressRange" min="0" max="100" value="${trip.progress || 0}" style="width: 100%; margin-top: 10px;" ${!isOwner ? 'disabled' : ''}>
                    </div>
                    
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px;">
                        ${isOwner ? `<button id="saveProgressBtn" class="btn btn-primary"><i class="fas fa-save"></i> Сохранить прогресс</button>` : ''}
                        <button id="exportPdfBtn" class="btn btn-outline"><i class="fas fa-file-pdf"></i> Экспорт PDF</button>
                        <button id="inviteFriendBtn" class="btn btn-outline"><i class="fas fa-user-plus"></i> Пригласить друга</button>
                        <button id="closeModalBtn" class="btn btn-outline"><i class="fas fa-times"></i> Закрыть</button>
                    </div>
                    
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                        <h4><i class="fas fa-users"></i> Участники:</h4>
                        <div id="membersList" style="margin-top: 10px;">
                            ${members?.map(m => `
                                <div style="display: flex; align-items: center; gap: 10px; padding: 8px; background: #f8f9fa; border-radius: 8px; margin-bottom: 5px;">
                                    <i class="fas fa-user-circle" style="font-size: 1.5rem; color: #e07a5f;"></i>
                                    <span>${m.user_id === userData.id ? 'Вы' : 'Участник'} ${m.role === 'owner' ? '(Организатор)' : ''}</span>
                                </div>
                            `).join('') || '<p>Нет участников</p>'}
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                        <h4><i class="fas fa-camera"></i> Фото поездки</h4>
                        <div id="tripPhotosContainer" style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px; margin-bottom: 10px;">
                            <div style="color: #999; font-size: 0.8rem;">Загрузка фото...</div>
                        </div>
                        <input type="file" id="photoUpload" accept="image/*" style="margin-top: 10px; display: none;">
                        <button id="uploadPhotoBtn" class="btn btn-small btn-outline" style="margin-top: 10px;">
                            <i class="fas fa-upload"></i> Загрузить фото
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        
        const closeModal = () => {
            modal.remove();
            document.body.style.overflow = '';
        };
        
        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.querySelector('#closeModalBtn').addEventListener('click', closeModal);
        
        if (isOwner) {
            modal.querySelector('#saveProgressBtn').addEventListener('click', async () => {
                const newProgress = parseInt(modal.querySelector('#progressRange').value);
                await supabase.from('trips').update({ progress: newProgress }).eq('id', tripId);
                showNotification('Прогресс сохранен!', 'success');
                closeModal();
                await loadTripsFromDB();
            });
        }
        
        const exportBtn = modal.querySelector('#exportPdfBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                exportTripToPDF(tripId);
            });
        }
        
        modal.querySelector('#inviteFriendBtn').addEventListener('click', () => {
            inviteFriendToTrip(tripId);
        });
        
        await loadTripPhotos(tripId);
        
        const uploadBtn = modal.querySelector('#uploadPhotoBtn');
        const fileInput = modal.querySelector('#photoUpload');
        
        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => {
                fileInput.click();
            });
            
            fileInput.addEventListener('change', async () => {
                if (fileInput.files[0]) {
                    await uploadPhoto(tripId);
                    await loadTripPhotos(tripId);
                    fileInput.value = '';
                }
            });
        }
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        // Подключаем чат к этой поездке
        await selectTripForChat(tripId);
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка загрузки деталей', 'error');
    }
};

// Поделиться поездкой
window.shareTrip = function(tripId) {
    const url = `${window.location.origin}${window.location.pathname}?invite=${tripId}`;
    navigator.clipboard.writeText(url);
    showNotification(`🔗 Ссылка на поездку скопирована!`, 'success');
};

// Удалить поездку
window.deleteTrip = async function(tripId) {
    if (!confirm('Вы уверены, что хотите удалить эту поездку?')) return;
    
    const userData = JSON.parse(localStorage.getItem('travelUser'));
    if (!userData) return;
    
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        await supabase.from('trip_members').delete().eq('trip_id', tripId);
        const { error } = await supabase.from('trips').delete().eq('id', tripId);
        
        if (error) throw error;
        
        showNotification('✅ Поездка удалена', 'success');
        await loadTripsFromDB();
        
    } catch (error) {
        console.error('Ошибка удаления:', error);
        showNotification('❌ Ошибка удаления', 'error');
    }
};

// Проверка приглашения
window.checkInvite = async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCode = urlParams.get('invite');
    
    if (!inviteCode) return;
    
    const userData = JSON.parse(localStorage.getItem('travelUser'));
    if (!userData) {
        showNotification('Войдите в аккаунт, чтобы присоединиться к поездке', 'info');
        return;
    }
    
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        const { data: existing } = await supabase
            .from('trip_members')
            .select('*')
            .eq('trip_id', inviteCode)
            .eq('user_id', userData.id);
        
        if (existing && existing.length > 0) {
            showNotification('Вы уже участник этой поездки!', 'info');
            return;
        }
        
        await supabase.from('trip_members').insert({
            trip_id: parseInt(inviteCode),
            user_id: userData.id,
            role: 'member'
        });
        
        showNotification('🎉 Вы присоединились к поездке!', 'success');
        await loadTripsFromDB();
        
        window.history.replaceState({}, '', window.location.pathname);
        
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Не удалось присоединиться', 'error');
    }
};

// ===== ФИЛЬТРАЦИЯ ПОЕЗДОК =====

let currentFilter = {
    search: '',
    status: 'all'
};

function filterTrips() {
    const tripCards = document.querySelectorAll('.trip-card');
    let visibleCount = 0;
    
    tripCards.forEach(card => {
        const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
        const destination = card.querySelector('.fa-map-marker-alt')?.parentElement?.textContent.toLowerCase() || '';
        
        let cardStatus = 'planned';
        const statusElement = card.querySelector('.trip-card-header div:first-child');
        const statusText = statusElement?.textContent || '';
        if (statusText === 'Активно') cardStatus = 'active';
        else if (statusText === 'Завершено') cardStatus = 'completed';
        else cardStatus = 'planned';
        
        let statusMatch = true;
        if (currentFilter.status !== 'all') {
            statusMatch = cardStatus === currentFilter.status;
        }
        
        let searchMatch = true;
        if (currentFilter.search) {
            searchMatch = title.includes(currentFilter.search) || destination.includes(currentFilter.search);
        }
        
        if (statusMatch && searchMatch) {
            card.style.display = '';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });
    
    const container = document.getElementById('tripsContainer');
    let noResultsMsg = document.querySelector('.no-results-message');
    
    if (visibleCount === 0 && tripCards.length > 0) {
        if (!noResultsMsg) {
            const msg = document.createElement('div');
            msg.className = 'no-results-message';
            msg.style.textAlign = 'center';
            msg.style.padding = '40px';
            msg.style.color = '#999';
            msg.innerHTML = '<i class="fas fa-search" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i><p>Ничего не найдено</p>';
            container.parentNode?.appendChild(msg);
        }
    } else {
        if (noResultsMsg) noResultsMsg.remove();
    }
}

function initFilters() {
    const searchInput = document.getElementById('filterSearchInput');
    const statusSelect = document.getElementById('filterStatusSelect');
    const resetBtn = document.getElementById('filterResetBtn');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentFilter.search = e.target.value.toLowerCase();
            filterTrips();
        });
    }
    
    if (statusSelect) {
        statusSelect.addEventListener('change', (e) => {
            currentFilter.status = e.target.value;
            filterTrips();
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (statusSelect) statusSelect.value = 'all';
            currentFilter = { search: '', status: 'all' };
            filterTrips();
        });
    }
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${escapeHtml(message)}</span>
        </div>
        <button class="notification-close"><i class="fas fa-times"></i></button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    });
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) notification.remove();
            }, 300);
        }
    }, 5000);
}

function getNotificationIcon(type) {
    switch(type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'info-circle';
    }
}

function getStatusText(status) {
    const statusMap = {
        'active': 'Активно',
        'planned': 'Запланировано',
        'completed': 'Завершено'
    };
    return statusMap[status] || status;
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', function() {
    const preloader = document.querySelector('.preloader');
    if (preloader) {
        setTimeout(() => {
            preloader.classList.add('fade-out');
            setTimeout(() => {
                preloader.style.display = 'none';
            }, 500);
        }, 2000);
    }
    
    checkAuthStatus();

    loadHeroImagesFromDB();
    
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const navbar = document.querySelector('.navbar');
    
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            menuToggle.innerHTML = navLinks.classList.contains('active') ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
        });
    }
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar?.classList.add('scrolled');
        } else {
            navbar?.classList.remove('scrolled');
        }
    });
    
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                navLinks?.classList.remove('active');
                if (menuToggle) menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
                window.scrollTo({ top: targetElement.offsetTop - 80, behavior: 'smooth' });
            }
        });
    });
    
    if (document.getElementById('particles-js')) {
        particlesJS('particles-js', {
            particles: {
                number: { value: 80, density: { enable: true, value_area: 800 } },
                color: { value: "#e07a5f" },
                shape: { type: "circle" },
                opacity: { value: 0.5, random: true },
                size: { value: 3, random: true },
                line_linked: { enable: true, distance: 150, color: "#e07a5f", opacity: 0.2, width: 1 },
                move: { enable: true, speed: 2, direction: "none", random: true, straight: false, out_mode: "out", bounce: false }
            },
            interactivity: { detect_on: "canvas", events: { onhover: { enable: true, mode: "repulse" }, onclick: { enable: true, mode: "push" } } }
        });
    }
    
    const datepickers = document.querySelectorAll('.datepicker');
    if (datepickers.length > 0 && typeof flatpickr !== 'undefined') {
        flatpickr.localize(flatpickr.l10ns.ru);
        datepickers.forEach(input => {
            flatpickr(input, { mode: "range", dateFormat: "d.m.Y", minDate: "today", locale: "ru", disableMobile: true });
        });
    }
    
    loadTripsFromDB();
    loadTravelersData();
    loadChatMessages();
    //renderCalendar();
    
    initWeatherWidget();
    initChatWidget();
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('animated'); });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    
    document.querySelectorAll('.step-card, .destination-item, .traveler-card').forEach(el => {
        el.classList.add('animate-on-scroll');
        observer.observe(el);
    });
    
    const totalTripsCount = document.getElementById('totalTripsCount');
    const activeUsers = document.getElementById('activeUsers');
    const destinationsCount = document.getElementById('destinationsCount');
    
    if (totalTripsCount) animateCounter(totalTripsCount, 1250, 2000);
    if (activeUsers) animateCounter(activeUsers, 5800, 2000);
    if (destinationsCount) animateCounter(destinationsCount, 120, 2000);
    
    const setupTripButton = (button) => {
        if (!button) return;
        button.addEventListener('click', (e) => {
            e.preventDefault();
            if (localStorage.getItem('travelUser')) {
                showCreateTripModal();
            } else {
                window.location.href = 'login.html';
            }
        });
    };
    setupTripButton(document.getElementById('startPlanningBtn'));
    setupTripButton(document.getElementById('createTripBtn'));
    setupTripButton(document.getElementById('createTripNavBtn'));
    
    initFilters();
    window.checkInvite();
});

// ===== ПРОВЕРКА АВТОРИЗАЦИИ =====
function checkAuthStatus() {
    const userData = localStorage.getItem('travelUser');
    const token = localStorage.getItem('travelToken');
    
    const userAvatar = document.getElementById('userAvatar');
    const logoutLink = document.getElementById('logoutLink');
    const createTripNavBtn = document.getElementById('createTripNavBtn');
    const startPlanningBtn = document.getElementById('startPlanningBtn');
    
    if (userData && token) {
        const user = JSON.parse(userData);
        
        if (userAvatar) {
            const avatarUrl = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.firstName || 'User')}&background=e07a5f&color=fff&bold=true`;
            userAvatar.innerHTML = `<img src="${avatarUrl}" alt="${user.firstName || 'Пользователь'}">`;
            userAvatar.style.cursor = 'default';
            userAvatar.onclick = null;
        }
        
        if (logoutLink) {
            logoutLink.style.display = 'block';
            logoutLink.addEventListener('click', logoutUser);
        }
        
        if (startPlanningBtn) {
            startPlanningBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Создать поездку';
            startPlanningBtn.onclick = () => showCreateTripModal();
        }
        
        if (createTripNavBtn) {
            createTripNavBtn.style.display = 'flex';
        }
    } else {
        if (userAvatar) {
            userAvatar.innerHTML = `<div style="width: 100%; height: 100%; background: linear-gradient(135deg, #e07a5f, #81b29a); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.2rem;"><i class="fas fa-user"></i></div>`;
            userAvatar.style.cursor = 'pointer';
            userAvatar.onclick = () => { window.location.href = 'login.html'; };
        }
        
        if (startPlanningBtn) {
            startPlanningBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Войти для начала';
            startPlanningBtn.onclick = () => { window.location.href = 'login.html'; };
        }
        
        if (createTripNavBtn) createTripNavBtn.style.display = 'none';
        if (logoutLink) logoutLink.style.display = 'none';
    }
}

async function logoutUser() {
    const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
    await supabase.auth.signOut();
    localStorage.removeItem('travelUser');
    localStorage.removeItem('travelToken');
    window.location.reload();
}

function showCreateTripModal() {
    console.log("🔵 showCreateTripModal вызвана");
    
    const modal = document.getElementById('createTripModal');
    if (!modal) {
        console.error("Модальное окно не найдено!");
        alert("Ошибка: модальное окно не найдено");
        return;
    }
    
    // Полностью перезаписываем содержимое модального окна
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-plus-circle"></i> Создать новую поездку</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="createTripForm">
                    <div class="form-group">
                        <label for="tripName">Название поездки *</label>
                        <input type="text" id="tripName" placeholder="Например: Отпуск в Грузии" required>
                    </div>
                    <div class="form-group">
                        <label for="tripDestination">Направление *</label>
                        <input type="text" id="tripDestination" placeholder="Куда планируете поехать?" required>
                    </div>
                    <div class="form-group">
                        <label for="tripDates">Даты поездки</label>
                        <input type="text" id="tripDates" class="datepicker" placeholder="Выберите даты">
                    </div>
                    <div class="form-group">
                        <label for="tripBudget">Бюджет (₽)</label>
                        <input type="number" id="tripBudget" placeholder="25000" value="25000">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline cancel-btn">Отмена</button>
                        <button type="submit" class="btn btn-primary">Создать поездку</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Показываем модальное окно
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Настройка datepicker
    const datepicker = document.getElementById('tripDates');
    if (datepicker && typeof flatpickr !== 'undefined') {
        flatpickr(datepicker, { 
            mode: "range", 
            dateFormat: "d.m.Y", 
            minDate: "today", 
            locale: "ru" 
        });
    }
    
    // Закрытие модального окна
    const closeModal = () => {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        // Очищаем содержимое для следующего открытия
        setTimeout(() => {
            if (modal.innerHTML.includes('createTripForm')) {
                // Оставляем как есть
            }
        }, 100);
    };
    
    // Кнопка закрытия
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    
    // Кнопка отмена
    const cancelBtn = modal.querySelector('.cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    // Отправка формы
    const form = modal.querySelector('#createTripForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Собираем данные
            const tripName = document.getElementById('tripName')?.value;
            const tripDestination = document.getElementById('tripDestination')?.value;
            
            if (!tripName || !tripDestination) {
                alert('Заполните название и направление!');
                return;
            }
            
            // Вызываем создание поездки
            if (typeof createNewTrip === 'function') {
                await createNewTrip();
            } else {
                // Если функции нет, создаем напрямую
                const userData = JSON.parse(localStorage.getItem('travelUser'));
                if (!userData) {
                    alert('Войдите в аккаунт');
                    window.location.href = 'login.html';
                    return;
                }
                
                const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
                const { error } = await supabase.from('trips').insert({
                    name: tripName,
                    destination: tripDestination,
                    owner_id: userData.id
                });
                
                if (error) {
                    alert('Ошибка: ' + error.message);
                } else {
                    alert('Поездка создана!');
                    closeModal();
                    location.reload();
                }
            }
            
            closeModal();
        });
    }
    
    // Закрытие при клике на фон
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    console.log("✅ Модальное окно открыто");
}

function animateCounter(element, target, duration) {
    if (!element) return;
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target.toLocaleString() + '+';
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current).toLocaleString() + '+';
        }
    }, 16);
}

// ЗАГРУЗКА ПУТЕШЕСТВЕННИКОВ
async function loadTravelersData() {
    const container = document.getElementById('travelersContainer');
    if (!container) return;
    
    const userData = JSON.parse(localStorage.getItem('travelUser'));
    
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        let query = supabase.from('users').select('*');
        if (userData) {
            query = query.neq('id', userData.id);
        }
        
        const { data: users, error } = await query.limit(6);
        
        if (error) throw error;
        
        if (!users || users.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Другие путешественники появятся здесь</p></div>';
            return;
        }
        
        container.innerHTML = '';
        
        for (const traveler of users) {
            const card = document.createElement('div');
            card.className = 'traveler-card';
            card.style.background = 'white';
            card.style.borderRadius = '12px';
            card.style.padding = '15px';
            card.style.margin = '10px';
            card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
            card.style.transition = 'transform 0.2s';
            
            let isFriend = false;
            let requestSent = false;
            
            if (userData) {
                const { data: friendStatus } = await supabase
                    .from('friends')
                    .select('status')
                    .or(`and(user_id.eq.${userData.id},friend_id.eq.${traveler.id}),and(user_id.eq.${traveler.id},friend_id.eq.${userData.id})`)
                    .maybeSingle();
                
                if (friendStatus) {
                    isFriend = friendStatus.status === 'accepted';
                    requestSent = friendStatus.status === 'pending';
                }
            }
            
            let buttonHtml = '';
            if (!userData) {
                buttonHtml = `<button class="btn-friend" data-id="${traveler.id}" data-name="${escapeHtml(traveler.first_name)}" style="width: 100%; padding: 8px; background: #e07a5f; color: white; border: none; border-radius: 8px; cursor: pointer;">Войдите, чтобы добавить</button>`;
            } else if (isFriend) {
                buttonHtml = `<button style="width: 100%; padding: 8px; background: #e0e7ff; color: #4f46e5; border: none; border-radius: 8px; cursor: default;" disabled><i class="fas fa-check"></i> В друзьях</button>`;
            } else if (requestSent) {
                buttonHtml = `<button style="width: 100%; padding: 8px; background: #fef3c7; color: #d97706; border: none; border-radius: 8px; cursor: default;" disabled><i class="fas fa-clock"></i> Запрос отправлен</button>`;
            } else {
                buttonHtml = `<button class="btn-friend" data-id="${traveler.id}" data-name="${escapeHtml(traveler.first_name)}" style="width: 100%; padding: 8px; background: #e07a5f; color: white; border: none; border-radius: 8px; cursor: pointer;">+ Добавить в друзья</button>`;
            }
            
            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(traveler.first_name || 'U')}+${encodeURIComponent(traveler.last_name || '')}&background=e07a5f&color=fff&bold=true" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover;">
                    <div>
                        <h4 style="margin: 0 0 5px 0;">${escapeHtml(traveler.first_name)} ${escapeHtml(traveler.last_name || '')}</h4>
                        <div style="font-size: 0.8rem; color: #666;">
                            <i class="fas fa-map-marker-alt"></i> ${escapeHtml(traveler.location || 'Не указан')}
                        </div>
                    </div>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px;">
                    <span style="background: #f0f0f0; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem;">✈️ Путешественник</span>
                </div>
                <div style="font-size: 0.8rem; color: #e07a5f; margin-bottom: 15px;">
                    <i class="fas fa-calendar"></i> Присоединился: ${new Date(traveler.created_at).toLocaleDateString()}
                </div>
                ${buttonHtml}
            `;
            
            const friendBtn = card.querySelector('.btn-friend');
            if (friendBtn && !isFriend && !requestSent && userData) {
                friendBtn.addEventListener('click', () => {
                    const userId = friendBtn.dataset.id;
                    const userName = friendBtn.dataset.name;
                    sendFriendRequest(userId, userName);
                });
            }
            
            container.appendChild(card);
        }
        
    } catch (error) {
        console.error('Ошибка загрузки путешественников:', error);
        container.innerHTML = '<div class="error-state"><i class="fas fa-exclamation-triangle"></i><p>Ошибка загрузки</p></div>';
    }
}

function loadChatMessages() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    container.innerHTML = '<div class="chat-message"><div class="message-text">Добро пожаловать в чат!</div></div>';
}

// ===== ВИДЖЕТ ПОГОДЫ =====

let currentWeatherCity = localStorage.getItem('weatherCity') || 'Москва';
let weatherUpdateInterval = null;
let isFetching = false;

async function fetchWeatherSimple(city) {
    if (isFetching) return;
    isFetching = true;
    
    const locationEl = document.getElementById('weatherLocation');
    const tempEl = document.getElementById('weatherTemp');
    const descEl = document.getElementById('weatherDesc');
    const humidityEl = document.getElementById('weatherHumidity');
    const windEl = document.getElementById('weatherWind');
    const feelsEl = document.getElementById('weatherFeels');
    
    if (!locationEl) {
        isFetching = false;
        return;
    }
    
    locationEl.textContent = city;
    if (tempEl) tempEl.textContent = '...';
    if (descEl) descEl.textContent = 'Загрузка...';
    
    try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru&format=json`;
        const geoResponse = await fetch(geoUrl);
        const geoData = await geoResponse.json();
        
        if (!geoData.results || geoData.results.length === 0) {
            throw new Error('Город не найден');
        }
        
        const { latitude, longitude, name } = geoData.results[0];
        
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,apparent_temperature,windspeed_10m&timezone=auto`;
        const weatherResponse = await fetch(weatherUrl);
        const weatherData = await weatherResponse.json();
        
        const current = weatherData.current_weather;
        const temp = Math.round(current.temperature) + '°C';
        const wind = Math.round(current.windspeed) + ' км/ч';
        
        const weatherCode = current.weathercode;
        let desc = 'Ясно';
        let iconClass = 'fa-sun';
        
        if (weatherCode === 0) { desc = 'Ясно'; iconClass = 'fa-sun'; }
        else if (weatherCode === 1 || weatherCode === 2) { desc = 'Переменная облачность'; iconClass = 'fa-cloud-sun'; }
        else if (weatherCode === 3) { desc = 'Облачно'; iconClass = 'fa-cloud'; }
        else if (weatherCode >= 51 && weatherCode <= 67) { desc = 'Дождь'; iconClass = 'fa-cloud-rain'; }
        else if (weatherCode >= 71 && weatherCode <= 77) { desc = 'Снег'; iconClass = 'fa-snowflake'; }
        else if (weatherCode >= 80 && weatherCode <= 99) { desc = 'Ливень'; iconClass = 'fa-cloud-showers-heavy'; }
        
        let humidity = '--%';
        let feels = '--°C';
        
        if (weatherData.hourly && weatherData.hourly.relativehumidity_2m && weatherData.hourly.relativehumidity_2m.length > 0) {
            humidity = weatherData.hourly.relativehumidity_2m[0] + '%';
        }
        if (weatherData.hourly && weatherData.hourly.apparent_temperature && weatherData.hourly.apparent_temperature.length > 0) {
            feels = Math.round(weatherData.hourly.apparent_temperature[0]) + '°C';
        }
        
        locationEl.textContent = name;
        if (tempEl) tempEl.textContent = temp;
        if (descEl) descEl.textContent = desc;
        if (humidityEl) humidityEl.textContent = humidity;
        if (windEl) windEl.textContent = wind;
        if (feelsEl) feelsEl.textContent = feels;
        
        const weatherIcon = document.querySelector('.weather-header i');
        if (weatherIcon) weatherIcon.className = `fas ${iconClass}`;
        
        const updateTimeEl = document.getElementById('weatherUpdateTime');
        if (updateTimeEl) updateTimeEl.textContent = `обновлено ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        
    } catch (error) {
        console.error('Ошибка погоды:', error);
        if (tempEl) tempEl.textContent = '--°C';
        if (descEl) descEl.textContent = 'Ошибка';
        locationEl.textContent = city;
    } finally {
        isFetching = false;
    }
}

function showCityModalSimple() {
    const modal = document.getElementById('cityModal');
    if (modal) {
        modal.classList.add('active');
        const input = document.getElementById('cityInput');
        if (input) input.value = currentWeatherCity;
    }
}

function saveCitySimple() {
    const input = document.getElementById('cityInput');
    let newCity = input?.value.trim();
    if (newCity) {
        currentWeatherCity = newCity;
        localStorage.setItem('weatherCity', currentWeatherCity);
        fetchWeatherSimple(currentWeatherCity);
        const modal = document.getElementById('cityModal');
        if (modal) modal.classList.remove('active');
    }
}

function initWeatherWidget() {
    const savedCity = localStorage.getItem('weatherCity');
    if (savedCity) currentWeatherCity = savedCity;
    
    fetchWeatherSimple(currentWeatherCity);
    
    if (weatherUpdateInterval) clearInterval(weatherUpdateInterval);
    weatherUpdateInterval = setInterval(() => fetchWeatherSimple(currentWeatherCity), 30 * 60 * 1000);
    
    const settingsBtn = document.getElementById('weatherSettingsBtn');
    const refreshBtn = document.getElementById('refreshWeatherBtn');
    const saveBtn = document.getElementById('saveCityBtn');
    const locationBtn = document.getElementById('useLocationBtn');
    const closeBtns = document.querySelectorAll('.cityModalClose');
    
    if (settingsBtn) settingsBtn.addEventListener('click', showCityModalSimple);
    if (refreshBtn) refreshBtn.addEventListener('click', () => fetchWeatherSimple(currentWeatherCity));
    if (saveBtn) saveBtn.addEventListener('click', saveCitySimple);
    
    if (locationBtn) {
        locationBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('https://ipapi.co/json/');
                const data = await response.json();
                if (data.city) {
                    currentWeatherCity = data.city;
                    localStorage.setItem('weatherCity', currentWeatherCity);
                    fetchWeatherSimple(currentWeatherCity);
                    const modal = document.getElementById('cityModal');
                    if (modal) modal.classList.remove('active');
                } else {
                    alert('Не удалось определить город');
                }
            } catch (error) {
                alert('Не удалось определить город');
            }
        });
    }
    
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById('cityModal');
            if (modal) modal.classList.remove('active');
        });
    });
    
    const modal = document.getElementById('cityModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    }
}

function initChatWidget() {
    const toggleBtn = document.getElementById('toggleChat');
    const chatWidget = document.getElementById('chatWidget');
    if (toggleBtn && chatWidget) {
        toggleBtn.addEventListener('click', () => {
            const isVisible = chatWidget.style.height !== '50px';
            chatWidget.style.height = isVisible ? '50px' : '400px';
            toggleBtn.innerHTML = isVisible ? '<i class="fas fa-chevron-up"></i>' : '<i class="fas fa-chevron-down"></i>';
        });
    }
    
    const sendBtn = document.getElementById('sendMessageBtn');
    const chatInput = document.getElementById('chatInput');
    const messagesContainer = document.getElementById('chatMessages');
    
    if (sendBtn && chatInput && messagesContainer) {
        sendBtn.addEventListener('click', () => {
            if (chatInput.value.trim()) {
                const messageEl = document.createElement('div');
                messageEl.className = 'chat-message own';
                messageEl.innerHTML = `<div class="message-text">${escapeHtml(chatInput.value)}</div>`;
                messagesContainer.appendChild(messageEl);
                chatInput.value = '';
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        });
    }
}

window.editTrip = async function(tripId) {
    console.log("✏️ Редактирование поездки:", tripId);
    
    const userData = JSON.parse(localStorage.getItem('travelUser'));
    if (!userData) {
        showNotification('Войдите в аккаунт', 'error');
        return;
    }
    
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        const { data: trip, error } = await supabase
            .from('trips')
            .select('*')
            .eq('id', tripId)
            .single();
        
        if (error) throw error;
        
        if (trip.owner_id !== userData.id) {
            showNotification('Только организатор может редактировать поездку', 'error');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid #eee;">
                    <h3><i class="fas fa-edit"></i> Редактировать поездку</h3>
                    <button class="modal-close" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <form id="editTripForm">
                        <div class="form-group">
                            <label>Название поездки</label>
                            <input type="text" id="editTripName" value="${escapeHtml(trip.name)}" required>
                        </div>
                        <div class="form-group">
                            <label>Направление</label>
                            <input type="text" id="editTripDestination" value="${escapeHtml(trip.destination || '')}" required>
                        </div>
                        <div class="form-group">
                            <label>Бюджет (₽)</label>
                            <input type="number" id="editTripBudget" value="${trip.budget || 0}">
                        </div>
                        <div class="form-group">
                            <label>Статус</label>
                            <select id="editTripStatus">
                                <option value="planned" ${trip.status === 'planned' ? 'selected' : ''}>Запланировано</option>
                                <option value="active" ${trip.status === 'active' ? 'selected' : ''}>Активно</option>
                                <option value="completed" ${trip.status === 'completed' ? 'selected' : ''}>Завершено</option>
                            </select>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="button" class="btn btn-outline cancel-btn">Отмена</button>
                            <button type="submit" class="btn btn-primary">Сохранить</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        
        const closeModal = () => {
            modal.remove();
            document.body.style.overflow = '';
        };
        
        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.querySelector('.cancel-btn').addEventListener('click', closeModal);
        
        modal.querySelector('#editTripForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newName = document.getElementById('editTripName').value;
            const newDestination = document.getElementById('editTripDestination').value;
            const newBudget = parseInt(document.getElementById('editTripBudget').value) || 0;
            const newStatus = document.getElementById('editTripStatus').value;
            
            const { error: updateError } = await supabase
                .from('trips')
                .update({
                    name: newName,
                    destination: newDestination,
                    budget: newBudget,
                    status: newStatus
                })
                .eq('id', tripId);
            
            if (updateError) {
                showNotification('Ошибка сохранения', 'error');
            } else {
                showNotification('✅ Поездка обновлена!', 'success');
                closeModal();
                await loadTripsFromDB();
            }
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
};

// Пригласить друга в поездку
window.inviteFriendToTrip = async function(tripId, friendEmail) {
    if (!friendEmail) {
        const email = prompt('Введите email друга, чтобы пригласить его в поездку:');
        if (!email) return;
        friendEmail = email;
    }
    
    const userData = JSON.parse(localStorage.getItem('travelUser'));
    if (!userData) {
        showNotification('Войдите в аккаунт', 'error');
        return;
    }
    
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        const { data: friend, error: findError } = await supabase
            .from('users')
            .select('id, email, first_name')
            .eq('email', friendEmail)
            .single();
        
        if (findError || !friend) {
            const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${tripId}`;
            navigator.clipboard.writeText(inviteUrl);
            showNotification(`Пользователь с email ${friendEmail} не найден. Ссылка-приглашение скопирована!`, 'info');
            return;
        }
        
        const { data: existing } = await supabase
            .from('trip_members')
            .select('*')
            .eq('trip_id', tripId)
            .eq('user_id', friend.id);
        
        if (existing && existing.length > 0) {
            showNotification('Пользователь уже является участником этой поездки', 'warning');
            return;
        }
        
        const { error: addError } = await supabase
            .from('trip_members')
            .insert({
                trip_id: tripId,
                user_id: friend.id,
                role: 'member'
            });
        
        if (addError) throw addError;
        
        showNotification(`✅ ${friend.first_name || 'Пользователь'} добавлен в поездку!`, 'success');
        
        const membersList = document.getElementById('membersList');
        if (membersList) {
            const newMemberHtml = `
                <div style="display: flex; align-items: center; gap: 10px; padding: 8px; background: #f8f9fa; border-radius: 8px; margin-bottom: 5px;">
                    <i class="fas fa-user-circle" style="font-size: 1.5rem; color: #e07a5f;"></i>
                    <span>${escapeHtml(friend.first_name || friend.email)} (Приглашен)</span>
                </div>
            `;
            membersList.insertAdjacentHTML('beforeend', newMemberHtml);
        }
        
    } catch (error) {
        console.error('Ошибка приглашения:', error);
        showNotification('Ошибка при приглашении друга', 'error');
    }
};

// ===== ФУНКЦИИ ДЛЯ РАБОТЫ С ДРУЗЬЯМИ =====

window.sendFriendRequest = async function(userId, userName) {
    const userData = JSON.parse(localStorage.getItem('travelUser'));
    if (!userData) {
        showNotification('Войдите в аккаунт, чтобы добавить друзей', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        return;
    }
    
    if (userData.id === userId) {
        showNotification('Нельзя добавить самого себя в друзья', 'warning');
        return;
    }
    
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        const { data: existing } = await supabase
            .from('friends')
            .select('*')
            .or(`and(user_id.eq.${userData.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${userData.id})`)
            .maybeSingle();
        
        if (existing) {
            if (existing.status === 'accepted') {
                showNotification(`${userName || 'Пользователь'} уже ваш друг!`, 'info');
            } else if (existing.status === 'pending') {
                showNotification(`Запрос дружбы уже отправлен ${userName || 'пользователю'}`, 'info');
            }
            return;
        }
        
        const { error: insertError } = await supabase
            .from('friends')
            .insert({
                user_id: userData.id,
                friend_id: userId,
                status: 'pending',
                created_at: new Date().toISOString()
            });
        
        if (insertError) throw insertError;
        
        showNotification(`🤝 Запрос дружбы отправлен ${userName || 'пользователю'}!`, 'success');
        
        await supabase
            .from('notifications')
            .insert({
                user_id: userId,
                type: 'friend_request',
                title: 'Запрос дружбы',
                message: `${userData.firstName} ${userData.lastName} хочет добавить вас в друзья`,
                created_at: new Date().toISOString()
            });
        
    } catch (error) {
        console.error('Ошибка отправки запроса:', error);
        showNotification('Ошибка при отправке запроса', 'error');
    }
};

window.acceptFriendRequest = async function(requestId, userId) {
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        const { error } = await supabase
            .from('friends')
            .update({ status: 'accepted' })
            .eq('id', requestId);
        
        if (error) throw error;
        
        showNotification('Запрос дружбы принят!', 'success');
        
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка при принятии запроса', 'error');
    }
};

window.rejectFriendRequest = async function(requestId) {
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        const { error } = await supabase
            .from('friends')
            .delete()
            .eq('id', requestId);
        
        if (error) throw error;
        
        showNotification('Запрос отклонен', 'info');
        
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка при отклонении запроса', 'error');
    }
};

function updateLiveStats() {
    const totalTripsEl = document.getElementById('totalTripsCount');
    const activeUsersEl = document.getElementById('activeUsers');
    
    if (totalTripsEl) {
        let count = 1250;
        setInterval(() => {
            count += Math.floor(Math.random() * 10);
            totalTripsEl.textContent = count.toLocaleString() + '+';
        }, 30000);
    }
    
    if (activeUsersEl) {
        let count = 5800;
        setInterval(() => {
            count += Math.floor(Math.random() * 5);
            activeUsersEl.textContent = count.toLocaleString() + '+';
        }, 30000);
    }
}

// ===== КАЛЕНДАРЬ ПОЕЗДОК =====

let currentCalendarDate = new Date();

async function renderCalendar() {
    const container = document.getElementById('tripsCalendar');
    if (!container) {
        console.log("Контейнер календаря не найден");
        return;
    }
    
    const userData = JSON.parse(localStorage.getItem('travelUser'));
    if (!userData) {
        container.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fas fa-lock" style="font-size: 3rem; color: #e07a5f; margin-bottom: 15px; display: block;"></i><p>Войдите, чтобы видеть календарь</p><button onclick="window.location.href=\'login.html\'" class="btn btn-primary">Войти</button></div>';
        return;
    }
    
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        const { data: trips, error } = await supabase
            .from('trips')
            .select('*')
            .eq('owner_id', userData.id);
        
        if (error) throw error;
        
        console.log("Поездки для календаря:", trips);
        
        // Функция для преобразования даты из формата дд.мм.гггг в гггг-мм-дд
        function convertToDateKey(dateStr) {
            if (!dateStr) return null;
            // Если уже в формате YYYY-MM-DD
            if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
                return dateStr;
            }
            // Если в формате DD.MM.YYYY
            const parts = dateStr.split('.');
            if (parts.length === 3) {
                return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
            }
            return null;
        }
        
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startWeekday = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        
        const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        
        let calendarHtml = `
            <div style="text-align: center; margin-bottom: 20px; display: flex; justify-content: center; align-items: center; gap: 20px;">
                <button onclick="changeMonth(-1)" style="background: #f0f0f0; border: none; font-size: 1.2rem; cursor: pointer; padding: 8px 16px; border-radius: 8px;">←</button>
                <span style="font-size: 1.3rem; font-weight: bold;">${monthNames[month]} ${year}</span>
                <button onclick="changeMonth(1)" style="background: #f0f0f0; border: none; font-size: 1.2rem; cursor: pointer; padding: 8px 16px; border-radius: 8px;">→</button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; text-align: center;">
                ${weekdays.map(day => `<div style="font-weight: bold; padding: 10px; color: #e07a5f;">${day}</div>`).join('')}
        `;
        
        // Пустые ячейки для начала месяца
        const startOffset = startWeekday === 0 ? 6 : startWeekday - 1;
        for (let i = 0; i < startOffset; i++) {
            calendarHtml += `<div style="padding: 10px; background: #f8f9fa; border-radius: 8px;"></div>`;
        }
        
        // Дни месяца
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            
            // Проверяем, есть ли поездки в этот день
            let hasTrips = false;
            let tripNames = [];
            
            for (const trip of trips) {
                const startDateKey = convertToDateKey(trip.start_date);
                const endDateKey = convertToDateKey(trip.end_date);
                
                // Проверяем, попадает ли день в диапазон поездки
                if (startDateKey && startDateKey === currentDate) {
                    hasTrips = true;
                    tripNames.push(trip.name);
                }
                if (endDateKey && endDateKey === currentDate && endDateKey !== startDateKey) {
                    hasTrips = true;
                    tripNames.push(trip.name);
                }
                // Если есть начало и конец, проверяем диапазон
                if (startDateKey && endDateKey && currentDate >= startDateKey && currentDate <= endDateKey) {
                    hasTrips = true;
                    if (!tripNames.includes(trip.name)) {
                        tripNames.push(trip.name);
                    }
                }
            }
            
            calendarHtml += `
                <div style="padding: 10px; background: ${hasTrips ? '#fdf0ea' : 'white'}; border-radius: 8px; min-height: 60px; border: 1px solid #eee; position: relative;">
                    <span style="font-weight: bold; font-size: 1rem;">${day}</span>
                    ${hasTrips ? `<div style="font-size: 10px; margin-top: 5px; color: #e07a5f; background: #fff0ea; padding: 2px 6px; border-radius: 12px; display: inline-block;" title="${tripNames.join(', ')}">✈️ ${tripNames.length}</div>` : ''}
                </div>
            `;
        }
        
        calendarHtml += `</div>`;
        container.innerHTML = calendarHtml;
        console.log("Календарь загружен, поездок:", trips?.length);
        
    } catch (error) {
        console.error('Ошибка календаря:', error);
        container.innerHTML = '<div style="text-align: center; padding: 40px;">Ошибка загрузки календаря</div>';
    }
}
function changeMonth(delta) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
    renderCalendar();
}

// ===== РЕАЛЬНЫЙ ЧАТ С SUPABASE =====

let currentTripId = null;
let chatSubscription = null;

async function loadChatMessagesForTrip(tripId) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    const userData = JSON.parse(localStorage.getItem('travelUser'));
    if (!userData) return;
    
    currentTripId = tripId;
    
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*, users(first_name, last_name)')
            .eq('trip_id', tripId)
            .order('created_at', { ascending: true })
            .limit(50);
        
        if (error) throw error;
        
        if (!messages || messages.length === 0) {
            container.innerHTML = '<div class="chat-message"><div class="message-text">Напишите первое сообщение в чат!</div></div>';
            return;
        }
        
        container.innerHTML = '';
        
        messages.forEach(msg => {
            const isOwn = msg.user_id === userData.id;
            const userName = msg.users?.first_name || 'Пользователь';
            const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const messageEl = document.createElement('div');
            messageEl.className = `chat-message ${isOwn ? 'own' : ''}`;
            messageEl.innerHTML = `
                <div class="message-header">
                    <strong>${escapeHtml(userName)}</strong>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text">${escapeHtml(msg.message)}</div>
            `;
            container.appendChild(messageEl);
        });
        
        container.scrollTop = container.scrollHeight;
        
        subscribeToChatMessages(tripId);
        
    } catch (error) {
        console.error('Ошибка загрузки чата:', error);
        container.innerHTML = '<div class="chat-message"><div class="message-text">Ошибка загрузки чата</div></div>';
    }
}

function subscribeToChatMessages(tripId) {
    if (chatSubscription) {
        chatSubscription.unsubscribe();
    }
    
    const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
    
    chatSubscription = supabase
        .channel(`messages:${tripId}`)
        .on('postgres_changes', 
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'messages',
                filter: `trip_id=eq.${tripId}`
            },
            (payload) => {
                addNewMessageToChat(payload.new);
            }
        )
        .subscribe();
}

async function addNewMessageToChat(message) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    const userData = JSON.parse(localStorage.getItem('travelUser'));
    if (!userData) return;
    
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        const { data: user, error } = await supabase
            .from('users')
            .select('first_name, last_name')
            .eq('id', message.user_id)
            .single();
        
        const userName = user?.first_name || 'Пользователь';
        const isOwn = message.user_id === userData.id;
        const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${isOwn ? 'own' : ''}`;
        messageEl.innerHTML = `
            <div class="message-header">
                <strong>${escapeHtml(userName)}</strong>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-text">${escapeHtml(message.message)}</div>
        `;
        container.appendChild(messageEl);
        container.scrollTop = container.scrollHeight;
        
    } catch (error) {
        console.error('Ошибка добавления сообщения:', error);
    }
}

async function sendChatMessage(tripId) {
    const input = document.getElementById('chatInput');
    if (!input || !input.value.trim()) return;
    
    const userData = JSON.parse(localStorage.getItem('travelUser'));
    if (!userData) {
        showNotification('Войдите в аккаунт', 'error');
        return;
    }
    
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        const { error } = await supabase
            .from('messages')
            .insert({
                trip_id: tripId,
                user_id: userData.id,
                message: input.value.trim()
            });
        
        if (error) throw error;
        
        input.value = '';
        
    } catch (error) {
        console.error('Ошибка отправки:', error);
        showNotification('Ошибка отправки сообщения', 'error');
    }
}

// Загрузка изображений для героя из базы данных
// Загрузка изображений для героя из базы данных
async function loadHeroImagesFromDB() {
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        // Загружаем данные из таблицы hero_images
        const { data: images, error } = await supabase
            .from('hero_images')
            .select('*')
            .order('id');
        
        if (error) throw error;
        
        // Обновляем картинки (если есть в БД)
        if (images && images.length > 0) {
            images.forEach(image => {
                if (image.position === 'card1') {
                    const imgElement = document.getElementById('heroCard1Img');
                    const titleElement = document.getElementById('heroCard1Title');
                    if (imgElement) imgElement.src = image.image_url;
                    if (titleElement) titleElement.textContent = image.name;
                } else if (image.position === 'card2') {
                    const imgElement = document.getElementById('heroCard2Img');
                    const titleElement = document.getElementById('heroCard2Title');
                    if (imgElement) imgElement.src = image.image_url;
                    if (titleElement) titleElement.textContent = image.name;
                }
            });
        } else {
            // Если нет изображений в БД, используем стандартные
            useDefaultHeroImages();
        }
        
        // ВСЕГДА показываем статичную статистику (как было раньше)
        setStaticStats();
        
    } catch (error) {
        console.error('Ошибка загрузки изображений героя:', error);
        useDefaultHeroImages();
        setStaticStats();
    }
}

// Статичная статистика (то, что было раньше)
function setStaticStats() {
    // Карточка 1 (Грузия)
    const card1People = document.getElementById('heroCard1People');
    const card1Days = document.getElementById('heroCard1Days');
    
    if (card1People) card1People.textContent = '5';
    if (card1Days) card1Days.textContent = '10';
    
    // Карточка 2 (Алтай)
    const card2People = document.getElementById('heroCard2People');
    const card2Budget = document.getElementById('heroCard2Budget');
    
    if (card2People) card2People.textContent = '3';
    if (card2Budget) card2Budget.textContent = '25 000';
}

// Использование изображений по умолчанию
function useDefaultHeroImages() {
    const defaultImages = {
        card1: {
            img: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&h=250&fit=crop',
            title: 'Отпуск в Грузии'
        },
        card2: {
            img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=250&fit=crop',
            title: 'Поход на Алтай'
        }
    };
    
    const card1Img = document.getElementById('heroCard1Img');
    const card1Title = document.getElementById('heroCard1Title');
    const card2Img = document.getElementById('heroCard2Img');
    const card2Title = document.getElementById('heroCard2Title');
    
    if (card1Img) card1Img.src = defaultImages.card1.img;
    if (card1Title) card1Title.textContent = defaultImages.card1.title;
    if (card2Img) card2Img.src = defaultImages.card2.img;
    if (card2Title) card2Title.textContent = defaultImages.card2.title;
}

// Обновление карточки героя
function updateHeroCard(cardNumber, imageData) {
    const imgElement = document.getElementById(`heroCard${cardNumber}Img`);
    const titleElement = document.getElementById(`heroCard${cardNumber}Title`);
    
    if (imgElement && imageData.image_url) {
        imgElement.src = imageData.image_url;
        imgElement.alt = imageData.alt_text || imageData.name;
    }
    
    if (titleElement) {
        titleElement.textContent = imageData.name;
    }
}

// Загрузка статистики для карточек (участники, дни, бюджет)
async function loadHeroCardStats() {
    const userData = JSON.parse(localStorage.getItem('travelUser'));
    
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        // Получаем все поездки
        let query = supabase.from('trips').select('*');
        
        const { data: trips, error } = await query.limit(10);
        
        if (error) throw error;
        
        if (trips && trips.length >= 2) {
            // Для первой карточки - берем последнюю активную поездку
            const activeTrip = trips.find(t => t.status === 'active') || trips[0];
            if (activeTrip) {
                // Подсчитываем участников
                const { count: membersCount } = await supabase
                    .from('trip_members')
                    .select('*', { count: 'exact', head: true })
                    .eq('trip_id', activeTrip.id);
                
                // Обновляем мета-информацию карточки 1
                const peopleSpan = document.getElementById('heroCard1People');
                const daysSpan = document.getElementById('heroCard1Days');
                
                if (peopleSpan) peopleSpan.textContent = (membersCount || 1) + 1; // +1 для организатора
                if (daysSpan && activeTrip.start_date && activeTrip.end_date) {
                    const days = Math.ceil((new Date(activeTrip.end_date) - new Date(activeTrip.start_date)) / (1000 * 60 * 60 * 24));
                    daysSpan.textContent = days || '?';
                } else if (daysSpan) {
                    daysSpan.textContent = '?';
                }
            }
            
            // Для второй карточки
            const plannedTrip = trips.find(t => t.status === 'planned') || trips[1] || trips[0];
            if (plannedTrip) {
                const budgetSpan = document.getElementById('heroCard2Budget');
                if (budgetSpan && plannedTrip.budget) {
                    budgetSpan.textContent = plannedTrip.budget.toLocaleString();
                }
                
                const peopleSpan = document.getElementById('heroCard2People');
                if (peopleSpan) {
                    const { count: membersCount } = await supabase
                        .from('trip_members')
                        .select('*', { count: 'exact', head: true })
                        .eq('trip_id', plannedTrip.id);
                    peopleSpan.textContent = (membersCount || 1) + 1;
                }
            }
        }
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        // Используем стандартные значения
        useDefaultStats();
    }
}

// Создание стандартных изображений в базе данных
async function createDefaultHeroImages() {
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        const defaultImages = [
            {
                name: 'Грузия',
                image_url: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&h=250&fit=crop',
                position: 'card1',
                alt_text: 'Отпуск в Грузии'
            },
            {
                name: 'Алтай',
                image_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=250&fit=crop',
                position: 'card2',
                alt_text: 'Поход на Алтай'
            }
        ];
        
        for (const image of defaultImages) {
            const { error } = await supabase
                .from('hero_images')
                .insert(image);
            
            if (error) console.error('Ошибка вставки:', error);
        }
        
        console.log('Стандартные изображения добавлены в базу');
        await loadHeroImagesFromDB();
        
    } catch (error) {
        console.error('Ошибка создания стандартных изображений:', error);
        useDefaultHeroImages();
    }
}

// Использование изображений по умолчанию (если БД недоступна)
function useDefaultHeroImages() {
    const defaultImages = {
        card1: {
            img: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&h=250&fit=crop',
            title: 'Отпуск в Грузии'
        },
        card2: {
            img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=250&fit=crop',
            title: 'Поход на Алтай'
        }
    };
    
    for (let i = 1; i <= 2; i++) {
        const imgElement = document.getElementById(`heroCard${i}Img`);
        const titleElement = document.getElementById(`heroCard${i}Title`);
        
        if (imgElement) imgElement.src = defaultImages[`card${i}`].img;
        if (titleElement) titleElement.textContent = defaultImages[`card${i}`].title;
    }
    
    useDefaultStats();
}

// Стандартная статистика
function useDefaultStats() {
    const card1People = document.getElementById('heroCard1People');
    const card1Days = document.getElementById('heroCard1Days');
    const card2People = document.getElementById('heroCard2People');
    const card2Budget = document.getElementById('heroCard2Budget');
    
    if (card1People) card1People.textContent = '5';
    if (card1Days) card1Days.textContent = '10';
    if (card2People) card2People.textContent = '3';
    if (card2Budget) card2Budget.textContent = '25 000';
}

// Админ-функция для загрузки новых изображений
window.uploadHeroImage = async function(imageFile, name, position, altText) {
    const userData = JSON.parse(localStorage.getItem('travelUser'));
    
    // Проверка прав администратора (можно добавить поле is_admin в users)
    if (!userData || userData.email !== 'admin@example.com') {
        showNotification('Только администратор может загружать изображения', 'error');
        return;
    }
    
    if (!imageFile || !name || !position) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    try {
        showNotification('Загрузка изображения...', 'info');
        
        // Конвертируем изображение в base64
        const reader = new FileReader();
        reader.onloadend = async function() {
            const base64String = reader.result;
            
            const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
            
            // Удаляем старое изображение на этой позиции, если нужно
            if (confirm('Заменить существующее изображение на этой позиции?')) {
                await supabase
                    .from('hero_images')
                    .delete()
                    .eq('position', position);
            }
            
            // Добавляем новое
            const { error } = await supabase
                .from('hero_images')
                .insert({
                    name: name,
                    image_url: base64String,
                    position: position,
                    alt_text: altText || name
                });
            
            if (error) throw error;
            
            showNotification('Изображение успешно загружено!', 'success');
            await loadHeroImagesFromDB(); // Обновляем отображение
            
        };
        reader.readAsDataURL(imageFile);
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        showNotification('Ошибка загрузки изображения', 'error');
    }
};

async function selectTripForChat(tripId) {
    await loadChatMessagesForTrip(tripId);
    
    const sendBtn = document.getElementById('sendMessageBtn');
    if (sendBtn) {
        const newSendBtn = sendBtn.cloneNode(true);
        sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
        newSendBtn.addEventListener('click', () => sendChatMessage(tripId));
    }
    
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.removeEventListener('keypress', chatInput._keypressHandler);
        chatInput._keypressHandler = (e) => {
            if (e.key === 'Enter') sendChatMessage(tripId);
        };
        chatInput.addEventListener('keypress', chatInput._keypressHandler);
    }
}

// Пустые функции для совместимости
function initModals() {}
function initAnimations() {}
function initDraggableWidgets() {}
function viewTravelerProfile(userId) { showNotification(`Профиль #${userId}`, 'info'); }