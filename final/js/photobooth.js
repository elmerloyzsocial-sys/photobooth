class PhotoboothApp {
    constructor() {
        this.stream = null;
        this.currentCamera = 'user';
        this.timerSeconds = 3;
        this.isCountingDown = false;
        this.capturedPhotoBlobs = [];
        this.currentPhotoIndex = 0;
        this.compositeCanvas = document.createElement('canvas');
        this.overlayMessageInterval = null;
        this.overlayMessages = ["Smile!", "Say Cheese!", "Look at the camera!", "Strike a pose!"];
        this.isLargeVideo = false;

        this.initializeElements();
        this.bindEvents();
        this.initializeCamera();
        this.startOverlayMessageRotation();
    }

    initializeElements() {
        this.videoElement = document.getElementById('camera-feed');
        this.instaxFrame = document.querySelector('.instax-frame');
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
        this.galleryGrid = document.getElementById('gallery-grid');
        this.photoOverlay = document.getElementById('photo-overlay');
        this.closePhotoBtn = document.getElementById('close-photo');
        this.downloadPhotoBtn = document.getElementById('download-photo');
        this.sharePhotoBtn = document.getElementById('share-photo');
        this.retakePhotoBtn = document.getElementById('retake-photo');
        this.printOverlay = document.getElementById('print-overlay');
        this.closePrintBtn = document.getElementById('close-print');
        this.printStartBtn = document.getElementById('print-start');
        this.printPreviewImg = document.getElementById('print-preview-img');
        this.flashEffect = document.getElementById('flash-effect');
        this.overlayMessageElement = document.getElementById('message-text');
    }

    bindEvents() {
        this.takePhotoBtn.addEventListener('click', () => this.startCountdown());
        this.switchCameraBtn.addEventListener('click', () => this.switchCamera());
        this.timerIncrease.addEventListener('click', () => this.updateTimer(1));
        this.timerDecrease.addEventListener('click', () => this.updateTimer(-1));
        this.closePhotoBtn.addEventListener('click', () => this.hidePhotoOverlay());
        this.downloadPhotoBtn.addEventListener('click', () => this.downloadPhoto());
        this.sharePhotoBtn.addEventListener('click', () => this.sharePhoto());
        this.retakePhotoBtn.addEventListener('click', () => this.retakePhoto());
        this.printBtn.addEventListener('click', () => this.showPrintPreview());
        this.closePrintBtn.addEventListener('click', () => this.hidePrintOverlay());
        this.printStartBtn.addEventListener('click', () => this.printComposite());
        window.addEventListener('orientationchange', () => this.handleOrientationChange());
        window.addEventListener('beforeunload', () => this.destroy());
    }

    async initializeCamera() {
        if (this.stream) this.stream.getTracks().forEach(track => track.stop());
        try {
            const constraints = {
                video: {
                    facingMode: this.currentCamera,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;
            this.videoElement.addEventListener('loadedmetadata', () => {
                const videoRatio = this.videoElement.videoWidth / this.videoElement.videoHeight;
                const frameRatio = this.instaxFrame.offsetWidth / this.instaxFrame.offsetHeight;
                this.isLargeVideo = videoRatio > frameRatio;
            }, { once: true });
        } catch (error) {
            console.error('Error accessing camera:', error);
            this.showError(`Error accessing camera: ${error.message}`);
        }
    }

    switchCamera() {
        this.currentCamera = (this.currentCamera === 'user') ? 'environment' : 'user';
        this.initializeCamera();
    }

    updateTimer(value) {
        this.timerSeconds = Math.max(1, this.timerSeconds + value);
        this.timerDisplay.textContent = `${this.timerSeconds}s`;
    }

    startCountdown() {
        if (this.isCountingDown) return;
        this.isCountingDown = true;
        this.countdownNumber.textContent = this.timerSeconds;
        this.countdownOverlay.style.display = 'flex';
        this.takePhotoBtn.disabled = true;

        let countdown = this.timerSeconds;
        const countdownInterval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                this.countdownNumber.textContent = countdown;
            } else {
                clearInterval(countdownInterval);
                this.countdownOverlay.style.display = 'none';
                this.isCountingDown = false;
                this.takePhotoBtn.disabled = false;
                this.takePhoto();
            }
        }, 1000);
    }

    takePhoto() {
        const width = this.videoElement.videoWidth;
        const height = this.videoElement.videoHeight;
        this.canvasElement.width = width;
        this.canvasElement.height = height;

        const ctx = this.canvasElement.getContext('2d');
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(this.videoElement, 0, 0, width, height);

        this.canvasElement.toBlob(blob => {
            if (blob) {
                this.capturedPhotoBlobs.push(blob);
                this.renderGalleryThumbnails();
                this.showFlashEffect();
                this.showPhotoOverlay(this.capturedPhotoBlobs.length - 1);
            }
        }, 'image/jpeg', 0.95);
    }

    showFlashEffect() {
        this.flashEffect.style.display = 'block';
        setTimeout(() => {
            this.flashEffect.style.display = 'none';
        }, 300);
    }

    renderGalleryThumbnails() {
        this.galleryGrid.innerHTML = '';
        this.capturedPhotoBlobs.forEach((blob, index) => {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(blob);
            img.classList.add('gallery-thumb');
            img.alt = `Photo ${index + 1}`;
            img.onclick = () => this.showPhotoOverlay(index);
            this.galleryGrid.appendChild(img);
        });
    }

    showPhotoOverlay(index) {
        this.currentPhotoIndex = index;
        const blob = this.capturedPhotoBlobs[index];
        const img = document.createElement('img');
        img.src = URL.createObjectURL(blob);
        this.photoResult.innerHTML = '';
        this.photoResult.appendChild(img);
        this.photoResult.appendChild(this.createPhotoControls());
        this.photoOverlay.style.display = 'flex';
    }

    createPhotoControls() {
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'photo-controls';
        controlsDiv.innerHTML = `
            <button id="close-photo" class="dslr-btn" title="Close" aria-label="Close Photo View">
                <div class="btn-icon">
                    <svg viewBox="0 0 48 48" width="40" height="40">
                        <path d="M12 12l24 24M12 36l24-24" stroke="#222" stroke-width="4" stroke-linecap="round"/>
                    </svg>
                </div>
                <div class="btn-label">Close</div>
            </button>
            <button id="download-photo" class="dslr-btn" title="Download" aria-label="Download Photo">
                <div class="btn-icon">
                    <svg viewBox="0 0 48 48" width="40" height="40">
                        <path d="M24 38L12 26h8V8h8v18h8L24 38zM24 38v4" stroke="#222" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="btn-label">Download</div>
            </button>
            <button id="share-photo" class="dslr-btn" title="Share" aria-label="Share Photo">
                <div class="btn-icon">
                    <svg viewBox="0 0 48 48" width="40" height="40">
                        <path d="M30 18a6 6 0 1 0 0-12a6 6 0 0 0 0 12zM18 30a6 6 0 1 0 0-12a6 6 0 0 0 0 12zM30 42a6 6 0 1 0 0-12a6 6 0 0 0 0 12z" fill="#222"/>
                        <path d="M30 18l-12 12" stroke="#222" stroke-width="2" fill="none" stroke-linecap="round"/>
                    </svg>
                </div>
                <div class="btn-label">Share</div>
            </button>
            <button id="retake-photo" class="dslr-btn" title="Retake" aria-label="Retake Photo">
                <div class="btn-icon">
                    <svg viewBox="0 0 48 48" width="40" height="40">
                        <rect x="18" y="15" width="12" height="18" rx="1.2" ry="1.5" fill="#222"/>
                        <path d="M24 30q2 2 4 0" stroke="#222" stroke-width="2" fill="none"/>
                    </svg>
                </div>
                <div class="btn-label">Retake</div>
            </button>
        `;
        controlsDiv.querySelector('#close-photo').addEventListener('click', () => this.hidePhotoOverlay());
        controlsDiv.querySelector('#download-photo').addEventListener('click', () => this.downloadPhoto());
        controlsDiv.querySelector('#share-photo').addEventListener('click', () => this.sharePhoto());
        controlsDiv.querySelector('#retake-photo').addEventListener('click', () => this.retakePhoto());
        return controlsDiv;
    }

    hidePhotoOverlay() {
        this.photoOverlay.style.display = 'none';
        this.photoResult.innerHTML = '';
    }

    downloadPhoto() {
        const photoBlob = this.capturedPhotoBlobs[this.currentPhotoIndex];
        const url = URL.createObjectURL(photoBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `photobooth-${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    retakePhoto() {
        this.capturedPhotoBlobs.splice(this.currentPhotoIndex, 1);
        this.renderGalleryThumbnails();
        this.hidePhotoOverlay();
    }

    async sharePhoto() {
        try {
            const photoBlob = this.capturedPhotoBlobs[this.currentPhotoIndex];
            const file = new File([photoBlob], `photobooth-${Date.now()}.jpg`, { type: photoBlob.type });
            if (navigator.share) {
                await navigator.share({
                    files: [file],
                    title: 'Photobooth Photo',
                    text: 'Check out this photo I took!'
                });
            } else {
                alert('Web Share API is not supported in this browser. The photo has been downloaded instead.');
                this.downloadPhoto();
            }
        } catch (error) {
            console.error('Failed to share:', error);
            alert('Failed to share photo. The photo has been downloaded instead.');
        }
    }
    
    startOverlayMessageRotation() {
        this.overlayMessageInterval = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * this.overlayMessages.length);
            this.overlayMessageElement.textContent = this.overlayMessages[randomIndex];
        }, 5000);
    }

    handleOrientationChange() {
        if (this.stream) setTimeout(() => this.initializeCamera(), 100);
    }
    
    destroy() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        if (this.overlayMessageInterval) {
            clearInterval(this.overlayMessageInterval);
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