let StringifyingMap = require("../StringifyingMap.js");
let ChartNode = require("./ChartNode.js").ChartNode;
let ChartClass = require("./ChartClass.js").ChartClass;
let ChartEdgeJS = require("./ChartEdge.js");
let ChartEdge = ChartEdgeJS.ChartEdge;
let ChartDifferential = ChartEdgeJS.ChartDifferential;
let ChartStructline = ChartEdgeJS.ChartStructline;
let ChartExtension = ChartEdgeJS.ChartExtension;
let EventEmitter = require('events');

/**
 * Adds an entry to a map keys ==> lists.
 * If the current key isn't present in the map, add an empty list first.
 * @param dictionary The dictionary of lists to add the entry to
 * @param key
 * @param value
 */
function add_to_dictionary_of_lists(dictionary, key,value){
    if(!dictionary.has(key)){
        dictionary.set(key, []);
    }
    dictionary.get(key).push(value);
}

function filter_dictionary_of_lists(dictionary, key,callback){
    if(!dictionary.has(key)){
        dictionary.set(key, []);
    }
    dictionary.set(dictionary.get(key).filter(callback));
}

class SpectralSequenceChart extends EventEmitter {
    constructor() {
        super();
        this.offset_size = 5;
        this.min_class_size = 1;
        this.max_class_size = 3;
        this.class_scale = 10;
        this.classes_by_degree = new StringifyingMap();
        this.classes = [];
        this.edges = [];
        this.nodes = [];

        this.page_list = [2];
        this.min_page_idx = 0;

        this.initialxRange = [0, 10];
        this.initialyRange = [0, 10];
    }

    static from_JSON(json) {
        let chart = new SpectralSequenceChart();

        if(json.nodes === undefined) {
            console.error("json.nodes is undefined.");
            throw "Error!"
        }

        if(json.classes === undefined) {
            console.error("json.classes is undefined.");
            throw "Error!"
        }

        if(json.edges === undefined) {
            console.error("json.edges is undefined.");
            throw "Error!"
        }        

        json.nodes = json.nodes.map(n => new ChartNode(n));
        json.classes = json.classes.map(c => chart.add_class(c));
        json.edges = json.edges.map(e => chart.add_edge(e));
        Object.assign(chart, json);

        return chart;
    }

    add_class(kwargs) {
        let c = new ChartClass(this, kwargs);
        let degree = [c.x, c.y];
        this.classes.push(c);
        filter_dictionary_of_lists(this.classes_by_degree, degree, c => c._valid);
        if(c.idx === undefined){
            c.idx = this.classes_by_degree.get(degree).length;
        }
        add_to_dictionary_of_lists(this.classes_by_degree, degree, c);
        this.recalculate_offsets(degree);
        this.emit("class-added", c);
        this.emit("update");
        return c;
    }

    add_edge(kwargs) {
        switch(kwargs["type"]) {
            case "differential":
                return this.add_differential(kwargs);
            case "structline":
                return this.add_structline(kwargs);
            case "extension":
                return this.add_extension(kwargs);
            default:
                throw "Error!!!";
        }
    }

    add_differential(kwargs) {
        let e = new ChartDifferential(kwargs);
        this.edges.push(e);
        this.emit("differential-added", e);
        this.emit("edge-added", e);
        this.emit("update");
        return e;
    }

    add_structline(kwargs) {
        let e = new ChartStructline(kwargs);
        this.edges.push(e);
        this.emit("structline-added", e);
        this.emit("edge-added", e);
        this.emit("update");
        return e;
    }

    add_extension(kwargs) {
        let e = new ChartExtension(kwargs);
        this.edges.push(e);
        this.emit("extension-added", e);
        this.emit("edge-added", e);
        this.emit("update");
        return e;    
    }

    recalculate_offsets(degree) {
        let classes = this.classes_by_degree.get(degree);
        let num_classes = classes.length;
        for(let c of classes) {
            let idx = c.idx;
            let out = (idx - (num_classes - 1) / 2) * this.offset_size;
            if (isNaN(out)) {
                console.log("Invalid offset for class:",c);
                return 0;
            }
            return out; 
        }
    }

    static _classInRangeQ(c, xmin, xmax, ymin, ymax) {
        return xmin <= c.x && c.x <= xmax && ymin <= c.y && c.y <= ymax;
    }

    static _drawClassOnPageQ(c, page) {
        if (c._drawOnPageQ) {
            return c._drawOnPageQ(page);
        } else {
            return ChartClass._drawOnPageQ(c, page);
        }
    }

    static _drawEdgeOnPageQ(edge, pageRange) {
        if (edge._drawOnPageQ) {
            return edge._drawOnPageQ(pageRange);
        } else {
            switch (edge.type) {
                case "differential":
                    return ChartDifferential._drawOnPageQ(edge, pageRange);
                case "extension":
                    return ChartExtension._drawOnPageQ(edge, pageRange);
                case "structline":
                    return ChartStructline._drawOnPageQ(edge, pageRange);
                default:
                    return ChartEdge._drawOnPageQ(edge, pageRange);

            }
        }
    }
    
    /**
     * Gets the node to be drawn for the class on the given page. Used primarily by display.
     * @param c
     * @param page
     * @returns {*}
     */
    getClassNode(c, page) {
        return this.nodes[c.node_list[c._getPageIndex(page)]];
    }

    getDrawnElements(page, xmin, xmax, ymin, ymax) {
        // Util.checkArgumentsDefined(SpectralSequenceChart.prototype.getDrawnElements, arguments);
        let pageRange;
        // TODO: clean up pageRange. Probably we should always pass pages as pairs?
        if(Array.isArray(page)) {
            pageRange = page;
            page = page[0];
        } else {
            pageRange = [page, page];
        }
        let display_classes = this.classes.filter(c => {
            if (!c || c.invalid) {
                return false;
            }
            c._in_range = SpectralSequenceChart._classInRangeQ(c, xmin, xmax, ymin, ymax);
            return c._in_range && c._drawOnPageQ(page);
        });

        // Maybe move this elsewhere...
        for (let e of this.edges) {
            e._source = this.classes[e.source];
            e._target = this.classes[e.target];
        }

        // Display edges such that
        // 1) e is a valid edge
        // 2) e is supposed to be drawn on the current pageRange.
        // 3) e.source and e.target are supposed to be drawn on the current pageRange
        // 4) At least one of the source or target is in bounds.
        let display_edges = this.edges.filter(e =>
            e && !e.invalid && 
            SpectralSequenceChart._drawEdgeOnPageQ(e, pageRange)
            && SpectralSequenceChart._drawClassOnPageQ(e._source, page) 
            && SpectralSequenceChart._drawClassOnPageQ(e._target, page)
            && (e._source._in_range || e._target._in_range)
        );

        // We need to go back and make sure that for every edge we are planning to  draw, we draw both its source and
        // target even if one of them is out of bounds. Check for out of bounds sources / targets and add them to the
        // list of edges to draw.
        for (let e of display_edges) {
            if (!e._source.in_range) {
                display_classes.push(e._source);
                e._source._in_range = true;
            }
            if (!e._target.in_range) {
                e._target._in_range = true;
                display_classes.push(e._target);
            }
        }

        for(let c of display_classes) {
            let node = this.getClassNode(c, page);
            if(node === undefined) {
                console.log(c);
                console.log(page);
                throw `Undefined node for class`;
            }
            c._node = node;
        }

        // for (let e of display_edges) {
        //     e.source_node = e.source.node;
        //     e.target_node = e.target.node;
        // }
        return [display_classes, display_edges];
    }
}

exports.SpectralSequenceChart = SpectralSequenceChart;