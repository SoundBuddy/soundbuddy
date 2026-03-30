// Mason's Spectral Contrast Protocol v4.0
function runDetectionLoop() {
    if (!isPlaying) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const canvas = document.getElementById('visualizer');
    const canvasCtx = canvas.getContext('2d');
    const status = document.getElementById('statusIndicator');
    const meter = document.getElementById('acumMeter') || document.createElement('div');

    const draw = () => {
        if (!isPlaying) return;
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        // 1. CLEAR CANVAS
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        // 2. DRAW FREQUENCY BARS
        const barWidth = (canvas.width / analyser.frequencyBinCount) * 2.5;
        let x = 0;

        for (let i = 0; i < analyser.frequencyBinCount; i++) {
            let barHeight = dataArray[i];
            
            // Color logic: High frequencies (where the drill is) are highlighted
            if (i > 45 && i < 115) {
                canvasCtx.fillStyle = `rgb(${barHeight + 100}, 50, 50)`; // Reddish for drill zone
            } else {
                canvasCtx.fillStyle = `rgb(50, ${barHeight + 100}, 200)`; // Blue for music
            }

            canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }

        // 3. CALCULATION LOGIC
        let highFreqSum = 0;
        for (let i = 45; i < 115; i++) { highFreqSum += dataArray[i]; }
        let avg = highFreqSum / 70;
        let estimatedAcums = (avg / 22).toFixed(2);
        meter.innerText = `Sensory Sharpness: ${estimatedAcums} Acums`;

        // 4. DETECTION & DELAY LOGIC
        if (avg > 13) {
            if (!drillDetectedStartTime) drillDetectedStartTime = Date.now();
            let elapsed = Date.now() - drillDetectedStartTime;

            if (elapsed >= TRIGGER_DELAY_MS) {
                highBoostFilter.gain.setTargetAtTime(25, audioCtx.currentTime, 0.1);
                masterGain.gain.setTargetAtTime(3.0, audioCtx.currentTime, 0.2);
                status.innerText = "CONTRAST REDUCED - SHIELD ACTIVE";
                status.style.background = "#dc2626";
            } else {
                status.innerText = `Verifying Contrast Spike... (${Math.ceil((3000 - elapsed) / 1000)}s)`;
                status.style.background = "#ca8a04";
            }
        } else {
            drillDetectedStartTime = null;
            highBoostFilter.gain.setTargetAtTime(0, audioCtx.currentTime, 0.5);
            masterGain.gain.setTargetAtTime(1.0, audioCtx.currentTime, 0.5);
            status.innerText = "Monitoring Spectral Balance...";
            status.style.background = "#059669";
        }
    };
    draw();
}
