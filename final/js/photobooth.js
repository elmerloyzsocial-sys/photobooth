class PhotoboothApp {
    constructor() {
        this.stream = null;
        this.currentCamera = 'user'; // 'user' for front, 'environment' for back
        this.timerSeconds = 3;
        this.isCountingDown = false;
        this.capturedPhotoBlob = null;

        // NEW: Collage state
        this.isCollageMode = false;
        this.collagePhotos = [];
        this.collageStep = 0;
        this.maxCollage = 4;

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

        // NEW: Collage button & progress overlay
        this.collageBtn = document.getElementById('collage-mode');
        this.collageProgress = document.getElementById('collage-progress');
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

        // NEW: Collage mode
        if (this.collageBtn) {
            this.collageBtn.addEventListener('click', () => this.startCollageMode());
        }

        // Handle orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.handleOrientationChange(), 500);
        });

        // Handle visibility changes (when app goes to background/foreground)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && !this.stream) {
                this.initializeCamera();
            }
        });
    }

    async initializeCamera() {
        try {
            // Stop existing stream if any
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }

            // Check if camera devices are available first
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');

            if (videoDevices.length === 0) {
                // Handle gracefully for testing environments
                console.warn('No camera devices found - this is expected in testing environments');
                this.handleCameraError(new Error('No camera devices found'));
                return;
            }

            // Request camera access with fallback constraints
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
                // Fallback: try without facingMode constraint
                console.warn('Specific camera facing mode not available, trying default camera:', facingModeError.message);
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

            // Wait for video to be ready
            await new Promise((resolve) => {
                this.videoElement.onloadedmetadata = resolve;
            });

            // Show video, hide any captured photo
            this.videoElement.style.display = 'block';
            this.capturedPhotoDiv.style.display = 'none';
            if (this.collageProgress) this.collageProgress.style.display = 'none';

            // Enable camera controls
            this.enableCameraControls();

            console.log('Camera initialized successfully');
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
    }

    disableCameraControls() {
        this.switchCameraBtn.disabled = true;
        this.takePhotoBtn.disabled = true;
        if (this.collageBtn) this.collageBtn.disabled = true;
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
            // Revert camera setting if switch fails
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

        let countdown = this.timerSeconds;
        this.countdownNumber.textContent = countdown;
        this.countdownOverlay.style.display = 'flex';

        const countdownInterval = setInterval(() => {
            countdown--;

            if (countdown > 0) {
                this.countdownNumber.textContent = countdown;
                // Trigger animation by removing and re-adding class
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
            }
        }, 1000);
    }

    capturePhoto() {
        if (!this.stream) return;

        try {
            // Create flash effect
            this.createFlashEffect();

            const video = this.videoElement;

            // Calculate 4:3 aspect ratio dimensions
            const aspectRatio = 4 / 3;
            const frameWidth = 800;  // Base width for 4:3 format
            const frameHeight = frameWidth / aspectRatio; // 600px height

            // Set canvas dimensions for 4:3 aspect ratio
            this.canvasElement.width = frameWidth;
            this.canvasElement.height = frameHeight;

            const ctx = this.canvasElement.getContext('2d');

            // Fill with white background (Instax frame background)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, frameWidth, frameHeight);

            // Calculate photo area within the frame (accounting for Instax padding)
            const padding = 20;
            const bottomPadding = 60; // Extra space for INSTAX branding
            const photoX = padding;
            const photoY = padding;
            const photoWidth = frameWidth - (padding * 2);
            const photoHeight = frameHeight - padding - bottomPadding;

            // Calculate video scaling to fit photo area while maintaining aspect ratio
            const videoAspect = video.videoWidth / video.videoHeight;
            const photoAspect = photoWidth / photoHeight;

            let drawWidth, drawHeight, drawX, drawY;

            if (videoAspect > photoAspect) {
                // Video is wider - fit to height
                drawHeight = photoHeight;
                drawWidth = drawHeight * videoAspect;
                drawX = photoX + (photoWidth - drawWidth) / 2;
                drawY = photoY;
            } else {
                // Video is taller - fit to width
                drawWidth = photoWidth;
                drawHeight = drawWidth / videoAspect;
                drawX = photoX;
                drawY = photoY + (photoHeight - drawHeight) / 2;
            }

            // Save context for flipping
            ctx.save();

            // Flip image if using front camera
            if (this.currentCamera === 'user') {
                ctx.translate(drawX + drawWidth, drawY);
                ctx.scale(-1, 1);
                ctx.drawImage(video, 0, 0, drawWidth, drawHeight);
            } else {
                ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
            }

            // Restore context
            ctx.restore();

            // Add Instax frame styling
            this.addInstaxFrameStyling(ctx, frameWidth, frameHeight);

            // NEW: Collage Mode
            if (this.isCollageMode) {
                // Save as dataURL for collage assembly
                this.canvasElement.toBlob((blob) => {
                    this.collagePhotos.push(blob);
                    this.collageStep++;
                    this.showCollageProgress();
                    if (this.collageStep < this.maxCollage) {
                        // Prompt for next photo
                        setTimeout(() => {
                            this.videoElement.style.display = 'block';
                            this.capturedPhotoDiv.style.display = 'none';
                        }, 700);
                    } else {
                        // Assemble collage
                        setTimeout(() => this.assembleCollage(), 700);
                    }
                }, 'image/jpeg', 0.9);
                // Show a preview flash after each shot
                this.showCollageProgress();
                return;
            }

            // Normal mode: Convert canvas to blob and display
            this.canvasElement.toBlob((blob) => {
                this.capturedPhotoBlob = blob;

                // Display captured photo
                const photoURL = URL.createObjectURL(blob);
                this.photoResult.src = photoURL;
                this.photoResult.onload = () => URL.revokeObjectURL(photoURL);

                // Show captured photo, hide video
                this.videoElement.style.display = 'none';
                this.capturedPhotoDiv.style.display = 'block';

                // Enable photo action buttons
                this.printBtn.disabled = false;
                this.shareBtn.disabled = false;
                this.retakeBtn.style.display = 'block';
                this.takePhotoBtn.style.display = 'none';

                if (this.collageBtn) this.collageBtn.disabled = false;
            }, 'image/jpeg', 0.9);

        } catch (error) {
            console.error('Error capturing photo:', error);
            alert('Failed to capture photo. Please try again.');
        }
    }

    // Collage Mode: UI and Assembly
    startCollageMode() {
        this.isCollageMode = true;
        this.collagePhotos = [];
        this.collageStep = 0;
        this.capturedPhotoDiv.style.display = 'none';
        this.videoElement.style.display = 'block';
        this.printBtn.disabled = true;
        this.shareBtn.disabled = true;
        this.retakeBtn.style.display = 'none';
        this.takePhotoBtn.style.display = 'block';
        this.takePhotoBtn.disabled = false;
        if (this.collageBtn) this.collageBtn.disabled = true;
        this.showCollageProgress();
        this.startCountdown();
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

    assembleCollage() {
        // Set up a 2x2 grid, each with an Instax-style frame
        const singleWidth = 400; // 4:3
        const singleHeight = 300;
        const collageWidth = singleWidth * 2 + 40;   // 20px padding between
        const collageHeight = singleHeight * 2 + 40;

        this.canvasElement.width = collageWidth;
        this.canvasElement.height = collageHeight;
        const ctx = this.canvasElement.getContext('2d');

        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, collageWidth, collageHeight);

        // For each photo, draw it into the correct quadrant with a border/frame
        const positions = [
            [0, 0], [singleWidth + 40, 0],
            [0, singleHeight + 40], [singleWidth + 40, singleHeight + 40]
        ];

        let loadedImgs = 0;
        const imageEls = [];

        // Utility to draw the Instax frame for each
        const drawFramedImage = (img, ix, iy) => {
            // Draw white frame
            ctx.save();
            ctx.fillStyle = "#fff";
            ctx.fillRect(ix, iy, singleWidth, singleHeight);
            // Draw image inside with 12px padding
            ctx.drawImage(img, ix + 12, iy + 12, singleWidth - 24, singleHeight - 36); // Bottom padding for branding
            // Add simple border
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.lineWidth = 1;
            ctx.strokeRect(ix + 12, iy + 12, singleWidth - 24, singleHeight - 36);
            // Branding
            ctx.fillStyle = '#666666';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'right';
            ctx.fillText('INSTAX', ix + singleWidth - 18, iy + singleHeight - 12);
            ctx.restore();
        };

        // Load all blobs as images
        for (let i = 0; i < this.maxCollage; i++) {
            const img = new window.Image();
            img.onload = () => {
                imageEls[i] = img;
                loadedImgs++;
                if (loadedImgs === this.maxCollage) {
                    // Draw all onto the collage canvas
                    for (let j = 0; j < this.maxCollage; j++) {
                        const [x, y] = positions[j];
                        drawFramedImage(imageEls[j], x, y);
                    }
                    // Output as one photo
                    this.canvasElement.toBlob((blob) => {
                        this.capturedPhotoBlob = blob;
                        const photoURL = URL.createObjectURL(blob);
                        this.photoResult.src = photoURL;
                        this.photoResult.onload = () => URL.revokeObjectURL(photoURL);

                        // Show result, enable buttons
                        this.videoElement.style.display = 'none';
                        this.capturedPhotoDiv.style.display = 'block';
                        this.printBtn.disabled = false;
                        this.shareBtn.disabled = false;
                        this.retakeBtn.style.display = 'block';
                        this.takePhotoBtn.style.display = 'none';
                        if (this.collageBtn) this.collageBtn.disabled = false;
                        if (this.collageProgress) this.collageProgress.style.display = 'none';
                        // Reset collage state
                        this.isCollageMode = false;
                        this.collagePhotos = [];
                        this.collageStep = 0;
                    }, 'image/jpeg', 0.9);
                }
            };
            img.src = URL.createObjectURL(this.collagePhotos[i]);
        }
    }

    addInstaxFrameStyling(ctx, width, height) {
        // Add subtle inner border
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(20, 20, width - 40, height - 80);

        // Add INSTAX branding
        ctx.fillStyle = '#666666';
        ctx.font = 'bold 16px Arial';
        ctx.letterSpacing = '2px';
        ctx.textAlign = 'right';
        ctx.fillText('INSTAX', width - 25, height - 20);

        // Add subtle shadow effect around the frame
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.05)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');

        // Draw shadow border
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, width - 2, height - 2);
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
        // Hide captured photo, show video
        this.capturedPhotoDiv.style.display = 'none';
        this.videoElement.style.display = 'block';

        // Reset buttons
        this.printBtn.disabled = true;
        this.shareBtn.disabled = true;
        this.retakeBtn.style.display = 'none';
        this.takePhotoBtn.style.display = 'block';

        // Clear captured photo data
        this.capturedPhotoBlob = null;
        this.photoResult.src = '';

        // Reset collage state if in use
        this.isCollageMode = false;
        this.collagePhotos = [];
        this.collageStep = 0;
        if (this.collageProgress) this.collageProgress.style.display = 'none';
        if (this.collageBtn) this.collageBtn.disabled = false;
    }

    async printPhoto() {
        if (!this.capturedPhotoBlob) return;

        try {
            // Create a new window for printing
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
            // Check if Web Share API is supported
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

            // Fallback: Download the photo
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
        // Reinitialize camera after orientation change
        if (this.stream) {
            setTimeout(() => {
                this.initializeCamera();
            }, 100);
        }
    }

    // Cleanup method
    destroy() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
    }
}

// Initialize the photobooth app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check for required APIs
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

    // Initialize the photobooth
    window.photoboothApp = new PhotoboothApp();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.photoboothApp) {
        window.photoboothApp.destroy();
    }
});

// Handle errors globally
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});