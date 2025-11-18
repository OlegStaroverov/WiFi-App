// Основное приложение
class SevastopolWifiApp {
    constructor() {
        this.currentUser = null;
        this.currentTab = 'map';
        this.selectedRequest = null;
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
        
        btn.innerHTML = '🔄 Определяем местоположение...';
        btn.disabled = true;
        
        try {
            if (!navigator.geolocation) {
                throw new Error('Геолокация не поддерживается');
            }
            
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                });
            });
            
            const { latitude, longitude } = position.coords;
            const nearest = findNearestPoints(latitude, longitude, 5);
            
            results.innerHTML = `
                <h4>🎯 Ближайшие к вам точки:</h4>
                ${nearest.map(point => `
                    <div class="result-item">
                        <strong>${getTypeEmoji(point.type)} ${point.name}</strong><br>
                        <small>📍 ${point.distance.toFixed(1)} км • ${point.address || 'Адрес не указан'}</small>
                    </div>
                `).join('')}
            `;
            
            btn.innerHTML = '📍 Обновить местоположение';
            
        } catch (error) {
            results.innerHTML = `
                <div style="color: #FF3B30; text-align: center; padding: 20px;">
                    ❌ Не удалось определить местоположение<br>
                    <small>${error.message}</small>
                </div>
            `;
            btn.innerHTML = '📍 Попробовать снова';
        } finally {
            btn.disabled = false;
        }
    }

    // Показать детали точки
    showPointDetails(pointId) {
        const point = wifiPoints.find(p => p.id === pointId);
        if (!point) return;
        
        const modal = document.getElementById('pointModal');
        const details = document.getElementById('pointDetails');
        
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
            <button onclick="app.reportSpecificProblem(${pointId})" class="btn primary" style="margin-top: 16px;">
                🔧 Сообщить о проблеме
            </button>
        `;
        
        modal.style.display = 'block';
    }

    // Отправить сообщение о проблеме
    submitProblem() {
        const pointId = document.getElementById('problemPoint').value;
        const problemType = document.getElementById('problemType').value;
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
            problemType: problemType,
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
        document.getElementById('problemType').value = 'not_working';
        document.getElementById('problemDesc').value = '';
        
        this.loadUserRequests();
        this.showNotification('✅ Заявка отправлена! Спасибо за обратную связь.');
    }

    // Отправить предложение новой точки
    submitSuggestion() {
        const address = document.getElementById('newPointAddress').value.trim();
        const reason = document.getElementById('newPointReason').value.trim();
        
        if (!address || !reason) {
            alert('❌ Заполните все поля');
            return;
        }
        
        const request = {
            id: Date.now(),
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
        document.getElementById('newPointAddress').value = '';
        document.getElementById('newPointReason').value = '';
        
        this.loadUserRequests();
        this.showNotification('💡 Предложение отправлено! Спасибо за идею.');
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
                <strong>${req.type === 'problem' ? '🔧 ' : '💡 '}${req.pointName || req.address}</strong>
                <div>${req.description || req.reason}</div>
                <div class="request-meta">
                    📅 ${new Date(req.date).toLocaleDateString()} • 
                    Статус: <span class="status-${req.status}">${this.getStatusText(req.status)}</span>
                    ${req.adminReply ? `<br>💌 Ответ: ${req.adminReply}` : ''}
                </div>
            </div>
        `).join('');
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
                <strong>${req.type === 'problem' ? '🔧 ' : '💡 '}${req.pointName || req.address}</strong>
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
                <div>${req.type === 'problem' ? '🔧 Проблема' : '💡 Предложение'}</div>
            </div>
            
            ${req.type === 'problem' ? `
                <div class="detail-item">
                    <div class="detail-label">Точка Wi-Fi:</div>
                    <div>${req.pointName}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Тип проблемы:</div>
                    <div>${this.getProblemTypeText(req.problemType)}</div>
                </div>
            ` : `
                <div class="detail-item">
                    <div class="detail-label">Предлагаемый адрес:</div>
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
            // Также обновляем в userRequests
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
            // Также обновляем в userRequests
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

    getProblemTypeText(type) {
        const types = {
            'not_working': 'Точка не работает',
            'weak_signal': 'Плохой сигнал',
            'no_auth': 'Не открывается авторизация',
            'other': 'Другое'
        };
        return types[type] || type;
    }

    showNotification(message) {
        // Простое уведомление
        alert(message);
    }

    reportSpecificProblem(pointId) {
        this.switchTab('report');
        document.getElementById('problemPoint').value = pointId;
        document.getElementById('problemDesc').focus();
    }
}

// Глобальные функции для HTML onclick
function filterPoints(type) {
    app.renderPointsList(type);
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
    document.getElementById('pointModal').style.display = 'none';
}

// Инициализация приложения
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new SevastopolWifiApp();
});
