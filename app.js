// --- MASON'S CONFIGURATION ---
const musicLibrary = [
    { name: "Kamma", url: "music/Kamma Official Audio.mp3" },
    { name: "Coup D'état", url: "music/Coup D'état Song.mp3" }
];

let audioCtx, musicSource, highBoostFilter, analyser, canvasCtx, canvas;

function initPlaylist() {
    const list = document.getElementById('playlist');
    musicLibrary.forEach(song => {
        const btn = document.createElement('button');
        btn.innerText = song.name;
        btn.onclick = () => startEngine(song.url);
        list.appendChild(btn);
    });
}

async function startEngine(url) {
    if (audioCtx) audioCtx.close();
    
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const status = document.getElementById('statusIndicator');
    status.innerText = "Loading Audio...";

    // 1. Setup Music
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    
    musicSource = audioCtx.createBufferSource();
    musicSource.buffer = audioBuffer;
    musicSource.loop = true;

    // 2. Setup Masking Filter (High Shelf)
    highBoostFilter = audioCtx.createBiquadFilter();
    highBoostFilter.type = "highshelf";
    highBoostFilter.frequency.value = 8000; // Targets frequencies from 8kHz up
    highBoostFilter.gain.value = 0;

    // 3. Setup Mic Analysis
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const micSource = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    micSource.connect(analyser);

    // 4. Connect Chain
    musicSource.connect(highBoostFilter);
    highBoostFilter.connect(audioCtx.destination);
    
    musicSource.start();
    status.innerText = "SYSTEM ACTIVE - Monitoring Frequencies";
    status.style.background = "#059669";

    setupVisualizer();
    runDetectionLoop();
}

function runDetectionLoop() {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const status = document.getElementById('statusIndicator');

    const check = () => {
        analyser.getByteFrequencyData(dataArray);
        
        // Average energy in the high frequency bins
        let highFreqEnergy = 0;
        for(let i = 40; i < 100; i++) { highFreqEnergy += dataArray[i]; }
        let avg = highFreqEnergy / 60;

        if (avg > 50) { // DRILL DETECTED
            highBoostFilter.gain.setTargetAtTime(15, audioCtx.currentTime, 0.1);
            status.innerText = "DRILL DETECTED - BOOSTING SHIELD";
            status.style.background = "#dc2626";
        } else { // IDLE
            highBoostFilter.gain.setTargetAtTime(0, audioCtx.currentTime, 0.5);
            status.innerText = "Monitoring...";
            status.style.background = "#059669";
        }
        requestAnimationFrame(check);
    };
    check();
}

function setupVisualizer() {
    canvas = document.getElementById('visualizer');
    canvasCtx = canvas.getContext('2d');
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        canvasCtx.fillStyle = '#000';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / dataArray.length) * 2.5;
        let x = 0;

        for(let i = 0; i < dataArray.length; i++) {
            let barHeight = dataArray[i] / 2;
            canvasCtx.fillStyle = `rgb(56, 189, 248)`;
            canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    };
    draw();
}

window.onload = initPlaylist;
