// videoExporter.js
const VideoExporter = {
    isRecording: false,
    recorder: null,
    recordingTimer: null,
    recordingStartTime: 0,

    watermarkSvg: null,
    defaultWatermark: '<svg width="100" height="30" xmlns="http://www.w3.org/2000/svg"><text x="50" y="20" font-family="Arial" font-size="10" fill="rgba(255,255,255,0.65)" text-anchor="middle">Namrata_Nilesh_Daharwal</text></svg>',


    initialize() {
        const exportBtn = document.getElementById('export-video-btn');
        const videoControls = document.getElementById('video-export-controls');
        videoControls.style.display = 'block';
        exportBtn.addEventListener('click', () => this.toggleVideoRecording());
        // Add watermark initialization
        this.initializeWatermark();
    },


    initializeWatermark() {
        const watermarkUpload = document.getElementById('watermark-upload');
        const selectWatermarkBtn = document.getElementById('select-watermark');

        selectWatermarkBtn.onclick = () => watermarkUpload.click();

        watermarkUpload.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.watermarkSvg = e.target.result;
                };
                reader.readAsText(file);
            }
        };
    },

    async toggleVideoRecording() {
        try {
            if (this.isRecording) {
                await this.stopRecording();
            } else {
                if (BookmarkManager.bookmarks.length === 0) {
                    alert('Add bookmarks before recording a tour');
                    return;
                }
                await this.startRecording();
            }
        } catch (error) {
            console.error('Error toggling video recording:', error);
            this.isRecording = false;
            this.updateRecordingUI(false);
        }
    },

    // Add this to your VideoExporter object
    // In VideoExporter, modify handleShortcutTrigger to be async
    async handleShortcutTrigger() {
        try {
            if (this.isRecording) {
                await this.stopRecording();
            }
            else if (BookmarkManager.bookmarks.length > 0) {
                await this.startRecording();
            }
            else {
                alert('Add bookmarks before recording a tour');
            }
        } catch (error) {
            console.error('Error in video shortcut trigger:', error);
            this.isRecording = false;
            this.updateRecordingUI(false);
        }
    },

    async startRecording() {
        if (BookmarkManager.bookmarks.length === 0) {
            alert('Add bookmarks before recording a tour');
            return;
        }

        try {
            this.isRecording = true;
            this.updateRecordingUI(true);
            this.startRecordingTimer();

            const quality = document.getElementById('video-quality').value;
            const format = document.getElementById('video-format').value;
            const showWatermark = document.getElementById('show-watermark').checked;
            const dimensions = this.getVideoDimensions(quality);

            // Setup canvas for recording
            const canvas = document.querySelector('canvas');

            // Hide UI elements during recording
            this.hideUIElements();

            // Create a new canvas for compositing
            const recordCanvas = document.createElement('canvas');
            recordCanvas.width = dimensions.width;
            recordCanvas.height = dimensions.height;
            const recordCtx = recordCanvas.getContext('2d');

            const stream = recordCanvas.captureStream(60);

            this.recorder = new RecordRTC(stream, {
                type: 'video',
                mimeType: format === 'mp4' ? 'video/mp4' : 'video/webm',
                frameInterval: 1,
                quality: 100,
                videoBitsPerSecond: quality === 'high' ? 8000000 :
                    quality === 'medium' ? 5000000 :
                        3000000
            });

            this.recorder.startRecording();

            // Frame capture function
            const captureFrame = () => {
                if (!this.isRecording) return;

                // Clear and draw main canvas content
                recordCtx.clearRect(0, 0, recordCanvas.width, recordCanvas.height);
                recordCtx.drawImage(canvas, 0, 0, recordCanvas.width, recordCanvas.height);

                // Add watermark if enabled
                if (showWatermark) {
                    this.drawWatermark(recordCtx, recordCanvas.width, recordCanvas.height);
                }

                requestAnimationFrame(captureFrame);
            };

            // ADD these new lines here
            BookmarkManager.onTourEnd = () => {
                // Add a 2-second delay before stopping
                setTimeout(() => {
                    this.stopRecording();
                }, 2000); // 2000ms = 2 seconds
            };

            // Start the tour
            requestAnimationFrame(captureFrame);
            BookmarkManager.playTour();

        } catch (error) {
            console.error('Recording error:', error);
            alert('Error starting recording');
            this.stopRecording();
        }
    },

    drawWatermark(ctx, width, height) {
        const watermarkSvg = this.watermarkSvg || this.defaultWatermark;
        const img = new Image();
        img.src = 'data:image/svg+xml;base64,' + btoa(watermarkSvg);

        // Position watermark at bottom right
        const watermarkWidth = 150;
        const watermarkHeight = 45;
        const padding = 20;

        ctx.globalAlpha = 0.5;
        ctx.drawImage(img,
            width - watermarkWidth - padding,
            height - watermarkHeight - padding,
            watermarkWidth,
            watermarkHeight
        );
        ctx.globalAlpha = 1;
    },

    hideUIElements() {
        // Hide FPS counter and other UI elements during recording
        const elementsToHide = [
            document.querySelector('.toolbar'),
            // Add other UI elements that should be hidden
        ];

        elementsToHide.forEach(el => {
            if (el) el.style.display = 'none';
        });
    },

    showUIElements() {
        // Restore UI elements after recording
        const elementsToShow = [
            document.querySelector('.toolbar'),
            // Add other UI elements that should be restored
        ];

        elementsToShow.forEach(el => {
            if (el) el.style.display = '';
        });
    },

    async stopRecording() {
        if (!this.isRecording || !this.recorder) return;

        this.isRecording = false;
        this.stopRecordingTimer();
        this.updateRecordingUI(false);
        this.showUIElements();

        try {
            return new Promise((resolve) => {
                this.recorder.stopRecording(() => {
                    const blob = this.recorder.getBlob();
                    this.saveVideo(blob);
                    this.recorder = null;
                    resolve();
                });
            });
        } catch (error) {
            console.error('Error stopping recording:', error);
            alert('Error saving video');
        }
    },


    saveVideo(blob) {
        const format = document.getElementById('video-format').value;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.href = url;
        a.download = `canvas_tour_${timestamp}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
    },

    getVideoDimensions(quality) {
        switch (quality) {
            case 'highm': return { width: 1080, height: 1920, scale: 2 };
            case 'high': return { width: 1920, height: 1080, scale: 2 };
            case 'medium': return { width: 1280, height: 720, scale: 1.5 };
            case 'low': return { width: 854, height: 480, scale: 1 };
            default: return { width: 1280, height: 720, scale: 1.5 };
        }
    },

    updateRecordingUI(recording) {
        const exportBtn = document.getElementById('export-video-btn');
        const indicator = document.getElementById('recording-indicator');
        const progress = document.querySelector('.video-progress');

        exportBtn.textContent = recording ? 'Stop Recording' : 'Export Tour as Video';
        exportBtn.classList.toggle('recording', recording);
        indicator.style.display = recording ? 'block' : 'none';
        progress.style.display = recording ? 'block' : 'none';
    },

    startRecordingTimer() {
        this.recordingStartTime = Date.now();
        const timerElement = document.querySelector('.recording-timer');

        this.recordingTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const seconds = (elapsed % 60).toString().padStart(2, '0');
            timerElement.textContent = `${minutes}:${seconds}`;
        }, 1000);
    },

    stopRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }


};