class Shape
{
    constructor(pos, color, fill, stroke, strokeCol, strokeSize)
    {
        this.pos = pos;
        this.color = color;
        this.strokeColor = strokeCol ? strokeCol : "#00000000";
        this.fill = fill !== undefined ? fill : true;
        this.stroke = stroke !== undefined ? stroke : false;
        this.strokeSize = strokeSize ? strokeSize : 0;
        this.alpha = 1;

        this.shapeType = -1; //used for saving and loading
    }

    // Add this method
    resetScale() {
        this.originalDimensions = null;
        // Reset dimensions based on shape type
        if (this.shapeType === 0 && this.radius && this.originalDimensions?.radius) {
            this.radius = this.originalDimensions.radius;
        } else if ((this.shapeType === 1 || this.shapeType === 4 || this.shapeType === 5) &&
            this.originalDimensions?.w && this.originalDimensions?.h) {
            this.w = this.originalDimensions.w;
            this.h = this.originalDimensions.h;
        }
    }


    move(x, y)
    {
        this.pos = this.pos.add(new Vec2(x, y));
    }

    getScreenPos(pos)
    {
        let s = data.cam.worldToScreenPoint(pos.x, pos.y);
        return {x: s.x.toNumber(), y: s.y.toNumber()};
    }

    getScreenSize(n)
    {
        return n.div(data.cam.range).mul(innerHeight).toNumber();
    }

    getStrokeWidth()
    {
        return new Decimal(this.strokeSize).div(data.cam.range).mul(innerHeight).toNumber();
    }

    intersectsWithScreen(x, y)
    {
        return false;
    }

    isRenderable()
    {

    }

    render(ctx)
    {

    }

    linearGradient(grad, cx, cy, r)
    {
        let cos = Math.cos(parseFloat(grad.rotation) + Math.PI / 2) * r, sin = Math.sin(parseFloat(grad.rotation) + Math.PI / 2) * r;
        let g = ctx.createLinearGradient(cx - cos, cy - sin, cx + cos, cy + sin);
        for (let c of grad.colors)
        {
            g.addColorStop(c.pos, c.color);
        }
        return g;
    }

    radialGradient(grad, cx, cy, r)
    {
        let g = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
        for (let c of grad.colors)
        {
            g.addColorStop(c.pos, c.color);
        }
        return g;
    }

    createGradient(grad)
    {

    }

    getFill()
    {
        if (typeof this.color === "string")
        {
            return this.color;
        }
        else
        {
            return this.createGradient(this.color);
        }
    }

    getStroke()
    {
        if (typeof this.strokeColor === "string")
        {
            return this.strokeColor;
        }
        else
        {
            return this.createGradient(this.strokeColor);
        }
    }
}

class ShapeCircle extends Shape
{
    constructor(pos, color, r, fill, stroke, strokeCol, strokeSize, alpha)
    {
        super(pos, color, fill, stroke, strokeCol, strokeSize);
        this.radius = r;
        this.shapeType = 0;
        this.alpha = alpha !== undefined ? alpha : 1;
        this.originalDimensions = null;
    }

    // Add this method
    resetScale() {
        this.originalDimensions = null;
    }

// ShapeCircle.isRenderable
    isRenderable() {
        let d = this.radius.div(data.cam.range);
        if (!d.gte(1e-3) || !d.lte(1e3)) return false; // Changed from 1e-6 to 1e-3

        const screenPos = this.getScreenPos(this.pos);
        const margin = this.getScreenSize(this.radius);

        return (
            screenPos.x + margin >= 0 &&
            screenPos.x - margin <= canvas.width &&
            screenPos.y + margin >= 0 &&
            screenPos.y - margin <= canvas.height
        );
    }


    intersectsWithScreen(x, y)
    {
        let c = this.getScreenPos(this.pos);
        let r = new Decimal(this.getScreenSize(this.radius));

        let mag = new Vec2(c.x, c.y).sub(new Vec2(x, y)).mag();

        return mag.lt(r);
    }

    createGradient(grad)
    {
        let screen = this.getScreenPos(this.pos);
        let r = this.getScreenSize(this.radius);

        return grad.type === 0 ? this.linearGradient(grad, screen.x, screen.y, r) : this.radialGradient(grad, screen.x, screen.y, r);
    }

    render(ctx)
    {
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.getFill();
        ctx.strokeStyle = this.getStroke();
        ctx.lineWidth = this.getStrokeWidth();

        let screen = this.getScreenPos(this.pos);
        let r = this.getScreenSize(this.radius);
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
        ctx.closePath();
        if (this.fill)
        {
            ctx.fill();
        }
        if (this.stroke)
        {
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }
}

class ShapeRect extends Shape
{
    constructor(pos, color, w, h, fill, stroke, strokeCol, strokeSize, alpha)
    {
        super(pos, color, fill, stroke, strokeCol, strokeSize);
        this.w = w;
        this.h = h;
        this.shapeType = 1;
        this.alpha = alpha !== undefined ? alpha : 1;
    }

    isRenderable() {
        let d = (this.w.add(this.h).div(2)).div(data.cam.range);
        if (!d.gte(1e-3) || !d.lte(1e3)) return false; // Changed from 1e-6 to 1e-3

        const screenPos = this.getScreenPos(this.pos);
        const w = this.getScreenSize(this.w);
        const h = this.getScreenSize(this.h);

        return (
            screenPos.x + w/2 >= 0 &&
            screenPos.x - w/2 <= canvas.width &&
            screenPos.y + h/2 >= 0 &&
            screenPos.y - h/2 <= canvas.height
        );
    }



    intersectsWithScreen(x, y)
    {
        let c = this.getScreenPos(this.pos);
        let w = this.getScreenSize(this.w);
        let h = this.getScreenSize(this.h);

        return x > c.x - w / 2 && x < c.x + w / 2 &&
            y > c.y - h / 2 && y < c.y + h / 2;
    }

    createGradient(grad)
    {
        let screen = this.getScreenPos(this.pos);
        let w = this.getScreenSize(this.w), h = this.getScreenSize(this.h);

        return grad.type === 0 ? this.linearGradient(grad, screen.x, screen.y, Math.max(w, h) / 2) : this.radialGradient(grad, screen.x, screen.y, Math.max(w, h) / Math.sqrt(2));
    }

    render(ctx)
    {
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.getFill();
        ctx.strokeStyle = this.getStroke();
        ctx.lineWidth = this.getStrokeWidth();

        let screen = this.getScreenPos(this.pos);
        let w = this.getScreenSize(this.w);
        let h = this.getScreenSize(this.h);
        if (this.fill)
        {
            ctx.fillRect(screen.x - w / 2, screen.y - h / 2, w, h);
        }
        if (this.stroke)
        {
            ctx.strokeRect(screen.x - w / 2, screen.y - h / 2, w, h);
        }
        ctx.globalAlpha = 1;
    }
}

class ShapePolygon extends Shape
{
    constructor(points, color, fill, stroke, strokeCol, strokeSize, isClosed, smooth, alpha)
    {
        super(points[0], color, fill, stroke, strokeCol, strokeSize);
        this.points = points;
        this.isClosed = isClosed ? isClosed : false;
        this.shapeType = 2;
        this.geometryData = {}; //cached data
        this.alpha = alpha !== undefined ? alpha : 1;
        this.isSmooth = smooth;
    }

    cacheGeometryData()
    {
        let sum = Vec2.ZERO;
        for (let p of this.points)
        {
            sum = sum.add(p);
        }
        sum = sum.div(this.points.length);

        let mags = this.points.slice().map(point => point.sub(sum).mag());
        let dist = mags.sort((p1, p2) => p2.sub(p1).gt(0) ? 1 : -1)[0];
        let distMin = mags.sort((p1, p2) => p2.sub(p1).gt(0) ? -1 : 1)[0];

        this.geometryData = {center: sum, sizeMin: distMin, size: dist};
    }

    move(x, y)
    {
        for (let i = 0; i < this.points.length; i++)
        {
            this.points[i] = this.points[i].add(new Vec2(x, y));
        }
    }

    isRenderable() {
        if (Object.keys(this.geometryData).length === 0) return true;

        let d = this.geometryData.size.div(data.cam.range);
        let d2 = this.geometryData.sizeMin.div(data.cam.range);
        if (!d.gte(1e-3) || !d2.lte(1e3)) return false; // Changed from 1e-6 to 1e-3

        const screenPos = this.getScreenPos(this.geometryData.center);
        const size = this.getScreenSize(this.geometryData.size);

        return (
            screenPos.x + size >= 0 &&
            screenPos.x - size <= canvas.width &&
            screenPos.y + size >= 0 &&
            screenPos.y - size <= canvas.height
        );
    }

    intersectsWithScreen(x, y)
    {
        let path = new Path2D();
        for (let i = 0; i < this.points.length; i++)
        {
            let s = data.cam.worldToScreenPoint(this.points[i].x, this.points[i].y);
            let x = s.x.toNumber(), y = s.y.toNumber();
            if (i === 0)
            {
                path.moveTo(x, y);
            }
            else
            {
                path.lineTo(x, y);
            }
        }
        return ctx.isPointInPath(path, x, y);
    }

    createGradient(grad)
    {
        let screen = this.getScreenPos(this.geometryData.center);
        let r = this.getScreenSize(this.geometryData.size);

        return grad.type === 0 ? this.linearGradient(grad, screen.y, screen.y, r) : this.radialGradient(grad, screen.x, screen.y, r);
    }

    render(ctx)
    {
        if(typeof this.color === "object" || typeof this.strokeColor === "object")
        {
            this.cacheGeometryData();
        }

        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.getFill();
        ctx.strokeStyle = this.getStroke();

        ctx.lineWidth = this.getStrokeWidth();
        ctx.beginPath();
        for (let i = 0; i < (this.isSmooth ? this.points.length - 1 : this.points.length); i += this.isSmooth ? 2 : 1)
        {
            let point = this.points[i];
            let s = this.getScreenPos(point);
            let sc1 = this.isSmooth ? this.getScreenPos(this.points[i + 1]) : null;
            if (i === 0)
            {
                ctx.moveTo(s.x, s.y);
            }
            else
            {
                if (this.isSmooth)
                {
                    if (sc1 === null)
                    {
                        ctx.lineTo(s.x, s.y);
                    }
                    else
                    {
                        ctx.quadraticCurveTo(s.x, s.y, sc1.x, sc1.y);
                    }
                }
                else
                {
                    ctx.lineTo(s.x, s.y);
                }
            }
        }
        if (this.isClosed)
        {
            ctx.closePath();
        }
        if (this.stroke)
        {
            ctx.stroke();
        }
        if (this.fill)
        {
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
}

class ShapeText extends Shape
{
    constructor(pos, color, fill, stroke, strokeCol, strokeSize, text, size, font, halign, valign, alpha)
    {
        super(pos, color, fill, stroke, strokeCol, strokeSize);
        this.text = text;
        this.size = size;
        this.shapeType = 3;
        this.font = font ? font : "Montserrat";
        this.halign = halign ? halign : "left";
        this.valign = valign ? valign : "top";
        this.alpha = alpha !== undefined ? alpha : 1;
    }

    isRenderable() {
        let d = (this.w.add(this.h)).div(2).div(data.cam.range);
        if (!d.gte(1e-3) || !d.lte(1e3)) return false; // Changed from 1e-6 to 1e-3

        const screenPos = this.getScreenPos(this.pos);
        const w = this.getScreenSize(this.w);
        const h = this.getScreenSize(this.h);

        return (
            screenPos.x + w/2 >= 0 &&
            screenPos.x - w/2 <= canvas.width &&
            screenPos.y + h/2 >= 0 &&
            screenPos.y - h/2 <= canvas.height
        );
    }

    intersectsWithScreen(x, y)
    {
        let oldFont = ctx.font;
        ctx.font = this.getScreenSize(this.size) + "px " + this.font + ",Montserrat";
        let c = this.getScreenPos(this.pos);
        let w = ctx.measureText(this.text).width;
        let h = this.getScreenSize(this.size);
        let xOff = this.halign === "left" ? 0 : (this.halign === "center" ? -w * 0.5 : -w);
        let yOff = this.valign === "top" ? 0 : (this.valign === "middle" ? -h * 0.5 : -h);

        ctx.font = oldFont;

        return x > c.x + xOff && x < c.x + xOff + w &&
            y > c.y + yOff && y < c.y + yOff + h;
    }

    createGradient(grad)
    {
        let screen = this.getScreenPos(this.pos);
        let h = this.getScreenSize(this.size);
        let w = ctx.measureText(this.text).width;
        let xOff = this.halign === "left" ? 0 : (this.halign === "center" ? -w * 0.5 : -w);
        let yOff = this.valign === "top" ? 0 : (this.valign === "middle" ? -h * 0.5 : -h);
        let x = screen.x + xOff, y = screen.y + yOff;

        return grad.type === 0 ? this.linearGradient(grad, x + w / 2, y + h * 0.5, w / 2) : this.radialGradient(grad, x + w / 2, y + h * 0.5, w / 2);
    }

    render(ctx)
    {
        ctx.globalAlpha = this.alpha;
        ctx.font = (this.getScreenSize(this.size)) + "px " + this.font + (this.font !== "Montserrat" ? ",Montserrat" : "");
        ctx.fillStyle = this.getFill();
        ctx.strokeStyle = this.getStroke();
        ctx.lineWidth = this.getStrokeWidth();
        ctx.textAlign = this.halign;
        ctx.textBaseline = this.valign;

        let s = this.getScreenPos(this.pos);
        if (this.fill)
        {
            ctx.fillText(this.text, s.x, s.y);
        }
        if (this.stroke)
        {
            ctx.strokeText(this.text, s.x, s.y);
        }
        ctx.globalAlpha = 1;
    }
}

class ShapeImage extends Shape
{
    constructor(pos, imageIndex, w, h, rotation, filter, alpha)
    {
        super(pos, "#ffffff", true, false, "#ffffff", new Decimal(0));
        this.w = w;
        this.h = h;
        this.rotation = rotation;
        this.shapeType = 4;
        this.imageIndex = imageIndex;
        this.image = shapeImages[this.imageIndex];
        this.blur = filter && filter.blur ? filter.blur : 0;
        this.hue = filter && filter.hue ? filter.hue : 0;
        this.brightness = filter && filter.brightness ? filter.brightness : 100;
        this.saturation = filter && filter.saturation ? filter.saturation : 100;
        this.contrast = filter && filter.contrast ? filter.contrast : 100;
        this.alpha = alpha !== undefined ? alpha : 1;
    }

    isRenderable() {
        let d = (this.w.add(this.h)).div(2).div(data.cam.range);
        if (!d.gte(1e-6) || !d.lte(1e3)) return false;

        const screenPos = this.getScreenPos(this.pos);
        const w = this.getScreenSize(this.w);
        const h = this.getScreenSize(this.h);

        return (
            screenPos.x + w/2 >= 0 &&
            screenPos.x - w/2 <= canvas.width &&
            screenPos.y + h/2 >= 0 &&
            screenPos.y - h/2 <= canvas.height
        );
    }


    intersectsWithScreen(x, y)
    {
        let c = this.getScreenPos(this.pos);
        let w = this.getScreenSize(this.w),
            h = this.getScreenSize(this.h);

        return x > c.x - w / 2 && x < c.x + w / 2 &&
            y > c.y - h / 2 && y < c.y + h / 2;
    }

    createGradient(grad)
    {
        return "#ffffff"; //images cant be filled
    }

    render(ctx)
    {
        ctx.globalAlpha = this.alpha;
        let blur = Decimal.max(this.w, this.h).mul(this.blur).div(data.cam.range).mul(100).toNumber();
        if (blur !== 0 || parseFloat(this.hue) !== 0 || this.brightness !== 0 || this.contrast !== 0 || this.saturation !== 0)
        {
            ctx.filter = "blur(" + blur + "px) hue-rotate(" + this.hue + "deg) brightness(" + this.brightness + "%) contrast(" + this.contrast + "%) saturate(" + this.saturation + "%)";
        }
        else
        {
            ctx.filter = "none";
        }
        let s = this.getScreenPos(this.pos);
        let x = s.x, y = s.y;
        let w = this.getScreenSize(this.w),
            h = this.getScreenSize(this.h);

        Utils.drawRotatedImage(this.rotation, this.image, x - w / 2, y - h / 2, w, h);
        ctx.filter = "none";
        ctx.globalAlpha = 1;
    }
}

// Update the ShapeSVG class
class ShapeSVG extends Shape {
    constructor(pos, svgIndex, w, h, rotation, alpha) {
        super(pos, "#ffffff", true, false, "#ffffff", new Decimal(0));
        this.w = w;
        this.h = h;
        this.rotation = rotation;
        this.shapeType = 5;
        this.svgIndex = svgIndex;
        this.svgData = svgCollection[svgIndex]?.data || '';
        this.alpha = alpha !== undefined ? alpha : 1;
        this.image = new Image();
        this.aspectRatio = 1;
        this.cachedSVGElement = null; // Add cache for parsed SVG
        this.updateImage();
        this.calculateAspectRatio();
    }

    // Add method to parse and cache SVG dimensions
    parseSVGDimensions() {
        if (!this.cachedSVGElement && this.svgData) {
            try {
                const parser = new DOMParser();
                this.cachedSVGElement = parser.parseFromString(this.svgData, 'image/svg+xml').documentElement;
            } catch (e) {
                console.error('Error parsing SVG:', e);
            }
        }
        return this.cachedSVGElement;
    }

    calculateAspectRatio() {
        const svg = this.parseSVGDimensions();
        if (svg) {
            const viewBox = svg.getAttribute('viewBox');
            let width, height;

            if (viewBox) {
                const [, , vbWidth, vbHeight] = viewBox.split(' ').map(Number);
                width = vbWidth;
                height = vbHeight;
            } else {
                width = parseFloat(svg.getAttribute('width')) || 100;
                height = parseFloat(svg.getAttribute('height')) || 100;
            }

            this.aspectRatio = width / height;
            this.maintainAspectRatio();
        }
    }

    maintainAspectRatio() {
        if (this.w && this.aspectRatio) {
            // Adjust height based on width to maintain aspect ratio
            this.h = this.w.div(this.aspectRatio);
        }
    }

    // Override the existing move method
    move(x, y) {
        super.move(x, y);
        this.maintainAspectRatio();
    }


// Add after ShapeSVG constructor in shape.js
    updateDimensions() {
        // Create temporary SVG element to get dimensions
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = this.svgData;
        const svgElement = tempDiv.querySelector('svg');

        if (svgElement) {
            // Get viewBox or width/height
            const viewBox = svgElement.getAttribute('viewBox');
            let width = svgElement.getAttribute('width');
            let height = svgElement.getAttribute('height');

            if (viewBox) {
                const [, , vbWidth, vbHeight] = viewBox.split(' ');
                width = width || vbWidth;
                height = height || vbHeight;
            }

            // Calculate aspect ratio
            const aspectRatio = width / height;

            // Set proportional dimensions
            if (this.w > this.h) {
                this.h = this.w.div(aspectRatio);
            } else {
                this.w = this.h.mul(aspectRatio);
            }
        }
    }

    // Update image only when needed
    updateImage() {
        if (!this.image.src && this.svgData) {
            try {
                const encodedData = encodeURIComponent(this.svgData)
                    .replace(/'/g, '%27')
                    .replace(/"/g, '%22');
                this.image.src = `data:image/svg+xml;charset=utf-8,${encodedData}`;
            } catch (e) {
                console.error('Error setting SVG src:', e);
            }
        }
    }

// In ShapeSVG class, update the render method
    render(ctx) {
        if (!this.image || !this.image.complete) {
            // If image isn't loaded yet, try updating it
            this.updateImage();

            // Draw a placeholder rectangle while loading
            ctx.globalAlpha = this.alpha;
            ctx.fillStyle = "#f0f0f0";
            ctx.strokeStyle = "#cccccc";
            ctx.lineWidth = 1;

            let s = this.getScreenPos(this.pos);
            let w = this.getScreenSize(this.w),
                h = this.getScreenSize(this.h);

            ctx.fillRect(s.x - w/2, s.y - h/2, w, h);
            ctx.strokeRect(s.x - w/2, s.y - h/2, w, h);
            ctx.globalAlpha = 1;
            return;
        }

        try {
            ctx.globalAlpha = this.alpha;
            let s = this.getScreenPos(this.pos);
            let x = s.x, y = s.y;
            let w = this.getScreenSize(this.w),
                h = this.getScreenSize(this.h);

            Utils.drawRotatedImage(this.rotation, this.image, x - w/2, y - h/2, w, h);
            ctx.globalAlpha = 1;
        } catch (error) {
            console.warn('Error rendering SVG:', error);
            // Retry loading the image
            this.updateImage();
        }
    }

// Also update the updateImage method
    updateImage() {
        try {
            if (this.svgData) {
                // Create a new Image instance each time
                const newImage = new Image();

                // Set up load handler before setting src
                newImage.onload = () => {
                    this.image = newImage;
                };

                newImage.onerror = (error) => {
                    console.error('Error loading SVG image:', error);
                };

                // Properly encode SVG data
                const encodedData = encodeURIComponent(this.svgData)
                    .replace(/'/g, '%27')
                    .replace(/"/g, '%22');

                newImage.src = `data:image/svg+xml;charset=utf-8,${encodedData}`;
            }
        } catch (error) {
            console.error('Error updating SVG image:', error);
            // Try fallback method
            try {
                const blob = new Blob([this.svgData], {type: 'image/svg+xml'});
                const url = URL.createObjectURL(blob);
                this.image.src = url;

                // Clean up the URL after load
                this.image.onload = () => {
                    URL.revokeObjectURL(url);
                };
            } catch (fallbackError) {
                console.error('Fallback error:', fallbackError);
            }
        }
    }

    isRenderable() {
        let d = (this.w.add(this.h)).div(2).div(data.cam.range);
        if (!d.gte(1e-6) || !d.lte(1e3)) return false;

        const screenPos = this.getScreenPos(this.pos);
        const w = this.getScreenSize(this.w);
        const h = this.getScreenSize(this.h);

        return (
            screenPos.x + w/2 >= 0 &&
            screenPos.x - w/2 <= canvas.width &&
            screenPos.y + h/2 >= 0 &&
            screenPos.y - h/2 <= canvas.height
        );
    }


    intersectsWithScreen(x, y) {
        let c = this.getScreenPos(this.pos);
        let w = this.getScreenSize(this.w),
            h = this.getScreenSize(this.h);

        return x > c.x - w / 2 && x < c.x + w / 2 &&
            y > c.y - h / 2 && y < c.y + h / 2;
    }


}

// At the end of shape.js, after all class definitions
function filterShapes() {
    for (let i = 0; i < world.shapeCache.length; i++) {
        if (world.shapeCache[i] !== undefined && world.shapeCache[i].isRenderable()) {
            world.shapes[i] = world.shapeCache[i];
            world.shapeCache[i] = undefined;
        }
    }
    for (let i = 0; i < world.shapes.length; i++) {
        if (world.shapes[i] !== undefined && !world.shapes[i].isRenderable()) {
            world.shapeCache[i] = world.shapes[i];
            world.shapes[i] = undefined;
        }
    }
}