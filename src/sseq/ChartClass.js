let utils = require("./utils.js");
let ChartShape = require("./ChartShape.js").ChartShape;

class ChartClass {
    constructor(sseq, kwargs) {
        this._sseq = sseq;
        this._valid = true;
        this._x_offset = 0;
        this._y_offset = 0;

        utils.assign_fields(this, kwargs, [
            { "type" : "mandatory", "field" : "x" },
            { "type" : "mandatory", "field" : "y" },
            { "type" : "optional", "field" : "idx" },
            { "type" : "default",   "field" : "name",             "default" : "" },
            { "type" : "default",   "field" : "transition_pages", "default" : [] },
            { "type" : "mandatory", "field" : "node_list" },
            { "type" : "default",   "field" : "transition_pages", "default" : [] },
            { "type" : "default",   "field" : "visible",          "default" : true },
            { "type" : "optional",  "field" : "xoffset" },
            { "type" : "optional",  "field" : "yoffset" },
            { "type" : "optional",  "field" : "tooltip" },
        ]);
    }

    setPosition(x, y, size) {
        if(isNaN(x) || isNaN(y) || isNaN(size)){
            console.error(this, x, y, size);
            throw "class.setPosition called with bad argument.";
        }
        this._canvas_x = x;
        this._canvas_y = y;
        this._size = size;
    }

    draw(context) {
        let node = this._node;
        context.save();

        if(node.opacity) {
            context.opacity = node.opacity;
        }

        if(node.color) {
            context.fillStyle = node.color;
            context.strokeStyle = node.color;
        }

        if(node.stroke && node.stroke !== true) {
            context.strokeStyle = node.stroke;
        }

        if(node.fill && node.fill !== true) {
            context.fillStyle = node.fill;
        }

        if(node.highlight) {
            if(node.hcolor) {
                context.fillStyle = node.hcolor;
                context.strokeStyle = node.hcolor;
            }

            if(node.hstroke) {
                context.strokeStyle = node.hstroke;
            }

            if(node.hfill) {
                context.fillStyle = node.hfill;
            }
        }
        context.lineWidth = Math.min(3, node.size * node.scale / 20); // Magic number
        this._path = ChartShape.draw(node.shape, context, this._canvas_x, this._canvas_y, this._size * node.scale, node);
        context.restore();
    }

    _drawOnPageQ(page){
        let idx = this._getPageIndex(page);
        return this.node_list[idx] != null && this.visible;
    }

    _getPageIndex(page){
        if( page === undefined ) {
            return this.node_list.length - 1;
        } else if( page === this._last_page ) {
            return this._last_page_idx;
        }
        let page_idx = this.transition_pages.length;
        for(let i = 0; i < this.transition_pages.length; i++){
            if(this.transition_pages[i] >= page){
                page_idx = i;
                break;
            }
        }
        this._last_page = page;
        this._last_page_idx = page_idx;
        return page_idx;
    }

    getNameCoord(){
        let tooltip = "";
        if (this.name !== "") {
            tooltip = `\\(\\large ${this.name}\\)&nbsp;&mdash;&nbsp;`;
        }
        tooltip += `(${this.x}, ${this.y})`;
        return tooltip;
    }

    getXOffset() {
        return this._x_offset;
    }

    getYOffset() {
        return this._y_offset;
    }

    toJSON() {
        return utils.public_fields(this);
    }
}

exports.ChartClass = ChartClass;