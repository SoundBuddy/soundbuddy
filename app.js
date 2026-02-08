// Mason's Master Gain & Shield v3.0
const musicLibrary = [
    { name: "Kamma", url: "music/Kamma Official Audio.mp3" },
    { name: "Coup D'état", url: "music/Coup D'état Song.mp3" }
];

let audioCtx, musicSource, highBoostFilter, lowDucker, masterGain, analyser, limiter;
let isPlaying = false;

function initPlaylist() {
    const list = document.getElementById('playlist');
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
    if (isPlaying) { stopAudio(); }

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const status = document.getElementById('statusIndicator');
    status.innerText = "Initializing Full Power Shield...";

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } 
        });

        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        
        musicSource = audioCtx.createBufferSource();
        musicSource.buffer = audioBuffer;
        musicSource.loop = true;

        // 1. Frequency Boost
        highBoostFilter = audioCtx.createBiquadFilter();
        highBoostFilter.type = "highshelf";
        highBoostFilter.frequency.value = 6000; 
        highBoostFilter.gain.value = 0;

        // 2. Bass Ducker
        lowDucker = audioCtx.createBiquadFilter();
        lowDucker.type = "lowshelf";
        lowDucker.frequency.value = 800;
        lowDucker.gain.value = 0;

        // 3. MASTER GAIN (Overall Volume Control)
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 1.0; // Normal volume

        // 4. LIMITER (Protection)
        limiter = audioCtx.createDynamicsCompressor();
        limiter.threshold.setValueAtTime(-10, audioCtx.currentTime);
        limiter.knee.setValueAtTime(30, audioCtx.currentTime);
        limiter.ratio.setValueAtTime(12, audioCtx.currentTime);

        const micSource = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        micSource.connect(analyser);

        // CHAIN: Music -> HighBoost -> LowDuck -> MasterGain -> Limiter -> Output
        musicSource.connect(highBoostFilter);
        highBoostFilter.connect(lowDucker);
        lowDucker.connect(masterGain);
        masterGain.connect(limiter);
        limiter.connect(audioCtx.destination);
        
        musicSource.start();
        isPlaying = true;
        status.innerText = "SYSTEM ACTIVE";
        status.style.background = "#059669";

        setupVisualizer();
        runDetectionLoop();
    } catch (err) {
        console.error(err);
        status.innerText = "Mic Error";
    }
}

function stopAudio() {
    if (musicSource) {
        try { musicSource.stop(); } catch(e) {}
        isPlaying = false;
        document.getElementById('statusIndicator').innerText = "System Standby";
        document.getElementById('statusIndicator').style.background = "#334155";
    }
}

function runDetectionLoop() {
    if (!isPlaying) return; 
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const status = document.getElementById('statusIndicator');

    const check = () => {
        if (!isPlaying) return; 
        analyser.getByteFrequencyData(dataArray);
        
        let highFreqSum = 0;
        for(let i = 45; i < 115; i++) { highFreqSum += dataArray[i]; }
        let avg = highFreqSum / 70;

        if (avg > 12) { 
            // SHIELD ON: Boost high freq, duck low freq, and increase OVERALL gain
            highBoostFilter.gain.setTargetAtTime(20,
