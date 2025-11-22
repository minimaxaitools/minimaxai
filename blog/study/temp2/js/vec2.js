class Vec2 {
    constructor(x, y) {
        // Convert inputs to Decimal strings for maximum precision
        this.x = x instanceof Decimal ? x : new Decimal(x.toString());
        this.y = y instanceof Decimal ? y : new Decimal(y.toString());
    }

    static get ZERO() {
        return new Vec2('0', '0');
    }

    static get ONE() {
        return new Vec2('1', '1');
    }

    add(x, y) {
        if (arguments.length === 2) {
            return new Vec2(
                this.x.plus(x.toString()),
                this.y.plus(y.toString())
            );
        }
        return new Vec2(
            this.x.plus(x.x.toString()),
            this.y.plus(x.y.toString())
        );
    }

    sub(x, y) {
        if (arguments.length === 2) {
            return new Vec2(
                this.x.minus(x.toString()),
                this.y.minus(y.toString())
            );
        }
        return new Vec2(
            this.x.minus(x.x.toString()),
            this.y.minus(x.y.toString())
        );
    }

    mul(x, y) {
        if (arguments.length === 1) {
            return new Vec2(
                this.x.times(x.toString()),
                this.y.times(x.toString())
            );
        }
        return new Vec2(
            this.x.times(x.toString()),
            this.y.times(y.toString())
        );
    }

    div(x, y) {
        if (arguments.length === 1) {
            const divisor = x.toString();
            return new Vec2(
                this.x.div(divisor),
                this.y.div(divisor)
            );
        }
        return new Vec2(
            this.x.div(x.toString()),
            this.y.div(y.toString())
        );
    }

    mag() {
        return Decimal.sqrt(
            this.x.pow(2).plus(this.y.pow(2))
        );
    }

    toString() {
        return `(${this.x.toString()},${this.y.toString()})`;
    }

    toFixed(x) {
        return `(${this.x.toFixed(x)},${this.y.toFixed(x)})`;
    }

    toExponential(n) {
        return `(${this.x.toExponential(n)},${this.y.toExponential(n)})`;
    }

    // Add serialization methods
    serialize() {
        return {
            x: this.x.toString(),
            y: this.y.toString()
        };
    }

// Add this to Vec2 class
    clone() {
        return new Vec2(
            new Decimal(this.x.toString()),
            new Decimal(this.y.toString())
        );
    }

    static deserialize(data) {
        return new Vec2(
            new Decimal(data.x),
            new Decimal(data.y)
        );
    }
}