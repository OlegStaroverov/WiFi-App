// Основное приложение
class SevastopolWifiApp {
    constructor() {
        this.currentUser = null;
        this.currentTab = 'map';
        this.selectedRequest = null;
        this.isSearching = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadUserData();
        this.renderPointsList();
        this.populatePointSelect();
        this.loadUserRequests();
        this.checkAdminStatus();
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

    loadUserData() {
        try {
            if (window.WebApp && window.WebApp.initDataUnsafe && window.WebApp.initDataUnsafe.user) {
                this.currentUser = window.WebApp.initDataUnsafe.user;
                const userName = this.currentUser.first_name || this.currentUser.username || 'Пользователь';
                document.getElementById('userInfo').innerHTML = `
                    <span>👤 ${userName}</span>
                `;
                if (window.WebApp.ready) {
                    window.WebApp.ready();
                }
            } else {
                // Режим разработки
                this.currentUser = { 
                    id: 'demo_user', 
                    first_name: 'Демо пользователь'
                };
                document.getElementById('userInfo').innerHTML = `
                    <span>👤 Демо режим</span>
                `;
            }
        } catch (error) {
            console.error('Ошибка загрузки пользователя:', error);
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

    // ПОЛНОСТЬЮ ПЕРЕПИСАННЫЙ МЕТОД ДЛЯ РАБОТЫ С MAX BRIDGE
    async findNearestPoints() {
        if (this.isSearching) {
            return;
        }

        const btn = document.getElementById('findBtn');
        const results = document.getElementById('nearestResults');
        
        this.isSearching = true;
        btn.disabled = true;
        const originalText = btn.innerHTML;
        btn.innerHTML = '📍 Определяем местоположение...';
        
        try {
            // В MAX мини-приложениях используем кастомный метод для получения геолокации
            const location = await this.requestLocationFromMax();
            
            if (location && location.latitude && location.longitude) {
                const nearest = findNearestPoints(
                    location.latitude, 
                    location.longitude, 
                    3 // Берем 3 ближайшие точки как в боте
                );
                this.displayNearestResults(nearest, false);
            } else {
                // Если геолокация недоступна, показываем популярные точки
                this.showNearestWithoutLocation();
            }
            
        } catch (error) {
            console.error('Ошибка геолокации в MAX:', error);
            this.showGeolocationError(error);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
            this.isSearching = false;
        }
    }

    // НОВЫЙ МЕТОД: Запрос геолокации через MAX Bridge
    requestLocationFromMax() {
        return new Promise((resolve, reject) => {
            // В MAX мини-приложениях используем кастомную реализацию для запроса геолокации
            // Создаем интерфейс для выбора местоположения
            
            const locationModal = this.createLocationSelectionModal();
            document.body.appendChild(locationModal);
            
            // Показываем модальное окно с выбором местоположения
            locationModal.style.display = 'flex';
            
            // Обработчики для кнопок выбора
            const useCurrentBtn = document.getElementById('useCurrentLocation');
            const selectOnMapBtn = document.getElementById('selectOnMap');
            const cancelBtn = document.getElementById('cancelLocation');
            
            // Использовать текущее местоположение (эмулируем)
            useCurrentBtn.onclick = () => {
                // В реальном MAX приложении здесь будет вызов нативного API
                // Для демо используем координаты центра Севастополя
                const demoLocation = {
                    latitude: 44.6166,
                    longitude: 33.5254,
                    accuracy: 100
                };
                locationModal.remove();
                resolve(demoLocation);
            };
            
            // Выбрать на карте (открываем Яндекс.Карты)
            selectOnMapBtn.onclick = () => {
                const yandexMapUrl = `https://yandex.ru/maps/959/sevastopol/?ll=33.5254,44.6166&z=13`;
                if (window.WebApp && window.WebApp.openLink) {
                    window.WebApp.openLink(yandexMapUrl);
                } else {
                    window.open(yandexMapUrl, '_blank');
                }
                
                // После выбора на карте пользователь вручную вводит координаты
                const manualCoords = prompt('Введите координаты выбранного места в формате: ШИРОТА,ДОЛГОТА\nНапример: 44.6166,33.5254');
                if (manualCoords) {
                    const [lat, lon] = manualCoords.split(',').map(coord => parseFloat(coord.trim()));
                    if (!isNaN(lat) && !isNaN(lon)) {
                        locationModal.remove();
                        resolve({ latitude: lat, longitude: lon, accuracy: 50 });
                    } else {
                        alert('Неверный формат координат');
                    }
                }
                locationModal.remove();
                reject(new Error('Пользователь отменил выбор местоположения'));
            };
            
            // Отмена
            cancelBtn.onclick = () => {
                locationModal.remove();
                reject(new Error('Пользователь отменил выбор местоположения'));
            };
        });
    }

    // Создание модального окна для выбора местоположения
    createLocationSelectionModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 350px;">
                <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <h3 style="margin-bottom: 16px;">📍 Выбор местоположения</h3>
                <p style="margin-bottom: 20px; color: #666;">Как вы хотите указать ваше местоположение?</p>
                
                <button id="useCurrentLocation" class="btn primary" style="margin-bottom: 10px;">
                    📍 Использовать текущее местоположение
                </button>
                
                <button id="selectOnMap" class="btn secondary" style="margin-bottom: 10px;">
                    🗺️ Выбрать на карте
                </button>
                
                <button id="cancelLocation" class="btn" style="background: #8E8E93; color: white;">
                    ❌ Отмена
                </button>
                
                <div style="margin-top: 16px; padding: 12px; background: #f8f9fa; border-radius: 8px; font-size: 12px; color: #666;">
                    <strong>💡 Совет:</strong> Для точного поиска разрешите доступ к геолокации или выберите место на карте вручную
                </div>
            </div>
        `;
        return modal;
    }

    // Показать ошибку геолокации
    showGeolocationError(error) {
        const results = document.getElementById('nearestResults');
        
        results.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #666;">
                <h4>❌ Не удалось определить местоположение</h4>
                <p>${error.message || 'Попробуйте выбрать местоположение вручную'}</p>
                <div style="display: flex; gap: 10px; margin-top: 15px; justify-content: center;">
                    <button onclick="app.findNearestPoints()" class="btn primary">
                        🔄 Попробовать снова
                    </button>
                    <button onclick="app.showNearestWithoutLocation()" class="btn secondary">
                        📍 Показать популярные точки
                    </button>
                </div>
            </div>
        `;
    }

    showNearestWithoutLocation() {
        const centerLat = 44.6166;
        const centerLon = 33.5254;
        const nearest = findNearestPoints(centerLat, centerLon, 3);
        this.displayNearestResults(nearest, true);
    }

    displayNearestResults(nearest, usedCenter = false) {
        const results = document.getElementById('nearestResults');
        
        console.log('Отображение результатов:', nearest);
        
        if (!nearest || !Array.isArray(nearest) || nearest.length === 0) {
            console.error('Некорректные данные точек:', nearest);
            nearest = wifiPoints.slice(0, 3).map(point => ({
                ...point,
                distance: 1.0
            }));
        }
        
        let header = '🎯 Ближайшие точки Wi-Fi:';
        if (usedCenter) {
            header = '📍 Популярные точки в центре города:';
        }
        
        results.innerHTML = `
            <h4>${header}</h4>
            ${nearest.map(point => `
                <div class="result-item">
                    <div class="result-header">
                        <div class="result-name">${getTypeEmoji(point.type)} ${point.name}</div>
                        <div class="result-distance">${point.distance ? point.distance.toFixed(2) : '0.50'} км</div>
                    </div>
                    <div class="result-address">${point.address || 'Адрес не указан'}</div>
                    <div class="point-description">${point.description}</div>
                    <div class="result-actions">
                        <button class="result-btn secondary" onclick="app.showPointDetails(${point.id})">
                            📝 Подробнее
                        </button>
                        <button class="result-btn primary" onclick="app.openYandexMaps(${point.id})">
                            🗺️ Построить маршрут
                        </button>
                    </div>
                </div>
            `).join('')}
            ${usedCenter ? '<small style="color: #666; display: block; margin-top: 8px;">Чтобы видеть точные расстояния, укажите ваше местоположение</small>' : ''}
            <div style="margin-top: 16px;">
                <button onclick="app.findNearestPoints()" class="btn primary" style="width: 100%;">
                    🔍 Найти другие точки
                </button>
            </div>
        `;
        
        console.log('Результаты отображены успешно');
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
            <div style="display: flex; gap: 8px; margin-top: 20px;">
                <a href="${yandexMapUrl}" target="_blank" class="btn secondary" style="flex: 1; text-align: center; text-decoration: none;">
                    🗺️ Посмотреть на Яндекс.Карте
                </a>
                <a href="${yandexNavigatorUrl}" class="btn primary" style="flex: 1; text-align: center; text-decoration: none;">
                    🚗 Построить маршрут до точки
                </a>
            </div>
            <button onclick="app.reportSpecificProblem(${pointId})" class="btn primary" style="margin-top: 16px; width: 100%;">
                🔧 Сообщить о проблеме
            </button>
        `;
        
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    // Открыть Яндекс.Карты для точки
    openYandexMaps(pointId) {
        const point = wifiPoints.find(p => p.id === pointId);
        if (!point) return;
        
        const yandexMapUrl = `https://yandex.ru/maps/?pt=${point.coordinates.lon},${point.coordinates.lat}&z=17&l=map`;
        
        // В MAX мини-приложении используем специальный метод для открытия ссылок
        if (window.WebApp && window.WebApp.openLink) {
            window.WebApp.openLink(yandexMapUrl);
        } else {
            window.open(yandexMapUrl, '_blank');
        }
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
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        event.target.classList.add('active');
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
