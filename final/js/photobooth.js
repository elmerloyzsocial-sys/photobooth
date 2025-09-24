class PhotoboothApp {
    constructor() {
        this.stream = null;
        this.currentCamera = 'user';
        this.timerSeconds = 3;
        this.isCountingDown = false;
        this.isLargeVideo = false;
        this.capturedPhotoBlobs = [];
        this.currentPhotoIndex = 0;
        this.compositeCanvas = document.createElement('canvas');
        this.overlayMessageInterval = null;
        this.printHistory = [];

        this.initializeElements();
        this.bindEvents();
        this.initializeCamera();
        this.startOverlayMessageRotation?.();
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
        this.retakeBtn = document.getElementById('retake-photo');
        this.toggleVideoSizeBtn = document.getElementById('toggle-video-size');
        this.downloadGalleryBtn = document.getElementById('download-gallery');
        this.sidebarGallery = document.getElementById('sidebar-gallery');
        this.instaxMessage = document.getElementById('instax-message');
        this.advancedPrintBtn = document.getElementById('advanced-print-btn');
        this.advancedPrintModal = document.getElementById('advanced-print-modal');
        this.closeAdvancedModalBtn = document.getElementById('close-advanced-modal');
        this.advancedPrintForm = document.getElementById('advanced-print-form');
        this.printLayoutSel = document.getElementById('print-layout');
        this.printBorderSel = document.getElementById('print-border');
        this.addStickersChk = document.getElementById('add-stickers');
        this.printCaptionInput = document.getElementById('print-caption');
        this.printSizeSel = document.getElementById('print-size');
        this.printDpiInput = document.getElementById('print-dpi');
        this.addQrChk = document.getElementById('add-qr');
        this.batchSelectPhotosDiv = document.getElementById('batch-select-photos');
        this.printLimitInput = document.getElementById('print-limit');
        this.printHistoryDiv = document.getElementById('print-history');
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
        window.addEventListener('orientationchange', () => setTimeout(() => this.handleOrientationChange(), 500));
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && !this.stream) {
                this.initializeCamera();
            }
        });

        // Advanced Print
        this.advancedPrintBtn.addEventListener('click', () => this.openAdvancedPrintModal());
        this.closeAdvancedModalBtn.addEventListener('click', () => this.closeAdvancedPrintModal());
        this.advancedPrintForm.addEventListener('submit', (e) => this.handleAdvancedPrint(e));
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
        this.retakeBtn.style.display = 'block';
        this.takePhotoBtn.style.display = 'none';
        this.updateSidebarGallery(idx);
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
        // Array of Bible verses/phrases (add as many as you like)
        const verses = [
            // Bible verses about joy
            "The joy of the Lord is your strength. - Nehemiah 8:10",
            "This is the day that the Lord has made; let us rejoice and be glad in it. - Psalm 118:24",
            "Rejoice in the Lord always. I will say it again: Rejoice! - Philippians 4:4",
            "You make known to me the path of life; in your presence there is fullness of joy. - Psalm 16:11",
            "You have turned my mourning into joyful dancing. - Psalm 30:11",
            "A cheerful heart is good medicine. - Proverbs 17:22",
            "Shout for joy to the Lord, all the earth. - Psalm 100:1",
            "May the God of hope fill you with all joy and peace as you trust in him. - Romans 15:13",
            "I have told you this so that my joy may be in you and that your joy may be complete. - John 15:11",
            "Those who sow with tears will reap with songs of joy. - Psalm 126:5",
            // Joyful phrases
            "Let your heart be full of joy!",
            "Smile—God loves you!",
            "Choose joy every day.",
            "Joy is a gift—share it!",
            "Today is a day for joyful memories!",
            // Love
            "Above all, love each other deeply, because love covers over a multitude of sins. - 1 Peter 4:8",
            "Let all that you do be done in love. - 1 Corinthians 16:14",
            "Love is patient, love is kind. - 1 Corinthians 13:4",
            "And now these three remain: faith, hope and love. But the greatest of these is love. - 1 Corinthians 13:13",
            "We love because He first loved us. - 1 John 4:19",
            "Let us love one another, for love comes from God. - 1 John 4:7",
            // Respect
            "Be devoted to one another in love. Honor one another above yourselves. - Romans 12:10",
            "Show proper respect to everyone, love the family of believers, fear God. - 1 Peter 2:17",
            "Honor your father and your mother. - Exodus 20:12",
            "Do to others as you would have them do to you. - Luke 6:31",
            "Encourage one another and build each other up. - 1 Thessalonians 5:11",
            "A friend loves at all times. - Proverbs 17:17",
            // Phrases
            "Respect is love in action.",
            "Kindness is a language the deaf can hear and the blind can see.",
            "Love and respect make a family strong.",
            "Treat others with love and respect, always.",
            "Where there is love, there is respect.",
            "Respecting each other brings us closer together.",
            "Let love and respect guide your heart.",
        ];

        // Pick a random verse/phrase
        const verse = verses[Math.floor(Math.random() * verses.length)];

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(20, 20, width - 40, height - 80);

        // Use a playful font if you have it loaded, otherwise fallback
        ctx.fillStyle = '#666666';
        ctx.font = "bold 20px 'Fredoka One', 'Comic Sans MS', cursive, Arial";
        ctx.textAlign = 'center';

        // Draw the verse, wrapping if it's too long
        const maxWidth = width - 50;
        const lines = [];
        let currentLine = '';
        verse.split(' ').forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            if (ctx.measureText(testLine).width > maxWidth) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
        if (currentLine) lines.push(currentLine);

        // Draw lines above the bottom padding
        const lineHeight = 24;
        let y = height - 20 - (lines.length - 1) * lineHeight;
        lines.forEach(line => {
            ctx.fillText(line, width / 2, y);
            y += lineHeight;
        });
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
        this.downloadGalleryBtn.style.display = 'none';
        this.printBtn.disabled = true;
        this.printAllBtn.disabled = true;
        this.shareBtn.disabled = true;
        this.retakeBtn.style.display = 'none';
        this.takePhotoBtn.style.display = 'block';
        this.updateSidebarGallery();
    }

    async printPhoto() {
        if (!this.capturedPhotoBlobs.length) return;
        try {
            const blob = this.capturedPhotoBlobs[this.currentPhotoIndex];
            const photoURL = URL.createObjectURL(blob);
            const printWindow = window.open('', '_blank');
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

    // UPDATED PRINT ALL FOR 4x4 INCHES AT 300DPI WITH INDIVIDUAL PHOTO BORDER
    async printAllPhotos() {
        if (!this.capturedPhotoBlobs.length) return;
        // Load up to 4 images as HTMLImageElements
        const images = await Promise.all(
            this.capturedPhotoBlobs.slice(0, 4).map(blob => this.loadImageFromBlob(blob))
        );
        // 4x4 inches at 300 DPI (square)
        const DPI = 300;
        const printWidth = 4 * DPI; // 1200px
        const printHeight = 4 * DPI; // 1200px
        // Margins and spacing
        const border = 32; // px, outer white border
        const gap = 40; // px, between photos
        const frameMargin = 18; // px, border around each photo
        // Calculate photo area
        const n = images.length;
        const availableHeight = printHeight - (2 * border) - (gap * (n - 1));
        const photoHeight = Math.floor(availableHeight / n);
        const photoWidth = printWidth - 2 * border;
        // Prepare composite canvas
        this.compositeCanvas.width = printWidth;
        this.compositeCanvas.height = printHeight;
        const ctx = this.compositeCanvas.getContext('2d');
        ctx.fillStyle = "#FFFAE6";
        ctx.fillRect(0, 0, printWidth, printHeight);
        // Draw and center each photo with its own border
        let y = border;
        images.forEach((img, i) => {
            // Maintain aspect ratio, fit within photoWidth x photoHeight
            let imgAspect = img.width / img.height;
            let targetWidth = photoWidth;
            let targetHeight = photoHeight;
            if (img.width > img.height) {
                targetHeight = Math.min(photoHeight, Math.floor(photoWidth / imgAspect));
            } else {
                targetWidth = Math.min(photoWidth, Math.floor(photoHeight * imgAspect));
            }
            const x = border + Math.floor((photoWidth - targetWidth) / 2);
            // Draw border behind each photo
            ctx.fillStyle = "#fff"; // photo border color (white)
            ctx.fillRect(
                x - frameMargin,
                y - frameMargin,
                targetWidth + 2 * frameMargin,
                targetHeight + 2 * frameMargin
            );
            // Draw photo
            ctx.drawImage(img, x, y, targetWidth, targetHeight);
            y += photoHeight + gap;
        });
        // Print the composite
        this.compositeCanvas.toBlob((blob) => {
            const photoURL = URL.createObjectURL(blob);
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Print All Photos</title>
                    <style>
                        @page {
                            size: 4in 4in;
                            margin: 0;
                        }
                        html, body {
                            width: 4in;
                            height: 4in;
                            margin: 0;
                            padding: 0;
                            background: white;
                        }
                        body {
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                        }
                        img {
                            width: 100%;
                            height: auto;
                            display: block;
                            background: white;
                        }
                        @media print {
                            body { margin: 0; padding: 0; }
                            img { box-shadow: none; border: none; }
                        }
                    </style>
                </head>
                <body>
                    <img src="${photoURL}" alt="All Photobooth Photos" onload="window.print(); window.close();">
                </body>
                </html>
            `);
            printWindow.document.close();
        }, 'image/png');
    }

    loadImageFromBlob(blob) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = URL.createObjectURL(blob);
        });
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
        if (this.overlayMessageInterval) {
            clearInterval(this.overlayMessageInterval);
        }
    }

    // --- Advanced Print Modal Logic ---
    openAdvancedPrintModal() {
        this.advancedPrintModal.style.display = 'flex';
        this.renderBatchPhotoSelector();
        this.updatePrintHistory();
    }
    closeAdvancedPrintModal() {
        this.advancedPrintModal.style.display = 'none';
    }
    renderBatchPhotoSelector() {
        this.batchSelectPhotosDiv.innerHTML = '';
        this.batchPhotoSelections = this.capturedPhotoBlobs.map(() => false);
        this.capturedPhotoBlobs.forEach((blob, i) => {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(blob);
            img.className = 'batch-photo-thumb';
            img.title = `Photo ${i + 1}`;
            img.addEventListener('click', () => {
                this.batchPhotoSelections[i] = !this.batchPhotoSelections[i];
                img.classList.toggle('selected', this.batchPhotoSelections[i]);
            });
            this.batchSelectPhotosDiv.appendChild(img);
        });
    }
    updatePrintHistory() {
        const history = this.printHistory || [];
        if (!history.length) {
            this.printHistoryDiv.textContent = 'No print jobs this session.';
            return;
        }
        this.printHistoryDiv.innerHTML = '<b>Print History:</b><ul style="margin:0 0 0 16px;padding:0">';
        history.slice(-10).forEach((job, idx) => {
            this.printHistoryDiv.innerHTML += `<li>${job.time}: ${job.summary}</li>`;
        });
        this.printHistoryDiv.innerHTML += '</ul>';
    }
    handleAdvancedPrint(e) {
        e.preventDefault();
        // Gather values
        const layout = this.printLayoutSel.value;
        const border = this.printBorderSel.value;
        const addStickers = this.addStickersChk.checked;
        const caption = this.printCaptionInput.value;
        const size = this.printSizeSel.value;
        const dpi = parseInt(this.printDpiInput.value, 10);
        const addQr = this.addQrChk.checked;
        const limit = parseInt(this.printLimitInput.value, 10);
        // Gather which photos to print
        const selectedIdx = this.batchPhotoSelections
            ? this.batchPhotoSelections.map((v, i) => v ? i : -1).filter(i => i >= 0)
            : [this.currentPhotoIndex];
        // Print count limiter
        this.printHistory = this.printHistory || [];
        if (this.printHistory.length >= limit) {
            alert(`Print limit of ${limit} reached for this session.`);
            return;
        }
        // Prepare job summary
        const summary = `${layout} layout, ${border} border, ${selectedIdx.length} photo(s), "${caption}"`;
        // Save to history
        this.printHistory.push({
            time: new Date().toLocaleTimeString(),
            summary,
        });
        this.updatePrintHistory();
        this.closeAdvancedPrintModal();
        // Call custom print logic
        this.advancedPrintPhotos({
            layout, border, addStickers, caption, size, dpi, addQr,
            photoIndices: selectedIdx,
        });
    }
    async advancedPrintPhotos({layout, border, addStickers, caption, size, dpi, addQr, photoIndices}) {
        const photos = photoIndices.map(idx => this.capturedPhotoBlobs[idx]);
        if (!photos.length) {
            alert("No photos selected for printing.");
            return;
        }
        // 1. Get images
        const images = await Promise.all(photos.map(blob => this.loadImageFromBlob(blob)));
        // 2. Determine layout size
        let printWidth = 1200, printHeight = 1800; // default 4x6in at 300dpi
        if (size === "3x5") { printWidth = 900; printHeight = 1500; }
        else if (size === "square") { printWidth = 1200; printHeight = 1200; }
        else if (size === "wallet") { printWidth = 600; printHeight = 900; } // 2x3 in
        printWidth = Math.floor(printWidth * (dpi / 300));
        printHeight = Math.floor(printHeight * (dpi / 300));
        // 3. Prepare canvas
        this.compositeCanvas.width = printWidth;
        this.compositeCanvas.height = printHeight;
        const ctx = this.compositeCanvas.getContext('2d');
        // 4. Draw border/background
        ctx.fillStyle = (border === "white") ? "#fff" :
                        (border === "party") ? "#ffe0f7" :
                        (border === "wedding") ? "#f8f7f4" :
                        (border === "birthday") ? "#fffbe0" : "#fff";
        ctx.fillRect(0, 0, printWidth, printHeight);
        // 5. Draw photos according to layout
        if (layout === "single") {
            // Center photo
            this.drawPhotoWithExtras(ctx, images[0], printWidth, printHeight, caption, addStickers, addQr);
        } else if (layout === "strip") {
            // 4 in a row, vertical strip
            const eachH = Math.floor(printHeight / 4 * 0.82);
            const eachW = Math.floor(printWidth * 0.88);
            let y = Math.floor((printHeight - eachH*photos.length)/2);
            for (let i=0; i<images.length; i++) {
                this.drawPhotoWithExtras(
                    ctx, images[i], eachW, eachH, (i===0 ? caption : ''), addStickers, addQr,
                    Math.floor((printWidth-eachW)/2), y
                );
                y += eachH + 12;
            }
        } else if (layout === "collage") {
            // 2x2 grid
            const rows = 2, cols = 2;
            const eachW = Math.floor(printWidth / cols * 0.9);
            const eachH = Math.floor(printHeight / rows * 0.85);
            let k = 0;
            for (let r=0; r<rows; r++) for (let c=0; c<cols; c++) {
                if (k >= images.length) break;
                this.drawPhotoWithExtras(
                    ctx, images[k], eachW, eachH, (k===0 ? caption : ''), addStickers, addQr,
                    Math.floor(c*printWidth/cols + (printWidth/cols-eachW)/2),
                    Math.floor(r*printHeight/rows + (printHeight/rows-eachH)/2)
                );
                k++;
            }
        }
        // 6. Confirmation animation
        this.createPrintAnimation();
        // 7. Print (open new window with image and print)
        this.compositeCanvas.toBlob((blob) => {
            const photoURL = URL.createObjectURL(blob);
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Print Photos</title>
                    <style>
                        @page { margin: 0; size: auto; }
                        html, body {
                            width: 100vw; height: 100vh; margin:0; padding:0; background:white;
                        }
                        body { display: flex; align-items: center; justify-content: center; min-height: 100vh;}
                        img { width: 100%; height: auto; display:block; }
                        @media print { body {margin:0; padding:0;} }
                    </style>
                </head>
                <body>
                    <img src="${photoURL}" alt="Photobooth Print" onload="window.print(); window.close();">
                </body>
                </html>
            `);
            printWindow.document.close();
        }, 'image/png');
    }
    // Helper: draw a photo (with optional caption, stickers, QR)
    drawPhotoWithExtras(ctx, img, outW, outH, caption, addStickers, addQr, x=0, y=0) {
        // Maintain aspect ratio
        let imgW = outW, imgH = outH;
        const aspectImg = img.width / img.height, aspectOut = outW / outH;
        if (aspectImg > aspectOut) {
            imgH = outH;
            imgW = imgH * aspectImg;
        } else {
            imgW = outW;
            imgH = imgW / aspectImg;
        }
        const dx = x + Math.floor((outW - imgW) / 2);
        const dy = y + Math.floor((outH - imgH) / 2);
        ctx.save();
        ctx.drawImage(img, dx, dy, imgW, imgH);
        // Stickers (example: smiley face, star, etc.)
        if (addStickers) {
            ctx.font = "28px Arial";
            ctx.globalAlpha = 0.88;
            ctx.fillText("😀⭐", dx+20, dy+38);
            ctx.globalAlpha = 1.0;
        }
        // Caption
        if (caption) {
            ctx.font = "bold 26px 'Permanent Marker','Comic Sans MS',cursive,Arial";
            ctx.fillStyle = "#fd6e77";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.shadowColor = "#fff";
            ctx.shadowBlur = 3;
            ctx.fillText(caption, x + outW/2, y + outH - 18);
            ctx.shadowBlur = 0;
        }
        // QR code (very basic: uses Google Chart API)
        if (addQr) {
            const qrUrl = "https://chart.googleapis.com/chart?cht=qr&chs=90x90&chl=" + encodeURIComponent(window.location.href);
            const qrImg = new window.Image();
            qrImg.onload = () => {
                ctx.drawImage(qrImg, x+outW-60, y+outH-60, 42, 42);
            };
            qrImg.src = qrUrl;
        }
        ctx.restore();
    }
    createPrintAnimation() {
        // Show a quick slide-out animation at the bottom of the screen
        const anim = document.createElement('div');
        anim.style.position = 'fixed';
        anim.style.bottom = '22px';
        anim.style.left = '50%';
        anim.style.transform = 'translateX(-50%)';
        anim.style.background = '#fff';
        anim.style.color = '#fd6e77';
        anim.style.fontWeight = 'bold';
        anim.style.fontSize = '1.1rem';
        anim.style.padding = '18px 32px';
        anim.style.borderRadius = '20px';
        anim.style.boxShadow = '0 4px 18px #f7797d55';
        anim.style.zIndex = 999999;
        anim.textContent = '🖨️ Print job sent!';
        document.body.appendChild(anim);
        setTimeout(() => anim.style.opacity = '0', 1100);
        setTimeout(() => anim.remove(), 1800);
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