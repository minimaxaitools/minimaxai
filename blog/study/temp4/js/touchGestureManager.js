// Touch Gesture Manager for Infinite Canvas
class TouchGestureManager {
    constructor() {
        this.touches = new Map();
        this.lastTouchDistance = 0;
        this.lastTouchCenter = { x: 0, y: 0 };
        this.touchStartTime = 0;
        this.longPressTimer = null;
        this.longPressThreshold = 500; // ms
        this.tapTimeout = null;
        this.doubleTapThreshold = 300; // ms
        this.lastTapTime = 0;
        this.isGesturing = false;
        this.touchStartPos = null;
        this.gestureThreshold = 10; // pixels to start gesture

        // Gesture states
        this.isPinching = false;
        this.isPanning = false;
        this.isLongPress = false;
        this.preventNextClick = false;

        this.init();
    }

    init() {
        if (!canvas) {
            console.warn('Canvas not found for touch gestures');
            return;
        }

        // Prevent default touch behaviors
        canvas.style.touchAction = 'none';
        document.body.style.touchAction = 'manipulation';

        // Add touch event listeners
        canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        canvas.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: false });

        // Prevent context menu on touch devices
        canvas.addEventListener('contextmenu', (e) => {
            if (this.touches.size > 0) {
                e.preventDefault();
            }
        });

        console.log('Touch Gesture Manager initialized');
    }

    handleTouchStart(e) {
        e.preventDefault();

        // Store touch information
        for (let touch of e.changedTouches) {
            this.touches.set(touch.identifier, {
                x: touch.clientX,
                y: touch.clientY,
                startX: touch.clientX,
                startY: touch.clientY,
                startTime: Date.now()
            });
        }

        const touchCount = this.touches.size;
        this.touchStartTime = Date.now();

        if (touchCount === 1) {
            // Single touch - potential tap, long press, or pan
            const touch = Array.from(this.touches.values())[0];
            this.touchStartPos = { x: touch.x, y: touch.y };

            // Update mouse position for other systems
            mouseX = touch.x;
            mouseY = touch.y;

            // Start long press timer
            this.longPressTimer = setTimeout(() => {
                this.handleLongPress(touch);
            }, this.longPressThreshold);

            // Handle single touch tool interactions
            this.handleSingleTouchStart(touch);

        } else if (touchCount === 2) {
            // Two finger gesture - pinch to zoom
            this.clearLongPressTimer();
            this.isPinching = true;
            this.isGesturing = true;

            const touchArray = Array.from(this.touches.values());
            this.lastTouchDistance = this.getTouchDistance(touchArray[0], touchArray[1]);
            this.lastTouchCenter = this.getTouchCenter(touchArray[0], touchArray[1]);

            console.log('Pinch gesture started');
        } else if (touchCount >= 3) {
            // Three or more fingers - cancel other gestures
            this.clearLongPressTimer();
            this.isPinching = false;
            this.isPanning = false;
            this.isGesturing = true;
        }
    }

    handleTouchMove(e) {
        e.preventDefault();

        // Update touch positions
        for (let touch of e.changedTouches) {
            if (this.touches.has(touch.identifier)) {
                const storedTouch = this.touches.get(touch.identifier);
                storedTouch.x = touch.clientX;
                storedTouch.y = touch.clientY;
            }
        }

        const touchCount = this.touches.size;

        if (touchCount === 1) {
            // Single touch - pan or tool interaction
            const touch = Array.from(this.touches.values())[0];
            const deltaX = touch.x - touch.startX;
            const deltaY = touch.y - touch.startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // Clear long press if moved too much
            if (distance > this.gestureThreshold) {
                this.clearLongPressTimer();

                if (!this.isPanning) {
                    this.isPanning = true;
                    this.isGesturing = true;
                }
            }

            // Update mouse position
            mouseX = touch.x;
            mouseY = touch.y;

            // Handle panning or tool-specific movement
            if (this.isPanning) {
                this.handleSingleTouchMove(touch);
            }

        } else if (touchCount === 2 && this.isPinching) {
            // Two finger pinch/zoom
            const touchArray = Array.from(this.touches.values());
            this.handlePinchGesture(touchArray[0], touchArray[1]);
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();

        // Remove ended touches
        for (let touch of e.changedTouches) {
            this.touches.delete(touch.identifier);
        }

        const touchCount = this.touches.size;
        const touchDuration = Date.now() - this.touchStartTime;

        if (touchCount === 0) {
            // All touches ended
            this.clearLongPressTimer();

            if (!this.isGesturing && !this.isLongPress) {
                // Quick tap - handle as click
                const touch = e.changedTouches[0];
                this.handleTap(touch, touchDuration);
            }

            // Reset states
            this.isPinching = false;
            this.isPanning = false;
            this.isGesturing = false;
            this.isLongPress = false;
            this.touchStartPos = null;

            // Simulate mouse up
            mousePressed = false;
            isDragging = false;

        } else if (touchCount === 1 && this.isPinching) {
            // Went from 2 fingers to 1 - stop pinching, maybe start panning
            this.isPinching = false;
            const remainingTouch = Array.from(this.touches.values())[0];
            mouseX = remainingTouch.x;
            mouseY = remainingTouch.y;
        }
    }

    handleTouchCancel(e) {
        // Treat as touch end
        this.handleTouchEnd(e);
    }

    handleSingleTouchStart(touch) {
        // Simulate mouse down for tool interactions
        mousePressed = true;
        mouseButton = 0; // Left button
        isDragging = true;
        lastMouseX = touch.x;
        lastMouseY = touch.y;

        // Handle tool-specific touch start
        if (!toolBarFocused) {
            if (data.settings.tool === TOOL_SELECT) {
                // Select tool touch handling
                this.handleSelectToolTouch(touch);
            } else if (data.settings.tool === TOOL_ERASER) {
                // Eraser tool
                handleEraser();
            } else if (data.settings.tool === TOOL_GRADIENT) {
                // Gradient tool
                this.handleGradientToolTouch(touch);
            }
        }
    }

    handleSingleTouchMove(touch) {
        const deltaX = touch.x - lastMouseX;
        const deltaY = touch.y - lastMouseY;

        if (data.settings.tool === TOOL_SELECT && selectedShapes.length > 0) {
            // Move selected shapes
            let amplitude = data.cam.range.div(innerHeight);
            for (let shape of selectedShapes) {
                shape.move(amplitude.mul(deltaX), amplitude.mul(deltaY));
            }
        } else if (data.settings.tool === TOOL_TEXT && selectedShapes.length > 0) {
            // Move text shape
            let amplitude = data.cam.range.div(innerHeight);
            currentShape().move(amplitude.mul(deltaX), amplitude.mul(deltaY));
        } else if (data.settings.tool === TOOL_POLYGON && currentShape() && currentShape().shapeType === 2) {
            // Update polygon point
            if (!toolBarFocused) {
                currentShape().points[currentShape().points.length - 1] = data.cam.screenToWorldPoint(touch.x, touch.y);
            }
        } else if (data.settings.tool === TOOL_ERASER) {
            // Continue erasing
            handleEraser();
        } else {
            // Pan the canvas
            this.handlePanning(deltaX, deltaY);
        }

        lastMouseX = touch.x;
        lastMouseY = touch.y;
    }

    handlePanning(deltaX, deltaY) {
        const panFactor = data.cam.range.div(innerHeight).mul(panSpeed);
        data.cam.translate(
            panFactor.mul(-deltaX),
            panFactor.mul(-deltaY)
        );
    }

    handlePinchGesture(touch1, touch2) {
        const currentDistance = this.getTouchDistance(touch1, touch2);
        const currentCenter = this.getTouchCenter(touch1, touch2);

        if (this.lastTouchDistance > 0) {
            // Calculate zoom scale (1:1 mapping)
            const scale = currentDistance / this.lastTouchDistance;

            // Calculate new range based on scale (zoom in = smaller range)
            let newRange = data.cam.targetRange.div(scale);

            // Set target range
            data.cam.setTargetRange(newRange);
            let actualNewRange = data.cam.targetRange;

            // Calculate position offset to zoom towards center
            let centerWorld = data.cam.screenToWorldPoint(currentCenter.x, currentCenter.y);
            let rangeRatio = actualNewRange.div(data.cam.range);
            let offset = centerWorld.sub(data.cam.pos).mul(new Decimal(1).sub(rangeRatio));

            data.cam.setTargetPos(data.cam.targetPos.add(offset));

            // Update filter if significant change
            if (data.cam.range.sub(data.lastUpdate.range).abs().div(data.lastUpdate.range).gt(0.1)) {
                data.lastUpdate.range = data.cam.range;
                data.lastUpdate.pos = data.cam.pos;
                filterShapes();
            }
        }

        // Handle pan during pinch (two-finger pan)
        const centerDeltaX = currentCenter.x - this.lastTouchCenter.x;
        const centerDeltaY = currentCenter.y - this.lastTouchCenter.y;

        if (Math.abs(centerDeltaX) > 2 || Math.abs(centerDeltaY) > 2) {
            const panFactor = data.cam.range.div(innerHeight);
            data.cam.translate(
                panFactor.mul(-centerDeltaX),
                panFactor.mul(-centerDeltaY)
            );
        }

        this.lastTouchDistance = currentDistance;
        this.lastTouchCenter = currentCenter;
    }

    handleSelectToolTouch(touch) {
        if (!data.settings.select.multiSelect) {
            // Single select mode
            clearSelection();
            let foundShape = false;
            for (let i = world.shapes.length - 1; i >= 0; i--) {
                if (world.shapes[i] !== undefined && world.shapes[i].intersectsWithScreen(touch.x, touch.y)) {
                    selectedShapes = [world.shapes[i]];
                    updateScaleControls(world.shapes[i]);
                    foundShape = true;
                    break;
                }
            }
            if (!foundShape) {
                clearSelection();
            }
        } else {
            // Multi-select mode
            let clickedOnShape = false;
            for (let i = world.shapes.length - 1; i >= 0; i--) {
                if (world.shapes[i] !== undefined && world.shapes[i].intersectsWithScreen(touch.x, touch.y)) {
                    clickedOnShape = true;
                    const index = selectedShapes.indexOf(world.shapes[i]);
                    if (index === -1) {
                        selectedShapes.push(world.shapes[i]);
                        updateScaleControls(world.shapes[i]);
                    } else {
                        selectedShapes.splice(index, 1);
                    }
                    break;
                }
            }

            if (!clickedOnShape) {
                clearSelection();
                selectBoundingBox = [touch.x, touch.y, touch.x, touch.y];
            }
        }
    }

    handleGradientToolTouch(touch) {
        for (let i = world.shapes.length - 1; i >= 0; i--) {
            let shape = world.shapes[i];
            if (shape !== undefined && shape.intersectsWithScreen(touch.x, touch.y)) {
                let obj = JSON.parse(JSON.stringify(data.settings.gradient));
                shape.color = obj; // Apply to fill color (could add long press for stroke)
                break;
            }
        }
    }

    handleTap(touch, duration) {
        const currentTime = Date.now();

        if (currentTime - this.lastTapTime < this.doubleTapThreshold) {
            // Double tap - handle zoom to point
            this.handleDoubleTap(touch);
        } else {
            // Single tap - handle as click after delay to check for double tap
            this.tapTimeout = setTimeout(() => {
                this.handleSingleTap(touch);
            }, this.doubleTapThreshold);
        }

        this.lastTapTime = currentTime;
    }

    handleSingleTap(touch) {
        if (!toolBarFocused && !this.preventNextClick) {
            mouseX = touch.clientX;
            mouseY = touch.clientY;
            handleShapeCreation();
        }
        this.preventNextClick = false;
    }

    handleDoubleTap(touch) {
        // Clear single tap timeout
        if (this.tapTimeout) {
            clearTimeout(this.tapTimeout);
            this.tapTimeout = null;
        }

        // Zoom to point (similar to mouse wheel at location)
        const zoomFactor = 0.5; // Zoom in on double tap
        let f = parseFloat(data.settings.zoomFactor);
        let oldRange = data.cam.range;
        let newRange = data.cam.targetRange.mul(Math.pow(f, -20)); // Zoom in

        data.cam.setTargetRange(newRange);
        let actualNewRange = data.cam.targetRange;
        let scale = actualNewRange.div(oldRange);
        let touchWorld = data.cam.screenToWorldPoint(touch.clientX, touch.clientY);
        let offset = touchWorld.sub(data.cam.pos).mul(new Decimal(1).sub(scale));
        data.cam.setTargetPos(data.cam.targetPos.add(offset));

        console.log('Double tap zoom at:', touch.clientX, touch.clientY);
    }

    handleLongPress(touch) {
        this.isLongPress = true;
        this.preventNextClick = true;

        console.log('Long press detected');

        // Haptic feedback if available
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        // Simulate Right Click
        mouseX = touch.x;
        mouseY = touch.y;
        mousePressed = true;
        mouseButton = 2; // RIGHT click code in main.js

        // Handle specific tool overrides if needed
        if (data.settings.tool === TOOL_SELECT) {
            // Toggle multi-select mode
            data.settings.select.multiSelect = !data.settings.select.multiSelect;
            const checkbox = document.querySelector('input[data-prop="select.multiSelect"]');
            if (checkbox) {
                checkbox.checked = data.settings.select.multiSelect;
            }
            console.log('Multi-select toggled:', data.settings.select.multiSelect);
        } else if (data.settings.tool === TOOL_GRADIENT) {
            // Apply to stroke color instead of fill
            for (let i = world.shapes.length - 1; i >= 0; i--) {
                let shape = world.shapes[i];
                if (shape !== undefined && shape.intersectsWithScreen(touch.x, touch.y)) {
                    let obj = JSON.parse(JSON.stringify(data.settings.gradient));
                    shape.strokeColor = obj;
                    break;
                }
            }
        }
    }

    clearLongPressTimer() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    getTouchDistance(touch1, touch2) {
        const dx = touch2.x - touch1.x;
        const dy = touch2.y - touch1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getTouchCenter(touch1, touch2) {
        return {
            x: (touch1.x + touch2.x) / 2,
            y: (touch1.y + touch2.y) / 2
        };
    }

    // Public method to enable/disable touch gestures
    setEnabled(enabled) {
        if (enabled) {
            canvas.style.touchAction = 'none';
            console.log('Touch gestures enabled');
        } else {
            canvas.style.touchAction = 'auto';
            console.log('Touch gestures disabled');
        }
    }

    // Method to check if device supports touch
    static isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
    }
}

// Export for use in other modules
window.TouchGestureManager = TouchGestureManager;