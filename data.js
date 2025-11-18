// КОНФИГУРАЦИЯ - НАСТРОЙТЕ ЭТИ ПАРАМЕТРЫ ПЕРЕД ДЕПЛОЕМ!

// 🔧 ID администраторов - замените на реальные ID пользователей MAX
const ADMIN_USER_IDS = ['123456789', '987654321', '555666777']; // ЗАМЕНИТЕ НА РЕАЛЬНЫЕ ID!

// 📍 Данные точек Wi-Fi (ваш существующий массив)
const wifiPoints = [
    {
        id: 1,
        name: "1-я Городская Больница 🏥",
        address: "ул. Адмирала Октябрьского, 19",
        coordinates: { lat: 44.601878, lon: 33.517227 },
        description: "65 точек доступа. Бесплатный Wi-Fi для пациентов и посетителей",
        type: "здрав"
    },
    {
        id: 2,
        name: "5-я Городская Больница",
        address: "просп. Генерала Острякова, 211Б",
        coordinates: { lat: 44.554841, lon: 33.533712 },
        description: "53 точки доступа. Wi-Fi в родильном доме и детской поликлинике",
        type: "здрав"
    },
    {
        id: 3,
        name: "9-я Городская Больница 🏥",
        address: "ул. Мира, 5",
        coordinates: { lat: 44.514211, lon: 33.598949 },
        description: "29 точек доступа в больнице и поликлиника",
        type: "здрав"
    },
    {
        id: 4,
        name: "Школа №22 🎓",
        address: "проспект Генерала Острякова, 65",
        coordinates: { lat: 44.573829, lon: 33.522198 },
        description: "2 точки доступа",
        type: "образование"
    },
    {
        id: 6,
        name: "ТЦ Пассаж 🛍️",
        address: "улица Щербака, 1",
        coordinates: { lat: 44.610553, lon: 33.515586 },
        description: "5 точек доступа в торговом центре",
        type: "тц"
    },
    {
        id: 216,
        name: "МФЦ - Вокзальная 🏢",
        address: "ул. Вокзальная, д. 10",
        coordinates: { lat: 44.594299, lon: 33.532275 },
        description: "Многофункциональный центр предоставления услуг",
        type: "МФЦ"
    }
    // Добавьте остальные точки из вашего бота...
];

// 🗄️ Локальное хранилище для заявок
let userRequests = JSON.parse(localStorage.getItem('wifi_requests')) || [];
let adminRequests = JSON.parse(localStorage.getItem('admin_requests')) || [];

// 🎯 Вспомогательные функции
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function findNearestPoints(lat, lon, count = 5) {
    return wifiPoints
        .map(point => ({
            ...point,
            distance: calculateDistance(lat, lon, point.coordinates.lat, point.coordinates.lon)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, count);
}

function getTypeEmoji(type) {
    const emojis = {
        'здрав': '🏥', 'образование': '🎓', 'тц': '🛍️',
        'отдых': '🌳', 'транспорт': '🚌', 'МФЦ': '🏢',
        'АЗС': '⛽', '': '📍'
    };
    return emojis[type] || '📍';
}

function getTypeName(type) {
    const names = {
        'здрав': 'Медицина',
        'образование': 'Образование', 
        'тц': 'Торговля',
        'отдых': 'Отдых',
        'транспорт': 'Транспорт',
        'МФЦ': 'МФЦ',
        'АЗС': 'АЗС'
    };
    return names[type] || 'Другое';
}

function saveRequests() {
    localStorage.setItem('wifi_requests', JSON.stringify(userRequests));
    localStorage.setItem('admin_requests', JSON.stringify(adminRequests));
}

function isAdmin(userId) {
    return ADMIN_USER_IDS.includes(userId.toString());
}
