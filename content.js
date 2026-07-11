(function () {
    'use strict';

    let box = null;
    let videoElement = null;
    let isEnabled = true;
    let speedBtnsContainer = null;

    let activeTimeUpdate = null;
    let activeRateChange = null;
    let activeLoadedMetadata = null;

    const style = document.createElement('style');
    style.textContent = `
        .pw-action-icon { display: flex; align-items: center; justify-content: center; opacity: 0.6; transition: opacity 0.25s ease, transform 0.25s ease; }
        .pw-action-icon:hover { opacity: 1; transform: translateY(-1px); }
        .pw-scroll-zone { cursor: ns-resize; }
        .pw-scroll-zone:hover svg { stroke: #7dd3fc !important; }
        
        /* Updated button margins and padding for better spacing */
        .pw-ctrl-btn { 
            background: rgba(2, 2, 2, 0.05); 
            border: 1px solid rgba(255, 255, 255, 0.12); 
            color: #E8E8E8; 
            padding: 3px 12px; 
            border-radius: 20px; 
            cursor: pointer; 
            font-size: 12px; 
            font-weight: normal; 
            margin: 0 4px; 
            transition: all 0.s cubic-bezier(0.25, 1, 0.5, 1); 
            font-family: inherit; 
            white-space: nowrap; 
        }
        .pw-ctrl-btn:hover { background: rgba(2, 2, 2, 0.10); color: #F5F7FA; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
        .pw-ctrl-btn.active { background: rgba(150, 255, 150, 0.3); color: #FFFFFF; border-color: rgba(109, 247, 109, 0.4); box-shadow: 0 0 8px rgba(255, 255, 255, 0.25); }
        .pw-divider { width: 1px; height: 16px; background: rgba(255, 255, 255, 0.12); margin: 0 12px; transition: opacity 0.2s ease; }
        .pw-speed-text { color: #F5F7FA; font-weight: 900; }
        .pw-timer-text { color: #FFFFFF; font-weight: bold; }
    `;
    document.head.appendChild(style);

    function formatTime(sec) {
        if (!sec || sec < 0) return "0:00";
        let h = Math.floor(sec / 3600);
        let m = Math.floor((sec % 3600) / 60);
        let s = Math.floor(sec % 60);
        return h > 0 ? `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}` : `${m}:${s.toString().padStart(2,'0')}`;
    }

    function removeUI() {
        if (box) { box.remove(); box = null; }
        if (videoElement) {
            if (activeTimeUpdate) videoElement.removeEventListener('timeupdate', activeTimeUpdate);
            if (activeRateChange) videoElement.removeEventListener('ratechange', activeRateChange);
            if (activeLoadedMetadata) videoElement.removeEventListener('loadedmetadata', activeLoadedMetadata);
            videoElement = null;
        }
    }

    function rebuildSpeedButtons(video, directSpeeds = null) {
        if (!speedBtnsContainer) return;
        speedBtnsContainer.innerHTML = '';

        if (directSpeeds) {
            renderButtonsArray(video, directSpeeds.btn1, directSpeeds.btn2, directSpeeds.btn3);
        } else {
            chrome.storage.local.get({
                btn1_speed: 1.0,
                btn2_speed: 1.5,
                btn3_speed: 2.0
            }, (speeds) => {
                renderButtonsArray(video, speeds.btn1_speed, speeds.btn2_speed, speeds.btn3_speed);
            });
        }
    }

    function renderButtonsArray(video, b1, b2, b3) {
        [b1, b2, b3].forEach(speed => {
            let btn = document.createElement('button');
            btn.className = 'pw-ctrl-btn';
            btn.innerText = parseFloat(speed).toFixed(2) + 'x';
            btn.dataset.speed = speed;
            btn.onclick = (e) => {
                e.stopPropagation();
                video.playbackRate = parseFloat(speed);
            };
            speedBtnsContainer.appendChild(btn);
        });
        updateActiveButtonHighlight(video.playbackRate);
    }

    function updateActiveButtonHighlight(rate) {
        if (!speedBtnsContainer) return;
        localStorage.setItem('pw_speed', rate);
        Array.from(speedBtnsContainer.children).forEach(btn => {
            if (Math.abs(parseFloat(btn.dataset.speed) - rate) < 0.01) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    function createUI(video) {
        if (box) return; 
        videoElement = video;

        let savedSpeed = parseFloat(localStorage.getItem('pw_speed')) || 1.0;
        let savedX = localStorage.getItem('pw_pos_x') || '5px';
        let savedY = localStorage.getItem('pw_pos_y') || '100px';
        let lastSnapSide = localStorage.getItem('pw_snap_side') || 'left';

        box = document.createElement('div');
        Object.assign(box.style, {
            position: 'fixed', top: savedY, left: savedX, height: '38px', borderRadius: '20px',
            background: 'rgba(18, 18, 22, 0.55)', backdropFilter: 'blur(8px) saturate(260%)', WebkitBackdropFilter: 'blur(8px) saturate(260%)',
            border: '1px solid rgba(255, 255, 255, 0.12)', color: '#F5F7FA', fontSize: '14px',
            fontFamily: '"Segoe UI", Roboto, sans-serif', fontWeight: 'normal', zIndex: '99999',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.05)',
            display: 'flex', alignItems: 'center', padding: '0 16px', overflow: 'hidden', userSelect: 'none', cursor: 'move'
        });

        if (lastSnapSide === 'right') { box.style.left = 'auto'; box.style.right = savedX; }

        let textContainer = document.createElement('div');
        textContainer.style.whiteSpace = 'nowrap';
        textContainer.style.pointerEvents = 'none';
        box.appendChild(textContainer);

        let divider1 = document.createElement('div');
        divider1.className = 'pw-divider';
        divider1.style.cssText = 'opacity:0; width:0px; margin:0px;';
        box.appendChild(divider1);

        let scrollIcon = document.createElement('div');
        scrollIcon.className = 'pw-action-icon pw-scroll-zone';
        scrollIcon.innerHTML = `<svg width="16" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="7" /><line x1="12" y1="6" x2="12" y2="10" stroke="#38bdf8" stroke-width="3"/></svg>`;
        Object.assign(scrollIcon.style, { width: '0px', opacity: '0', overflow: 'hidden', transition: 'width 0.25s ease, opacity 0.2s ease' });
        box.appendChild(scrollIcon);

        // Uses auto-width and max-width animations to snap perfectly without empty dead space
        let iconDrawer = document.createElement('div');
        Object.assign(iconDrawer.style, { 
            display: 'flex', 
            alignItems: 'center', 
            width: 'auto', 
            maxWidth: '0px', 
            opacity: '0', 
            marginLeft: '0px', 
            overflow: 'hidden', 
            transition: 'max-width 0.3s ease, opacity 0.2s ease, margin-left 0.3s ease' 
        });

        speedBtnsContainer = document.createElement('div');
        speedBtnsContainer.style.cssText = 'display:flex; gap:2px;';
        iconDrawer.appendChild(speedBtnsContainer);
        box.appendChild(iconDrawer);
        document.body.appendChild(box);

        rebuildSpeedButtons(video);

        let isDragging = false, offsetX, offsetY;
        box.addEventListener('mousedown', (e) => {
            if (e.target.closest('.pw-scroll-zone') || e.target.closest('.pw-ctrl-btn')) return;
            isDragging = true;
            let rect = box.getBoundingClientRect();
            offsetX = e.clientX - rect.left; offsetY = e.clientY - rect.top;
            box.style.transition = 'none'; box.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) { box.style.right = 'auto'; box.style.left = (e.clientX - offsetX) + 'px'; box.style.top = (e.clientY - offsetY) + 'px'; }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                const pad = 5, rect = box.getBoundingClientRect();
                const snapLeft = rect.left + (rect.width / 2) < window.innerWidth / 2;
                const snapTop = rect.top + (rect.height / 2) < window.innerHeight / 2;
                box.style.transition = 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
                box.style.top = snapTop ? `${pad}px` : `${window.innerHeight - rect.height - pad}px`;
                if (snapLeft) { lastSnapSide = 'left'; box.style.right = 'auto'; box.style.left = `${pad}px`; }
                else { lastSnapSide = 'right'; box.style.left = 'auto'; box.style.right = `${pad}px`; }
                localStorage.setItem('pw_snap_side', lastSnapSide); localStorage.setItem('pw_pos_x', `${pad}px`); localStorage.setItem('pw_pos_y', box.style.top);
            }
            isDragging = false; box.style.cursor = 'move';
        });

        scrollIcon.addEventListener('wheel', (e) => {
            e.preventDefault(); e.stopPropagation();
            let currentSpeed = video.playbackRate;
            currentSpeed = e.deltaY < 0 ? Math.min(3.00, currentSpeed + 0.05) : Math.max(0.25, currentSpeed - 0.05);
            video.playbackRate = parseFloat(currentSpeed.toFixed(2));
        }, { passive: false });

        let contractTimeout;
        box.addEventListener('mouseenter', () => {
            clearTimeout(contractTimeout);
            divider1.style.cssText = 'opacity:1; width:1px; margin:0 12px;';
            scrollIcon.style.width = '16px'; scrollIcon.style.opacity = '1';
            
            // Dynamic max-width ceiling accommodates margins snugly
            iconDrawer.style.maxWidth = '255px'; 
            iconDrawer.style.marginLeft = '12px'; 
            iconDrawer.style.opacity = '1';
        });

        box.addEventListener('mouseleave', () => {
            contractTimeout = setTimeout(() => {
                if (!isDragging) {
                    divider1.style.cssText = 'opacity:0; width:0px; margin:0px;';
                    scrollIcon.style.width = '0px'; scrollIcon.style.opacity = '0';
                    
                    iconDrawer.style.maxWidth = '0px'; 
                    iconDrawer.style.marginLeft = '0px'; 
                    iconDrawer.style.opacity = '0';
                }
            }, 400);
        });

        function render() {
            let remaining = video.duration - video.currentTime;
            let currentSpeed = video.playbackRate;
            textContainer.innerHTML = `<span class="pw-speed-text">⪢ ${currentSpeed.toFixed(2)}x</span> <span class="pw-timer-text">• ${formatTime(remaining / currentSpeed)}</span>`;
        }

        activeTimeUpdate = render;
        activeRateChange = () => { render(); updateActiveButtonHighlight(video.playbackRate); };
        activeLoadedMetadata = () => { video.playbackRate = parseFloat(localStorage.getItem('pw_speed')) || 1.0; render(); };

        video.addEventListener('timeupdate', activeTimeUpdate);
        video.addEventListener('ratechange', activeRateChange);
        video.addEventListener('loadedmetadata', activeLoadedMetadata);

        render();
        video.playbackRate = savedSpeed;
    }

    function checkPageContext() {
        chrome.storage.local.get({ enabled: true }, (data) => {
            isEnabled = data.enabled;
            if (!isEnabled) { removeUI(); return; }
            const video = document.querySelector('video');
            if (video) { if (!box || videoElement !== video) { removeUI(); createUI(video); } } 
            else { removeUI(); }
        });
    }

    setInterval(checkPageContext, 1000);

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.enabled) {
            if (!changes.enabled.newValue) removeUI();
            else checkPageContext();
        }
    });

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "rebuild_buttons") {
            if (box && videoElement) {
                rebuildSpeedButtons(videoElement, message);
            }
        }
    });
})();