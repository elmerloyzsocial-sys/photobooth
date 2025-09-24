class PhotoboothApp {
    constructor() {
        this.stream = null;
        this.currentCamera = 'user';
        this.timerSeconds = 3;
        this.isCountingDown = false;
        this.isLargeVideo = false;
        this.capturedPhotoBlobs = [];
        this.publicPhotoLinks = []; // <-- NEW: stores public links per photo
        this.currentPhotoIndex = 0;
        this.compositeCanvas = document.createElement('canvas');
        this.overlayMessageInterval = null;

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
        this.printAllBtn = document.getElementById('print-all-photos');
        this.shareBtn = document.getElementById('share-photo');
        this.qrCodeBtn = document.getElementById('qr-code-btn');
        this.retakeBtn = document.getElementById('retake-photo');
        this.toggleVideoSizeBtn = document.getElementById('toggle-video-size');
        this.downloadGalleryBtn = document.getElementById('download-gallery');
        this.sidebarGallery = document.getElementById('sidebar-gallery');
        this.instaxMessage = document.getElementById('instax-message');
        this.qrModal = document.getElementById('qr-modal');
        this.qrModalClose = document.getElementById('qr-modal-close');
        this.qrCodeDiv = document.getElementById('qr-code');
        this.qrModalLink = document.getElementById('qr-modal-link');
    }

    bindEvents() {
        this.timerDecrease.addEventListener('click', () => this.adjustTimer(-1));
        this.timerIncrease.addEventListener('click', () => this.adjustTimer(1));
        this.switchCameraBtn.addEventListener('click', () => this.switchCamera());
        this.takePhotoBtn.addEventListener('click', () => this.startPhotoSequence());
        this.retakeBtn.addEventListener('click', () => this.retakePhotos());
        this.printBtn.addEventListener('click', () => this.printPhoto());
        this.printAllBtn.addEventListener('click', () => this.printAllPhotos());
        this.shareBtn.addEventListener('click', () => this.sharePhoto());
        if (this.toggleVideoSizeBtn)
            this.toggleVideoSizeBtn.addEventListener('click', () => this.toggleVideoSize());
        this.downloadGalleryBtn.addEventListener('click', () => this.downloadGallery());

        // QR code button events
        this.qrCodeBtn.addEventListener('click', () => this.showQRCode());
        this.qrModalClose.addEventListener('click', () => this.hideQRCode());
        this.qrModal.addEventListener('click', (e) => {
            if (e.target === this.qrModal) this.hideQRCode();
        });

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
            this.enableCameraControls();
            if (this.isLargeVideo) {
                this.videoElement.classList.remove('normal-size');
                this.videoElement.classList.add('large-size');
                if (this.instaxFrame) {
                    this.instaxFrame.classList.remove('normal-size');
                    this.instaxFrame.classList.add('large-size');
                }
            } else {
                this.videoElement.classList.remove('large-size');
                this.videoElement.classList.add('normal-size');
                if (this.instaxFrame) {
                    this.instaxFrame.classList.remove('large-size');
                    this.instaxFrame.classList.add('normal-size');
                }
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
        if (this.toggleVideoSizeBtn)
            this.toggleVideoSizeBtn.disabled = false;
    }
    disableCameraControls() {
        this.switchCameraBtn.disabled = true;
        this.takePhotoBtn.disabled = true;
        if (this.toggleVideoSizeBtn)
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
            if (this.instaxFrame) {
                this.instaxFrame.classList.remove('normal-size');
                this.instaxFrame.classList.add('large-size');
            }
        } else {
            this.videoElement.classList.remove('large-size');
            this.videoElement.classList.add('normal-size');
            if (this.instaxFrame) {
                this.instaxFrame.classList.remove('large-size');
                this.instaxFrame.classList.add('normal-size');
            }
        }
    }

    async startPhotoSequence() {
        if (this.isCountingDown) return;
        this.isCountingDown = true;
        this.disableCameraControls();
        this.capturedPhotoBlobs = [];
        this.publicPhotoLinks = [];
        this.currentPhotoIndex = 0;
        const numPhotos = 4;
        for (let i = 0; i < numPhotos; i++) {
            await this.runCountdown();
            await this.capturePhotoToBlob();
            if (i < numPhotos - 1) await this.wait(600);
        }
        this.isCountingDown = false;
        this.enableCameraControls();
        this.currentPhotoIndex = 0;
        this.showPhoto(this.currentPhotoIndex);
        this.updateSidebarGallery();
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
                ctx.fillStyle = '#FFFAE6';
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
                this.addThankYouFrame(ctx, frameWidth, frameHeight);
                this.canvasElement.toBlob(blob => {
                    this.capturedPhotoBlobs.push(blob);
                    this.publicPhotoLinks.push(null); // Placeholder for uploaded link
                    resolve(blob);
                }, 'image/jpeg', 0.9);
            } catch (e) {
                reject(e);
            }
        });
    }

    showPhoto(idx) {
        if (!this.capturedPhotoBlobs[idx]) return;
        this.capturedPhotoDiv.style.display = 'block';
        this.videoElement.style.display = 'none';
        const photoURL = URL.createObjectURL(this.capturedPhotoBlobs[idx]);
        this.photoResult.src = photoURL;
        this.photoResult.onload = () => URL.revokeObjectURL(photoURL);
        this.printBtn.disabled = false;
        this.printAllBtn.disabled = false;
        this.shareBtn.disabled = false;
        this.qrCodeBtn.disabled = false; // will be enabled after upload
        this.retakeBtn.style.display = 'block';
        this.takePhotoBtn.style.display = 'none';
        this.updateSidebarGallery(idx);

        // Enable QR button only if already uploaded
        if (this.publicPhotoLinks[idx]) {
            this.qrCodeBtn.disabled = false;
        } else {
            this.qrCodeBtn.disabled = false; // Let them click and upload
        }
    }

    updateSidebarGallery(selectedIdx) {
        if (!this.capturedPhotoBlobs.length) {
            this.sidebarGallery.innerHTML = '';
            return;
        }
        this.sidebarGallery.innerHTML = '';
        this.capturedPhotoBlobs.forEach((blob, i) => {
            const div = document.createElement('div');
            div.className = 'gallery-thumb';
            if (selectedIdx === i) div.classList.add('selected');
            const img = document.createElement('img');
            img.src = URL.createObjectURL(blob);
            img.alt = `Photo ${i + 1}`;
            img.title = `Photo ${i + 1}`;
            img.addEventListener('click', () => {
                this.currentPhotoIndex = i;
                this.showPhoto(i);
            });
            div.appendChild(img);
            this.sidebarGallery.appendChild(div);
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

    addThankYouFrame(ctx, width, height) {
        // ...existing bible verse overlay...
        // (Keep as in your prior version)
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
        this.publicPhotoLinks = [];
        this.currentPhotoIndex = 0;
        this.capturedPhotoDiv.style.display = 'none';
        this.videoElement.style.display = 'block';
        this.downloadGalleryBtn.style.display = 'none';
        this.printBtn.disabled = true;
        this.printAllBtn.disabled = true;
        this.shareBtn.disabled = true;
        this.qrCodeBtn.disabled = true;
        this.retakeBtn.style.display = 'none';
        this.takePhotoBtn.style.display = 'block';
        this.updateSidebarGallery();
    }

    async printPhoto() { /* ...unchanged... */ }
    async printAllPhotos() { /* ...unchanged... */ }
    loadImageFromBlob(blob) { /* ...unchanged... */ }
    async sharePhoto() { /* ...unchanged... */ }

    // --- QR Code Feature with Public Link ---
    async showQRCode() {
        if (!this.capturedPhotoBlobs.length) return;
        const idx = this.currentPhotoIndex;
        // Remove any previous QR code
        this.qrCodeDiv.innerHTML = '';
        this.qrModalLink.textContent = '';
        this.qrModal.style.display = 'flex';

        // If already uploaded, use the cached public link:
        if (this.publicPhotoLinks[idx]) {
            this.renderQRCodeForLink(this.publicPhotoLinks[idx]);
            return;
        }

        // Otherwise, upload to Imgur (or your own public API)
        this.qrModalLink.textContent = 'Uploading photo for sharing...';
        this.qrCodeBtn.disabled = true;

        try {
            const publicUrl = await this.uploadToImgur(this.capturedPhotoBlobs[idx]);
            this.publicPhotoLinks[idx] = publicUrl;
            this.renderQRCodeForLink(publicUrl);
        } catch (e) {
            this.qrModalLink.textContent = 'Failed to upload photo. Please try again.';
        } finally {
            this.qrCodeBtn.disabled = false;
        }
    }

    renderQRCodeForLink(link) {
        this.qrCodeDiv.innerHTML = '';
        new QRCode(this.qrCodeDiv, {
            text: link,
            width: 186,
            height: 186,
            colorDark: "#222",
            colorLight: "#fff",
            correctLevel: QRCode.CorrectLevel.H
        });
        this.qrModalLink.textContent = link;
    }

    hideQRCode() {
        this.qrModal.style.display = 'none';
        this.qrCodeDiv.innerHTML = '';
        this.qrModalLink.textContent = '';
    }

    /**
     * Uploads image Blob to Imgur anonymously.
     * @param {Blob} imageBlob 
     * @returns {Promise<string>} URL
     */
    async uploadToImgur(imageBlob) {
        // Replace this Client-ID with your own from https://api.imgur.com/oauth2/addclient (type: Anonymous usage)
        const IMGUR_CLIENT_ID = "546c6d3e7b1dad6"; // Demo, get your own for production
        const formData = new FormData();
        formData.append('image', imageBlob);

        const response = await fetch("https://api.imgur.com/3/image", {
            method: "POST",
            headers: {
                Authorization: "Client-ID " + IMGUR_CLIENT_ID
            },
            body: formData
        });
        if (!response.ok) throw new Error("Upload failed");
        const data = await response.json();
        if (!data.success) throw new Error("Imgur upload error");
        return data.data.link; // e.g. https://i.imgur.com/xxxxxxx.jpg
    }

    handleOrientationChange() { /* ...unchanged... */ }
    destroy() { /* ...unchanged... */ }
    startOverlayMessageRotation() { /* ...unchanged... */ }
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