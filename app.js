// Основное приложение
class SevastopolWifiApp {
    constructor() {
        this.currentUser = null;
        this.currentTab = 'map';
        this.selectedRequest = null;
        this.yamaps = null;
        this.map = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.loadUserData();
        this.renderPointsList();
        this.populatePointSelect();
        this.loadUserRequests();
        this.checkAdminStatus();
        await this.initYandexMap();
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
            // Ждем загрузку API
            await ymaps3.ready;
            
            const {YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker} = ymaps3;

            // Создаем карту
            this.map = new YMap(
                document.getElementById('yandexMap'),
                {
                    location: {
                        center: [33.5224, 44.6167],
                        zoom: 12
                    }
                }
            );

            // Добавляем стандартные слои
            this.map.addChild(new YMapDefaultSchemeLayer());
            this.map.addChild(new YMapDefaultFeaturesLayer());

            // Добавляем маркеры точек Wi-Fi
            this.addWifiPointsToMap();

        } catch (error) {
            console.error('Ошибка Яндекс.Карт:', error);
            // Простой fallback
            document.getElementById('yandexMap').innerHTML = `
                <div class="map-placeholder">
                    <p>🗺️ Карта точек Wi-Fi Севастополя</p>
                    <p><small>Используйте поиск ближайших точек или список точек</small></p>
                </div>
            `;
        }
    }

    addWifiPointsToMap() {
        if (!this.map || !ymaps3) return;

        const {YMapMarker} = ymaps3;

        wifiPoints.forEach(point => {
            const markerElement = document.createElement('div');
            markerElement.className = 'wifi-marker';
            markerElement.innerHTML = '📶';
            markerElement.title = point.name;
            markerElement.style.cursor = 'pointer';
            
            markerElement.addEventListener('click', () => {
                this.showPointDetails(point.id);
            });

            const marker = new YMapMarker(
                {
                    coordinates: [point.coordinates.lon, point.coordinates.lat],
                    source: 'wifi-source'
                },
                markerElement
            );

            this.map.addChild(marker);
        });
    }

    loadUserData() {
        try {
            if (window.WebApp && window.WebApp.initDataUnsafe) {
                this.currentUser = window.WebApp.initDataUnsafe.user;
                document.getElementById('userInfo').innerHTML = `
                    <span>👤 ${this.currentUser.first_name || 'Пользователь'}</span>
                `;
                window.WebApp.ready();
            } else {
                // Режим разработки
                this.currentUser = { id: 'demo', first_name: 'Демо пользователь' };
                document.getElementById('userInfo').innerHTML = `
                    <span>👤 Демо режим</span>
                `;
            }
        } catch (error) {
            console.error('Ошибка загрузки пользователя:', error);
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
            { text: '📍 Определяем местоположение...', progress: 20 },
            { text: '🗺️ Загружаем карту точек...', progress: 40 },
            { text: '📡 Сканируем сеть Wi-Fi...', progress: 60 },
            { text: '🔍 Анализируем расстояние...', progress: 80 },
            { text: '🎯 Почти нашли...', progress: 90 },
            { text: '💫 Готово!', progress: 100 }
        ];
        
        let currentStage = 0;
        
        // Создаем контейнер для прогресса
        const progressHTML = `
            <div style="width: 100%; background: #e0e0e0; border-radius: 10px; margin-top: 8px;">
                <div id="progressBar" style="height: 4px; background: #007AFF; border-radius: 10px; width: 0%; transition: width 0.5s ease;"></div>
            </div>
        `;
        
        btn.disabled = true;
        btn.innerHTML = `${loadingStages[0].text} ${progressHTML}`;
        
        const progressInterval = setInterval(() => {
            if (currentStage < loadingStages.length - 1) {
                currentStage++;
                const stage = loadingStages[currentStage];
                btn.innerHTML = `${stage.text} ${progressHTML}`;
                document.getElementById('progressBar').style.width = `${stage.progress}%`;
            }
        }, 800);
        
        try {
            await this.getBrowserLocation();
            
            // Завершаем прогресс
            clearInterval(progressInterval);
            const finalStage = loadingStages[loadingStages.length - 1];
            btn.innerHTML = `${finalStage.text} ${progressHTML}`;
            document.getElementById('progressBar').style.width = '100%';
            
            // Задержка перед возвратом к исходному состоянию
            await new Promise(resolve => setTimeout(resolve, 500));
            
        } catch (error) {
            console.error('Ошибка поиска:', error);
            this.showNearestWithoutLocation();
        } finally {
            clearInterval(progressInterval);
            btn.disabled = false;
            btn.innerHTML = originalText;
            
            // Анимация успеха
            btn.style.transform = 'scale(1.05)';
            btn.style.background = '#34C759';
            setTimeout(() => {
                btn.style.transform = 'scale(1)';
                btn.style.background = '';
            }, 300);
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
