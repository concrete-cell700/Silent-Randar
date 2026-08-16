// ============================================================
//  SchoolMap PUBLIC — просмотр карт школы (без локальных файлов)
//  Хранение версии в localStorage, картинки — в памяти
// ============================================================

const GITHUB_RAW = 'https://raw.githubusercontent.com/concrete-cell700/school/main/school/';
const VERSION_FILE = 'versions/version.txt';
const UPDATE_FILE = 'config/updatelist.txt';

let currentVersion = '';
let localVersion = '';
let currentCorp = 'corp1';
let currentStage = 1;
let totalStages = { corp1: 0, corp2: 0 };
let imageCache = {};

// ============================================================
//  РАБОТА С LOCALSTORAGE (вместо файлов)
// ============================================================
function getLocalVersion() {
    return localStorage.getItem('schoolmap_version') || '';
}

function setLocalVersion(ver) {
    localStorage.setItem('schoolmap_version', ver);
}

// ============================================================
//  ЗАГРУЗКА С GITHUB
// ============================================================
async function downloadFile(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
}

async function downloadImage(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
}

// ============================================================
//  ОСНОВНАЯ ЛОГИКА
// ============================================================
async function init() {
    try {
        localVersion = getLocalVersion();

        // Версия с GitHub
        try {
            currentVersion = await downloadFile(GITHUB_RAW + VERSION_FILE);
            currentVersion = currentVersion.trim();
        } catch (e) {
            if (localVersion) {
                currentVersion = localVersion;
            } else {
                throw new Error('Не удалось получить версию и нет локальной копии');
            }
        }

        if (localVersion !== currentVersion) {
            await showUpdateScreen();
        } else {
            await loadMap();
        }
    } catch (e) {
        showError('Ошибка: ' + e.message);
    }
}

// ============================================================
//  ЭКРАН ОБНОВЛЕНИЯ
// ============================================================
async function showUpdateScreen() {
    document.body.innerHTML = `
        <div style="padding:20px;max-width:600px;margin:auto;background:#0d0d0d;color:#e0e0e0;min-height:100vh;">
            <h1>📢 Доступно обновление</h1>
            <div id="updateText" style="background:#1a1a1a;padding:16px;border-radius:10px;max-height:60vh;overflow-y:auto;white-space:pre-wrap;margin:16px 0;"></div>
            <button id="updateBtn" style="width:100%;padding:14px;background:#1e88e5;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer;">
                🔄 Обновить
            </button>
        </div>
    `;

    try {
        const updateText = await downloadFile(GITHUB_RAW + UPDATE_FILE);
        document.getElementById('updateText').textContent = updateText;
    } catch (e) {
        document.getElementById('updateText').textContent = 'Нет описания обновления.';
    }

    document.getElementById('updateBtn').onclick = async function() {
        this.disabled = true;
        this.textContent = '⏳ Обновление...';
        try {
            // Очищаем кеш картинок
            imageCache = {};
            // Скачиваем всё заново
            await downloadAllFiles();
            // Сохраняем версию
            setLocalVersion(currentVersion);
            alert('✅ Обновление завершено!');
            location.reload();
        } catch (e) {
            alert('❌ Ошибка обновления: ' + e.message);
            this.disabled = false;
            this.textContent = '🔄 Обновить';
        }
    };
}

// ============================================================
//  ЗАГРУЗКА ВСЕХ КАРТИНОК (в память)
// ============================================================
async function downloadAllFiles() {
    const corps = ['corp1', 'corp2'];
    for (const corp of corps) {
        let stage = 1;
        let hasMore = true;
        while (hasMore) {
            const url = `${GITHUB_RAW}maps/${corp}/stage${stage}/floor1.png`;
            try {
                const imgData = await downloadImage(url);
                if (!imageCache[corp]) imageCache[corp] = {};
                imageCache[corp][stage] = imgData;
                stage++;
            } catch (e) {
                hasMore = false;
            }
        }
        totalStages[corp] = stage - 1;
    }
}

// ============================================================
//  ОТОБРАЖЕНИЕ КАРТЫ
// ============================================================
async function loadMap() {
    await downloadAllFiles();

    document.body.innerHTML = `
        <div style="padding:20px;max-width:600px;margin:auto;background:#0d0d0d;color:#e0e0e0;min-height:100vh;display:flex;flex-direction:column;align-items:center;">
            <h1 id="title" style="margin-bottom:10px;">🏫 SchoolMap</h1>
            <div id="navBar" style="display:flex;gap:20px;margin:10px 0;">
                <button id="prevCorp" style="background:#1e88e5;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:20px;">◀</button>
                <span id="corpName" style="font-size:18px;font-weight:bold;">Корпус 1</span>
                <button id="nextCorp" style="background:#1e88e5;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:20px;">▶</button>
            </div>
            <div id="stageNav" style="display:flex;gap:20px;margin:10px 0;">
                <button id="prevStage" style="background:#1e88e5;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:20px;">▲</button>
                <span id="stageName" style="font-size:18px;font-weight:bold;">Этаж 1</span>
                <button id="nextStage" style="background:#1e88e5;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:20px;">▼</button>
            </div>
            <img id="mapImage" src="" alt="Карта" style="max-width:100%;max-height:70vh;border-radius:10px;margin-top:10px;">
            <div id="cameraButtons" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">
                <!-- Кнопки камер будут здесь -->
            </div>
        </div>
    `;

    const prevCorpBtn = document.getElementById('prevCorp');
    const nextCorpBtn = document.getElementById('nextCorp');
    const prevStageBtn = document.getElementById('prevStage');
    const nextStageBtn = document.getElementById('nextStage');
    const corpName = document.getElementById('corpName');
    const stageName = document.getElementById('stageName');
    const mapImage = document.getElementById('mapImage');

    function updateView() {
        corpName.textContent = currentCorp === 'corp1' ? 'Корпус 1' : 'Корпус 2';
        stageName.textContent = `Этаж ${currentStage}`;

        const imgData = imageCache[currentCorp]?.[currentStage];
        if (imgData) {
            mapImage.src = imgData;
        } else {
            mapImage.alt = 'Нет карты';
            mapImage.src = '';
        }

        const total = totalStages[currentCorp] || 0;
        document.getElementById('stageNav').style.display = total > 1 ? 'flex' : 'none';
    }

    prevCorpBtn.onclick = () => {
        const corps = ['corp1', 'corp2'];
        const idx = corps.indexOf(currentCorp);
        const newIdx = (idx - 1 + corps.length) % corps.length;
        if (corps[newIdx] !== currentCorp) {
            currentCorp = corps[newIdx];
            if (currentStage > totalStages[currentCorp]) {
                currentStage = totalStages[currentCorp] || 1;
            }
            updateView();
        }
    };

    nextCorpBtn.onclick = () => {
        const corps = ['corp1', 'corp2'];
        const idx = corps.indexOf(currentCorp);
        const newIdx = (idx + 1) % corps.length;
        if (corps[newIdx] !== currentCorp) {
            currentCorp = corps[newIdx];
            if (currentStage > totalStages[currentCorp]) {
                currentStage = totalStages[currentCorp] || 1;
            }
            updateView();
        }
    };

    prevStageBtn.onclick = () => {
        const total = totalStages[currentCorp] || 0;
        if (total <= 1) return;
        currentStage = currentStage > 1 ? currentStage - 1 : total;
        updateView();
    };

    nextStageBtn.onclick = () => {
        const total = totalStages[currentCorp] || 0;
        if (total <= 1) return;
        currentStage = currentStage < total ? currentStage + 1 : 1;
        updateView();
    };

    updateView();
}

function showError(msg) {
    document.body.innerHTML = `
        <div style="padding:20px;text-align:center;color:#e53935;background:#0d0d0d;min-height:100vh;display:flex;flex-direction:column;justify-content:center;">
            <h1>❌ Ошибка</h1>
            <p>${msg}</p>
            <button onclick="location.reload()" style="padding:12px 24px;background:#1e88e5;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer;">🔄 Попробовать снова</button>
        </div>
    `;
}

init();