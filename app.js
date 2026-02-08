// Mason's Overdrive Shield v3.0 - Maximum Drastic Change
const musicLibrary = [
    { name: "Kamma", url: "music/Kamma Official Audio.mp3" },
    { name: "Coup D'état", url: "music/Coup D'état Song.mp3" }
];

let audioCtx, musicSource, highBoostFilter, masterGain, analyser;
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

        // THE MASKER: High-pass filter makes the music "piercing" to match the drill
        highBoostFilter = audioCtx.createBiquadFilter();
        highBoostFilter.type = "highpass"; // Switched from highshelf to highpass for more "bite"
        highBoostFilter.frequency.value = 4000; 
        
        // MASTER GAIN: Set to a huge multiplier
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 1.0; 

        const micSource = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        micSource.connect(analyser);

        // We use TWO paths: One for normal music, and one for the "Shield"
        // This ensures the music doesn't just disappear, it just gets a massive boost
        const dryGain = audioCtx.createGain();
        dryGain.gain.value = 1.0;

        musicSource.connect(dryGain);
        dryGain.connect(audioCtx.destination);

        musicSource.connect(highBoostFilter);
        highBoostFilter.connect(masterGain);
        masterGain.connect(audioCtx.destination);
        
        musicSource.start();
        isPlaying = true;
        status.innerText = "SYSTEM ARMED";
        status.style.background = "#059669";

        runDetectionLoop();
    } catch (err) {
        status.innerText = "Error: Check Mic";
    }
}

function stopAudio() {
    if (musicSource) {
        musicSource.stop();
        isPlaying = false;
        document.getElementById('statusIndicator').innerText = "Standby";
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
        for(let i = 40; i < 120; i++) { highFreqSum += dataArray[i]; }
        let avg = highFreqSum / 80;

        if (avg > 10) { 
            // DRASTIC CHANGE: Boost the high-pass path by 10x volume
            masterGain.gain.setTargetAtTime(10.0, audioCtx.currentTime, 0.05); 
            status.innerText = "!!! SHIELD OVERDRIVE !!!";
            status.style.background = "#dc2626";
            status.style.boxShadow = "0 0 20px #ef4444";
        } else { 
            masterGain.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.2);
            status.innerText = "Monitoring...";
            status.style.background = "#059669";
            status.style.boxShadow = "none";
        }
        requestAnimationFrame(check);
    };
    check();
}

window.onload = initPlaylist;
