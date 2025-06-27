class PurikuraApp {
    constructor() {
        this.canvas = document.getElementById('editor-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.video = document.getElementById('camera');
        this.stream = null;
        this.isDrawing = false;
        this.currentTool = 'pen';
        this.penColor = '#ff0000';
        this.penSize = 5;
        this.backgroundImage = null;
        this.stickers = [];
        this.currentBackground = 'none';
        this.canvasHistory = [];
        this.historyIndex = -1;
        this.hasPhoto = false;
        this.actionsSection = document.getElementById('actions-section');
        this.actionsSection.style.display = 'none';
        this.undoBtn = document.getElementById('undo-btn');
        
        this.initCanvas();
        this.bindEvents();
        this.disableEditingTools();
        this.updateUndoButton();
    }

    initCanvas() {
        this.canvas.width = 600;
        this.canvas.height = 600;
        this.ctx.fillStyle = '#2d3748';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.saveToHistory();
    }

    disableEditingTools() {
        const toolsPanel = document.querySelector('.tools-panel');
        toolsPanel.classList.add('disabled');
        if (!this.hasPhoto) {
            this.actionsSection.style.display = 'none';
        }
    }

    enableEditingTools() {
        const toolsPanel = document.querySelector('.tools-panel');
        toolsPanel.classList.remove('disabled');
        this.actionsSection.style.display = '';
    }

    bindEvents() {
        // Camera and upload buttons
        document.getElementById('camera-btn').addEventListener('click', () => this.startCamera());
        document.getElementById('upload-btn').addEventListener('click', () => this.uploadPhoto());
        document.getElementById('capture-btn').addEventListener('click', () => this.capturePhoto());
        document.getElementById('cancel-camera-btn').addEventListener('click', () => this.stopCamera());
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFileUpload(e));

        // Drawing tools
        document.getElementById('pen-tool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('pen-color').addEventListener('change', (e) => this.setPenColor(e.target.value));
        document.getElementById('pen-size').addEventListener('input', (e) => this.setPenSize(e.target.value));

        // Canvas drawing events (mouse)
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // Canvas drawing events (touch)
        this.canvas.addEventListener('touchstart', (e) => this.startDrawing(e, true));
        this.canvas.addEventListener('touchmove', (e) => this.draw(e, true));
        this.canvas.addEventListener('touchend', () => this.stopDrawing());
        this.canvas.addEventListener('touchcancel', () => this.stopDrawing());

        // Background buttons
        document.querySelectorAll('.bg-btn').forEach(btn => {
            btn.addEventListener('click', () => this.changeBackground(btn.dataset.bg));
        });
        // Background color picker
        const bgColorPicker = document.getElementById('bg-color-picker');
        if (bgColorPicker) {
            bgColorPicker.addEventListener('input', (e) => {
                this.changeBackground('custom');
                this.customBgColor = e.target.value;
            });
        }

        // Sticker buttons
        document.querySelectorAll('.sticker-btn').forEach(btn => {
            btn.addEventListener('click', () => this.addSticker(btn.dataset.sticker));
        });

        // Action buttons
        document.getElementById('clear-btn').addEventListener('click', () => this.clearCanvas());
        document.getElementById('download-btn').addEventListener('click', () => this.downloadImage());
        document.getElementById('new-photo-btn').addEventListener('click', () => this.newPhoto());
    }

    updateUndoButton() {
        if (!this.hasPhoto || this.historyIndex <= 0) {
            this.undoBtn.disabled = true;
            this.undoBtn.classList.add('disabled');
        } else {
            this.undoBtn.disabled = false;
            this.undoBtn.classList.remove('disabled');
        }
    }

    saveToHistory() {
        // Remove any history after current index (for when we undo then draw)
        this.canvasHistory = this.canvasHistory.slice(0, this.historyIndex + 1);
        
        // Save current canvas state
        const imageData = this.canvas.toDataURL();
        this.canvasHistory.push(imageData);
        this.historyIndex++;
        
        // Limit history to 20 states to prevent memory issues
        if (this.canvasHistory.length > 20) {
            this.canvasHistory.shift();
            this.historyIndex--;
        }
        this.updateUndoButton();
    }

    undo() {
        if (this.hasPhoto && this.historyIndex > 0) {
            this.historyIndex--;
            this.loadFromHistory();
            this.updateUndoButton();
        }
    }

    loadFromHistory() {
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0);
        };
        img.src = this.canvasHistory[this.historyIndex];
    }

    async startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                } 
            });
            this.video.srcObject = this.stream;
            document.getElementById('camera-container').classList.remove('hidden');
        } catch (err) {
            alert('Camera access denied. Please allow camera access and try again.');
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        document.getElementById('camera-container').classList.add('hidden');
    }

    capturePhoto() {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.video.videoWidth;
        tempCanvas.height = this.video.videoHeight;
        tempCtx.drawImage(this.video, 0, 0);
        
        this.loadImageToCanvas(tempCanvas.toDataURL());
        this.stopCamera();
        this.showEditor();
    }

    uploadPhoto() {
        document.getElementById('file-input').click();
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.loadImageToCanvas(e.target.result);
                this.showEditor();
            };
            reader.readAsDataURL(file);
        }
    }

    loadImageToCanvas(imageSrc) {
        const img = new Image();
        img.onload = () => {
            this.backgroundImage = img;
            this.hasPhoto = true;
            this.redrawCanvas();
            this.canvasHistory = [];
            this.historyIndex = -1;
            this.saveToHistory();
            this.enableEditingTools();
            this.updateUndoButton();
        };
        img.src = imageSrc;
    }

    redrawCanvas() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background color/gradient first
        this.drawBackground();
        
        // Draw background image
        if (this.backgroundImage) {
            const scale = Math.min(
                this.canvas.width / this.backgroundImage.width,
                this.canvas.height / this.backgroundImage.height
            );
            const x = (this.canvas.width - this.backgroundImage.width * scale) / 2;
            const y = (this.canvas.height - this.backgroundImage.height * scale) / 2;
            
            this.ctx.drawImage(
                this.backgroundImage,
                x, y,
                this.backgroundImage.width * scale,
                this.backgroundImage.height * scale
            );
        }
        
        // Redraw stickers
        this.stickers.forEach(sticker => this.drawSticker(sticker));
    }

    drawBackground() {
        if (this.currentBackground === 'custom' && this.customBgColor) {
            this.ctx.fillStyle = this.customBgColor;
        } else {
            switch(this.currentBackground) {
                case 'pink':
                    this.ctx.fillStyle = 'palevioletred';
                    break;
                case 'blue':
                    this.ctx.fillStyle = 'cornflowerblue';
                    break;
                case 'green':
                    this.ctx.fillStyle = 'mediumseagreen';
                    break;
                default:
                    this.ctx.fillStyle = '#2d3748';
            }
        }
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    changeBackground(bgType) {
        if (!this.hasPhoto) return;
        this.currentBackground = bgType;
        this.redrawCanvas();
        this.saveToHistory();
    }

    setTool(tool) {
        if (!this.hasPhoto) return;
        if (this.currentTool === tool) {
            // Toggle off
            this.currentTool = null;
            document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        } else {
            this.currentTool = tool;
            document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById(`${tool}-tool`).classList.add('active');
        }
    }

    setPenColor(color) {
        this.penColor = color;
    }

    setPenSize(size) {
        this.penSize = parseInt(size);
        document.getElementById('pen-size-display').textContent = size;
    }

    getCanvasPos(e, isTouch) {
        const rect = this.canvas.getBoundingClientRect();
        if (isTouch) {
            const touch = e.touches[0] || e.changedTouches[0];
            return {
                x: (touch.clientX - rect.left) * (this.canvas.width / rect.width),
                y: (touch.clientY - rect.top) * (this.canvas.height / rect.height)
            };
        } else {
            return {
                x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
                y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
            };
        }
    }

    startDrawing(e, isTouch = false) {
        if (!this.hasPhoto || this.currentTool !== 'pen') return;
        e.preventDefault();
        this.isDrawing = true;
        const pos = this.getCanvasPos(e, isTouch);
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
    }

    draw(e, isTouch = false) {
        if (!this.isDrawing || !this.hasPhoto || this.currentTool !== 'pen') return;
        e.preventDefault();
        const pos = this.getCanvasPos(e, isTouch);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.strokeStyle = this.penColor;
        this.ctx.lineWidth = this.penSize;
        this.ctx.lineCap = 'round';
        this.ctx.stroke();
    }

    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.saveToHistory();
        }
    }

    addSticker(stickerType) {
        if (!this.hasPhoto) return;
        const sticker = {
            type: stickerType,
            x: Math.random() * (this.canvas.width - 50),
            y: Math.random() * (this.canvas.height - 50),
            size: 40
        };
        this.stickers.push(sticker);
        this.drawSticker(sticker);
        this.saveToHistory();
    }

    drawSticker(sticker) {
        this.ctx.font = `${sticker.size}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const emoji = this.getStickerEmoji(sticker.type);
        this.ctx.fillText(emoji, sticker.x, sticker.y);
    }

    getStickerEmoji(type) {
        const emojis = {
            heart: '❤️',
            star: '⭐',
            flower: '🌸',
            crown: '👑',
            sparkle: '✨',
            rainbow: '🌈'
        };
        return emojis[type] || '❤️';
    }

    clearCanvas() {
        if (!this.hasPhoto) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.stickers = [];
        this.drawBackground();
        if (this.backgroundImage) {
            this.redrawCanvas();
        }
        this.saveToHistory();
    }

    downloadImage() {
        if (!this.hasPhoto) return;
        const link = document.createElement('a');
        link.download = 'fotobella-photo.png';
        link.href = this.canvas.toDataURL();
        link.click();
    }

    newPhoto() {
        this.backgroundImage = null;
        this.stickers = [];
        this.currentBackground = 'none';
        this.canvasHistory = [];
        this.historyIndex = -1;
        this.hasPhoto = false;
        this.clearCanvas();
        this.disableEditingTools();
        this.showCaptureSection();
        this.updateUndoButton();
    }

    showEditor() {
        document.getElementById('capture-section').classList.add('hidden');
        document.getElementById('editor-section').classList.remove('hidden');
    }

    showCaptureSection() {
        document.getElementById('capture-section').classList.remove('hidden');
        document.getElementById('editor-section').classList.add('hidden');
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new PurikuraApp();
});