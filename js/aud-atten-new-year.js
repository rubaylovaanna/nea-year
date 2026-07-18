document.addEventListener('DOMContentLoaded', () => {
    // === ПРОВЕРКА iOS ===
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    // === КОНФИГУРАЦИЯ ЗВУКОВ С HOWLER.JS ===
    // ИСПРАВЛЕНО: везде теперь .mp3 и убраны лишние "./" для стабильности на GitHub
    const soundsConfig = {
        bells: { src: 'audio/bells.mp3', volume: 0.8 },
        chimes: { src: 'audio/chimes.mp3', volume: 0.8 },
        fire: { src: 'audio/fire.mp3', volume: 0.8 },
        whistle: { src: 'audio/whistle.mp3', volume: 0.8 } // <-- БЫЛО .mp4, СТАЛО .mp3
    };

    // Создаём объекты Howl для каждого звука
    const sounds = {};
    Object.keys(soundsConfig).forEach(key => {
        sounds[key] = new Howl({
            src: [soundsConfig[key].src],
            volume: soundsConfig[key].volume,
            html5: true, // Оставляем true для максимальной совместимости с iOS
            preload: true,
            onload: function() {
                console.log(`✅ Звук загружен: ${key}`);
            },
            onloaderror: function(id, error) {
                console.error(`❌ Ошибка загрузки звука ${key}:`, error);
            },
            onplayerror: function(id, error) {
                console.error(`❌ Ошибка воспроизведения ${key}:`, error);
                // Если ошибка из-за блокировки iOS, пытаемся разблокировать
                if (isIOS && !state.audioUnlocked) {
                    unlockAudio();
                }
            }
        });
    });

    // === ДАННЫЕ ИГРЫ ===
    const soundsData = [
        { id: 'bells', name: 'Колокольчики' },
        { id: 'chimes', name: 'Куранты' },
        { id: 'fire', name: 'Бенгальский огонь' },
        { id: 'whistle', name: 'Свистулька' }
    ];

    // === СОСТОЯНИЕ ИГРЫ ===
    let state = {
        score: 0,
        currentTarget: null,
        selectedOption: null,
        audioUnlocked: false
    };

    // === DOM ЭЛЕМЕНТЫ ===
    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');
    
    const ui = {
        score: document.getElementById('score'),
        btnListen: document.getElementById('btn-listen'),
        options: document.querySelectorAll('.option-card'),
        btnCheck: document.getElementById('btn-check'),
        popup: document.getElementById('popup-overlay'),
        popupImg: document.getElementById('popup-img'),
        popupTitle: document.getElementById('popup-title'),
        popupText: document.getElementById('popup-text'),
        btnPopupClose: document.getElementById('btn-popup-close')
    };

    // === ИНИЦИАЛИЗАЦИЯ ===
    function init() {
        // Разблокировка аудио на iOS (нужен первый клик пользователя)
        if (isIOS) {
            document.addEventListener('click', unlockAudio, { once: true });
            document.addEventListener('touchstart', unlockAudio, { once: true });
        }

        document.getElementById('btn-start').addEventListener('click', startGame);
        document.getElementById('btn-back').addEventListener('click', goBackToMenu);
        ui.btnListen.addEventListener('click', playRandomSound);
        ui.btnCheck.addEventListener('click', checkAnswer);
        ui.btnPopupClose.addEventListener('click', nextRound);

        ui.options.forEach(card => {
            card.addEventListener('click', () => selectCard(card));
        });
        
        createSnowflakes();
        
        console.log('🎄 Игра инициализирована с Howler.js');
    }

    // === РАЗБЛОКИРОВКА АУДИО НА iOS ===
    function unlockAudio() {
        if (state.audioUnlocked) return;
        
        console.log('🔓 Попытка разблокировки аудио...');
        // Используем уже загруженный звук для разблокировки контекста
        const unlockSound = sounds['bells'];
        if (unlockSound) {
            unlockSound.volume(0.001); // Делаем почти бесшумным
            unlockSound.play();
            
            setTimeout(() => {
                unlockSound.stop();
                unlockSound.volume(0.8); // Возвращаем нормальную громкость
                state.audioUnlocked = true;
                console.log('✅ Аудио успешно разблокировано!');
            }, 100);
        }
    }

    // === ЛОГИКА ИГРЫ ===
    function startGame() {
        // Гарантируем разблокировку аудио при старте игры
        if (isIOS && !state.audioUnlocked) {
            unlockAudio();
        }

        startScreen.style.display = 'none';
        gameScreen.classList.remove('hidden');
        state.score = 0;
        updateScore();
        nextRound();
    }

    function goBackToMenu() {
        // Останавливаем все звуки
        Object.values(sounds).forEach(sound => {
            if (sound.playing()) {
                sound.stop();
            }
        });
        
        ui.btnListen.classList.remove('playing');
        startScreen.style.display = 'flex';
        gameScreen.classList.add('hidden');
    }

    function nextRound() {
        closePopup();
        state.selectedOption = null;
        state.currentTarget = soundsData[Math.floor(Math.random() * soundsData.length)];
        
        ui.options.forEach(c => c.classList.remove('selected'));
        ui.btnCheck.disabled = true;
        ui.btnListen.classList.remove('playing');
        
        console.log('🎯 Новый раунд. Цель:', state.currentTarget.name);
    }

    function playRandomSound() {
        if (!state.currentTarget) return;
        
        const soundId = state.currentTarget.id;
        const sound = sounds[soundId];
        
        if (!sound) {
            console.error('❌ Звук не найден:', soundId);
            alert('Ошибка: звук не загружен. Проверьте консоль.');
            return;
        }

        // Останавливаем все остальные звуки
        Object.values(sounds).forEach(s => {
            if (s.playing()) {
                s.stop();
            }
        });

        // Показываем анимацию
        ui.btnListen.classList.add('playing');
        
        // Воспроизводим звук
        try {
            sound.play();
            console.log('🔊 Воспроизводится:', soundId);
            
            // Когда звук закончится, убираем анимацию
            sound.once('end', () => {
                ui.btnListen.classList.remove('playing');
                console.log('✅ Звук завершён');
            });
            
            // Страховочный таймаут на случай, если событие 'end' не сработает
            setTimeout(() => {
                ui.btnListen.classList.remove('playing');
            }, 10000);
            
        } catch (error) {
            console.error('❌ Критическая ошибка воспроизведения:', error);
            ui.btnListen.classList.remove('playing');
        }
    }

    function selectCard(card) {
        ui.options.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.selectedOption = card.dataset.sound;
        ui.btnCheck.disabled = false;
        
        // Вибрация только на Android (iOS не поддерживает navigator.vibrate)
        if (!isIOS && navigator.vibrate) {
            navigator.vibrate(10);
        }
    }

    function checkAnswer() {
        if (!state.selectedOption || !state.currentTarget) return;

        const isCorrect = state.selectedOption === state.currentTarget.id;
        
        if (isCorrect) {
            state.score++;
            updateScore();
            showPopup(true);
        } else {
            showPopup(false);
        }
    }

    function updateScore() {
        ui.score.textContent = state.score;
        ui.score.parentElement.style.transform = 'scale(1.3)';
        setTimeout(() => ui.score.parentElement.style.transform = 'scale(1)', 300);
    }

    // === ПОПАП И АНИМАЦИИ ===
    function showPopup(isCorrect) {
        if (isCorrect) {
            ui.popupImg.src = 'img/popup/fine-fox.png';
            ui.popupTitle.textContent = 'Отлично!';
            ui.popupTitle.style.color = '#2ED573';
            ui.popupText.textContent = `Это были ${state.currentTarget.name}. Так держать!`;
        } else {
            ui.popupImg.src = 'img/popup/badly-fox.png';
            ui.popupTitle.textContent = 'Не совсем...';
            ui.popupTitle.style.color = '#FF4757';
            ui.popupText.textContent = `Это звучали ${state.currentTarget.name}. Попробуй ещё раз!`;
        }
        
        ui.popup.classList.remove('hidden');
        
        if (!isCorrect) {
            const content = document.getElementById('popup-content');
            content.style.animation = 'none';
            content.offsetHeight; // trigger reflow для перезапуска анимации
            content.style.animation = 'shakePopup 0.4s ease-in-out';
        }
    }

    function closePopup() {
        ui.popup.classList.add('hidden');
    }

    // === СНЕЖИНКИ ===
    function createSnowflakes() {
        if (!gameScreen) return;
        
        const oldSnowflakes = gameScreen.querySelectorAll('.snowflake-fall');
        oldSnowflakes.forEach(s => s.remove());
        
        // На iOS меньше снежинок для экономии батареи и производительности
        const count = isIOS ? 15 : 25;
        
        for (let i = 0; i < count; i++) {
            const snowflake = document.createElement('div');
            snowflake.className = 'snowflake-fall';
            snowflake.innerHTML = '❅';
            snowflake.style.left = Math.random() * 100 + '%';
            snowflake.style.animationDuration = (Math.random() * 5 + 5) + 's';
            snowflake.style.animationDelay = Math.random() * 5 + 's';
            snowflake.style.opacity = Math.random() * 0.5 + 0.3;
            snowflake.style.fontSize = (Math.random() * 10 + 10) + 'px';
            gameScreen.appendChild(snowflake);
        }
    }

    // Запуск игры
    init();
});
