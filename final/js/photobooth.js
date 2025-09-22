class PhotoboothApp {
    constructor() {
        this.stream = null;
        this.currentCamera = 'user'; // 'user' for front, 'environment' for back
        this.timerSeconds = 3;
        this.isCountingDown = false;
        this.capturedPhotoBlob = null;

        // Collage state
        this.isCollageMode = false;
        this.collagePhotos = [];
        this.collageStep = 0;
        this.maxCollage = 4;

        // Video size state
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

        this.initializeElements();
        this.bindEvents();
        this.initializeCamera();
    }

    initializeElements() {
        // Camera elements
        this.videoElement = document.getElementById('camera-feed');
        this.canvasElement = document.getElementById('photo-canvas');
        this.photoResult = document.getElementById('photo-result');
        this.capturedPhotoDiv = document.getElementById('captured-photo');

        // Countdown elements
        this.countdownOverlay = document.getElementById('countdown-overlay');
        this.countdownNumber = document.getElementById('countdown-number');

        // Timer controls
        this.timerDisplay = document.getElementById('timer-display');
        this.timerDecrease = document.getElementById('timer-decrease');
        this.timerIncrease = document.getElementById('timer-increase');

        // Control buttons
        this.switchCameraBtn = document.getElementById('switch-camera');
        this.takePhotoBtn = document.getElementById('take-photo');
        this.printBtn = document.getElementById('print-photo');
        this.shareBtn = document.getElementById('share-photo');
        this.retakeBtn = document.getElementById('retake-photo');

        // Collage button & progress overlay
        this.collageBtn = document.getElementById('collage-mode');
        this.collageProgress = document.getElementById('collage-progress');

        // Toggle video size button
        this.toggleVideoSizeBtn = document.getElementById('toggle-video-size');

        // Frame picker UI
        this.framePicker = document.getElementById('frame-picker');
        this.framePickerInner = document.getElementById('frame-picker-inner');
    }

    bindEvents() {
        // Timer controls
        this.timerDecrease.addEventListener('click', () => this.adjustTimer(-1));
        this.timerIncrease.addEventListener('click', () => this.adjustTimer(1));

        // Camera controls
        this.switchCameraBtn.addEventListener('click', () => this.switchCamera());
        this.takePhotoBtn.addEventListener('click', () => this.startCountdown());
        this.retakeBtn.addEventListener('click', () => this.retakePhoto());

        // Photo actions
        this.printBtn.addEventListener('click', () => this.printPhoto());
        this.shareBtn.addEventListener('click', () => this.sharePhoto());

        // Collage mode
        if (this.collageBtn) {
            this.collageBtn.addEventListener('click', () => this.startCollageMode());
        }

        // Toggle video size
        if (this.toggleVideoSizeBtn) {
            this.toggleVideoSizeBtn.addEventListener('click', () => this.toggleVideoSize());
        }

        // Frame picker
        if (this.framePickerInner) {
            this.frameStyles.forEach(frame => {
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

        // Handle orientation/visibility
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.handleOrientationChange(), 500);
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && !this.stream) {
                this.initializeCamera();
            }
        });
    }

    selectFrame(frameId) {
        if (!this.frameStyles.some(f => f.id === frameId)) return;
        this.selectedFrame = frameId;
        // update selected class
        if (this.framePickerInner) {
            Array.from(this.framePickerInner.children).forEach(btn => {
                btn.classList.toggle('selected', btn.dataset.frame === frameId);
            });
        }
        // re-draw photo with the new frame if a photo exists
        if (this.capturedPhotoBlob) {
            this.applyFrameToPhoto();
        }
    }

    // Re-generate the photoResult image with the selected frame
    applyFrameToPhoto() {
        // We'll need to re-draw the last captured photo or collage with the new frame
        // The easiest way: redraw the canvas, then display the new result

        // For single photo, the last frame is in the canvas
        // For collage, the raw collage is not kept, so we just update the frame
        // We'll use the last canvas content, but re-draw the frame.

        // Get the last photo image
        const img = new window.Image();
        const prevBlob = this.capturedPhotoBlob;
        if (!prevBlob) return;
        img.onload = () => {
            const ctx = this.canvasElement.getContext('2d');
            // Redraw the photo
            this.canvasElement.width = img.width;
            this.canvasElement.height = img.height;
            ctx.clearRect(0, 0, img.width, img.height);
            ctx.drawImage(img, 0, 0, img.width, img.height);
            // Draw selected frame
            this.addFrameStyling(ctx, img.width, img.height, this.selectedFrame);
            // Update preview and blob
            this.canvasElement.toBlob(blob => {
                this.capturedPhotoBlob = blob;
                const photoURL = URL.createObjectURL(blob);
                this.photoResult.src = photoURL;
                this.photoResult.onload = () => URL.revokeObjectURL(photoURL);
            }, 'image/jpeg', 0.9);
        };
        img.src = URL.createObjectURL(prevBlob);
    }

    // Toggle video size function (unchanged)
    toggleVideoSize() {
        if (!this.videoElement) return;
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

    async initializeCamera() {
        try {
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            if (videoDevices.length === 0) {
                console.warn('No camera devices found - this is expected in testing environments');
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
            } catch (facingModeError) {
                constraints = {
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                };
                this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            }
            this.videoElement.srcObject = this.stream;
            await new Promise((resolve) => {
                this.videoElement.onloadedmetadata = resolve;
            });
            this.videoElement.style.display = 'block';
            this.capturedPhotoDiv.style.display = 'none';
            if (this.collageProgress) this.collageProgress.style.display = 'none';
            this.enableCameraControls();
            if (this.isLargeVideo) {
                this.videoElement.classList.remove('normal-size');
                this.videoElement.classList.add('large-size');
            } else {
                this.videoElement.classList.remove('large-size');
                this.videoElement.classList.add('normal-size');
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            this.handleCameraError(error);
        }
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

    enableCameraControls() {
        this.switchCameraBtn.disabled = false;
        this.takePhotoBtn.disabled = false;
        if (this.collageBtn) this.collageBtn.disabled = false;
        if (this.toggleVideoSizeBtn) this.toggleVideoSizeBtn.disabled = false;
    }

    disableCameraControls() {
        this.switchCameraBtn.disabled = true;
        this.takePhotoBtn.disabled = true;
        if (this.collageBtn) this.collageBtn.disabled = true;
        if (this.toggleVideoSizeBtn) this.toggleVideoSizeBtn.disabled = true;
    }

    adjustTimer(change) {
        const newTime = this.timerSeconds + change;
        if (newTime >= 0 && newTime <= 10) {
            this.timerSeconds = newTime;
            this.timerDisplay.textContent = this.timerSeconds;
        }
    }

    async switchCamera() {
        if (this.isCountingDown) return;
        try {
            this.currentCamera = this.currentCamera === 'user' ? 'environment' : 'user';
            await this.initializeCamera();
        } catch (error) {
            console.error('Error switching camera:', error);
            this.currentCamera = this.currentCamera === 'user' ? 'environment' : 'user';
        }
    }

    startCountdown() {
        if (this.isCountingDown || !this.stream) return;
        if (this.timerSeconds === 0) {
            this.capturePhoto();
            return;
        }
        this.isCountingDown = true;
        this.takePhotoBtn.disabled = true;
        this.switchCameraBtn.disabled = true;
        if (this.collageBtn) this.collageBtn.disabled = true;
        if (this.toggleVideoSizeBtn) this.toggleVideoSizeBtn.disabled = true;
        let countdown = this.timerSeconds;
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
                this.capturePhoto();
                this.isCountingDown = false;
                this.takePhotoBtn.disabled = false;
                this.switchCameraBtn.disabled = false;
                if (this.collageBtn) this.collageBtn.disabled = false;
                if (this.toggleVideoSizeBtn) this.toggleVideoSizeBtn.disabled = false;
            }
        }, 1000);
    }

    capturePhoto() {
        if (!this.stream) return;
        try {
            this.createFlashEffect();
            const video = this.videoElement;
            const aspectRatio = 4 / 3;
            const frameWidth = 800;
            const frameHeight = frameWidth / aspectRatio;
            this.canvasElement.width = frameWidth;
            this.canvasElement.height = frameHeight;
            const ctx = this.canvasElement.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, frameWidth, frameHeight);
            const padding = 20;
            const bottomPadding = 60;
            const photoX = padding;
            const photoY = padding;
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
            if (this.isCollageMode) {
                this.canvasElement.toBlob((blob) => {
                    this.collagePhotos.push(blob);
                    this.collageStep++;
                    this.showCollageProgress();
                    if (this.collageStep < this.maxCollage) {
                        setTimeout(() => {
                            this.videoElement.style.display = 'block';
                            this.capturedPhotoDiv.style.display = 'none';
                        }, 700);
                    } else {
                        setTimeout(() => this.assembleCollage(), 700);
                    }
                }, 'image/jpeg', 0.9);
                this.showCollageProgress();
                return;
            }
            this.canvasElement.toBlob((blob) => {
                this.capturedPhotoBlob = blob;
                const photoURL = URL.createObjectURL(blob);
                this.photoResult.src = photoURL;
                this.photoResult.onload = () => URL.revokeObjectURL(photoURL);
                this.videoElement.style.display = 'none';
                this.capturedPhotoDiv.style.display = 'block';
                this.printBtn.disabled = false;
                this.shareBtn.disabled = false;
                this.retakeBtn.style.display = 'block';
                this.takePhotoBtn.style.display = 'none';
                if (this.collageBtn) this.collageBtn.disabled = false;
                if (this.toggleVideoSizeBtn) this.toggleVideoSizeBtn.disabled = false;
                if (this.framePicker) this.framePicker.style.display = 'block';
            }, 'image/jpeg', 0.9);
        } catch (error) {
            console.error('Error capturing photo:', error);
            alert('Failed to capture photo. Please try again.');
        }
    }

    // Collage Mode: UI and Assembly (4x1 layout)
    assembleCollage() {
        const singleWidth = 400;
        const singleHeight = 300;
        const collageWidth = singleWidth * 4 + 60;
        const collageHeight = singleHeight;
        this.canvasElement.width = collageWidth;
        this.canvasElement.height = collageHeight;
        const ctx = this.canvasElement.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, collageWidth, collageHeight);
        const positions = [
            [0, 0],
            [singleWidth + 20, 0],
            [2 * (singleWidth + 20), 0],
            [3 * (singleWidth + 20), 0]
        ];
        let loadedImgs = 0;
        const imageEls = [];
        const drawFramedImage = (img, ix, iy) => {
            ctx.save();
            ctx.fillStyle = "#fff";
            ctx.fillRect(ix, iy, singleWidth, singleHeight);
            ctx.drawImage(img, ix + 12, iy + 12, singleWidth - 24, singleHeight - 36);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.lineWidth = 1;
            ctx.strokeRect(ix + 12, iy + 12, singleWidth - 24, singleHeight - 36);
            ctx.fillStyle = '#666666';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'right';
            ctx.fillText('INSTAX', ix + singleWidth - 18, iy + singleHeight - 12);
            ctx.restore();
        };
        for (let i = 0; i < this.maxCollage; i++) {
            const img = new window.Image();
            img.onload = () => {
                imageEls[i] = img;
                loadedImgs++;
                if (loadedImgs === this.maxCollage) {
                    for (let j = 0; j < this.maxCollage; j++) {
                        const [x, y] = positions[j];
                        drawFramedImage(imageEls[j], x, y);
                    }
                    // Add selected frame on top of the collage
                    this.addFrameStyling(ctx, collageWidth, collageHeight, this.selectedFrame, true);
                    this.canvasElement.toBlob((blob) => {
                        this.capturedPhotoBlob = blob;
                        const photoURL = URL.createObjectURL(blob);
                        this.photoResult.src = photoURL;
                        this.photoResult.onload = () => URL.revokeObjectURL(photoURL);
                        this.videoElement.style.display = 'none';
                        this.capturedPhotoDiv.style.display = 'block';
                        this.printBtn.disabled = false;
                        this.shareBtn.disabled = false;
                        this.retakeBtn.style.display = 'block';
                        this.takePhotoBtn.style.display = 'none';
                        if (this.collageBtn) this.collageBtn.disabled = false;
                        if (this.collageProgress) this.collageProgress.style.display = 'none';
                        if (this.toggleVideoSizeBtn) this.toggleVideoSizeBtn.disabled = false;
                        if (this.framePicker) this.framePicker.style.display = 'block';
                        this.isCollageMode = false;
                        this.collagePhotos = [];
                        this.collageStep = 0;
                    }, 'image/jpeg', 0.9);
                }
            };
            img.src = URL.createObjectURL(this.collagePhotos[i]);
        }
    }

    showCollageProgress() {
        if (!this.collageProgress) return;
        if (!this.isCollageMode) {
            this.collageProgress.style.display = 'none';
            return;
        }
        this.collageProgress.textContent = `Collage: Photo ${this.collageStep + 1} of ${this.maxCollage}`;
        this.collageProgress.style.display = 'block';
    }

    // Dynamically draw frame based on user selection
    addFrameStyling(ctx, width, height, frameId, isCollage = false) {
        switch (frameId) {
            case 'instax':
            default:
                // Instax style
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

    retakePhoto() {
        this.capturedPhotoDiv.style.display = 'none';
        this.videoElement.style.display = 'block';
        this.printBtn.disabled = true;
        this.shareBtn.disabled = true;
        this.retakeBtn.style.display = 'none';
        this.takePhotoBtn.style.display = 'block';
        this.capturedPhotoBlob = null;
        this.photoResult.src = '';
        this.isCollageMode = false;
        this.collagePhotos = [];
        this.collageStep = 0;
        if (this.collageProgress) this.collageProgress.style.display = 'none';
        if (this.collageBtn) this.collageBtn.disabled = false;
        if (this.toggleVideoSizeBtn) this.toggleVideoSizeBtn.disabled = false;
        if (this.framePicker) this.framePicker.style.display = 'none';
    }

    async printPhoto() {
        if (!this.capturedPhotoBlob) return;
        try {
            const printWindow = window.open('', '_blank');
            const photoURL = URL.createObjectURL(this.capturedPhotoBlob);
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
            console.error('Error printing photo:', error);
            alert('Failed to print photo. Please try again.');
        }
    }

    async sharePhoto() {
        if (!this.capturedPhotoBlob) return;
        try {
            if (navigator.share && navigator.canShare) {
                const file = new File([this.capturedPhotoBlob], 'photobooth-photo.jpg', {
                    type: 'image/jpeg'
                });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: 'Photobooth Photo',
                        text: 'Check out my photo from the photobooth!',
                        files: [file]
                    });
                    return;
                }
            }
            const photoURL = URL.createObjectURL(this.capturedPhotoBlob);
            const link = document.createElement('a');
            link.href = photoURL;
            link.download = `photobooth-photo-${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(photoURL);
        } catch (error) {
            console.error('Error sharing photo:', error);
            alert('Failed to share photo. The photo has been downloaded instead.');
        }
    }

    handleOrientationChange() {
        if (this.stream) {
            setTimeout(() => {
                this.initializeCamera();
            }, 100);
        }
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