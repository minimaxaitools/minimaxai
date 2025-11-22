var canvas, ctx;
var dto = Date.now(), dtn = Date.now();
const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;
let lastFrameTime = 0;

var mousePressed = false, mouseX = 0, mouseY = 0, mouseButton = 0;
var LEFT = 0, MIDDLE = 1, RIGHT = 2;

var textCursorPosition = 0;
var selectedShapes = [];
var selectBoundingBox = [0, 0, 0, 0]; //x1, y2, x2, y2

var saveTimer = 0, fpstimer = 0;
var fpssum = 0, fpssumcount = 0, displayfps = 0;

var TOOL_CIRCLE = 0, TOOL_RECTANGLE = 1, TOOL_POLYGON = 2, TOOL_TEXT = 3, TOOL_IMAGE = 4, TOOL_GRADIENT = 5, TOOL_ERASER = 6,
    TOOL_SELECT = 7;

var toolBarFocused = false;

var world =
{
    shapes: [],
    shapeCache: []
};


let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let panSpeed = 1.0; // Adjustable pan speed multiplier

//----02- Start of Index db
// Add at the top of main.js with other utilities
const dbName = "InfiniteCanvasDB";
const storeName = "canvasData";
let db;

// Add this loading dialog code here
const loadingDialog = document.createElement('div');
loadingDialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 20px;
    border-radius: 10px;
    z-index: 1000;
    display: none;
`;
document.body.appendChild(loadingDialog);

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        request.onerror = () => {
            console.error('Database error:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;

            // Add connection error handling
            db.onerror = (event) => {
                console.error('Database error:', event.target.error);
            };

            resolve(db);
        };

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName);
            }
        };
    });
}

// New simplified autoSave using only IndexedDB
function autoSave() {
    if (!db) {
        console.warn('Database not initialized for auto-save');
        return;
    }

    try {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const exportData = exportCanvas();

        // Add transaction error handling
        transaction.onerror = (event) => {
            console.error('Transaction error:', event.target.error);
        };

        transaction.oncomplete = () => {
            // console.log('Auto-save completed successfully');
        };

        store.put(exportData, "InfiniteCanvas");
    } catch (e) {
        console.error('Auto-save failed:', e);
    }
}
// New simplified autoLoad using only IndexedDB
async function autoLoad() {
    if (!db) {
        await initDB();
    }

    try {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get("InfiniteCanvas");

        request.onsuccess = () => {
            if (request.result) {
                importCanvas(request.result);
            }
        };
    } catch (e) {
        console.error('Auto-load failed:', e);
    }
}


//----02- End of Index db




var data =
{
    cam: new Camera(Vec2.ZERO, 0.1),
    settings:
    {
        tool: 0,
        color: "#000000",
        strokeColor: "#000000",
        bgColor: "#ffffff",
        strokeSize: 0.005,
        alpha: 1,
        fill: true,
        stroke: false,
        zoomFactor: 1.05,
        panSpeed: 1.0,
        showHUD: true,
        circle:
        {
            radius: 0.1
        },
        rectangle:
        {
            w: 0.1,
            h: 0.1
        },
        polygon:
        {
            isClosed: false,
            isSmooth: false
        },
        text:
        {
            size: 0.05,
            halign: "left",
            valign: "top",
            font: "Montserrat"
        },
        svg:
        {
            w: 0.2,
            h: 0.2,
            rotation: 0,
            currentIndex: 0
        },
        image:
        {
            id: 0,
            w: 0.2,
            h: 0.2,
            rotation: 0,
            blur: 0,
            hue: 0,
            brightness: 100,
            contrast: 100,
            saturation: 100
        },
        select:
        {
            multiSelect: false
        },
        gradient:
        {
            type: 0,
            rotation: 0,
            colors: []
        },
        autoSave: true
    },
    lastUpdate:
    {
        range: new Decimal(0.1),
        pos: Vec2.ZERO
    }
};


var svgCollection = [];  // Will store {data: svgData, name: fileName} objects



// Add this new helper function near other utility functions
function updateScaleControls(shape) {
    if (!shape) return;

    const scaleInput = document.getElementById('scale-factor');
    const scaleSlider = document.getElementById('scale-slider');

    if (!scaleInput || !scaleSlider) return;

    if (!shape.originalDimensions) {
        shape.originalDimensions = {
            w: shape.w,
            h: shape.h,
            radius: shape.radius
        };
    }

    let currentScale = 1;
    if (shape.shapeType === 0 && shape.radius) {
        currentScale = shape.radius.div(shape.originalDimensions.radius).toNumber();
    } else if ((shape.shapeType === 1 || shape.shapeType === 4 || shape.shapeType === 5) && shape.w) {
        currentScale = shape.w.div(shape.originalDimensions.w).toNumber();
    }

    scaleInput.value = currentScale;
    scaleSlider.value = Math.min(Math.max(currentScale, scaleSlider.min), scaleSlider.max);
}




// It said add before setup() so ading i dont know which actual entire function or at end there is call for this

// Add this function right before setup()
function initializeToolbar() {
    const toolbar = document.querySelector(".toolbar");
    if (!toolbar) {
        console.warn('Toolbar not found');
        return;
    }

    toolbar.onmouseenter = e => toolBarFocused = true;
    toolbar.onmouseleave = e => toolBarFocused = false;

    toolbar.querySelectorAll("input, button").forEach(input => {
        if (!input) return;

        if (input.dataset.prop !== undefined) {
            input.oninput = e => {
                let prop = data.settings;
                let props = input.dataset.prop.split(".");
                for (let i = 0; i < props.length - 1; i++) {
                    prop = prop[props[i]];
                }

                let lastProp = props[props.length - 1];
                prop[lastProp] = input.type === "checkbox" ? e.target.checked : e.target.value;

                for (let shape of selectedShapes) {
                    if (shape[lastProp] !== undefined) {
                        if (input.type === "checkbox") {
                            shape[lastProp] = input.checked;
                        } else if (input.type === "number") {
                            if (!isNaN(parseFloat(input.value))) {
                                if (["w", "h", "radius", "size", "strokeSize"].includes(lastProp)) {
                                    shape[lastProp] = new Decimal(input.value).mul(data.cam.range);
                                } else {
                                    shape[lastProp] = parseFloat(input.value);
                                }
                            }
                        } else {
                            shape[lastProp] = input.value;
                        }
                    }
                }
            };
        }
    });
}




async function setup() {
    canvas = document.querySelector("canvas");
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }
    ctx = canvas.getContext("2d");
    canvas.width = innerWidth;
    canvas.height = innerHeight;

    // Initialize IndexedDB first
    try {
        await initDB();
        await autoLoad(); // Load data after DB is initialized
    } catch (e) {
        console.warn('Database initialization failed:', e);
    }

    // Initialize UI components after DOM is ready
    const initComponents = () => {
        GradientManager.addColor("#000000", 0);
        GradientManager.addColor("#ffffff", 1);

        // Initialize Managers
        if (typeof PanelManager !== 'undefined') {
            new PanelManager();
        }

        if (typeof TouchGestureManager !== 'undefined') {
            window.touchManager = new TouchGestureManager();
        }

        // All your existing canvas event listeners
        canvas.onclick = e => {
            if (!toolBarFocused) {
                handleShapeCreation();
            }
        };

        canvas.onmousedown = e => {
            mousePressed = true;
            mouseButton = e.button;
            isDragging = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;

            if (data.settings.tool === TOOL_SELECT && mouseButton === LEFT) {
                if (!data.settings.select.multiSelect) {
                    // Single select mode - keep your existing code
                    clearSelection();
                    let foundShape = false;
                    for (let i = world.shapes.length - 1; i >= 0; i--) {
                        if (world.shapes[i] !== undefined && world.shapes[i].intersectsWithScreen(mouseX, mouseY)) {
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
                    // Multi-select mode - new logic for handling multiple selections
                    let clickedOnShape = false;

                    // Check if clicked on an existing shape
                    for (let i = world.shapes.length - 1; i >= 0; i--) {
                        if (world.shapes[i] !== undefined && world.shapes[i].intersectsWithScreen(mouseX, mouseY)) {
                            clickedOnShape = true;

                            if (e.shiftKey) {
                                // Toggle selection with shift key
                                const index = selectedShapes.indexOf(world.shapes[i]);
                                if (index === -1) {
                                    selectedShapes.push(world.shapes[i]);
                                    updateScaleControls(world.shapes[i]);
                                } else {
                                    selectedShapes.splice(index, 1);
                                }
                            } else {
                                // Start new selection without shift key
                                clearSelection();
                                selectedShapes = [world.shapes[i]];
                                updateScaleControls(world.shapes[i]);
                            }
                            break;
                        }
                    }

                    // If didn't click on a shape, start drag selection
                    if (!clickedOnShape) {
                        if (!e.shiftKey) {
                            clearSelection();
                        }
                        selectBoundingBox = [mouseX, mouseY, mouseX, mouseY];
                    }
                }
            }


            if (mousePressed && data.settings.tool === TOOL_ERASER) {
                handleEraser();
            }

            if (data.settings.tool === TOOL_GRADIENT) {
                for (let i = world.shapes.length - 1; i >= 0; i--) {
                    let shape = world.shapes[i];
                    if (shape !== undefined && shape.intersectsWithScreen(mouseX, mouseY)) {
                        let obj = JSON.parse(JSON.stringify(data.settings.gradient)); //clone the object
                        if (mouseButton === LEFT) {
                            shape.color = obj;
                            break;
                        }
                        else if (mouseButton === RIGHT) {
                            shape.strokeColor = obj;
                            break;
                        }
                    }
                }
            }
        };

        canvas.onmousemove = e => {
            mouseX = e.clientX;
            mouseY = e.clientY;

            if (isDragging && !toolBarFocused) {
                const dx = e.clientX - lastMouseX;
                const dy = e.clientY - lastMouseY;

                // Middle mouse button or holding Spacebar + left mouse button for panning
                if (mouseButton === MIDDLE || (mouseButton === LEFT && e.getModifierState("Space"))) {
                    const panFactor = data.cam.range.div(innerHeight).mul(panSpeed);
                    data.cam.translate(
                        panFactor.mul(-dx),
                        panFactor.mul(-dy)
                    );
                }

                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
            }


            if (mousePressed && mouseButton === RIGHT) {
                data.cam.translate(data.cam.range.mul(-e.movementX / innerHeight), data.cam.range.mul(-e.movementY / innerHeight));
            }

            if (data.settings.tool === TOOL_SELECT && mousePressed && !toolBarFocused && mouseButton === LEFT) {
                let amplitude = data.cam.range.div(innerHeight);
                if (selectedShapes.length === 0 && data.settings.select.multiSelect) {
                    selectBoundingBox[2] = mouseX;
                    selectBoundingBox[3] = mouseY;
                }
                else {
                    for (let shape of selectedShapes) {
                        shape.move(amplitude.mul(e.movementX), amplitude.mul(e.movementY));
                    }
                }
            }

            if (data.settings.tool === TOOL_TEXT && selectedShapes.length > 0 && mousePressed && mouseButton === LEFT) {
                let amplitude = data.cam.range.div(innerHeight);
                currentShape().move(amplitude.mul(e.movementX), amplitude.mul(e.movementY));
            }

            if (currentShape() !== undefined && currentShape().shapeType === 2 && data.settings.tool === TOOL_POLYGON) {
                currentShape().points[currentShape().points.length - 1] = !toolBarFocused ? data.cam.screenToWorldPoint(mouseX, mouseY) : currentShape().points[currentShape().points.length - 2];
            }

            if (mousePressed && data.settings.tool === TOOL_ERASER) {
                handleEraser();
            }
        };

        canvas.onmouseup = e => {
            mousePressed = false;
            isDragging = false;

            if (data.settings.tool === TOOL_SELECT && data.settings.select.multiSelect) {
                if (selectedShapes.length === 0) {
                    selectedShapes = [];
                    for (let shape of world.shapes) {
                        let br = false;
                        let xmin = Math.min(selectBoundingBox[0], selectBoundingBox[2]),
                            xmax = Math.max(selectBoundingBox[0], selectBoundingBox[2]),
                            ymin = Math.min(selectBoundingBox[1], selectBoundingBox[3]),
                            ymax = Math.max(selectBoundingBox[1], selectBoundingBox[3]),
                            stepx = (xmax - xmin) / 50, stepy = (ymax - ymin) / 50;
                        for (let x = xmin; x < xmax; x += stepx) {
                            for (let y = ymin; y < ymax; y += stepy) {
                                if (shape !== undefined && shape.intersectsWithScreen(x, y)) {
                                    selectedShapes.push(shape);
                                    br = true;
                                    break;
                                }
                            }
                            if (br) {
                                break;
                            }
                        }
                    }

                    selectBoundingBox = [0, 0, 0, 0];
                }
            }

            // Add this line here - after the if statement but before the closing brace
            if (selectedShapes.length > 0) {
                updateScaleControls(selectedShapes[selectedShapes.length - 1]);
            }

        };

        canvas.oncontextmenu = e => false;

        // Initialize UI and components
        initializeUI();
        autoLoad();
        ShortcutManager.initialize();

        if (typeof BookmarkManager !== 'undefined') {
            BookmarkManager.initialize();
        }

        if (typeof VideoExporter !== 'undefined') {
            VideoExporter.initialize();
        }

        // Initialize panels with a slight delay
        setTimeout(() => {
            initializePanelToggles();
            initializeEnhancedPanels();
        }, 100);
    };

    // Wait for DOM content if still loading
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initComponents);
    } else {
        initComponents();
    }

    initializeScalingControls();
    requestAnimationFrame(update);
}


// In main.js, after setup()
function initializeEnhancedPanels() {
    EnhancedBookmarkManager.initialize();
    EnhancedSVGPanel.initialize();
}

function update(timestamp) {
    // Add FPS limiting
    if (timestamp - lastFrameTime < FRAME_TIME) {
        requestAnimationFrame(update);
        return;
    }
    lastFrameTime = timestamp;

    dtn = Date.now();
    let delta = (dtn - dto) / 1000;
    let w = canvas.width, h = canvas.height;

    dto = Date.now();

    // Rest of your existing update code remains the same
    data.cam.tick(delta);

    // Replace the existing condition
    // New smoother condition for shape filtering

    // In the tick function, modify the condition:
    if (data.cam.pos.sub(data.lastUpdate.pos).mag().gte(data.cam.range.mul(0.1)) ||
        Math.abs(Decimal.log10(data.cam.range) - Decimal.log10(data.lastUpdate.range)) > 0.1) {
        data.lastUpdate.range = data.cam.range;
        data.lastUpdate.pos = data.cam.pos;
        filterShapes();
    }


    if (displayfps === 0) {
        displayfps = 1 / delta;
    }
    fpstimer += delta;
    fpssum += 1 / delta;
    fpssumcount++;
    if (fpstimer >= 1) {
        displayfps = fpssum / fpssumcount;
        fpssumcount = 0;
        fpssum = 0;
        fpstimer = 0;
    }

    saveTimer += data.settings.autoSave ? delta : 0;
    if (saveTimer >= 10) {
        autoSave();
        saveTimer = 0;
    }

    // In main.js update function
    ctx.fillStyle = data.settings.bgColor;
    ctx.fillRect(0, 0, w, h);
    for (let s of world.shapes) {
        if (s !== undefined && s.isRenderable()) {
            if (selectedShapes.includes(s) && data.settings.tool === TOOL_SELECT) {
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.shadowBlur = innerHeight * 0.02 * (0.6 + 0.4 * Math.sin(Date.now() / 1000 * Math.PI));
                ctx.shadowColor = "#000000";
            }
            s.render(ctx);
            if (selectedShapes.includes(s)) {
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.shadowBlur = 0;
            }
        }
    }

    if (!toolBarFocused) {
        drawPreview(ctx);
    }

    ctx.fillStyle = "#00000000";
    ctx.strokeStyle = "#00a0ff";
    ctx.fillStyle = "#00a0ff30";
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = (Date.now() / 50) % 10000;

    if (selectBoundingBox[0] !== 0 || selectBoundingBox[1] !== 0 || selectBoundingBox[2] !== 0 || selectBoundingBox[3] !== 0) {
        ctx.fillRect(selectBoundingBox[0], selectBoundingBox[1], selectBoundingBox[2] - selectBoundingBox[0], selectBoundingBox[3] - selectBoundingBox[1]);
        ctx.strokeRect(selectBoundingBox[0], selectBoundingBox[1], selectBoundingBox[2] - selectBoundingBox[0], selectBoundingBox[3] - selectBoundingBox[1]);
    }

    ctx.setLineDash([]);


    // Modern FPS Counter
    if (!VideoExporter?.isRecording && data.settings.showHUD) {
        // Semi-transparent background panel for FPS
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        const fpsWidth = 100;
        const fpsHeight = 40;
        const fpsX = 20;
        const fpsY = 20;
        ctx.roundRect(fpsX, fpsY, fpsWidth, fpsHeight, 8); // Rounded corners
        ctx.fill();

        // FPS Text with glow
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.font = Utils.setFont(0.018, ["Inter", "Montserrat", "Arial"]);

        // Glow effect
        ctx.shadowColor = 'rgba(0, 149, 255, 0.5)';
        ctx.shadowBlur = 10;

        // FPS value
        ctx.fillStyle = "#ffffff";
        ctx.fillText((displayfps).toFixed(1), fpsX + fpsWidth / 2, fpsY + 15);

        // "FPS" label
        ctx.font = Utils.setFont(0.012, ["Inter", "Montserrat", "Arial"]);
        ctx.fillStyle = "#88ccff";
        ctx.fillText("FPS", fpsX + fpsWidth / 2, fpsY + 30);
        ctx.restore();
    }
    /*
    if (!VideoExporter?.isRecording) {  // Only show FPS when not recording
        ctx.textBaseline = "top";
        ctx.fillStyle = "black";
        ctx.textAlign = "left";
        ctx.font = Utils.setFont(0.02, ["Montserrat", "Arial"]);
        ctx.fillText((displayfps).toFixed(1) + " FPS", 10, 32);
    }
    */



    ctx.textAlign = "center";
    if (selectedShapes.length > 0) {
        ctx.fillText("Press Enter to Finish, Del to Delete", w / 2, 32);
    }

    /*
        // Add a check for recording before drawing zoom info
            if (!VideoExporter?.isRecording) {  // Only draw if not recording
                ctx.font = Utils.setFont(0.03, ["Work Sans", "Arial"]);
                ctx.strokeStyle = "white";
                ctx.lineWidth = Utils.vmax() * 0.002;
                ctx.textBaseline = "bottom";
                let widthDist = data.cam.range.mul(innerWidth / innerHeight);
                ctx.strokeText("<-  " + Utils.formatDistance(widthDist) + "  ->", w / 2, h);
                ctx.fillText("<-  " + Utils.formatDistance(widthDist) + "  ->", w / 2, h);
            }
    
        requestAnimationFrame(update);
    }
    */

    // Zoom scale - add data.settings.showHUD check
    // Modern Zoom Scale
    if (!VideoExporter?.isRecording && data.settings.showHUD) {
        ctx.save();

        // Semi-transparent background panel
        const widthDist = data.cam.range.mul(innerWidth / innerHeight);
        const scaleText = Utils.formatDistance(widthDist);
        const scaleWidth = Math.min(w * 0.2, 200); // Responsive width
        const scaleHeight = 40;
        const scaleX = w / 2 - scaleWidth / 2;
        const scaleY = h - 60; // Slightly higher from bottom

        // Gradient background
        const gradient = ctx.createLinearGradient(scaleX, scaleY, scaleX + scaleWidth, scaleY);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
        gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(scaleX, scaleY, scaleWidth, scaleHeight, 8);
        ctx.fill();

        // Scale lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(scaleX + 20, scaleY + scaleHeight / 2);
        ctx.lineTo(scaleX + scaleWidth - 20, scaleY + scaleHeight / 2);
        ctx.stroke();

        // Arrow markers
        ctx.fillStyle = '#ffffff';
        const arrowSize = 6;

        // Left arrow
        ctx.beginPath();
        ctx.moveTo(scaleX + 20, scaleY + scaleHeight / 2);
        ctx.lineTo(scaleX + 20 - arrowSize, scaleY + scaleHeight / 2 - arrowSize);
        ctx.lineTo(scaleX + 20 - arrowSize, scaleY + scaleHeight / 2 + arrowSize);
        ctx.fill();

        // Right arrow
        ctx.beginPath();
        ctx.moveTo(scaleX + scaleWidth - 20, scaleY + scaleHeight / 2);
        ctx.lineTo(scaleX + scaleWidth - 20 + arrowSize, scaleY + scaleHeight / 2 - arrowSize);
        ctx.lineTo(scaleX + scaleWidth - 20 + arrowSize, scaleY + scaleHeight / 2 + arrowSize);
        ctx.fill();

        // Scale text with glow
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = Utils.setFont(0.016, ["Inter", "Montserrat", "Arial"]);

        // Text glow
        ctx.shadowColor = 'rgba(0, 149, 255, 0.5)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(scaleText, w / 2, scaleY + scaleHeight / 2);

        ctx.restore();
    }

    requestAnimationFrame(update);
}



// Replace the existing changeTool function
// Update existing changeTool function
function changeTool(t) {
    data.settings.tool = t;
    // Updated selector to find nested tool views
    for (let div of document.querySelectorAll("[data-toolview]")) {
        if (div.dataset.toolview !== undefined) {
            // Use classList for Tailwind compatibility if needed, but style.display is safer for toggle
            div.style.display = t === parseInt(div.dataset.toolview) ? "block" : "none";
            // Also toggle the hidden class if it exists (Tailwind)
            if (t === parseInt(div.dataset.toolview)) {
                div.classList.remove('hidden');
            } else {
                div.classList.add('hidden');
            }
        }
    }

    // Add this line
    if (t === 8 && typeof EnhancedSVGPanel !== 'undefined') { // SVG tool
        EnhancedSVGPanel.syncWithMainPanel();
    }

    /*
    // Update original toolbar
    document.querySelectorAll('.toolbar > div').forEach(div => {
        if (div.dataset.toolview !== undefined) {
            div.style.display = t === parseInt(div.dataset.toolview) ? "block" : "none";
        }
    });
    */

    // Update modern UI if available
    if (window.modernUI) {
        window.modernUI.updateActiveToolUI(t);
    }
}

function initializeUI() {
    document.querySelector(".toolbar").onmouseenter = e => toolBarFocused = true;
    document.querySelector(".toolbar").onmouseleave = e => toolBarFocused = false;

    document.querySelector(".toolbar").querySelectorAll("input, button").forEach(input => {
        if (input.dataset.prop !== undefined) {
            input.oninput = e => {
                let prop = data.settings;
                let props = input.dataset.prop.split(".");
                for (let i = 0; i < props.length - 1; i++) {
                    prop = prop[props[i]];
                }

                let lastProp = props[props.length - 1];
                prop[lastProp] = input.type === "checkbox" ? e.target.checked : e.target.value;

                for (let shape of selectedShapes) {
                    if (shape[lastProp] !== undefined) {
                        if (input.type === "checkbox") {
                            shape[lastProp] = input.checked;
                        }
                        else if (input.type === "number") {
                            if (!isNaN(parseFloat(input.value))) {
                                if (["w", "h", "radius", "size", "strokeSize"].includes(lastProp)) //properties that are a Decimal
                                {
                                    shape[lastProp] = new Decimal(input.value).mul(data.cam.range);
                                }
                                else {
                                    shape[lastProp] = parseFloat(input.value);
                                }
                            }
                        }
                        else {
                            shape[lastProp] = input.value;
                        }
                    }
                }
            }
        }
        else if (input.dataset.tool !== undefined) {
            input.onclick = e => changeTool(parseInt(input.dataset.tool));
        }
        else if (input.dataset.textalign !== undefined) {
            input.onclick = e => {
                let halign = input.dataset.textalign[0].replace("l", "left").replace("r", "right").replace("c", "center");
                let valign = input.dataset.textalign[1].replace("t", "top").replace("m", "middle").replace("b", "bottom");
                data.settings.text.halign = halign;
                data.settings.text.valign = valign;
                for (let shape of selectedShapes) {
                    if (shape.shapeType === 3) {
                        shape.halign = halign;
                        shape.valign = valign;
                    }
                }
            }
        }
        else if (input.dataset.palettecolor !== undefined) {
            input.style.backgroundColor = input.dataset.palettecolor;
            input.oncontextmenu = e => false;
            input.onmouseup = e => {
                if (e.button === LEFT) {
                    data.settings.color = input.dataset.palettecolor;
                    document.querySelector("input[data-prop=color]").value = input.dataset.palettecolor;
                    for (let shape of selectedShapes) {
                        shape.color = input.dataset.palettecolor;
                    }
                }
                if (e.button === RIGHT) {
                    data.settings.strokeColor = input.dataset.palettecolor;
                    document.querySelector("input[data-prop=strokeColor]").value = input.dataset.palettecolor;
                    for (let shape of selectedShapes) {
                        shape.strokeColor = input.dataset.palettecolor;
                    }
                }
            }
        }
    });

    for (let i = 0; i < shapeImages.length; i++) {
        let b = document.querySelector(".image-select").appendChild(document.createElement("button"));
        b.innerHTML = "<img src='" + shapeImages[i].src + "' alt='image select'/>";
        b.onclick = e => {
            data.settings.image.id = i;
            for (let shape of selectedShapes) {
                shape.imageIndex = i;
                shape.image = shapeImages[i];
            }
        }
    }


    // Add SVG upload handler here
    // In initializeUI() function, after the image selection code:
    // In the SVG upload handler section
    document.getElementById('svg-upload').onchange = function (e) {
        let files = e.target.files;
        for (let file of files) {
            let reader = new FileReader();
            reader.onload = function (e) {
                try {
                    let svgData = e.target.result;

                    // Add to collection
                    let svgIndex = svgCollection.length;
                    svgCollection.push({
                        data: svgData,
                        name: file.name
                    });

                    // Create preview button
                    let svgPreviewContainer = document.querySelector(".svg-select");
                    let previewBtn = document.createElement("button");
                    previewBtn.className = "svg-preview";

                    // Safely set SVG content
                    try {
                        const encodedSvg = encodeURIComponent(svgData)
                            .replace(/'/g, '%27')
                            .replace(/"/g, '%22');
                        previewBtn.innerHTML = decodeURIComponent(encodedSvg);
                    } catch (error) {
                        console.error('Preview error:', error);
                        previewBtn.textContent = file.name; // Fallback to filename
                    }

                    previewBtn.title = file.name;
                    previewBtn.style.width = "3em";
                    previewBtn.style.height = "3em";
                    previewBtn.style.padding = "0.2em";
                    previewBtn.style.margin = "0.2em";
                    previewBtn.style.backgroundColor = "white";
                    previewBtn.style.border = "1px solid #ccc";

                    previewBtn.onclick = () => {
                        document.querySelectorAll('.svg-preview').forEach(btn => {
                            btn.style.border = "1px solid #ccc";
                        });
                        previewBtn.style.border = "2px solid #00f";
                        data.settings.svg.currentIndex = svgIndex;
                    };

                    svgPreviewContainer.appendChild(previewBtn);
                } catch (error) {
                    console.error('SVG processing error:', error);
                    alert('Error processing SVG file');
                }
            };
            reader.readAsText(file);
        }
    };


    document.querySelector("button#clear_canvas").onclick = e => clearCanvas();
    document.querySelector("button#reset_cam").onclick = e => data.cam.reset();
    document.querySelector("button#move_center").onclick = e => data.cam.pos = Vec2.ZERO;
    document.querySelector("button#move_shape_top").onclick = e => {
        for (let shape of selectedShapes) {
            moveShapeToTop(shape);
        }
    };
    // Add these new button handlers right after it:
    document.querySelector("button#move_shape_forward").onclick = e => {
        // Process shapes from front to back for bringing forward
        for (let i = selectedShapes.length - 1; i >= 0; i--) {
            moveShapeForward(selectedShapes[i]);
        }
    };

    document.querySelector("button#move_shape_backward").onclick = e => {
        // Process shapes from back to front for sending backward
        for (let i = 0; i < selectedShapes.length; i++) {
            moveShapeBackward(selectedShapes[i]);
        }
    };

    document.querySelector("button#move_shape_bottom").onclick = e => {
        // Process shapes from back to front for sending to bottom
        for (let i = 0; i < selectedShapes.length; i++) {
            moveShapeToBottom(selectedShapes[i]);
        }
    };


    document.querySelector("button#minimize").onclick = e => {
        let toolbar = document.querySelector(".toolbar");
        toolbar.classList.toggle("hidden");
    };
    document.querySelector("button#download").onclick = downloadCanvas;
    document.querySelector("button#import").onclick = e => {
        importCanvas(document.querySelector("textarea#import_text").value);
        console.log(document.querySelector("textarea#import_text").value);
    };

    // Add this new code right after document.querySelector("button#import")

    // Inside initializeUI() function, update the existing handler
    document.querySelector("input#import_file").onchange = async e => {
        const file = e.target.files[0];
        if (file) {
            try {
                // Check file extension (keeping this important validation from original)
                const fileExt = file.name.split('.').pop().toLowerCase();
                if (!['json', 'txt'].includes(fileExt)) {
                    alert('Please select a .json or .txt file');
                    return;
                }

                // Show loading dialog when starting import
                const loading = ChunkManager.showLoadingDialog('Processing file...');

                // Process in chunks if file is large
                if (file.size > ChunkManager.CHUNK_SIZE) {
                    try {
                        const data = await ChunkManager.importFromChunks(file);
                        // Update textarea with formatted JSON
                        document.querySelector("textarea#import_text").value =
                            JSON.stringify(data, null, 2);
                        await importCanvas(JSON.stringify(data));
                    } catch (error) {
                        console.error('Error importing large file:', error);
                        alert('Error importing canvas data');
                    }
                } else {
                    // Original method for smaller files
                    const reader = new FileReader();
                    reader.onload = async function (e) {
                        try {
                            // Try to parse and re-stringify to ensure valid JSON (keeping this validation)
                            const parsedData = JSON.parse(e.target.result);
                            document.querySelector("textarea#import_text").value =
                                JSON.stringify(parsedData, null, 2);
                            await importCanvas(JSON.stringify(parsedData));
                        } catch (error) {
                            console.error('Error importing file:', error);
                            alert('Error importing canvas data - Invalid JSON format');
                        }
                    };
                    reader.onerror = function (error) {
                        console.error('Error reading file:', error);
                        alert('Error reading file');
                    };
                    reader.readAsText(file);
                }
            } catch (error) {
                console.error('Import error:', error);
                alert('Error importing file');
            } finally {
                // Hide loading dialog in all cases
                ChunkManager.hideLoadingDialog(document.querySelector('.loading-dialog'));
            }
        }
    };


    document.querySelector("input#setting_font").oninput = e => {
        data.settings.text.font = e.target.value;
        e.target.style.fontFamily = e.target.value + ", Montserrat, Arial, sans-serif";
    };
    document.querySelector("button#add_gradient_color").onclick = e => GradientManager.addColor();
    for (let g of gradientTemplates) {
        let btn = document.createElement("button");
        btn.innerHTML = g.name;
        btn.onclick = e => GradientManager.setGradient(g.gradient);
        document.querySelector("div#gradient_templates").appendChild(btn);
    }
    document.querySelector("button#random_gradient").onclick = e => {
        GradientManager.createRandomGradient(data.settings.gradient.colors.length);
    };
    changeTool(0);
}




// Add after the initializeUI function definition
function initializeScalingControls() {
    const scaleInput = document.getElementById('scale-factor');
    const scaleSlider = document.getElementById('scale-slider');
    const stepInput = document.getElementById('scale-step');

    function applyScale(scale) {
        if (selectedShapes.length === 0) return;

        selectedShapes.forEach(shape => {
            // Store original dimensions if not stored
            if (!shape.originalDimensions) {
                shape.originalDimensions = {
                    w: shape.w,
                    h: shape.h,
                    radius: shape.radius
                };
            }

            // Scale based on shape type
            if (shape.shapeType === 0) { // Circle
                shape.radius = shape.originalDimensions.radius.mul(new Decimal(scale));
            } else if (shape.shapeType === 1 || shape.shapeType === 4 || shape.shapeType === 5) { // Rectangle, Image, SVG
                shape.w = shape.originalDimensions.w.mul(new Decimal(scale));
                shape.h = shape.originalDimensions.h.mul(new Decimal(scale));

                // Maintain aspect ratio for SVG
                if (shape.shapeType === 5 && shape.maintainAspectRatio) {
                    shape.maintainAspectRatio();
                }
            }
        });
    }

    // Update slider step when step input changes
    stepInput.addEventListener('input', (e) => {
        scaleSlider.step = e.target.value;
    });

    // Sync input and slider
    scaleInput.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        scaleSlider.value = Math.min(Math.max(value, scaleSlider.min), scaleSlider.max);
        applyScale(value);
    });

    scaleSlider.addEventListener('input', (e) => {
        scaleInput.value = e.target.value;
        applyScale(e.target.value);
    });

    // Reset scale when selection changes
    document.addEventListener('selectionchange', () => {
        scaleInput.value = 1;
        scaleSlider.value = 1;
    });
}



// Add panel toggle initialization at the end
setTimeout(() => {
    try {
        initializePanelToggles();
    } catch (error) {
        console.warn('Error initializing panel toggles:', error);
    }
}, 100);



function drawPreview(ctx) {
    ctx.globalAlpha = Math.min(0.5, data.settings.alpha / 2);
    ctx.fillStyle = data.settings.color; //add alpha component
    ctx.strokeStyle = data.settings.strokeColor;
    ctx.lineWidth = data.settings.strokeSize * innerHeight;
    if (data.settings.tool === TOOL_CIRCLE) {
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, innerHeight * data.settings.circle.radius, 0, 2 * Math.PI);
        ctx.closePath();
        if (data.settings.fill) {
            ctx.fill();
        }
        if (data.settings.stroke) {
            ctx.stroke();
        }
    }
    if (data.settings.tool === TOOL_RECTANGLE) {
        let w = innerHeight * data.settings.rectangle.w, h = innerHeight * data.settings.rectangle.h;
        if (data.settings.fill) {
            ctx.fillRect(mouseX - w / 2, mouseY - h / 2, w, h);
        }
        if (data.settings.stroke) {
            ctx.strokeRect(mouseX - w / 2, mouseY - h / 2, w, h);
        }
    }
    if (data.settings.tool === TOOL_POLYGON) {
        if (currentShape() !== undefined && currentShape().shapeType === 2) {
            //currentShape().render(ctx);
            ctx.strokeStyle = "red";
            ctx.lineWidth = innerHeight * 0.003;
            for (let point of currentShape().points) {
                let p = data.cam.worldToScreenPoint(point.x, point.y);
                let x = p.x.toNumber(), y = p.y.toNumber();
                let size = innerHeight * 0.005;

                ctx.beginPath();
                ctx.moveTo(x - size, y - size);
                ctx.lineTo(x + size, y + size);
                ctx.closePath();
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(x - size, y + size);
                ctx.lineTo(x + size, y - size);
                ctx.closePath();
                ctx.stroke();
            }
        }
    }
    if (data.settings.tool === TOOL_TEXT) {
        if (currentShape() === undefined || (currentShape().shapeType === 3 && currentShape().text.length === 0)) {
            let s = innerHeight * data.settings.text.size;
            ctx.font = s + "px " + data.settings.text.font + ",Montserrat";
            ctx.fillStyle = data.settings.color;
            ctx.strokeStyle = data.settings.strokeColor;
            ctx.lineWidth = innerHeight * data.settings.strokeSize;
            ctx.textAlign = data.settings.text.halign;
            ctx.textBaseline = data.settings.text.valign;
            if (data.settings.fill) {
                ctx.fillText("A", mouseX, mouseY);
            }
            if (data.settings.stroke) {
                ctx.strokeText("A", mouseX, mouseY);
            }
        }
    }
    if (data.settings.tool === TOOL_IMAGE) {
        let blur = Math.max(data.settings.image.w, data.settings.image.h) * data.settings.image.blur * 100;
        ctx.filter = "blur(" + blur + "px) hue-rotate(" + data.settings.image.hue + "deg) brightness(" + data.settings.image.brightness + "%)" +
            " contrast(" + data.settings.image.contrast + "%) saturate(" + data.settings.image.saturation + "%)";
        //ctx.filter = "blur(" + blur + "px) hue-rotate(" + data.settings.image.hue + "deg)";
        Utils.drawRotatedImage(data.settings.image.rotation, shapeImages[data.settings.image.id], mouseX - innerHeight * data.settings.image.w * 0.5, mouseY - innerHeight * data.settings.image.h * 0.5,
            data.settings.image.w * innerHeight, data.settings.image.h * innerHeight);
        ctx.filter = "none";
    }

    if (currentShape() !== undefined && currentShape().shapeType === 3) //draw cursor for text editing
    {
        let alignMulti = { "left": 1, "center": 0.5, "right": 0 };
        let yOff = { "top": 0, "middle": -0.5, "bottom": -1 };

        ctx.fillStyle = "#000000";
        let oldFont = ctx.font;
        let fSize = currentShape().size.div(data.cam.range).mul(innerHeight).toNumber();
        ctx.font = (fSize) + "px " + data.settings.text.font + ",Montserrat";
        let screen = currentShape().getScreenPos(currentShape().pos);
        let x = screen.x + ctx.measureText(currentShape().text.substring(0, textCursorPosition)).width
            - (ctx.measureText(currentShape().text).width * (1 - alignMulti[currentShape().halign]));
        let y = screen.y + fSize * yOff[currentShape().valign];
        let cHeight = fSize;
        if (Date.now() % 1000 > 500) {
            ctx.fillRect(x + cHeight / 20, y, 2, cHeight);
        }
        ctx.font = oldFont;
    }

    ctx.globalAlpha = 1;
}

function handleShapeCreation() {
    let pos = data.cam.screenToWorldPoint(mouseX, mouseY);
    let stroke = data.cam.range.mul(data.settings.strokeSize);
    let textSize = data.cam.range.mul(data.settings.text.size);
    let index = world.shapes.filter(s => s !== undefined).length + world.shapeCache.filter(s => s !== undefined).length;
    if (selectedShapes.length === 0) {
        switch (data.settings.tool) {
            case TOOL_CIRCLE:
                world.shapes[index] = new ShapeCircle(pos, data.settings.color, data.cam.range.mul(data.settings.circle.radius),
                    data.settings.fill, data.settings.stroke, data.settings.strokeColor, stroke, data.settings.alpha);
                break;
            case TOOL_RECTANGLE:
                world.shapes[index] = new ShapeRect(pos, data.settings.color, data.cam.range.mul(data.settings.rectangle.w), data.cam.range.mul(data.settings.rectangle.h),
                    data.settings.fill, data.settings.stroke, data.settings.strokeColor, stroke, data.settings.alpha);
                break;
            case TOOL_POLYGON:
                world.shapes[index] = new ShapePolygon([pos,
                    pos], data.settings.color, data.settings.fill, data.settings.stroke, data.settings.strokeColor, stroke, data.settings.polygon.isClosed, data.settings.polygon.isSmooth, data.settings.alpha);
                selectedShapes = [world.shapes[index]];
                break;
            case TOOL_TEXT:
                world.shapes[index] = new ShapeText(pos, data.settings.color, data.settings.fill, data.settings.stroke, data.settings.strokeColor, stroke, "", textSize,
                    data.settings.text.font, data.settings.text.halign, data.settings.text.valign, data.settings.alpha);
                selectedShapes = [world.shapes[index]];
                break;

            // Find the switch statement in handleShapeCreation() and update the SVG case:
            case 8: // SVG Tool
                if (svgCollection.length > 0) {
                    world.shapes[index] = new ShapeSVG(
                        pos,
                        data.settings.svg.currentIndex,
                        data.cam.range.mul(data.settings.svg.w),
                        data.cam.range.mul(data.settings.svg.h),
                        data.settings.svg.rotation,
                        data.settings.alpha
                    );
                }
                break;

            case TOOL_IMAGE:
                world.shapes[index] = new ShapeImage(pos, data.settings.image.id, data.cam.range.mul(data.settings.image.w), data.cam.range.mul(data.settings.image.h),
                    data.settings.image.rotation, {
                    blur: data.settings.image.blur,
                    hue: data.settings.image.hue,
                    brightness: data.settings.image.brightness,
                    contrast: data.settings.image.contrast,
                    saturation: data.settings.image.saturation
                }, data.settings.alpha);
                break;
            default:
                break;
        }
    }
    else {
        if (currentShape().shapeType === 2 && data.settings.tool === TOOL_POLYGON) {
            currentShape().points.push(pos);
        }
    }
}

function handleEraser() {
    for (let i = 0; i < world.shapes.length; i++) {
        if (world.shapes[i] !== undefined && world.shapes[i].intersectsWithScreen(mouseX, mouseY)) {
            removeShape(world.shapes[i]);
        }
    }
}

function removeShape(shape) {
    for (let i = 0; i < Math.max(world.shapes.length, world.shapeCache.length); i++) {
        if (world.shapes[i] === shape || world.shapeCache[i] === shape) {
            world.shapes.splice(i, 1);
            world.shapeCache.splice(i, 1);
            break;
        }
    }
}

function currentShape() {
    return selectedShapes[0];
}

function moveShapeToTop(shape) {
    let idx = world.shapes.findIndex(s => s === shape);
    let len = Math.max(world.shapes.length, world.shapeCache.length);
    world.shapes[len] = world.shapes[idx];
    world.shapeCache[len] = world.shapeCache[idx];

    world.shapes.splice(idx, 1);
    world.shapeCache.splice(idx, 1);
}

// Moves a shape one position forward in the rendering order
function moveShapeForward(shape) {
    let idx = world.shapes.findIndex(s => s === shape);
    if (idx < world.shapes.length - 1) {
        // Swap with the next shape
        [world.shapes[idx], world.shapes[idx + 1]] = [world.shapes[idx + 1], world.shapes[idx]];
        [world.shapeCache[idx], world.shapeCache[idx + 1]] = [world.shapeCache[idx + 1], world.shapeCache[idx]];
    }
}

// Moves a shape one position backward in the rendering order
function moveShapeBackward(shape) {
    let idx = world.shapes.findIndex(s => s === shape);
    if (idx > 0) {
        // Swap with the previous shape
        [world.shapes[idx], world.shapes[idx - 1]] = [world.shapes[idx - 1], world.shapes[idx]];
        [world.shapeCache[idx], world.shapeCache[idx - 1]] = [world.shapeCache[idx - 1], world.shapeCache[idx]];
    }
}

// Moves a shape to the bottom (back) of the rendering order
function moveShapeToBottom(shape) {
    let idx = world.shapes.findIndex(s => s === shape);
    if (idx > 0) {
        // Remove shape from current position
        world.shapes.splice(idx, 1);
        world.shapeCache.splice(idx, 1);
        // Insert at beginning
        world.shapes.unshift(shape);
        world.shapeCache.unshift(undefined);
    }
}



onresize = e => {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
};

document.onwheel = e => {
    if (!toolBarFocused) {
        let f = parseFloat(data.settings.zoomFactor);
        let oldRange = data.cam.range;
        let newRange = data.cam.targetRange.mul(Math.pow(f, e.deltaY / 100));

        // Set target range and get potentially clamped value
        data.cam.setTargetRange(newRange);
        let actualNewRange = data.cam.targetRange; // Get clamped range

        let scale = actualNewRange.div(oldRange);
        let mouseWorld = data.cam.screenToWorldPoint(e.clientX, e.clientY);
        let offset = mouseWorld.sub(data.cam.pos).mul(new Decimal(1).sub(scale));
        data.cam.setTargetPos(data.cam.targetPos.add(offset));

        if (data.cam.range.sub(data.lastUpdate.range).abs().div(data.lastUpdate.range).gt(0.1)) {
            data.lastUpdate.range = data.cam.range;
            data.lastUpdate.pos = data.cam.pos;
            filterShapes();
        }
    }
};


onkeydown = e => {
    if (!toolBarFocused) {

        const panAmount = data.cam.range.div(10); // Adjust this value for arrow key pan speed

        switch (e.key) {
            case 'ArrowLeft':
                data.cam.translate(panAmount.neg(), new Decimal(0));
                break;
            case 'ArrowRight':
                data.cam.translate(panAmount, new Decimal(0));
                break;
            case 'ArrowUp':
                data.cam.translate(new Decimal(0), panAmount.neg());
                break;
            case 'ArrowDown':
                data.cam.translate(new Decimal(0), panAmount);
                break;
        }

        if (e.key === "Enter") {
            if (currentShape() !== undefined) {
                if (currentShape().shapeType === 2 && data.settings.tool === TOOL_POLYGON) {
                    currentShape().points = currentShape().points.slice(0, currentShape().points.length - 1);
                    currentShape().cacheGeometryData();
                    clearSelection(); // Replace selectedShapes = []
                }
                else if (currentShape().shapeType === 3 && currentShape().text.length > 0) {
                    textCursorPosition = 0;
                    clearSelection(); // Replace selectedShapes = []
                }
                else {
                    clearSelection(); // Replace selectedShapes = []
                }
            }
            if (data.settings.tool === TOOL_SELECT && selectedShapes.length !== 0) {
                clearSelection(); // Replace selectedShapes = []
            }
        }
        if (e.key === "Delete") {
            for (let shape of selectedShapes) {
                removeShape(world.shapes.find(sh => sh === shape));
            }
            clearSelection(); // Replace selectedShapes = []
        }


        if (currentShape() !== undefined && currentShape().shapeType === 3) {
            if (e.key === "ArrowLeft") {
                textCursorPosition = Math.max(0, textCursorPosition - 1);
            }
            if (e.key === "ArrowRight") {
                textCursorPosition = Math.min(currentShape().text.length, textCursorPosition + 1);
            }
            if (e.key === "Backspace") {
                currentShape().text = currentShape().text.substring(0, textCursorPosition - 1) + currentShape().text.substring(textCursorPosition, currentShape().text.length);
                textCursorPosition = Math.max(0, textCursorPosition - 1);
            }
            else {
                if (e.key.length === 1) {
                    currentShape().text = currentShape().text.substring(0, textCursorPosition) + e.key + currentShape().text.substring(textCursorPosition, currentShape().text.length);
                    textCursorPosition = Math.min(currentShape().text.length, textCursorPosition + 1);
                }
            }
        }

        // Add these new cases
        if (e.ctrlKey && !e.shiftKey && e.key === ']') {
            // Ctrl + ] = Bring Forward
            e.preventDefault();
            for (let i = selectedShapes.length - 1; i >= 0; i--) {
                moveShapeForward(selectedShapes[i]);
            }
        }
        if (e.ctrlKey && !e.shiftKey && e.key === '[') {
            // Ctrl + [ = Send Backward
            e.preventDefault();
            for (let i = 0; i < selectedShapes.length; i++) {
                moveShapeBackward(selectedShapes[i]);
            }
        }
        if (e.ctrlKey && e.shiftKey && e.key === ']') {
            // Ctrl + Shift + ] = Bring to Front
            e.preventDefault();
            for (let shape of selectedShapes) {
                moveShapeToTop(shape);
            }
        }
        if (e.ctrlKey && e.shiftKey && e.key === '[') {
            // Ctrl + Shift + [ = Send to Back
            e.preventDefault();
            for (let i = 0; i < selectedShapes.length; i++) {
                moveShapeToBottom(selectedShapes[i]);
            }
        }

        // Modified to require Ctrl+H or alt+H to toggle HUD for fps and zoom depth
        // Toggle HUD with either Ctrl+H or Alt+H
        if (e.key === 'h' || e.key === 'H') {
            if (e.ctrlKey) {
                e.preventDefault(); // Prevent browser's default history hotkey
                e.stopPropagation(); // Additional prevention for browser default
                data.settings.showHUD = !data.settings.showHUD;
            }
            else if (e.altKey) {
                e.preventDefault(); // Prevent any potential browser default
                data.settings.showHUD = !data.settings.showHUD;
            }
        }

    }
};

// Update the exportCanvas() function
function exportCanvas() {
    let obj = [];
    for (let i = 0; i < world.shapes.length; i++) {
        if (world.shapes[i] !== undefined) {
            const shape = world.shapes[i];
            let cleanShape = {
                shapeType: shape.shapeType,
                pos: {
                    x: shape.pos.x.toString(),
                    y: shape.pos.y.toString()
                },
                alpha: shape.alpha,
                color: shape.color,
                fill: shape.fill,
                stroke: shape.stroke,
                strokeColor: shape.strokeColor,
                strokeSize: shape.strokeSize
            };

            // Add shape-specific properties
            switch (shape.shapeType) {
                case 0: // Circle
                    cleanShape.radius = shape.radius.toString();
                    break;

                case 1: // Rectangle
                    cleanShape.w = shape.w.toString();
                    cleanShape.h = shape.h.toString();
                    break;

                case 2: // Polygon
                    cleanShape.points = shape.points.map(p => ({
                        x: p.x.toString(),
                        y: p.y.toString()
                    }));
                    cleanShape.isClosed = shape.isClosed;
                    cleanShape.isSmooth = shape.isSmooth;
                    cleanShape.geometryData = shape.geometryData;
                    break;

                case 3: // Text
                    cleanShape.text = shape.text;
                    cleanShape.size = shape.size.toString();
                    cleanShape.font = shape.font;
                    cleanShape.halign = shape.halign;
                    cleanShape.valign = shape.valign;
                    break;

                case 4: // Image
                    cleanShape.imageIndex = shape.imageIndex;
                    cleanShape.w = shape.w.toString();
                    cleanShape.h = shape.h.toString();
                    cleanShape.rotation = shape.rotation;
                    cleanShape.blur = shape.blur;
                    cleanShape.hue = shape.hue;
                    cleanShape.brightness = shape.brightness;
                    cleanShape.contrast = shape.contrast;
                    cleanShape.saturation = shape.saturation;
                    break;

                case 5: // SVG
                    cleanShape.w = shape.w.toString();
                    cleanShape.h = shape.h.toString();
                    cleanShape.rotation = shape.rotation;
                    cleanShape.svgIndex = shape.svgIndex;
                    cleanShape.svgData = shape.svgData;
                    break;
            }

            obj[i] = cleanShape;
        }
        if (world.shapeCache[i] !== undefined) {
            obj[i] = world.shapeCache[i];
        }
    }

    return JSON.stringify({
        canvas: obj,
        camera: {
            pos: {
                x: data.cam.pos.x.toString(),
                y: data.cam.pos.y.toString()
            },
            targetRange: data.cam.targetRange.toString(),
            range: data.cam.range.toString()
        },
        background: data.settings.bgColor,
        svgCollection: svgCollection,
        bookmarks: BookmarkManager.bookmarks
    });
}


//---01- Start of dont know where to add this code

// Add at the top of main.js with other utilities
function compressData(str) {
    try {
        const compressedData = pako.deflate(str, { to: 'string' });
        return btoa(compressedData);
    } catch (e) {
        console.warn('Compression failed:', e);
        return str;
    }
}

function decompressData(data) {
    try {
        const decompressedData = pako.inflate(atob(data), { to: 'string' });
        return decompressedData;
    } catch (e) {
        console.warn('Decompression failed:', e);
        return data;
    }
}

// Add this when clearing selection:
function clearSelection() {
    if (selectedShapes.length > 0) {
        selectedShapes.forEach(shape => {
            if (shape && typeof shape.resetScale === 'function') {
                shape.resetScale();
            }
        });
    }
    selectedShapes = [];
    const scaleInput = document.getElementById('scale-factor');
    const scaleSlider = document.getElementById('scale-slider');
    if (scaleInput) scaleInput.value = 1;
    if (scaleSlider) scaleSlider.value = 1;
}

//---01- End of dont know where to add this code



async function importCanvas(str) {
    let decoded;
    try {
        decoded = JSON.parse(str);
    } catch (e) {
        console.log("Could not decode: " + e);
        return;
    }

    if (decoded !== undefined && decoded.canvas !== undefined) {
        loadingDialog.textContent = 'Importing...';
        loadingDialog.style.display = 'block';

        world.shapes = [];
        world.shapeCache = [];


        // Process in batches to avoid blocking the main thread
        const BATCH_SIZE = 50;
        let currentIndex = 0;

        const processBatch = async () => {
            const endIdx = Math.min(currentIndex + BATCH_SIZE, decoded.canvas.length);

            for (let i = currentIndex; i < endIdx; i++) {
                let shape = decoded.canvas[i];
                if (shape !== undefined && shape !== null) {
                    let type = shape.shapeType;
                    let newShape;
                    try {
                        let pos = new Vec2(
                            new Decimal(shape.pos?.x || 0),
                            new Decimal(shape.pos?.y || 0)
                        );

                        // Keep all your original shape type handling
                        if (type === 0) {
                            newShape = new ShapeCircle(pos, shape.color, new Decimal(shape.radius || 0),
                                shape.fill, shape.stroke, shape.strokeColor, parseFloat(shape.strokeSize), shape.alpha);
                        }
                        else if (type === 1) {
                            newShape = new ShapeRect(pos, shape.color, new Decimal(shape.w), new Decimal(shape.h),
                                shape.fill, shape.stroke, shape.strokeColor, parseFloat(shape.strokeSize), shape.alpha);
                        }
                        else if (type === 2) {
                            let points = [];
                            for (let p of shape.points) {
                                points.push(new Vec2(new Decimal(p.x), new Decimal(p.y)));
                            }
                            newShape = new ShapePolygon(points, shape.color,
                                shape.fill, shape.stroke, shape.strokeColor, parseFloat(shape.strokeSize),
                                shape.isClosed, shape.isSmooth, shape.alpha);
                            if (Object.keys(shape.geometryData).length !== 0) {
                                newShape.geometryData.center = new Vec2(
                                    new Decimal(shape.geometryData.center.x),
                                    new Decimal(shape.geometryData.center.y)
                                );
                                newShape.geometryData.size = new Decimal(shape.geometryData.size);
                                newShape.geometryData.sizeMin = new Decimal(shape.geometryData.sizeMin);
                            }
                        }
                        else if (type === 3) {
                            newShape = new ShapeText(pos, shape.color, shape.fill, shape.stroke,
                                shape.strokeColor, shape.strokeSize, shape.text, new Decimal(shape.size),
                                shape.font, shape.halign, shape.valign, shape.alpha);
                        }
                        else if (type === 4) {
                            newShape = new ShapeImage(pos, shape.imageIndex, new Decimal(shape.w),
                                new Decimal(shape.h), shape.rotation, {
                                blur: shape.blur,
                                hue: shape.hue,
                                brightness: shape.brightness,
                                contrast: shape.contrast,
                                saturation: shape.saturation
                            }, shape.alpha);
                        }
                        else if (type === 5) {
                            newShape = new ShapeSVG(
                                pos,
                                shape.svgIndex,
                                new Decimal(shape.w),
                                new Decimal(shape.h),
                                shape.rotation,
                                shape.alpha
                            );
                        }

                        if (newShape) {
                            world.shapeCache[i] = newShape;
                        }
                    } catch (error) {
                        console.error(`Error creating shape at index ${i}:`, error);
                        continue;
                    }
                }
            }

            currentIndex = endIdx;

            if (currentIndex < decoded.canvas.length) {
                // Schedule next batch
                setTimeout(processBatch, 0);
            } else {
                finishImport();
            }
        };

        const finishImport = () => {
            loadingDialog.style.display = 'none';
            filterShapes();
            data.lastUpdate.pos = data.cam.pos;
            data.lastUpdate.range = data.cam.range;

            // Process camera settings
            if (decoded.camera !== undefined) {
                data.cam.pos = new Vec2(
                    new Decimal(decoded.camera.pos.x),
                    new Decimal(decoded.camera.pos.y)
                );
                data.cam.targetRange = new Decimal(decoded.camera.targetRange);
                data.cam.range = data.cam.targetRange;
            }

            // Process background
            if (decoded.background !== undefined) {
                data.settings.bgColor = decoded.background;
                document.querySelector("input[data-prop=bgColor]").value = decoded.background;
            }

            // Process SVG collection
            if (decoded.svgCollection !== undefined) {
                processSvgCollection(decoded.svgCollection);
            }

            // Process bookmarks
            if (decoded.bookmarks !== undefined && typeof BookmarkManager !== 'undefined') {
                BookmarkManager.bookmarks = decoded.bookmarks;
                BookmarkManager.renderBookmarks();
            }
        };

        processBatch();
    }
}


// Add this new function to main.js
function rebuildSVGPreviews() {
    const svgPreviewContainer = document.querySelector(".svg-select");
    if (!svgPreviewContainer) return;

    svgPreviewContainer.innerHTML = ''; // Clear existing previews

    svgCollection.forEach((svg, index) => {
        let previewBtn = document.createElement("button");
        previewBtn.className = "svg-preview";
        previewBtn.innerHTML = svg.data;
        previewBtn.title = svg.name;

        // Style the preview button
        previewBtn.style.width = "3em";
        previewBtn.style.height = "3em";
        previewBtn.style.padding = "0.2em";
        previewBtn.style.margin = "0.2em";
        previewBtn.style.backgroundColor = "white";
        previewBtn.style.border = "1px solid #ccc";

        // Selection functionality
        previewBtn.onclick = () => {
            document.querySelectorAll('.svg-preview').forEach(btn => {
                btn.style.border = "1px solid #ccc";
            });
            previewBtn.style.border = "2px solid #00f";
            data.settings.svg.currentIndex = index;
        };

        svgPreviewContainer.appendChild(previewBtn);
    });
}



// Add this after rebuildSVGPreviews function and before downloadCanvas
function processSvgCollection(collection) {
    svgCollection = collection;

    // Rebuild SVG previews
    const svgPreviewContainer = document.querySelector(".svg-select");
    if (!svgPreviewContainer) return;

    svgPreviewContainer.innerHTML = ''; // Clear existing previews

    // Process SVGs in batches
    const processSvgBatch = (startIdx, batchSize) => {
        const endIdx = Math.min(startIdx + batchSize, collection.length);

        for (let i = startIdx; i < endIdx; i++) {
            const svg = collection[i];
            let previewBtn = document.createElement("button");
            previewBtn.className = "svg-preview";
            previewBtn.innerHTML = svg.data;
            previewBtn.title = svg.name;
            previewBtn.style.width = "3em";
            previewBtn.style.height = "3em";
            previewBtn.style.padding = "0.2em";
            previewBtn.style.margin = "0.2em";
            previewBtn.onclick = () => {
                document.querySelectorAll('.svg-preview').forEach(btn => {
                    btn.style.border = "1px solid #ccc";
                });
                previewBtn.style.border = "2px solid #00f";
                data.settings.svg.currentIndex = i;
            };
            svgPreviewContainer.appendChild(previewBtn);
        }

        if (endIdx < collection.length) {
            setTimeout(() => processSvgBatch(endIdx, batchSize), 0);
        }
    };

    // Start processing SVGs in batches of 10
    processSvgBatch(0, 10);
}


// Replace existing downloadCanvas function in main.js
// Replace existing downloadCanvas function in main.js
async function downloadCanvas() {
    let a = document.createElement("a");
    let exportData = exportCanvas();

    try {
        if (exportData.length > 10 * 1024 * 1024) { // If larger than 10MB, use chunks
            // Show loading dialog
            const loading = ChunkManager.showLoadingDialog('Exporting large canvas...');

            // Create blob in chunks
            const chunks = [];
            for (let i = 0; i < exportData.length; i += ChunkManager.CHUNK_SIZE) {
                chunks.push(exportData.slice(i, i + ChunkManager.CHUNK_SIZE));
                await ChunkManager.updateProgress(loading, (i / exportData.length) * 100);
            }

            const blob = new Blob(chunks, { type: 'text/plain' });
            a.href = URL.createObjectURL(blob);
            a.download = "canvas_export.txt";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            ChunkManager.hideLoadingDialog(loading);
        } else {
            // Original method for smaller files
            let base64 = btoa(unescape(encodeURIComponent(exportData)));
            a.href = "data:text/plain;base64," + base64;
            a.download = "canvas_export.txt";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    } catch (error) {
        console.error('Export error:', error);
        // Fallback method
        const blob = new Blob([exportData], { type: 'text/plain' });
        a.href = URL.createObjectURL(blob);
        a.download = "canvas_export.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }
}

// Update the import file input in the HTML
// Find this line in your HTML and update it:
// <input type="file" id="import_file" accept=".txt" style="margin: 5px 0;"/>
// Change to:
// <input type="file" id="import_file" accept=".json,.txt" style="margin: 5px 0;"/>




// Update clearCanvas function to also clear IndexedDB
function clearCanvas() {
    if (db) {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        store.delete("InfiniteCanvas");
    }
    selectedShapes = [];
    world.shapes = [];
    world.shapeCache = [];
}

/*
// In main.js, add this helper function
function initializePanelToggles() {
    document.querySelectorAll('.panel-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            const panel = e.target.closest('.ui-panel');
            const content = panel.querySelector('.panel-content');
            const isCollapsed = content.classList.toggle('collapsed');
            toggle.classList.toggle('collapsed', isCollapsed);
        });
    });
}
*/


// In main.js, add this helper function
function initializePanelToggles() {
    document.querySelectorAll('.panel-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            const panel = e.target.closest('.ui-panel');
            if (!panel) {
                console.warn('Panel not found');
                return;
            }

            const content = panel.querySelector('.panel-content');
            if (!content) {
                console.warn('Panel content not found');
                return;
            }

            // Only proceed if we have both panel and content
            try {
                // Toggle collapsed class on content and toggle button
                const isCollapsed = content.classList.toggle('collapsed');
                toggle.classList.toggle('collapsed', isCollapsed);

                // Optional: Toggle display for better compatibility
                if (isCollapsed) {
                    content.style.display = 'none';
                } else {
                    content.style.display = 'block';
                }
            } catch (error) {
                console.warn('Error toggling panel:', error);
            }
        });
    });
}

// Initialize the panel toggles when the DOM is ready
initializePanelToggles();



setup();