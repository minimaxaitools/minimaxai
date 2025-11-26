class Camera {
    constructor(pos, range) {
        this.pos = new Vec2(
            new Decimal(pos.x.toString()),
            new Decimal(pos.y.toString())
        );
        this.range = new Decimal(range);
        this.targetRange = new Decimal(this.range.toString());
        this.targetPos = new Vec2(
            new Decimal(pos.x.toString()),
            new Decimal(pos.y.toString())
        );
        this.smoothSpeed = 5;
        this.zoomSmoothSpeed = 8;
        this.minRange = new Decimal('1e-900000000');
        this.maxRange = new Decimal('1e900000000');
        this.initialize();
    }
    initialize() {
        this.reset();
    }

    reset() {
        this.targetRange = new Decimal(5);
        this.range = this.targetRange;
        this.pos = Vec2.ZERO;
        this.targetPos = Vec2.ZERO;
        if (typeof filterShapes === 'function') {
            filterShapes();
        }
    }

    tick(delta) {
        // Smooth position movement
        let dx = this.targetPos.x.sub(this.pos.x).mul(delta * this.smoothSpeed);
        let dy = this.targetPos.y.sub(this.pos.y).mul(delta * this.smoothSpeed);
        this.pos = this.pos.add(new Vec2(dx, dy));

        // Smooth range/zoom movement with easing
        let rangeDiff = this.targetRange.div(this.range).log();
        this.range = this.range.mul(Decimal.exp(rangeDiff.mul(delta * this.zoomSmoothSpeed)));

        // Clamp range to prevent extreme values
        if(this.range.lt(this.minRange)) this.range = this.minRange;
        if(this.range.gt(this.maxRange)) this.range = this.maxRange;
    }

    translate(x, y) {
        this.targetPos = this.targetPos.add(x, y);
    }

    setTargetPos(pos) {
        this.targetPos = new Vec2(
            new Decimal(pos.x.toString()),
            new Decimal(pos.y.toString())
        );
    }

    setTargetRange(range) {
        this.targetRange = range;

        // Clamp target range
        if(this.targetRange.lt(this.minRange)) this.targetRange = this.minRange;
        if(this.targetRange.gt(this.maxRange)) this.targetRange = this.maxRange;
    }

    worldToScreenPoint(x, y) {
        const worldX = new Decimal(x.toString());
        const worldY = new Decimal(y.toString());

        const relX = worldX.minus(this.pos.x);
        const relY = worldY.minus(this.pos.y);

        const screenX = relX.div(this.range).times(innerHeight).plus(innerWidth / 2);
        const screenY = relY.div(this.range).times(innerHeight).plus(innerHeight / 2);

        return new Vec2(screenX, screenY);
    }

    screenToWorldPoint(x, y) {
        const screenX = new Decimal(x.toString()).minus(innerWidth / 2);
        const screenY = new Decimal(y.toString()).minus(innerHeight / 2);

        const worldX = screenX.div(innerHeight).times(this.range).plus(this.pos.x);
        const worldY = screenY.div(innerHeight).times(this.range).plus(this.pos.y);

        return new Vec2(worldX, worldY);
    }

    smoothZoom(targetRange, center) {
        const worldCenter = this.screenToWorldPoint(center.x, center.y);
        const zoomRatio = targetRange.div(this.range);

        const newPos = new Vec2(
            worldCenter.x.minus(
                worldCenter.x.minus(this.pos.x).times(zoomRatio)
            ),
            worldCenter.y.minus(
                worldCenter.y.minus(this.pos.y).times(zoomRatio)
            )
        );

        this.setTargetPos(newPos);
        this.setTargetRange(targetRange);
    }
}