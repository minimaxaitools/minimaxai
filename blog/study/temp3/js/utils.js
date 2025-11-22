class Utils {
    static vmax() {
        return Math.max(window.innerWidth, window.innerHeight);
    }

    static setFont(size, fonts) {
        if (typeof fonts === "string") {
            return `${this.vmax() * size}px ${fonts}`;
        } else {
            return `${this.vmax() * size}px ${fonts.join(",")}`;
        }
    }

    static formatNumber(d) {
        d = new Decimal(d);
        if(d.eq(0)) return "0";
        if(d.lt(0.05)) {
            return "1 / " + this.formatNumber(new Decimal(1).div(d));
        }
        if (d.lt(1e3)) {
            return d.toFixed(2);
        }
        if (d.lt(1e13)) {
            return d.toNumber().toLocaleString("en-us", {minimumFractionDigits: 0, maximumFractionDigits: 0});
        }
        return d.toExponential(2);
    }

    static formatDistance(d) {
        d = new Decimal(d);

        // Expanded SI prefixes for very large and small numbers
        let pBig = ["", "Kilo", "Mega", "Giga", "Tera", "Peta", "Exa", "Zetta", "Yotta", "Xona", "Nova", "MegaNova", "GigaNova"];
        let pSmall = ["", "milli", "micro", "nano", "pico", "femto", "atto", "zepto", "yocto", "ronto", "quecto", "hecto", "picohecto", "nanohecto"];

        // Maximum and minimum representable values using the expanded prefixes
        let maxSI = Decimal.pow(10, 3 * pBig.length - 3), minSI = Decimal.pow(10, -3 * pSmall.length + 3);

        if (d.gt(1000) && d.lt(maxSI)) {
            // Large values (use appropriate pBig prefix)
            return Decimal.pow(10, Decimal.log10(d) % 3).toFixed(2) + " " + pBig[Math.floor(d.e / 3)] + "meters";
        }
        else if (d.lt(1) && d.gt(minSI)) {
            // Small values (use appropriate pSmall prefix)
            return Decimal.pow(10, 3 + (Decimal.log10(d) % 3)).toFixed(2) + " " + pSmall[Math.floor(-Decimal.log(d, 1000)) + 1] + "meters";
        }
        else if(d.gte(maxSI)) {
            // Very large values (above the largest SI prefix)
            return this.formatNumber(d.div(maxSI)) + " " + pBig[pBig.length - 1] + "meters";
        }
        else if(d.lte(minSI)) {
            // Very small values (below the smallest SI prefix)
            return this.formatNumber(d.div(minSI)) + " " + pSmall[pSmall.length - 1] + "meters";
        }
        return d.toFixed(2) + " Meters";
    }

    static drawRotatedImage(rotation, image, sx, sy, sw, sh) {
        const ctx = document.querySelector('canvas').getContext('2d');
        ctx.translate(sx + sw / 2, sy + sh / 2);
        ctx.rotate(rotation);
        ctx.drawImage(image, 0 - sw / 2, 0 - sh / 2, sw, sh);
        ctx.rotate(-rotation);
        ctx.translate(-sx - sw / 2, -sy - sh / 2);
    }

    static PrecisionManager = {
        serialize(value) {
            if (value instanceof Decimal) {
                return { type: 'decimal', value: value.toString() };
            }
            if (value instanceof Vec2) {
                return {
                    type: 'vec2',
                    x: value.x.toString(),
                    y: value.y.toString()
                };
            }
            if (typeof value === 'object' && value !== null) {
                const result = {};
                for (const key in value) {
                    result[key] = this.serialize(value[key]);
                }
                return result;
            }
            return value;
        },

        deserialize(value) {
            if (!value) return value;

            if (value.type === 'decimal') {
                return new Decimal(value.value);
            }
            if (value.type === 'vec2') {
                return new Vec2(
                    new Decimal(value.x),
                    new Decimal(value.y)
                );
            }
            if (typeof value === 'object') {
                const result = {};
                for (const key in value) {
                    result[key] = this.deserialize(value[key]);
                }
                return result;
            }
            return value;
        }
    }
}
