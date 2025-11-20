// Основное приложение
class SevastopolWifiApp {
    constructor() {
        this.currentUser = null;
        this.currentTab = 'map';
        this.selectedRequest = null;
        this.map = null;
        
        // Запускаем инициализацию с задержкой чтобы DOM точно был готов
        setTimeout(() => {
            this.init();
        }, 500);
    }

    async init() {
        this.setupEventListeners();
        this.loadUserData();
        this.renderPointsList();
        this.populatePointSelect();
        this.loadUserRequests();
        this.checkAdminStatus();
        
        // Пробуем инициализировать карту
        this.initYandexMap();
    }

    setupEventListeners() {
        // Навигация по табам
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Закрытие модального окна при клике вне его
        document.getElementById('pointModal').addEventListener('click', (e) => {
            if (e.target.id === 'pointModal') {
                this.closeModal();
            }
        });
    }

    async initYandexMap() {
        try {
            console.log('🔄 Инициализация Яндекс.Карт...');
            
            // Проверяем что API загрузилось
            if (typeof ymaps3 === 'undefined') {
                throw new Error('Yandex Maps API не загружен');
            }
            
            // Ждем готовность API
            await ymaps3.ready;
            console.log('✅ Яндекс.Карты API загружены');
            
            const {YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker} = ymaps3;

            // Создаем контейнер для карты
            const mapContainer = document.getElementById('yandexMap');
            
            // Инициализируем карту
            this.map = new YMap(
                mapContainer,
                {
                    location: {
                        center: [33.5224, 44.6167], // [долгота, широта]
                        zoom: 12
                    }
                }
            );

            // Добавляем слои
            this.map.addChild(new YMapDefaultSchemeLayer());
            this.map.addChild(new YMapDefaultFeaturesLayer());
            
            console.log('✅ Карта создана');
            
            // Добавляем маркеры
            this.addWifiPointsToMap();

        } catch (error) {
            console.error('❌ Ошибка Яндекс.Карт:', error);
            this.showMapFallback();
        }
    }

    // Функция fallback для карты
    showMapFallback() {
        const mapContainer = document.getElementById('yandexMap');
        mapContainer.innerHTML = `
            <div class="map-placeholder" style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">🗺️</div>
                <h3 style="margin-bottom: 8px;">Карта точек Wi-Fi</h3>
                <p style="color: #666; margin-bottom: 16px;">Используйте поиск ближайших точек или просмотрите список</p>
                <button onclick="app.switchTab('list')" class="btn primary">
                    📋 Открыть список точек
                </button>
            </div>
        `;
    }

    addWifiPointsToMap() {
        if (!this.map || typeof ymaps3 === 'undefined') {
            console.log('Карта не готова для добавления маркеров');
            return;
        }

        const {YMapMarker} = ymaps3;

        // Берем только первые 10 точек для теста
        const testPoints = wifiPoints.slice(0, 10);
        
        testPoints.forEach(point => {
            const markerElement = document.createElement('div');
            markerElement.innerHTML = '📶';
            markerElement.style.cssText = `
                font-size: 24px;
                cursor: pointer;
                text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            `;
            
            markerElement.addEventListener('click', () => {
                this.showPointDetails(point.id);
            });

            const marker = new YMapMarker(
                {
                    coordinates: [point.coordinates.lon, point.coordinates.lat],
                },
                markerElement
            );

            this.map.addChild(marker);
        });
        
        console.log(`✅ Добавлено ${testPoints.length} маркеров`);
    }

    loadUserData() {
        try {
            // Проверяем доступен ли WebApp объект
            if (window.WebApp && window.WebApp.initDataUnsafe && window.WebApp.initDataUnsafe.user) {
                this.currentUser = window.WebApp.initDataUnsafe.user;
                const userName = this.currentUser.first_name || this.currentUser.username || 'Пользователь';
                document.getElementById('userInfo').innerHTML = `
                    <span>👤 ${userName}</span>
                `;
                // Сообщаем MAX что приложение готово
                if (window.WebApp.ready) {
                    window.WebApp.ready();
                }
            } else {
                // Режим разработки - создаем заглушку
                console.log('🔧 Режим разработки - WebApp не доступен');
                this.currentUser = { 
                    id: 'demo_user', 
                    first_name: 'Демо пользователь',
                    username: 'demo'
                };
                document.getElementById('userInfo').innerHTML = `
                    <span>👤 Демо режим</span>
                `;
            }
        } catch (error) {
            console.error('Ошибка загрузки пользователя:', error);
            // Fallback на демо режим
            this.currentUser = { 
                id: 'error_user', 
                first_name: 'Гость'
            };
            document.getElementById('userInfo').innerHTML = `
                <span>👤 Гость</span>
            `;
        }
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        
        // Обновляем активные кнопки
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Показываем активный экран
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(`${tabName}-screen`).classList.add('active');
        
        // Обновляем данные при переключении
        if (tabName === 'admin') {
            this.loadAdminData();
        } else if (tabName === 'report') {
            this.loadUserRequests();
        }
    }

    checkAdminStatus() {
        if (this.currentUser && isAdmin(this.currentUser.id)) {
            document.getElementById('adminTab').style.display = 'block';
        }
    }

    // Рендер списка точек
    renderPointsList(filterType = 'all') {
        const list = document.getElementById('points-list');
        let points = wifiPoints;
        
        if (filterType !== 'all') {
            points = wifiPoints.filter(point => point.type === filterType);
        }
        
        list.innerHTML = points.map(point => `
            <div class="point-item" onclick="app.showPointDetails(${point.id})">
                <h4>${getTypeEmoji(point.type)} ${point.name}</h4>
                <div class="point-address">${point.address || 'Адрес не указан'}</div>
                <div class="point-description">${point.description}</div>
            </div>
        `).join('');
    }

    // Поиск точек для выпадающего списка
    searchPoints(query) {
        const searchResults = document.getElementById('searchResults');
        const select = document.getElementById('problemPoint');
        
        if (!query.trim()) {
            searchResults.innerHTML = '';
            select.style.display = 'block';
            return;
        }

        select.style.display = 'none';
        
        const results = wifiPoints.filter(point => 
            point.name.toLowerCase().includes(query.toLowerCase()) ||
            (point.address && point.address.toLowerCase().includes(query.toLowerCase()))
        ).slice(0, 5);

        searchResults.innerHTML = results.map(point => `
            <div class="search-result-item" onclick="app.selectPointForReport(${point.id}, '${point.name.replace(/'/g, "\\'")}')">
                <strong>${getTypeEmoji(point.type)} ${point.name}</strong>
                <div class="point-address">${point.address || 'Адрес не указан'}</div>
            </div>
        `).join('');
    }

    selectPointForReport(pointId, pointName) {
        document.getElementById('problemPoint').value = pointId;
        document.getElementById('problemPointSearch').value = pointName;
        document.getElementById('searchResults').innerHTML = '';
        document.getElementById('problemPoint').style.display = 'block';
    }

    // Заполнение выпадающего списка точек
    populatePointSelect() {
        const select = document.getElementById('problemPoint');
        select.innerHTML = '<option value="">-- Выберите точку --</option>' +
            wifiPoints.map(point => 
                `<option value="${point.id}">${point.name}</option>`
            ).join('');
    }

    // Поиск ближайших точек
    async findNearestPoints() {
        const btn = document.getElementById('findBtn');
        const results = document.getElementById('nearestResults');
        
        const originalText = btn.innerHTML;
        const loadingStages = [
            '📍 Определяем местоположение...',
            '🗺️ Сканируем карту...', 
            '📡 Ищем ближайшие точки Wi-Fi...',
            '🔍 Анализируем расстояние...',
            '💫 Почти нашли...'
        ];
        
        let currentStage = 0;
        let messageInterval;
        
        // Функция для плавной смены сообщений
        const startLoadingAnimation = () => {
            messageInterval = setInterval(() => {
                if (currentStage < loadingStages.length - 1) {
                    currentStage++;
                    btn.innerHTML = loadingStages[currentStage];
                } else {
                    // Достигли последнего сообщения - останавливаемся на нем
                    clearInterval(messageInterval);
                }
            }, 2000); // Меняем каждые 2 секунды
        };
        
        btn.disabled = true;
        btn.innerHTML = loadingStages[0];
        startLoadingAnimation();
        
        try {
            // Запускаем поиск и ждем его завершения
            const searchPromise = this.getBrowserLocation();
            
            // Если поиск завершится быстрее чем анимация - прерываем анимацию
            await searchPromise;
            
            // Поиск завершился - останавливаем анимацию
            clearInterval(messageInterval);
            
        } catch (error) {
            console.error('Ошибка поиска:', error);
            this.showNearestWithoutLocation();
        } finally {
            // Всегда возвращаем кнопку в исходное состояние
            clearInterval(messageInterval);
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    getBrowserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                this.showNearestWithoutLocation();
                resolve();
                return;
            }

            // Таймаут 8 секунд
            const timeoutId = setTimeout(() => {
                this.showNearestWithoutLocation();
                resolve();
            }, 8000);

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    clearTimeout(timeoutId);
                    const { latitude, longitude } = position.coords;
                    const nearest = findNearestPoints(latitude, longitude, 5);
                    this.displayNearestResults(nearest);
                    resolve();
                },
                (error) => {
                    clearTimeout(timeoutId);
                    console.log('Геолокация недоступна:', error.message);
                    this.showNearestWithoutLocation();
                    resolve();
                },
                {
                    enableHighAccuracy: false,
                    timeout: 7000,
                    maximumAge: 60000
                }
            );
        });
    }
    showNearestWithoutLocation() {
        const centerLat = 44.6166;
        const centerLon = 33.5254;
        const nearest = findNearestPoints(centerLat, centerLon, 5);
        this.displayNearestResults(nearest, true);
    }

    displayNearestResults(nearest, usedCenter = false) {
        const results = document.getElementById('nearestResults');
        
        let header = '🎯 Ближайшие точки:';
        if (usedCenter) {
            header = '📍 Популярные точки в центре города:';
        }
        
        results.innerHTML = `
            <h4>${header}</h4>
            ${nearest.map(point => `
                <div class="result-item" onclick="app.showPointDetails(${point.id})">
                    <strong>${getTypeEmoji(point.type)} ${point.name}</strong><br>
                    <small>📍 ${point.distance?.toFixed(1) || '0.5'} км • ${point.address || 'Адрес не указан'}</small>
                </div>
            `).join('')}
            ${usedCenter ? '<small style="color: #666; display: block; margin-top: 8px;">Чтобы видеть расстояния точно, разрешите доступ к геолокации</small>' : ''}
        `;
    }

    // Показать детали точки
    showPointDetails(pointId) {
        const point = wifiPoints.find(p => p.id === pointId);
        if (!point) return;
        
        const modal = document.getElementById('pointModal');
        const details = document.getElementById('pointDetails');
        
        const yandexMapUrl = `https://yandex.ru/maps/?pt=${point.coordinates.lon},${point.coordinates.lat}&z=17&l=map`;
        const yandexNavigatorUrl = `yandexnavi://build_route_on_map?lat_to=${point.coordinates.lat}&lon_to=${point.coordinates.lon}`;
        
        details.innerHTML = `
            <h3>${getTypeEmoji(point.type)} ${point.name}</h3>
            <div class="detail-item">
                <div class="detail-label">📍 Адрес:</div>
                <div>${point.address || 'Не указан'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">📝 Описание:</div>
                <div>${point.description}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">📌 Координаты:</div>
                <div>${point.coordinates.lat}, ${point.coordinates.lon}</div>
            </div>
            <div class="map-preview">
                <div class="detail-label">🗺️ На карте:</div>
                <div class="mini-map" style="height: 150px; background: #f5f5f5; border-radius: 8px; margin: 8px 0; display: flex; align-items: center; justify-content: center;">
                    <div style="text-align: center;">
                        <div style="font-size: 24px; margin-bottom: 8px;">📍</div>
                        <div>Точка на карте</div>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; margin-top: 8px;">
                    <a href="${yandexMapUrl}" target="_blank" class="btn secondary" style="flex: 1; text-align: center; text-decoration: none;">
                        📍 Открыть в Яндекс.Картах
                    </a>
                    <a href="${yandexNavigatorUrl}" class="btn primary" style="flex: 1; text-align: center; text-decoration: none;">
                        🚗 Построить маршрут
                    </a>
                </div>
            </div>
            <button onclick="app.reportSpecificProblem(${pointId})" class="btn primary" style="margin-top: 16px; width: 100%;">
                🔧 Сообщить о проблеме
            </button>
        `;
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        document.getElementById('pointModal').style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    // Отправить сообщение о проблеме
    submitProblem() {
        const pointId = document.getElementById('problemPoint').value;
        const description = document.getElementById('problemDesc').value.trim();
        
        if (!pointId || !description) {
            alert('❌ Заполните все обязательные поля');
            return;
        }
        
        const point = wifiPoints.find(p => p.id == pointId);
        const request = {
            id: Date.now(),
            pointId: pointId,
            pointName: point ? point.name : 'Неизвестная точка',
            description: description,
            userName: this.currentUser?.first_name || 'Аноним',
            userId: this.currentUser?.id || 'anonymous',
            date: new Date().toISOString(),
            status: 'new',
            type: 'problem'
        };
        
        userRequests.push(request);
        adminRequests.push(request);
        saveRequests();
        
        // Очистка формы
        document.getElementById('problemPoint').value = '';
        document.getElementById('problemPointSearch').value = '';
        document.getElementById('problemDesc').value = '';
        
        this.loadUserRequests();
        this.showNotification('✅ Заявка отправлена! Спасибо за обратную связь.');
    }

    // Отправить предложение новой точки
    submitSuggestion() {
        const name = document.getElementById('newPointName').value.trim();
        const address = document.getElementById('newPointAddress').value.trim();
        const reason = document.getElementById('newPointReason').value.trim();
        
        if (!name || !address || !reason) {
            alert('❌ Заполните все поля');
            return;
        }
        
        const request = {
            id: Date.now(),
            pointName: name,
            address: address,
            reason: reason,
            userName: this.currentUser?.first_name || 'Аноним',
            userId: this.currentUser?.id || 'anonymous',
            date: new Date().toISOString(),
            status: 'new',
            type: 'suggestion'
        };
        
        userRequests.push(request);
        adminRequests.push(request);
        saveRequests();
        
        // Очистка формы
        document.getElementById('newPointName').value = '';
        document.getElementById('newPointAddress').value = '';
        document.getElementById('newPointReason').value = '';
        
        this.loadUserRequests();
        this.showNotification('💡 Предложение отправлено! Спасибо за информацию о новой точке Wi-Fi.');
    }

    // Загрузка обращений пользователя
    loadUserRequests() {
        const container = document.getElementById('my-requests');
        const userReqs = userRequests.filter(req => req.userId === (this.currentUser?.id || 'anonymous'));
        
        if (userReqs.length === 0) {
            container.innerHTML = '<div class="placeholder">У вас пока нет обращений</div>';
            return;
        }
        
        container.innerHTML = userReqs.map(req => `
            <div class="request-item">
                <strong>${req.type === 'problem' ? '🔧 ' : '💡 '}${req.pointName || 'Новая точка'}</strong>
                <div>${req.description || req.reason}</div>
                <div class="request-meta">
                    📅 ${new Date(req.date).toLocaleDateString()} • 
                    Статус: <span class="status-${req.status}">${this.getStatusText(req.status)}</span>
                    ${req.adminReply ? `<br>💌 Ответ: ${req.adminReply}` : ''}
                </div>
            </div>
        `).join('');
    }

    // Функция фильтрации точек
    filterPoints(type) {
        // Убираем активный класс у всех кнопок
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Добавляем активный класс нажатой кнопке
        event.target.classList.add('active');
        
        // Рендерим отфильтрованный список
        this.renderPointsList(type);
    }

    // Админ-панель
    loadAdminData() {
        if (!this.currentUser || !isAdmin(this.currentUser.id)) return;
        
        const total = adminRequests.length;
        const newReqs = adminRequests.filter(req => req.status === 'new').length;
        
        document.getElementById('totalRequests').textContent = total;
        document.getElementById('newRequests').textContent = newReqs;
        
        this.renderAdminRequests();
    }

    renderAdminRequests() {
        const container = document.getElementById('admin-requests');
        
        if (adminRequests.length === 0) {
            container.innerHTML = '<div class="placeholder">Нет обращений</div>';
            return;
        }
        
        container.innerHTML = adminRequests.map(req => `
            <div class="admin-request-item ${this.selectedRequest?.id === req.id ? 'selected' : ''}" 
                 onclick="app.selectRequest(${req.id})">
                <strong>${req.type === 'problem' ? '🔧 ' : '💡 '}${req.pointName || 'Новая точка'}</strong>
                <div style="font-size: 12px; color: #666; margin: 4px 0;">
                    ${req.description || req.reason}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 11px; color: #888;">
                        ${new Date(req.date).toLocaleDateString()}
                    </span>
                    <span class="request-status status-${req.status}">
                        ${this.getStatusText(req.status)}
                    </span>
                </div>
            </div>
        `).join('');
    }

    selectRequest(requestId) {
        this.selectedRequest = adminRequests.find(req => req.id === requestId);
        this.renderRequestDetails();
    }

    renderRequestDetails() {
        const container = document.getElementById('request-details');
        if (!this.selectedRequest) return;
        
        const req = this.selectedRequest;
        
        container.innerHTML = `
            <h4>Детали обращения #${req.id}</h4>
            
            <div class="detail-item">
                <div class="detail-label">Тип:</div>
                <div>${req.type === 'problem' ? '🔧 Проблема' : '💡 Предложение новой точки'}</div>
            </div>
            
            ${req.type === 'problem' ? `
                <div class="detail-item">
                    <div class="detail-label">Точка Wi-Fi:</div>
                    <div>${req.pointName}</div>
                </div>
            ` : `
                <div class="detail-item">
                    <div class="detail-label">Название точки:</div>
                    <div>${req.pointName}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Адрес:</div>
                    <div>${req.address}</div>
                </div>
            `}
            
            <div class="detail-item">
                <div class="detail-label">Описание:</div>
                <div>${req.description || req.reason}</div>
            </div>
            
            <div class="detail-item">
                <div class="detail-label">Пользователь:</div>
                <div>${req.userName} (ID: ${req.userId})</div>
            </div>
            
            <div class="detail-item">
                <div class="detail-label">Дата:</div>
                <div>${new Date(req.date).toLocaleString()}</div>
            </div>
            
            <div class="reply-form">
                <div class="detail-label">Статус обращения:</div>
                <select class="status-select" onchange="app.updateRequestStatus(${req.id}, this.value)">
                    <option value="new" ${req.status === 'new' ? 'selected' : ''}>🆕 Новое</option>
                    <option value="in-progress" ${req.status === 'in-progress' ? 'selected' : ''}>🔄 В работе</option>
                    <option value="resolved" ${req.status === 'resolved' ? 'selected' : ''}>✅ Решено</option>
                    <option value="rejected" ${req.status === 'rejected' ? 'selected' : ''}>❌ Отклонено</option>
                </select>
                
                <div class="detail-label">Ответ пользователю:</div>
                <textarea class="reply-textarea" id="adminReplyText" placeholder="Напишите ответ пользователю...">${req.adminReply || ''}</textarea>
                
                <button onclick="app.sendAdminReply(${req.id})" class="btn primary">📩 Отправить ответ</button>
            </div>
        `;
    }

    updateRequestStatus(requestId, newStatus) {
        const request = adminRequests.find(req => req.id === requestId);
        if (request) {
            request.status = newStatus;
            const userReq = userRequests.find(req => req.id === requestId);
            if (userReq) {
                userReq.status = newStatus;
            }
            saveRequests();
            this.renderAdminRequests();
            this.renderRequestDetails();
        }
    }

    sendAdminReply(requestId) {
        const replyText = document.getElementById('adminReplyText').value.trim();
        if (!replyText) {
            alert('Введите текст ответа');
            return;
        }
        
        const request = adminRequests.find(req => req.id === requestId);
        if (request) {
            request.adminReply = replyText;
            request.status = 'resolved';
            const userReq = userRequests.find(req => req.id === requestId);
            if (userReq) {
                userReq.adminReply = replyText;
                userReq.status = 'resolved';
            }
            saveRequests();
            
            this.renderAdminRequests();
            this.renderRequestDetails();
            this.showNotification('✅ Ответ отправлен пользователю');
        }
    }

    // Вспомогательные методы
    getStatusText(status) {
        const statuses = {
            'new': '🆕 Новое',
            'in-progress': '🔄 В работе', 
            'resolved': '✅ Решено',
            'rejected': '❌ Отклонено'
        };
        return statuses[status] || status;
    }

    showNotification(message) {
        alert(message);
    }

    reportSpecificProblem(pointId) {
        this.switchTab('report');
        document.getElementById('problemPoint').value = pointId;
        const point = wifiPoints.find(p => p.id === pointId);
        if (point) {
            document.getElementById('problemPointSearch').value = point.name;
        }
        document.getElementById('problemDesc').focus();
        this.closeModal();
    }
}

// Глобальные функции для HTML onclick
function filterPoints(type) {
    app.filterPoints(type);
}

function findNearestPoints() {
    app.findNearestPoints();
}

function submitProblem() {
    app.submitProblem();
}

function submitSuggestion() {
    app.submitSuggestion();
}

function closeModal() {
    app.closeModal();
}

// Инициализация приложения
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new SevastopolWifiApp();
});
