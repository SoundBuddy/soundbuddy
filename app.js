// Mason's Extreme Integrated Masker v3.0
const musicLibrary = [
    { name: "Kamma", url: "music/Kamma Official Audio.mp3" },
    { name: "Coup D'état", url: "music/Coup D'état Song.mp3" }
];

let audioCtx, musicSource, highBoostFilter, lowDucker, analyser;
let isPlaying = false;

function initPlaylist() {
    const list = document.getElementById('playlist');
    // Clear list first to prevent duplicates
    list.innerHTML = ''; 
    
    musicLibrary.forEach(song => {
        const btn = document.createElement('button');
        btn.innerText = song.name;
        btn.onclick = () => startEngine(song.url);
        list.appendChild(btn);
    });

    document.getElementById('stopBtn').onclick = stopAudio;
}

async function startEngine(url) {
    if (isPlaying) {
        stopAudio();
    }

    // Initialize Audio Context
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const status = document.getElementById('statusIndicator');
    status.innerText = "Loading Audio...";

    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        
        musicSource = audioCtx.createBufferSource();
        musicSource.buffer = audioBuffer;
        musicSource.loop = true;

        // 1. HIGH BOOST FILTER (The Masker)
        highBoostFilter = audioCtx.createBiquadFilter();
        highBoostFilter.type = "highshelf";
        highBoostFilter.frequency.value = 6000; 
        highBoostFilter.gain.value = 0;

        // 2. LOW DUCKER (To make the boost stand out)
        lowDucker = audioCtx.createBiquadFilter();
        lowDucker.type = "lowshelf";
        lowDucker.frequency.value = 500;
        lowDucker.gain.value = 0;

        // 3. MIC ANALYSER (The Listener)
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const micSource = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        micSource.connect(analyser);

        // Chain: Music -> HighBoost -> LowDucker -> Speakers
        musicSource.connect(highBoostFilter);
        highBoostFilter.connect(lowDucker);
        lowDucker.connect(audioCtx.destination);
        
        musicSource.start();
        isPlaying = true;
        status.innerText = "MAX SHIELD ACTIVE";
        status.style.background = "#059669";

        setupVisualizer();
        runDetectionLoop();
    } catch (err) {
        console.error("Error starting audio:", err);
        status.innerText = "Error Loading File";
    }
}

function stopAudio() {
    if (musicSource) {
        try { musicSource.stop(); } catch(e) {}
        isPlaying = false;
        const status = document.getElementById('statusIndicator');
        status.innerText = "System Standby";
        status.style.background = "#334155";
    }
}

function runDetectionLoop() {
    if (!isPlaying) return; 

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const status = document.getElementById('statusIndicator');

    const check = () => {
        if (!isPlaying) return; 
        analyser.getByteFrequencyData(dataArray);
        
        // Target high-pitched frequencies (Drill zone)
        let highFreqEnergy = 0;
        for(let i = 50; i < 110; i++) { highFreqEnergy += dataArray[i]; }
        let avg = highFreqEnergy / 60;

        // TRIGGER LOGIC
        if (avg > 20) { // Highly sensitive
            highBoostFilter.gain.setTargetAtTime(40, audioCtx.currentTime, 0.05); // Huge boost
            lowDucker.gain.setTargetAtTime(-15, audioCtx.currentTime, 0.1);    // Cut bass
            status.innerText = "DRILL DETECTED - SHIELD BOOSTED";
            status.style.background = "#dc2626";
        } else { 
            highBoostFilter.gain.setTargetAtTime(0, audioCtx.currentTime, 0.4);
            lowDucker.gain.setTargetAtTime(0, audioCtx.currentTime, 0.4);
            status.innerText = "Monitoring...";
            status.style.background = "#059669";
        }
        requestAnimationFrame(check);
    };
    check();
}

function setupVisualizer() {
    const canvas = document.getElementById('visualizer');
    if (!canvas) return;
    const canvasCtx = canvas.getContext('2d');
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
        if (!
