// === БАЗА ДАННЫХ (LocalStorage) ===
const DB = {
    getUsers: () => JSON.parse(localStorage.getItem('lectum_users')) || [],
    saveUser: (user) => {
        const users = DB.getUsers();
        const idx = users.findIndex(u => u.email === user.email);
        if (idx >= 0) users[idx] = user;
        else users.push(user);
        localStorage.setItem('lectum_users', JSON.stringify(users));
    },

    getUser: (email) => {
        const users = DB.getUsers();
        return users.find(u => u.email === email);
    },

    getCurrentUser: () => localStorage.getItem('lectum_current_user'),
    setCurrentUser: (email) => localStorage.setItem('lectum_current_user', email),
    logout: () => localStorage.removeItem('lectum_current_user'),

    getSubjects: (userEmail) => {
        const key = `lectum_subjects_${userEmail}`;
        return JSON.parse(localStorage.getItem(key)) || [];
    },

    saveSubjects: (userEmail, subjects) => {
        const key = `lectum_subjects_${userEmail}`;
        localStorage.setItem(key, JSON.stringify(subjects));
    },

    getSharedItems: () => {
        const shared = localStorage.getItem('lectum_shared_items');
        return shared ? JSON.parse(shared) : {};
    },

    saveSharedItem: (shareCode, data) => {
        const shared = DB.getSharedItems();
        shared[shareCode] = {
            ...data,
            createdAt: new Date().toISOString()
        };
        localStorage.setItem('lectum_shared_items', JSON.stringify(shared));
    },

    getSharedItem: (shareCode) => {
        const shared = DB.getSharedItems();
        return shared[shareCode] || null;
    }
};

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let isLoginMode = true;
let currentSubjectId = null;
let currentUserEmail = null;
let currentTheme = localStorage.getItem('lectum_theme') || 'light';

// === ТЕМА ===
function initTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeButtons();
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('lectum_theme', currentTheme);
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeButtons();
}

function updateThemeButtons() {
    const icon = currentTheme === 'light' ? '🌙' : '☀️';
    const landingBtn = document.getElementById('landing-theme-toggle');
    const appBtn = document.getElementById('app-theme-toggle');
    if (landingBtn) landingBtn.innerText = icon;
    if (appBtn) appBtn.innerText = icon;
}

// === НАВИГАЦИЯ ===
function init() {
    initTheme();
    const user = DB.getCurrentUser();
    if (user) {
        showApp(user);
    } else {
        showLanding();
    }
}

function showLanding() {
    document.getElementById('landing-page').style.display = 'block';
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'none';
    window.scrollTo(0, 0);
}

function showAuth(mode) {
    isLoginMode = (mode === 'login');
    updateAuthUI();
    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
}

function showApp(email) {
    currentUserEmail = email;
    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
    const user = DB.getUser(email);
    const displayName = user.nickname || email.split('@')[0];
    document.getElementById('user-display').innerText = displayName;

    const avatarEl = document.getElementById('header-avatar');
    const profilePreview = document.getElementById('profile-avatar-preview');
    const profileEmail = document.getElementById('profile-email');
    const profileNickname = document.getElementById('profile-nickname');

    profileEmail.value = email;
    profileNickname.value = user.nickname || '';

    if (user && user.avatar) {
        avatarEl.innerHTML = `<img src="${user.avatar}" class="avatar-img">`;
        profilePreview.innerHTML = `<img src="${user.avatar}" class="avatar-img">`;
    } else {
        avatarEl.innerHTML = '👤';
        profilePreview.innerHTML = '👤';
    }

    renderSubjects();
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    updateAuthUI();
}

function updateAuthUI() {
    document.getElementById('auth-title').innerText = isLoginMode ? 'Вход' : 'Регистрация';
    document.getElementById('auth-toggle-text').innerText = isLoginMode
        ? 'Нет аккаунта? Зарегистрироваться'
        : 'Есть аккаунт? Войти';
}

// === АВТОРИЗАЦИЯ ===
document.getElementById('auth-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const users = DB.getUsers();
    if (isLoginMode) {
        const user = users.find(u => u.email === email && u.password === password);
        if (user) {
            DB.setCurrentUser(email);
            showApp(email);
        } else {
            alert('❌ Неверный email или пароль');
        }
    } else {
        if (users.find(u => u.email === email)) {
            alert('⚠️ Пользователь уже существует');
            return;
        }
        DB.saveUser({ email, password, avatar: null, nickname: '' });
        alert('✅ Регистрация успешна! Теперь войдите.');
        toggleAuthMode();
    }
});

function logout() {
    DB.logout();
    currentUserEmail = null;
    currentSubjectId = null;
    showLanding();
}

// === ПРОФИЛЬ ===
function handleAvatarUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64String = reader.result;
        const user = DB.getUser(currentUserEmail);
        user.avatar = base64String;
        DB.saveUser(user);
        showApp(currentUserEmail);
        closeModal('profile-modal');
    };
    reader.readAsDataURL(file);
}

function removeAvatar() {
    if (!confirm('Удалить аватарку?')) return;
    const user = DB.getUser(currentUserEmail);
    user.avatar = null;
    DB.saveUser(user);
    showApp(currentUserEmail);
    closeModal('profile-modal');
}

function saveProfile() {
    const nickname = document.getElementById('profile-nickname').value.trim();
    const user = DB.getUser(currentUserEmail);
    user.nickname = nickname;
    DB.saveUser(user);
    showApp(currentUserEmail);
    closeModal('profile-modal');
    alert('✅ Профиль сохранен!');
}

// === ПРЕДМЕТЫ ===
function renderSubjects() {
    const list = document.getElementById('subjects-list');
    list.innerHTML = '';
    const subjects = DB.getSubjects(currentUserEmail);
    if (subjects.length === 0) {
        list.innerHTML = '<div style="padding:10px; font-size:0.8rem; opacity:0.5;">Нет предметов</div>';
        return;
    }

    subjects.forEach(sub => {
        const div = document.createElement('div');
        div.className = `subject-item ${currentSubjectId === sub.id ? 'active' : ''}`;
        const importBadge = sub.importedFrom ? ' 📥' : '';
        div.innerHTML = `<span>${sub.name}${importBadge}</span> <small>${sub.files ? sub.files.length : 0}</small>`;
        div.onclick = () => selectSubject(sub.id);
        list.appendChild(div);
    });
}

function openModal(id) { 
    document.getElementById(id).style.display = 'flex'; 
}

function closeModal(id) { 
    document.getElementById(id).style.display = 'none'; 
}

function addSubject() {
    const name = document.getElementById('new-subject-name').value;
    if (!name) return;
    const subjects = DB.getSubjects(currentUserEmail);
    subjects.push({ id: Date.now(), name, files: [] });
    DB.saveSubjects(currentUserEmail, subjects);
    document.getElementById('new-subject-name').value = '';
    closeModal('add-subject-modal');
    renderSubjects();
    selectSubject(subjects[subjects.length - 1].id);
}

function deleteCurrentSubject() {
    if (!currentSubjectId) return;
    if (!confirm('Вы уверены? Это удалит предмет и все файлы в нем.')) return;
    let subjects = DB.getSubjects(currentUserEmail);
    subjects = subjects.filter(s => s.id !== currentSubjectId);
    DB.saveSubjects(currentUserEmail, subjects);

    currentSubjectId = null;
    document.getElementById('subject-workspace').style.display = 'none';
    document.getElementById('empty-state').style.display = 'block';
    renderSubjects();
}

function selectSubject(id) {
    currentSubjectId = id;
    renderSubjects();
    const subjects = DB.getSubjects(currentUserEmail);
    const subject = subjects.find(s => s.id === id);
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('subject-workspace').style.display = 'flex';
    document.getElementById('current-subject-title').innerText = subject.name;
    document.getElementById('subject-id-display').innerText = `ID: ${subject.id}`;

    renderFiles(subject.files || []);
    document.getElementById('preview-box').innerHTML = '<div class="placeholder-text">Выберите файл</div>';
}

// === ФАЙЛЫ ===
function renderFiles(files) {
    const list = document.getElementById('files-list');
    list.innerHTML = '';
    if (!files || files.length === 0) {
        list.innerHTML = '<div style="padding:10px; color:var(--text-muted);">Пусто</div>';
        return;
    }
    files.forEach((file) => {
        const div = document.createElement('div');
        div.className = 'file-card';
        const icon = file.type.includes('pdf') ? '📄' : (file.type.includes('image') ? '🖼️' : '📝');
        const importBadge = file.importedFrom ? ' 📥' : '';
        div.innerHTML = `
            <div class="file-left">
                <div class="file-icon">${icon}</div>
                <div class="file-info">
                    <h4>${file.name}${importBadge}</h4>
                    <span>${file.size}</span>
                </div>
            </div>
            <div style="display:flex; gap:5px;">
                ${!file.importedFrom ? `<button class="btn-sm" onclick="shareFile(event, '${file.id}')" title="Поделиться">🔗</button>` : ''}
                <button class="btn btn-danger" style="padding:4px 8px; font-size:0.7rem;" onclick="deleteFile(event, '${file.id}')" title="Удалить">🗑️</button>
            </div>
        `;
        div.querySelector('.file-left').onclick = () => previewFile(file);
        list.appendChild(div);
    });
}

function handleFileUpload(input) {
    const file = input.files[0];
    if (!file || !currentSubjectId) return;
    const subjects = DB.getSubjects(currentUserEmail);
    const subjectIndex = subjects.findIndex(s => s.id === currentSubjectId);
    const newFile = {
        id: Date.now().toString(),
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        type: file.type,
        blobUrl: URL.createObjectURL(file),
        uploadedBy: currentUserEmail
    };
    if (!subjects[subjectIndex].files) subjects[subjectIndex].files = [];
    subjects[subjectIndex].files.push(newFile);
    DB.saveSubjects(currentUserEmail, subjects);
    renderFiles(subjects[subjectIndex].files);
    previewFile(newFile);
    input.value = '';
}

function deleteFile(event, fileId) {
    event.stopPropagation();
    if(!confirm('Удалить файл?')) return;
    const subjects = DB.getSubjects(currentUserEmail);
    const subjectIndex = subjects.findIndex(s => s.id === currentSubjectId);
    subjects[subjectIndex].files = subjects[subjectIndex].files.filter(f => f.id !== fileId);
    DB.saveSubjects(currentUserEmail, subjects);
    renderFiles(subjects[subjectIndex].files);
    document.getElementById('preview-box').innerHTML = '<div class="placeholder-text">Файл удален</div>';
}

function previewFile(file) {
    const box = document.getElementById('preview-box');
    if (file.type.includes('pdf')) {
        box.innerHTML = `<div style="color:white; text-align:center;">
            <h3>📄 ${file.name}</h3><br>
            <a href="${file.blobUrl}" target="_blank" class="btn">Открыть PDF</a>
        </div>`;
    } else if (file.type.includes('image')) {
        box.innerHTML = `<img src="${file.blobUrl}" style="max-width:100%; max-height:100%;">`;
    } else {
        box.innerHTML = `<div style="color:white">Предпросмотр недоступен</div>`;
    }
}

// === ШАРИНГ И ИМПОРТ ===
function generateShareCode(data) {
    try {
        const jsonString = JSON.stringify(data);
        const base64 = btoa(unescape(encodeURIComponent(jsonString)));
        return 'LECTUM-' + base64;
    } catch (e) {
        console.error('Ошибка генерации кода:', e);
        return null;
    }
}

function parseShareCode(code) {
    try {
        if (!code || typeof code !== 'string') {
            console.error('Код пустой или не строка');
            return null;
        }
        let cleanCode = code.trim();
        if (cleanCode.startsWith('LECTUM-')) {
            cleanCode = cleanCode.substring(7);
        }
        
        if (!cleanCode) {
            console.error('Код пуст после очистки');
            return null;
        }
        
        const jsonString = decodeURIComponent(escape(atob(cleanCode)));
        const data = JSON.parse(jsonString);
        
        if (!data.type || (data.type !== 'subject' && data.type !== 'file')) {
            console.error('Неверный тип данных');
            return null;
        }
        
        return data;
    } catch (e) {
        console.error('Ошибка парсинга кода:', e);
        return null;
    }
}

function shareSubject() {
    if (!currentSubjectId) {
        alert('⚠️ Сначала выберите предмет');
        return;
    }
    const subjects = DB.getSubjects(currentUserEmail);
    const subject = subjects.find(s => s.id === currentSubjectId);

    if (!subject) {
        alert('⚠️ Предмет не найден');
        return;
    }

    const shareData = {
        type: 'subject',
        shareId: 'subj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        subjectId: subject.id,
        name: subject.name,
        sharedBy: currentUserEmail,
        sharedAt: new Date().toISOString(),
        files: subject.files ? subject.files.map(f => ({ 
            id: f.id, 
            name: f.name, 
            type: f.type, 
            size: f.size,
            uploadedBy: f.uploadedBy
        })) : []
    };

    const shareCode = generateShareCode(shareData);

    if (!shareCode) {
        alert('❌ Ошибка генерации кода');
        return;
    }

    DB.saveSharedItem(shareCode, shareData);

    document.getElementById('share-modal-title').innerText = '📚 Поделиться предметом';
    document.getElementById('share-code-display').innerText = shareCode;
    openModal('share-modal');
}

function shareFile(event, fileId) {
    event.stopPropagation();
    if (!currentSubjectId) {
        alert('⚠️ Сначала выберите предмет');
        return;
    }

    const subjects = DB.getSubjects(currentUserEmail);
    const subject = subjects.find(s => s.id === currentSubjectId);
    const file = subject.files.find(f => f.id === fileId);

    if (!file) {
        alert('⚠️ Файл не найден');
        return;
    }

    const shareData = {
        type: 'file',
        shareId: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        fileId: file.id,
        fileName: file.name,
        subjectId: subject.id,
        subjectName: subject.name,
        sharedBy: currentUserEmail,
        sharedAt: new Date().toISOString(),
        fileType: file.type,
        fileSize: file.size
    };

    const shareCode = generateShareCode(shareData);

    if (!shareCode) {
        alert('❌ Ошибка генерации кода');
        return;
    }

    DB.saveSharedItem(shareCode, shareData);

    document.getElementById('share-modal-title').innerText = '📄 Поделиться файлом';
    document.getElementById('share-code-display').innerText = shareCode;
    openModal('share-modal');
}

function copyShareCode() {
    const code = document.getElementById('share-code-display').innerText;
    navigator.clipboard.writeText(code).then(() => {
        alert('✅ Код скопирован в буфер обмена!\n\nОтправь его одногруппнику для импорта.');
        closeModal('share-modal');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('✅ Код скопирован!');
        closeModal('share-modal');
    });
}

function importSubject() {
    const code = document.getElementById('import-code').value.trim();
    if (!code) {
        alert('⚠️ Введите код для импорта');
        return;
    }

    console.log('Попытка импорта кода:', code.substring(0, 50) + '...');

    const data = parseShareCode(code);

    if (!data) {
        alert('❌ Ошибка импорта. Неверный формат кода.\n\nУбедитесь, что вы скопировали весь код полностью.');
        console.error('Распарсенные данные:', data);
        return;
    }

    console.log('Успешно распарсено:', data);

    try {
        const subjects = DB.getSubjects(currentUserEmail);
        
        if (data.type === 'subject') {
            if (subjects.find(s => s.id === data.subjectId)) {
                alert('⚠️ Этот предмет уже импортирован!');
                return;
            }
            
            subjects.push({
                id: data.subjectId, 
                name: data.name + " (Импорт)",
                files: data.files || [],
                importedFrom: data.sharedBy,
                importedAt: new Date().toISOString()
            });
            
            DB.saveSubjects(currentUserEmail, subjects);
            document.getElementById('import-code').value = '';
            renderSubjects();
            alert(`✅ Предмет "${data.name}" успешно импортирован!\n\n📁 Файлов: ${data.files ? data.files.length : 0}`);
            
        } else if (data.type === 'file') {
            let targetSubject = subjects.find(s => s.id === data.subjectId);
            
            if (!targetSubject) {
                targetSubject = {
                    id: data.subjectId,
                    name: data.subjectName + " (Импорт)",
                    files: [],
                    importedFrom: data.sharedBy,
                    importedAt: new Date().toISOString()
                };
                subjects.push(targetSubject);
            }
            
            const newFile = {
                id: data.fileId,
                name: data.fileName,
                type: data.fileType,
                size: data.fileSize,
                importedFrom: data.sharedBy,
                importedAt: new Date().toISOString()
            };
            
            if (!targetSubject.files) targetSubject.files = [];
            if (!targetSubject.files.find(f => f.id === data.fileId)) {
                targetSubject.files.push(newFile);
            } else {
                alert('⚠️ Этот файл уже импортирован!');
                return;
            }
             
            DB.saveSubjects(currentUserEmail, subjects);
            document.getElementById('import-code').value = '';
            renderSubjects();
            alert(`✅ Файл "${data.fileName}" успешно импортирован в предмет "${data.subjectName}"!`);
        }
        
    } catch (e) {
        console.error('Ошибка при импорте:', e);
        alert('❌ Ошибка импорта. Попробуйте ещё раз.');
    }
}

// Запуск приложения
init();