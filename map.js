// map.js - Интерактивная карта путешествий

let travelMap = null;
let markers = [];

// Координаты популярных направлений
const destinationCoordinates = {
    'Москва': [55.7558, 37.6173],
    'Санкт-Петербург': [59.9343, 30.3351],
    'Сочи': [43.5855, 39.7231],
    'Крым': [44.9521, 34.1024],
    'Алтай': [50.2273, 86.1227],
    'Грузия': [41.7167, 44.7833],
    'Казань': [55.7887, 49.1221],
    'Екатеринбург': [56.8389, 60.6057],
    'Новосибирск': [55.0084, 82.9357],
    'Владивосток': [43.1155, 131.8855],
    'Калининград': [54.7065, 20.5110],
    'Турция': [39.9334, 32.8597],
    'Италия': [41.8719, 12.5674],
    'Таиланд': [15.8700, 100.9925]
};

function getCoordinates(destination) {
    if (!destination) return null;
    if (destinationCoordinates[destination]) return destinationCoordinates[destination];
    for (let [name, coords] of Object.entries(destinationCoordinates)) {
        if (destination.toLowerCase().includes(name.toLowerCase()) || 
            name.toLowerCase().includes(destination.toLowerCase())) {
            return coords;
        }
    }
    return [55.7558, 37.6173];
}

async function initTravelMap() {
    const mapContainer = document.getElementById('travelMap');
    if (!mapContainer) return;
    
    if (typeof L === 'undefined') {
        console.error('Leaflet не загружен');
        return;
    }
    
    travelMap = L.map('travelMap').setView([55.7558, 37.6173], 4);
    
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19
}).addTo(travelMap);
    
    await loadTripsToMap();
}

async function loadTripsToMap() {
    if (!travelMap) return;
    
    markers.forEach(marker => {
        if (travelMap && marker) travelMap.removeLayer(marker);
    });
    markers = [];
    
    const userData = JSON.parse(localStorage.getItem('travelUser'));
    if (!userData) {
        showMapMessage('Войдите в аккаунт, чтобы видеть свои поездки на карте');
        return;
    }
    
    try {
        const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        
        const { data: ownedTrips } = await supabase.from('trips').select('*').eq('owner_id', userData.id);
        const { data: memberTrips } = await supabase.from('trip_members').select('trip_id, trips(*)').eq('user_id', userData.id);
        
        let allTrips = [...(ownedTrips || [])];
        if (memberTrips) {
            memberTrips.forEach(member => {
                if (member.trips && !allTrips.find(t => t.id === member.trips.id)) {
                    allTrips.push(member.trips);
                }
            });
        }
        
        if (allTrips.length === 0) {
            showMapMessage('У вас пока нет поездок');
            return;
        }
        
        allTrips.forEach(trip => addTripMarker(trip));
        
        if (allTrips.length > 0 && allTrips[0].destination) {
            const coords = getCoordinates(allTrips[0].destination);
            if (coords) travelMap.setView(coords, 5);
        }
        
        hideMapMessage();
        
    } catch (error) {
        console.error('Ошибка загрузки поездок на карту:', error);
        showMapMessage('Ошибка загрузки данных');
    }
}

function addTripMarker(trip) {
    if (!trip.destination) return;
    const coords = getCoordinates(trip.destination);
    if (!coords) return;
    
    let markerColor = '#e07a5f';
    let statusText = 'Запланировано';
    
    if (trip.status === 'active') {
        markerColor = '#10b981';
        statusText = 'Активно';
    } else if (trip.status === 'completed') {
        markerColor = '#8b5cf6';
        statusText = 'Завершено';
    }
    
    const markerHtml = `
        <div style="background: ${markerColor}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.2); cursor: pointer;">
            <i class="fas fa-map-marker-alt" style="color: white; font-size: 14px;"></i>
        </div>
    `;
    
    const marker = L.marker(coords, {
        icon: L.divIcon({ html: markerHtml, iconSize: [32, 32], className: 'custom-marker-icon', popupAnchor: [0, -16] })
    }).addTo(travelMap);
    
    const dates = formatTripDatesForMap(trip.start_date, trip.end_date);
    
    marker.bindPopup(`
        <div style="min-width: 200px;">
            <h4 style="margin: 0 0 8px 0;">${escapeHtml(trip.name)}</h4>
            <p style="margin: 5px 0;"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(trip.destination)}</p>
            <p style="margin: 5px 0;"><i class="fas fa-calendar"></i> ${dates}</p>
            <p style="margin: 5px 0;"><i class="fas fa-wallet"></i> ${trip.budget ? trip.budget.toLocaleString() + ' ₽' : 'Бюджет не указан'}</p>
            <div style="margin-top: 10px;"><span style="background: ${markerColor}; color: white; padding: 3px 10px; border-radius: 20px;">${statusText}</span></div>
            <button onclick="viewTripOnMap(${trip.id})" style="margin-top: 12px; width: 100%; padding: 8px; background: #e07a5f; color: white; border: none; border-radius: 8px; cursor: pointer;">Подробнее</button>
        </div>
    `);
    
    markers.push(marker);
}

function formatTripDatesForMap(start, end) {
    if (!start && !end) return 'Даты не указаны';
    if (start && !end) return start;
    if (!start && end) return end;
    if (start === end) return start;
    return `${start} — ${end}`;
}

window.viewTripOnMap = function(tripId) {
    if (typeof openTripDetails === 'function') {
        openTripDetails(tripId);
    } else {
        window.location.href = `index.html?trip=${tripId}`;
    }
};

function showMapMessage(message) {
    const mapContainer = document.getElementById('travelMap');
    if (!mapContainer) return;
    
    let overlay = document.querySelector('.map-message-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'map-message-overlay';
        overlay.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,0.9); display: flex; align-items: center; justify-content: center; z-index: 1000; border-radius: 16px; text-align: center; padding: 20px;`;
        mapContainer.style.position = 'relative';
        mapContainer.appendChild(overlay);
    }
    overlay.innerHTML = `<div><i class="fas fa-map-marked-alt" style="font-size: 3rem; color: #e07a5f; margin-bottom: 15px; display: block;"></i><p>${message}</p></div>`;
}

function hideMapMessage() {
    const overlay = document.querySelector('.map-message-overlay');
    if (overlay) overlay.remove();
}

async function refreshMap() {
    await loadTripsToMap();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (typeof L !== 'undefined') {
            initTravelMap();
        } else {
            setTimeout(initTravelMap, 500);
        }
    }, 100);
});

if (typeof loadTripsFromDB === 'function') {
    const originalLoadTrips = loadTripsFromDB;
    window.loadTripsFromDB = async function() {
        await originalLoadTrips();
        await refreshMap();
    };
}