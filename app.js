// Mason's Final Extreme Shield v3.0
const musicLibrary = [
    { name: "Kamma", url: "music/Kamma Official Audio.mp3" },
    { name: "Coup D'état", url: "music/Coup D'état Song.mp3" }
];

let audioCtx, musicSource, highBoostFilter, lowDucker, analyser;
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
    status.innerText = "Connecting Mic...";

    try {
        // GET RAW AUDIO - Disables browser muffling
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            } 
        });

        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        
        musicSource = audioCtx.createBufferSource();
        musicSource.buffer = audioBuffer;
        musicSource.loop = true;

        // HIGH SHELF: Boosts everything above 5kHz (The Drill Zone)
        highBoostFilter = audioCtx.createBiquadFilter();
        highBoostFilter.type = "highshelf";
        highBoostFilter.frequency.value = 5000; 
        highBoostFilter.gain.value = 0;

        // LOW SHELF: Used to "duck" bass for contrast
        lowDucker = audioCtx.createBiquadFilter();
        lowDucker.type = "lowshelf";
        lowDucker.frequency.value = 800;
        lowDucker.gain.value = 0;

        // MIC ANALYSER
        const micSource = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        micSource.connect(analyser);

        // ROUTING: Music -> Boost -> Duck -> Speakers
        musicSource.connect(highBoostFilter);
        highBoostFilter.connect(lowDucker);
        lowDucker.connect(audioCtx.destination);
        
        musicSource.start();
        isPlaying = true;
        status.innerText = "SYSTEM ACTIVE";
        status.style.background = "#059669";

        setupVisualizer();
        runDetectionLoop();
    } catch (err) {
        console.error(err);
        status.innerText = "Mic Error - Please Allow Access";
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
        
        // Summing up high-frequency bins (approx 5kHz to 12kHz)
        let highFreqSum = 0;
        for(let i = 40; i < 120; i++) { highFreqSum += dataArray[i]; }
        let avg = highFreqSum / 80;

        // TRIGGER SENSITIVITY: Lowered to 10 for instant reaction
        if (avg > 10) { 
            // Aggressive 45dB boost
            highBoostFilter.gain.setTargetAtTime(45, audioCtx.currentTime, 0.03); 
            // Extreme bass ducking for maximum contrast
            lowDucker.gain.setTargetAtTime(-25, audioCtx.currentTime, 0.05);
            
            status.innerText = "SHIELD BOOSTED - DRILL DETECTED";
            status.style.background = "#dc2626";
        } else { 
            highBoostFilter.gain.setTargetAtTime(0, audioCtx.currentTime, 0.3);
            lowDucker.gain.setTargetAtTime(0, audioCtx.currentTime, 0.3);
            status.innerText = "Monitoring Environment...";
            status.style.background = "#059669";
        }
        requestAnimationFrame(check);
    };
    check();
}

function setupVisualizer() {
    const canvas = document.getElementById('visualizer');
    const canvasCtx = canvas.getContext('2d');
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
        if (!isPlaying) return;
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        
        canvasCtx.fillStyle = '#0f172a';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / dataArray.length) * 2;
        let x = 0;

        for(let i = 0; i < dataArray.length; i++) {
            let barHeight = dataArray[i] / 1.5;
            // Bars turn bright orange when loud high frequencies are detected
            canvasCtx.fillStyle = i > 40 && dataArray[i] > 50 ? '#fb923c' : '#38bdf8';
            canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    };
    draw();
}

window.onload = initPlaylist;
