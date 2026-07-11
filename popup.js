document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('toggle-extension');
    const label = document.getElementById('status-label');
    const card = document.getElementById('popup-card');

    const snapToggle = document.getElementById('toggle-snap');
    const snapLabel = document.getElementById('snap-label');

    const sliders = {
        1: { input: document.getElementById('slide-b1'), lbl: document.getElementById('lbl-b1'), btn: document.getElementById('btn-b1') },
        2: { input: document.getElementById('slide-b2'), lbl: document.getElementById('lbl-b2'), btn: document.getElementById('btn-b2') },
        3: { input: document.getElementById('slide-b3'), lbl: document.getElementById('lbl-b3'), btn: document.getElementById('btn-b3') }
    };

    // Load configurations from local storage
    chrome.storage.local.get({
        enabled: true,
        snapEnabled: true,
        btn1_speed: 1.0,
        btn2_speed: 1.5,
        btn3_speed: 2.0
    }, (data) => {
        toggle.checked = data.enabled;
        updateUIState(data.enabled);

        snapToggle.checked = data.snapEnabled;
        updateSnapUIState(data.snapEnabled);

        setupSlider(1, data.btn1_speed);
        setupSlider(2, data.btn2_speed);
        setupSlider(3, data.btn3_speed);
    });

    // Handle master toggle switch modification
    toggle.addEventListener('change', () => {
        const isEnabled = toggle.checked;
        chrome.storage.local.set({ enabled: isEnabled }, () => {
            updateUIState(isEnabled);
        });
    });

    // Handle auto snap toggle switch modification
    snapToggle.addEventListener('change', () => {
        const isSnapEnabled = snapToggle.checked;
        chrome.storage.local.set({ snapEnabled: isSnapEnabled }, () => {
            updateSnapUIState(isSnapEnabled);
        });
    });

    function setupSlider(index, initialValue) {
        const slider = sliders[index];
        slider.input.value = initialValue;
        slider.lbl.innerText = parseFloat(initialValue).toFixed(2) + 'x';

        slider.input.addEventListener('input', () => {
            const val = parseFloat(slider.input.value).toFixed(2);
            slider.lbl.innerText = val + 'x';
            
            const key = `btn${index}_speed`;
            chrome.storage.local.set({ [key]: parseFloat(val) }, () => {
                broadcastButtonRebuild();
            });
        });

        slider.btn.addEventListener('click', () => {
            if (!toggle.checked) return;
            const currentSpeed = parseFloat(slider.input.value);
            sendSpeedToActiveTab(currentSpeed);
        });
    }

    function broadcastButtonRebuild() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "rebuild_buttons",
                    btn1: parseFloat(sliders[1].input.value),
                    btn2: parseFloat(sliders[2].input.value),
                    btn3: parseFloat(sliders[3].input.value)
                }).catch(() => { /* Silence errors on non-video tabs */ });
            }
        });
    }

    function sendSpeedToActiveTab(speedValue) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: (speed) => {
                        const video = document.querySelector('video');
                        if (video) {
                            video.playbackRate = speed;
                        } else {
                            localStorage.setItem('pw_speed', speed);
                        }
                    },
                    args: [speedValue]
                }).catch(() => {});
            }
        });
    }

    function updateUIState(isEnabled) {
        label.innerText = isEnabled ? 'ENABLED' : 'DISABLED';
        label.style.color = isEnabled ? '#38bdf8' : '#64748b';
        if (isEnabled) card.classList.remove('disabled-state');
        else card.classList.add('disabled-state');
    }

    function updateSnapUIState(isSnapEnabled) {
        snapLabel.innerText = isSnapEnabled ? 'ENABLED' : 'DISABLED';
        snapLabel.style.color = isSnapEnabled ? '#38bdf8' : '#64748b';
    }
});