class PhotoboothApp {
    constructor() {
        this.stream = null;
        this.currentCamera = 'user';
        this.timerSeconds = 3;
        this.isCountingDown = false;
        this.isLargeVideo = false;

        // Frame selection state
        this.frameStyles = [
            { id: 'instax', name: 'Instax', icon: '📸' },
            { id: 'polaroid', name: 'Polaroid', icon: '🟦' },
            { id: 'simple-black', name: 'Black', icon: '⬛' },
            { id: 'gold', name: 'Gold', icon: '🥇' },
            { id: 'rainbow', name: 'Rainbow', icon: '🌈' },
            { id: 'retro', name: 'Retro', icon: '🕹️' },
            { id: 'neon', name: 'Neon', icon: '💡' },
            { id: 'minimal', name: 'Minimal', icon: '⚪' },
            { id: 'funky', name: 'Funky', icon: '🎨' }
        ];
        this.selectedFrame = 'instax';

        this.capturedPhotoBlobs = []; // Array of 4 photo blobs
        this.currentPhotoIndex = 0; // Which photo is shown/previewed

        this.initializeElements();
        this.bindEvents();
        this.initializeCamera();
    }

    initializeElements() {
        this.videoElement = document.getElementById('camera-feed');
        this.canvasElement = document.getElementById('photo-canvas');
        this.photoResult = document.getElementById('photo-result');
        this.capturedPhotoDiv = document.getElementById('captured-photo');
        this.countdownOverlay = document.getElementById('countdown-overlay');
        this.countdownNumber = document.getElementById('countdown-number');
        this.timerDisplay = document.getElementById('timer-display');
        this.timerDecrease = document.getElementById('timer-decrease');
        this.timerIncrease = document.getElementById('timer-increase');
        this.switchCameraBtn = document.getElementById('switch-camera');
        this.takePhotoBtn = document.getElementById('take-photo');
        this.printBtn = document.getElementById('print-photo');
        this.shareBtn = document.getElementById('share-photo');
        this.retakeBtn = document.getElementById('retake-photo');
        this.toggleVideoSizeBtn = document.getElementById('toggle-video-size');
        this.framePicker = document.getElementById('frame-picker');
        this.framePickerInner = document.getElementById('frame-picker-inner');
        this.downloadGalleryBtn = document.getElementById('download-gallery');
        this.photoGallery = document.getElementById('photo-gallery');
    }

    bindEvents() {
        this.timerDecrease.addEventListener('click', () => this.adjustTimer(-1));
        this.timerIncrease.addEventListener('click', () => this.adjustTimer(1));
        this.switchCameraBtn.addEventListener('click', () => this.switchCamera());
        this.takePhotoBtn.addEventListener('click', () => this.startPhotoSequence());
        this.retakeBtn.addEventListener('click', () => this.retakePhotos());
        this.printBtn.addEventListener('click', () => this.printPhoto());
        this.shareBtn.addEventListener('click', () => this.sharePhoto());
        this.toggleVideoSizeBtn.addEventListener('click', () => this.toggleVideoSize());
        this.downloadGalleryBtn.addEventListener('click', () => this.downloadGallery());
        // Frame picker
        if (this.framePickerInner) {
            this.frameStyles.forEach((frame, idx) => {
                const btn = document.createElement('button');
                btn.className = 'frame-thumb';
                btn.dataset.frame = frame.id;
                btn.title = frame.name;
                btn.innerHTML = `<span class="frame-icon">${frame.icon}</span><span class="frame-name">${frame.name}</span>`;
                if (frame.id === this.selectedFrame) btn.classList.add('selected');
                btn.addEventListener('click', () => this.selectFrame(frame.id));
                this.framePickerInner.appendChild(btn);
            });
        }
        window.addEventListener('orientationchange', () => setTimeout(() => this.handleOrientationChange(), 500));
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && !this.stream) {
                this.initializeCamera();
            }
        });
    }

    adjustTimer(change) {
        const newTime = this.timerSeconds + change;
        if (newTime >= 0 && newTime <= 10) {
            this.timerSeconds = newTime;
            this.timerDisplay.textContent = this.timerSeconds;
        }
    }

    async initializeCamera() {
        try {
            if (this.stream) this.stream.getTracks().forEach(track => track.stop());
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            if (videoDevices.length === 0) {
                console.warn('No camera devices found');
                this.handleCameraError(new Error('No camera devices found'));
                return;
            }
            let constraints = {
                video: {
                    facingMode: this.currentCamera,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };
            try {
                this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (e) {
                constraints = { video: true, audio: false };
                this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            }
            this.videoElement.srcObject = this.stream;
            await new Promise((resolve) => {
                this.videoElement.onloadedmetadata = resolve;
            });
            this.videoElement.style.display = 'block';
            this.capturedPhotoDiv.style.display = 'none';
            this.framePicker.style.display = 'none';
            this.photoGallery.style.display = 'none';
            this.downloadGalleryBtn.style.display = 'none';
            this.enableCameraControls();
            if (this.isLargeVideo) {
                this.videoElement.classList.remove('normal-size');
                this.videoElement.classList.add('large-size');
            } else {
                this.videoElement.classList.remove('large-size');
                this.videoElement.classList.add('normal-size');
            }
        } catch (error) {
            this.handleCameraError(error);
        }
    }

    async switchCamera() {
        if (this.isCountingDown) return;
        try {
            this.currentCamera = this.currentCamera === 'user' ? 'environment' : 'user';
            await this.initializeCamera();
        } catch (error) {
            this.currentCamera = this.currentCamera === 'user' ? 'environment' : 'user';
        }
    }

    enableCameraControls() {
        this.switchCameraBtn.disabled = false;
        this.takePhotoBtn.disabled = false;
        this.toggleVideoSizeBtn.disabled = false;
    }
    disableCameraControls() {
        this.switchCameraBtn.disabled = true;
        this.takePhotoBtn.disabled = true;
        this.toggleVideoSizeBtn.disabled = true;
    }

    handleCameraError(error) {
        let errorMessage = 'Camera access failed. ';
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Please allow camera permissions and refresh the page.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'No camera found on this device.';
        } else if (error.name === 'NotSupportedError') {
            errorMessage += 'Camera not supported in this browser.';
        } else {
            errorMessage += 'Please check your camera and try again.';
        }
        this.videoElement.style.display = 'none';
        this.videoElement.parentElement.innerHTML = `<div class="error">${errorMessage}</div>`;
        this.disableCameraControls();
    }

    toggleVideoSize() {
        this.isLargeVideo = !this.isLargeVideo;
        if (this.isLargeVideo) {
            this.videoElement.classList.remove('normal-size');
            this.videoElement.classList.add('large-size');
            this.toggleVideoSizeBtn.textContent = '🔍 Shrink Video';
        } else {
            this.videoElement.classList.remove('large-size');
            this.videoElement.classList.add('normal-size');
            this.toggleVideoSizeBtn.textContent = '🔍 Toggle Video Size';
        }
    }

    // --- Main photo sequence logic ---
    async startPhotoSequence() {
        if (this.isCountingDown) return;
        this.isCountingDown = true;
        this.disableCameraControls();
        this.capturedPhotoBlobs = [];
        this.currentPhotoIndex = 0;
        const numPhotos = 4;
        for (let i = 0; i < numPhotos; i++) {
            await this.runCountdown();
            await this.capturePhotoToBlob();
            if (i < numPhotos - 1) await this.wait(600); // Short pause between shots
        }
        this.isCountingDown = false;
        this.enableCameraControls();
        this.currentPhotoIndex = 0;
        this.showPhoto(this.currentPhotoIndex);
        this.updateGallery();
        this.downloadGalleryBtn.style.display = 'inline-flex';
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    runCountdown() {
        return new Promise(resolve => {
            let countdown = this.timerSeconds;
            if (countdown <= 0) return resolve();
            this.countdownNumber.textContent = countdown;
            this.countdownOverlay.style.display = 'flex';
            const countdownInterval = setInterval(() => {
                countdown--;
                if (countdown > 0) {
                    this.countdownNumber.textContent = countdown;
                    this.countdownNumber.style.animation = 'none';
                    setTimeout(() => {
                        this.countdownNumber.style.animation = 'countdown-pulse 1s ease-in-out';
                    }, 10);
                } else {
                    clearInterval(countdownInterval);
                    this.countdownOverlay.style.display = 'none';
                    resolve();
                }
            }, 1000);
        });
    }

    capturePhotoToBlob() {
        return new Promise((resolve, reject) => {
            try {
                this.createFlashEffect();
                const video = this.videoElement;
                // 4:3 aspect
                const aspectRatio = 4 / 3;
                const frameWidth = 800;
                const frameHeight = frameWidth / aspectRatio;
                this.canvasElement.width = frameWidth;
                this.canvasElement.height = frameHeight;
                const ctx = this.canvasElement.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, frameWidth, frameHeight);
                const padding = 20, bottomPadding = 60;
                const photoX = padding, photoY = padding;
                const photoWidth = frameWidth - (padding * 2);
                const photoHeight = frameHeight - padding - bottomPadding;
                const videoAspect = video.videoWidth / video.videoHeight;
                const photoAspect = photoWidth / photoHeight;
                let drawWidth, drawHeight, drawX, drawY;
                if (videoAspect > photoAspect) {
                    drawHeight = photoHeight;
                    drawWidth = drawHeight * videoAspect;
                    drawX = photoX + (photoWidth - drawWidth) / 2;
                    drawY = photoY;
                } else {
                    drawWidth = photoWidth;
                    drawHeight = drawWidth / videoAspect;
                    drawX = photoX;
                    drawY = photoY + (photoHeight - drawHeight) / 2;
                }
                ctx.save();
                if (this.currentCamera === 'user') {
                    ctx.translate(drawX + drawWidth, drawY);
                    ctx.scale(-1, 1);
                    ctx.drawImage(video, 0, 0, drawWidth, drawHeight);
                } else {
                    ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
                }
                ctx.restore();
                this.addFrameStyling(ctx, frameWidth, frameHeight, this.selectedFrame);
                this.canvasElement.toBlob(blob => {
                    this.capturedPhotoBlobs.push(blob);
                    resolve(blob);
                }, 'image/jpeg', 0.9);
            } catch (e) {
                reject(e);
            }
        });
    }

    // --- Gallery, Preview, and Save ---
    showPhoto(idx) {
        if (!this.capturedPhotoBlobs[idx]) return;
        this.capturedPhotoDiv.style.display = 'block';
        this.videoElement.style.display = 'none';
        this.framePicker.style.display = 'block';
        this.photoGallery.style.display = 'flex';
        const photoURL = URL.createObjectURL(this.capturedPhotoBlobs[idx]);
        this.photoResult.src = photoURL;
        this.photoResult.onload = () => URL.revokeObjectURL(photoURL);
        this.printBtn.disabled = false;
        this.shareBtn.disabled = false;
        this.retakeBtn.style.display = 'block';
        this.takePhotoBtn.style.display = 'none';
        // Gallery highlight
        this.updateGallery(idx);
    }

    updateGallery(selectedIdx) {
        if (!this.capturedPhotoBlobs.length) {
            this.photoGallery.style.display = 'none';
            return;
        }
        this.photoGallery.innerHTML = '';
        this.photoGallery.style.display = 'flex';
        this.capturedPhotoBlobs.forEach((blob, i) => {
            const div = document.createElement('div');
            div.className = 'gallery-thumb';
            const img = document.createElement('img');
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `photobooth-photo-${i + 1}.jpg`;
            link.textContent = 'Download';
            img.src = link.href;
            img.alt = `Photo ${i + 1}`;
            img.title = `Photo ${i + 1}`;
            img.addEventListener('click', () => {
                this.currentPhotoIndex = i;
                this.showPhoto(i);
            });
            if (selectedIdx === i) img.style.border = '3px solid #6c5ce7';
            div.appendChild(img);
            div.appendChild(link);
            this.photoGallery.appendChild(div);
        });
    }

    downloadGallery() {
        this.capturedPhotoBlobs.forEach((blob, i) => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `photobooth-photo-${i + 1}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    // --- Frame picker ---
    selectFrame(frameId) {
        if (!this.frameStyles.some(f => f.id === frameId)) return;
        this.selectedFrame = frameId;
        Array.from(this.framePickerInner.children).forEach(btn =>
            btn.classList.toggle('selected', btn.dataset.frame === frameId)
        );
        // Redraw all photo frames
        this.capturedPhotoBlobs.forEach((blob, idx) => {
            this.applyFrameToPhoto(blob, idx);
        });
        // Show current photo with new frame
        this.showPhoto(this.currentPhotoIndex);
    }

    applyFrameToPhoto(blob, idx) {
        const img = new window.Image();
        img.onload = () => {
            const ctx = this.canvasElement.getContext('2d');
            this.canvasElement.width = img.width;
            this.canvasElement.height = img.height;
            ctx.clearRect(0, 0, img.width, img.height);
            ctx.drawImage(img, 0, 0, img.width, img.height);
            this.addFrameStyling(ctx, img.width, img.height, this.selectedFrame);
            this.canvasElement.toBlob(newBlob => {
                this.capturedPhotoBlobs[idx] = newBlob;
                // update gallery thumbnail
                this.updateGallery(this.currentPhotoIndex);
            }, 'image/jpeg', 0.9);
        };
        img.src = URL.createObjectURL(blob);
    }

    // --- Frame Drawing ---
    addFrameStyling(ctx, width, height, frameId) {
        switch (frameId) {
            case 'instax':
            default:
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
                ctx.lineWidth = 1;
                ctx.strokeRect(20, 20, width - 40, height - 80);
                ctx.fillStyle = '#666666';
                ctx.font = 'bold 16px Arial';
                ctx.letterSpacing = '2px';
                ctx.textAlign = 'right';
                ctx.fillText('INSTAX', width - 25, height - 20);
                break;
            case 'polaroid':
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, width, height);
                ctx.strokeStyle = '#222';
                ctx.lineWidth = 8;
                ctx.strokeRect(0, 0, width, height);
                ctx.fillStyle = '#222';
                ctx.font = 'bold 24px Courier';
                ctx.textAlign = 'center';
                ctx.fillText('Polaroid', width / 2, height - 18);
                break;
            case 'simple-black':
                ctx.strokeStyle = '#222';
                ctx.lineWidth = 20;
                ctx.strokeRect(0, 0, width, height);
                break;
            case 'gold':
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 18;
                ctx.strokeRect(0, 0, width, height);
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 12;
                break;
            case 'rainbow':
                var grad = ctx.createLinearGradient(0, 0, width, height);
                grad.addColorStop(0, "#ff5e62");
                grad.addColorStop(0.25, "#ff9966");
                grad.addColorStop(0.5, "#f5f7b2");
                grad.addColorStop(0.75, "#8fd3f4");
                grad.addColorStop(1, "#84fab0");
                ctx.strokeStyle = grad;
                ctx.lineWidth = 14;
                ctx.strokeRect(8, 8, width - 16, height - 16);
                break;
            case 'retro':
                ctx.strokeStyle = '#d35400';
                ctx.lineWidth = 14;
                ctx.strokeRect(12, 12, width - 24, height - 24);
                ctx.setLineDash([10, 10]);
                ctx.strokeStyle = '#27ae60';
                ctx.lineWidth = 6;
                ctx.strokeRect(26, 26, width - 52, height - 52);
                ctx.setLineDash([]);
                ctx.fillStyle = '#d35400';
                ctx.font = 'bold 18px Arial';
                ctx.textAlign = 'left';
                ctx.fillText('RETRO', 32, height - 16);
                break;
            case 'neon':
                ctx.shadowColor = '#00FFC6';
                ctx.shadowBlur = 20;
                ctx.strokeStyle = '#00FFC6';
                ctx.lineWidth = 10;
                ctx.strokeRect(6, 6, width - 12, height - 12);
                ctx.shadowBlur = 0;
                break;
            case 'minimal':
                ctx.strokeStyle = '#aaa';
                ctx.lineWidth = 3;
                ctx.strokeRect(20, 20, width - 40, height - 40);
                break;
            case 'funky':
                ctx.strokeStyle = '#8e44ad';
                ctx.lineWidth = 12;
                ctx.setLineDash([6, 8]);
                ctx.strokeRect(10, 10, width - 20, height - 20);
                ctx.setLineDash([]);
                ctx.fillStyle = '#e84393';
                ctx.font = 'bold 16px Comic Sans MS, cursive';
                ctx.textAlign = 'center';
                ctx.fillText('FUNKY!', width / 2, 35);
                break;
        }
    }

    createFlashEffect() {
        const flash = document.createElement('div');
        flash.className = 'flash-effect';
        document.body.appendChild(flash);
        setTimeout(() => {
            document.body.removeChild(flash);
        }, 300);
    }

    retakePhotos() {
        this.capturedPhotoBlobs = [];
        this.currentPhotoIndex = 0;
        this.capturedPhotoDiv.style.display = 'none';
        this.videoElement.style.display = 'block';
        this.framePicker.style.display = 'none';
        this.photoGallery.style.display = 'none';
        this.downloadGalleryBtn.style.display = 'none';
        this.printBtn.disabled = true;
        this.shareBtn.disabled = true;
        this.retakeBtn.style.display = 'none';
        this.takePhotoBtn.style.display = 'block';
    }

    async printPhoto() {
        if (!this.capturedPhotoBlobs.length) return;
        try {
            const blob = this.capturedPhotoBlobs[this.currentPhotoIndex];
            const printWindow = window.open('', '_blank');
            const photoURL = URL.createObjectURL(blob);
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Print Photo</title>
                    <style>
                        body { 
                            margin: 0; 
                            padding: 20px; 
                            display: flex; 
                            justify-content: center; 
                            align-items: center; 
                            min-height: 100vh;
                            background: white;
                        }
                        img { 
                            max-width: 100%; 
                            max-height: 100%; 
                            border: 20px solid white;
                            box-shadow: 0 0 20px rgba(0,0,0,0.3);
                        }
                        @media print {
                            body { padding: 0; }
                            img { border: 10px solid white; box-shadow: none; }
                        }
                    </style>
                </head>
                <body>
                    <img src="${photoURL}" alt="Captured Photo" onload="window.print(); window.close();">
                </body>
                </html>
            `);
            printWindow.document.close();
        } catch (error) {
            alert('Failed to print photo. Please try again.');
        }
    }

    async sharePhoto() {
        if (!this.capturedPhotoBlobs.length) return;
        try {
            const blob = this.capturedPhotoBlobs[this.currentPhotoIndex];
            if (navigator.share && navigator.canShare) {
                const file = new File([blob], 'photobooth-photo.jpg', { type: 'image/jpeg' });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: 'Photobooth Photo',
                        text: 'Check out my photo from the photobooth!',
                        files: [file]
                    });
                    return;
                }
            }
            const photoURL = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = photoURL;
            link.download = `photobooth-photo-${this.currentPhotoIndex + 1}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(photoURL);
        } catch (error) {
            alert('Failed to share photo. The photo has been downloaded instead.');
        }
    }

    handleOrientationChange() {
        if (this.stream) setTimeout(() => this.initializeCamera(), 100);
    }

    destroy() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.body.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #f8f9fa; color: #d63031; text-align: center; padding: 20px; font-family: Arial, sans-serif;">
                <div>
                    <h2>Camera Not Supported</h2>
                    <p>This browser doesn't support camera access. Please use a modern browser like Chrome, Firefox, or Safari.</p>
                </div>
            </div>
        `;
        return;
    }
    window.photoboothApp = new PhotoboothApp();
});

window.addEventListener('beforeunload', () => {
    if (window.photoboothApp) {
        window.photoboothApp.destroy();
    }
});
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});