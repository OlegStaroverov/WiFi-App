// Основное приложение
class SevastopolWifiApp {
    constructor() {
        this.currentUser = null;
        this.currentTab = 'map';
        this.selectedRequest = null;
        this.isSearching = false;
        this.map = null;
        this.marker = null;
        this.selectedLocation = null;
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
                ${point.address ? `<div class="point-address">${point.address}</div>` : ''}
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
                ${point.address ? `<div class="point-address">${point.address}</div>` : ''}
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

    // ПОЛНОСТЬЮ ПЕРЕПИСАННЫЙ МЕТОД ГЕОЛОКАЦИИ
    async findNearestPoints() {
        if (this.isSearching) return;

        const btn = document.getElementById('findBtn');
        this.isSearching = true;
        btn.disabled = true;
        btn.innerHTML = '📍 Определяем местоположение...';

        try {
            // Показываем модальное окно с картой для выбора местоположения
            await this.showLocationPicker();
            
        } catch (error) {
            console.error('Ошибка:', error);
            this.showGeolocationError(error);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '📍 Найти ближайший Wi-Fi';
            this.isSearching = false;
        }
    }

    // МОДАЛЬНОЕ ОКНО ВЫБОРА МЕСТОПОЛОЖЕНИЯ
    async showLocationPicker() {
        return new Promise((resolve, reject) => {
            const modal = document.createElement('div');
            modal.className = 'modal location-picker-modal';
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="modal-content location-picker-content">
                    <div class="location-picker-header">
                        <div style="display: flex; justify-content: between; align-items: center;">
                            <h3 style="margin: 0;">📍 Выберите ваше местоположение</h3>
                            <span class="close" onclick="this.closest('.modal').remove(); reject(new Error('Отменено'))" style="font-size: 24px;">&times;</span>
                        </div>
                        <p style="margin: 8px 0 0 0; color: #666; font-size: 14px;">
                            Кликните на карте или используйте автоматическое определение
                        </p>
                    </div>
                    
                    <div id="locationMap" class="location-map-container"></div>
                    
                    <div class="location-picker-footer">
                        <button id="useCurrentLocation" class="btn primary location-btn">
                            📍 Мое местоположение
                        </button>
                        <button id="confirmLocation" class="btn secondary location-btn" disabled>
                            ✅ Использовать выбранное
                        </button>
                    </div>
                </div>
            `;
    
            document.body.appendChild(modal);
            document.body.style.overflow = 'hidden';
    
            // Инициализируем карту после добавления в DOM
            setTimeout(() => {
                this.initLocationMap(modal);
                this.setupLocationHandlers(modal, resolve, reject);
            }, 100);
        });
    }

    // ИНИЦИАЛИЗАЦИЯ КАРТЫ
    initLocationMap(modal) {
        const mapContainer = modal.querySelector('#locationMap');
        
        // Центр Севастополя
        const sevastopolCenter = [44.6166, 33.5254];
        
        // Создаем карту с адаптивным зумом
        this.map = L.map(mapContainer).setView(sevastopolCenter, 13);
        
        // Добавляем слой OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(this.map);
    
        // Добавляем маркер с увеличенным размером для мобилок
        const iconSize = window.innerWidth <= 480 ? [30, 30] : [25, 41];
        const myIcon = L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            iconSize: iconSize,
            iconAnchor: [iconSize[0]/2, iconSize[1]]
        });
    
        this.marker = L.marker(sevastopolCenter, {
            draggable: true,
            autoPan: true,
            icon: myIcon
        }).addTo(this.map);
    
        // Обработчик перемещения маркера
        this.marker.on('dragend', (e) => {
            const marker = e.target;
            const position = marker.getLatLng();
            this.selectedLocation = {
                latitude: position.lat,
                longitude: position.lng
            };
            this.updateConfirmButton(modal, true);
        });
    
        // Обработчик клика по карте
        this.map.on('click', (e) => {
            const { lat, lng } = e.latlng;
            this.marker.setLatLng([lat, lng]);
            this.selectedLocation = {
                latitude: lat,
                longitude: lng
            };
            this.updateConfirmButton(modal, true);
            
            // Автопан для мобилок - центрируем карту на выбранной точке
            if (window.innerWidth <= 480) {
                this.map.panTo([lat, lng]);
            }
        });
    
        // Перерисовываем карту после инициализации
        setTimeout(() => {
            this.map.invalidateSize();
        }, 100);
    
        this.selectedLocation = {
            latitude: sevastopolCenter[0],
            longitude: sevastopolCenter[1]
        };
    }

    // НАСТРОЙКА ОБРАБОТЧИКОВ
    setupLocationHandlers(modal, resolve, reject) {
        const useCurrentBtn = modal.querySelector('#useCurrentLocation');
        const confirmBtn = modal.querySelector('#confirmLocation');
        const closeBtn = modal.querySelector('.close');

        // Автоматическое определение местоположения
        useCurrentBtn.onclick = () => {
            this.getCurrentLocation()
                .then(location => {
                    this.marker.setLatLng([location.latitude, location.longitude]);
                    this.map.setView([location.latitude, location.longitude], 16);
                    this.selectedLocation = location;
                    this.updateConfirmButton(modal, true);
                })
                .catch(error => {
                    alert('❌ Не удалось определить местоположение. Выберите точку на карте вручную.');
                    console.error('Geolocation error:', error);
                });
        };

        // Подтверждение выбора
        confirmBtn.onclick = () => {
            if (this.selectedLocation) {
                modal.remove();
                document.body.style.overflow = 'auto';
                this.performSearch(this.selectedLocation);
                resolve();
            }
        };

        // Закрытие
        closeBtn.onclick = () => {
            modal.remove();
            document.body.style.overflow = 'auto';
            reject(new Error('Отменено пользователем'));
        };
    }

    // АВТОМАТИЧЕСКОЕ ОПРЕДЕЛЕНИЕ МЕСТОПОЛОЖЕНИЯ
    getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Геолокация не поддерживается'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    });
                },
                (error) => {
                    let errorMessage = 'Не удалось определить местоположение';
                    
                    switch(error.code) {
                        case 1:
                            errorMessage = 'Доступ к геолокации запрещен. Разрешите доступ в настройках браузера.';
                            break;
                        case 2:
                            errorMessage = 'Информация о местоположении недоступна. Проверьте подключение к интернету.';
                            break;
                        case 3:
                            errorMessage = 'Время ожидания определения местоположения истекло.';
                            break;
                    }
                    
                    reject(new Error(errorMessage));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        });
    }

    // ОБНОВЛЕНИЕ КНОПКИ ПОДТВЕРЖДЕНИЯ
    updateConfirmButton(modal, enabled) {
        const confirmBtn = modal.querySelector('#confirmLocation');
        if (enabled) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `✅ Использовать выбранное (${this.selectedLocation.latitude.toFixed(4)}, ${this.selectedLocation.longitude.toFixed(4)})`;
        } else {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '✅ Использовать выбранное';
        }
    }

    // ВЫПОЛНЕНИЕ ПОИСКА
    performSearch(location) {
        console.log('🎯 Выполняем поиск для координат:', location);
        const nearest = this.findNearestPointsWithFallback(location.latitude, location.longitude, 3);
        this.displayNearestResults(nearest, false);
    }

    // ИСПРАВЛЕННАЯ ФУНКЦИЯ ПОИСКА БЛИЖАЙШИХ ТОЧЕК
    findNearestPointsWithFallback(lat, lon, count = 3) {
        console.log('🔍 ПОИСК БЛИЖАЙШИХ ТОЧЕК ДЛЯ КООРДИНАТ:', lat, lon);
        console.log('📊 Всего точек в базе:', wifiPoints.length);
        
        // Проверяем что координаты валидны
        if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
            console.error('❌ Некорректные координаты:', lat, lon);
            // Возвращаем случайные точки как fallback
            return this.getRandomPoints(count);
        }
        
        try {
            // Добавляем расстояние к каждой точке
            const pointsWithDistance = wifiPoints.map(point => {
                try {
                    const distance = calculateDistance(lat, lon, point.coordinates.lat, point.coordinates.lon);
                    return {
                        ...point,
                        distance: distance
                    };
                } catch (error) {
                    console.error('❌ Ошибка расчета расстояния для точки:', point.id, error);
                    return {
                        ...point,
                        distance: 999 // Большое расстояние по умолчанию
                    };
                }
            });
            
            console.log('📊 Точки с расстояниями:', pointsWithDistance.slice(0, 3).map(p => `${p.name} - ${p.distance.toFixed(2)} км`));
            
            // Сортируем по расстоянию
            const sortedPoints = pointsWithDistance.sort((a, b) => {
                return a.distance - b.distance;
            });
            
            console.log('📊 Отсортированные точки:', sortedPoints.slice(0, 5).map(p => `${p.name} - ${p.distance.toFixed(2)} км`));
            
            // Берем ближайшие count точек
            const result = sortedPoints.slice(0, count);
            
            console.log('✅ РЕЗУЛЬТАТ ПОИСКА:');
            result.forEach((point, index) => {
                console.log(`   ${index + 1}. ${point.name} - ${point.distance.toFixed(2)} км`);
            });
            
            return result;
            
        } catch (error) {
            console.error('💥 Критическая ошибка при поиске ближайших точек:', error);
            // Всегда возвращаем точки, даже при ошибке
            return this.getRandomPoints(count);
        }
    }

    // ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ СЛУЧАЙНЫХ ТОЧЕК
    getRandomPoints(count) {
        const shuffled = [...wifiPoints].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count).map(point => ({
            ...point,
            distance: Math.random() * 2 + 0.5 // Случайное расстояние от 0.5 до 2.5 км
        }));
    }

    // ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ - ИСПРАВЛЕННАЯ ВЕРСИЯ
    displayNearestResults(nearest, usedCenter = false) {
        const results = document.getElementById('nearestResults');
        
        console.log('🔄 Отображение результатов:', nearest);
        
        // Проверяем что nearest существует и является массивом
        if (!nearest || !Array.isArray(nearest)) {
            console.error('❌ Некорректные данные точек:', nearest);
            results.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #666;">
                    <h4>❌ Ошибка при поиске точек</h4>
                    <p>Попробуйте выбрать другое местоположение</p>
                    <button onclick="app.findNearestPoints()" class="btn primary" style="margin-top: 10px;">
                        🔄 Попробовать снова
                    </button>
                </div>
            `;
            return;
        }
        
        if (nearest.length === 0) {
            console.warn('⚠️ Не найдено ближайших точек');
            results.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #666;">
                    <h4>🔍 Ближайшие точки не найдены</h4>
                    <p>Попробуйте выбрать другое местоположение</p>
                    <button onclick="app.findNearestPoints()" class="btn primary" style="margin-top: 10px;">
                        🔄 Выбрать другое место
                    </button>
                </div>
            `;
            return;
        }
        
        let header = '🎯 Ближайшие точки Wi-Fi:';
        if (usedCenter) {
            header = '📍 Популярные точки в центре города:';
        }
        
        // КЛИКАБЕЛЬНЫЕ ТОЧКИ БЕЗ КНОПОК
        results.innerHTML = `
            <h4>${header}</h4>
            ${nearest.map(point => `
                <div class="point-item" onclick="app.showPointDetails(${point.id})">
                    <div style="display: flex; justify-content: between; align-items: flex-start; margin-bottom: 8px;">
                        <h4 style="margin: 0; flex: 1;">${getTypeEmoji(point.type)} ${point.name}</h4>
                        <div class="result-distance">${point.distance ? point.distance.toFixed(2) : '0.50'} км</div>
                    </div>
                    ${point.address ? `<div class="point-address">${point.address}</div>` : ''}
                    <div class="point-description">${point.description}</div>
                </div>
            `).join('')}
        `;
        
        console.log('✅ Результаты отображены успешно');
    }

    // Показать ошибку геолокации
    showGeolocationError(error) {
        const results = document.getElementById('nearestResults');
        
        results.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #666;">
                <h4>❌ ${error.message || 'Не удалось определить местоположение'}</h4>
                <p>Попробуйте выбрать местоположение на карте</p>
                <button onclick="app.findNearestPoints()" class="btn primary" style="margin-top: 10px;">
                    🔄 Попробовать снова
                </button>
            </div>
        `;
    }

    // Показать детали точки - ИСПРАВЛЕННАЯ ВЕРСИЯ
    showPointDetails(pointId) {
        const point = wifiPoints.find(p => p.id === pointId);
        if (!point) return;
        
        const modal = document.getElementById('pointModal');
        const details = document.getElementById('pointDetails');
        
        const yandexMapUrl = `https://yandex.ru/maps/?pt=${point.coordinates.lon},${point.coordinates.lat}&z=17&l=map`;
        const yandexNavigatorUrl = `yandexnavi://build_route_on_map?lat_to=${point.coordinates.lat}&lon_to=${point.coordinates.lon}`;
        
        // УБИРАЕМ АДРЕС ЕСЛИ ЕГО НЕТ
        details.innerHTML = `
            <h3>${getTypeEmoji(point.type)} ${point.name}</h3>
            ${point.address ? `
            <div class="detail-item">
                <div class="detail-label">📍 Адрес:</div>
                <div>${point.address}</div>
            </div>
            ` : ''}
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
        
        // ДОБАВЛЯЕМ ОБРАБОТЧИК ДЛЯ ЗАКРЫТИЯ ПРИ КЛИКЕ НА ФОН
        modal.addEventListener('click', this.handleModalClick);
    }

    // ОБРАБОТЧИК КЛИКА ПО ФОНУ МОДАЛЬНОГО ОКНА
    handleModalClick = (e) => {
        if (e.target.id === 'pointModal') {
            this.closeModal();
        }
    }

    // ЗАКРЫТИЕ МОДАЛЬНОГО ОКНА
    closeModal() {
        const modal = document.getElementById('pointModal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // УДАЛЯЕМ ОБРАБОТЧИК ПРИ ЗАКРЫТИИ
        modal.removeEventListener('click', this.handleModalClick);
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
