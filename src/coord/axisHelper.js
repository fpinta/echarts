define(function (require) {

    var OrdinalScale = require('../scale/Ordinal');
    var IntervalScale = require('../scale/Interval');
    require('../scale/Time');
    require('../scale/Log');
    var Scale = require('../scale/Scale');

    var numberUtil = require('../util/number');
    var zrUtil = require('zrender/core/util');
    var textContain = require('zrender/contain/text');
    var axisHelper = {};

    axisHelper.niceScaleExtent = function (axis, model) {
        var scale = axis.scale;
        var originalExtent = scale.getExtent();
        var span = originalExtent[1] - originalExtent[0];
        if (scale.type === 'ordinal') {
            // If series has no data, scale extent may be wrong
            if (!isFinite(span)) {
                scale.setExtent(0, 0);
            }
            return;
        }
        var min = model.get('min');
        var max = model.get('max');
        var crossZero = !model.get('scale');
        var boundaryGap = model.get('boundaryGap');
        if (!zrUtil.isArray(boundaryGap)) {
            boundaryGap = [boundaryGap || 0, boundaryGap || 0];
        }
        boundaryGap[0] = numberUtil.parsePercent(boundaryGap[0], 1);
        boundaryGap[1] = numberUtil.parsePercent(boundaryGap[1], 1);
        var fixMin = true;
        var fixMax = true;
        // Add boundary gap
        if (min == null) {
            min = originalExtent[0] - boundaryGap[0] * span;
            fixMin = false;
        }
        if (max == null) {
            max = originalExtent[1] + boundaryGap[1] * span;
            fixMax = false;
        }
        // TODO Only one data
        if (min === 'dataMin') {
            min = originalExtent[0];
        }
        if (max === 'dataMax') {
            max = originalExtent[1];
        }
        // Evaluate if axis needs cross zero
        if (crossZero) {
            // Axis is over zero and min is not set
            if (min > 0 && max > 0 && !fixMin) {
                min = 0;
            }
            // Axis is under zero and max is not set
            if (min < 0 && max < 0 && !fixMax) {
                max = 0;
            }
        }
        scale.setExtent(min, max);
        scale.niceExtent(model.get('splitNumber'), fixMin, fixMax);

        // If some one specified the min, max. And the default calculated interval
        // is not good enough. He can specify the interval. It is often appeared
        // in angle axis with angle 0 - 360. Interval calculated in interval scale is hard
        // to be 60.
        // FIXME
        var interval = model.get('interval');
        if (interval != null) {
            scale.setInterval && scale.setInterval(interval);
        }
    };

    /**
     * @param {module:echarts/model/Model} model
     * @param {string} [axisType] Default retrieve from model.type
     * @return {module:echarts/scale/*}
     */
    axisHelper.createScaleByModel = function(model, axisType) {
        axisType = axisType || model.get('type');
        if (axisType) {
            switch (axisType) {
                // Buildin scale
                case 'category':
                    return new OrdinalScale(
                        model.getCategories(), [Infinity, -Infinity]
                    );
                case 'value':
                    return new IntervalScale();
                // Extended scale, like time and log
                default:
                    return (Scale.getClass(axisType) || IntervalScale).create(model);
            }
        }
    };

    /**
     * Check if the axis corss 0
     */
    axisHelper.ifAxisCrossZero = function (axis) {
        var dataExtent = axis.scale.getExtent();
        var min = dataExtent[0];
        var max = dataExtent[1];
        return !((min > 0 && max > 0) || (min < 0 && max < 0));
    };

    /**
     * @param {Array.<number>} tickCoords In axis self coordinate.
     * @param {Array.<string>} labels
     * @param {string} font
     * @param {boolean} isAxisHorizontal
     * @return {number}
     */
    axisHelper.getAxisLabelInterval = function (tickCoords, labels, font, isAxisHorizontal) {
        // FIXME
        // 不同角的axis和label，不只是horizontal和vertical.

        var textSpaceTakenRect;
        var autoLabelInterval = 0;
        var accumulatedLabelInterval = 0;

        for (var i = 0; i < tickCoords.length; i++) {
            var tickCoord = tickCoords[i];
            var rect = textContain.getBoundingRect(
                labels[i], font, 'center', 'top'
            );
            rect[isAxisHorizontal ? 'x' : 'y'] += tickCoord;
            rect[isAxisHorizontal ? 'width' : 'height'] *= 1.5;
            if (!textSpaceTakenRect) {
                textSpaceTakenRect = rect.clone();
            }
            // There is no space for current label;
            else if (textSpaceTakenRect.intersect(rect)) {
                accumulatedLabelInterval++;
                autoLabelInterval = Math.max(autoLabelInterval, accumulatedLabelInterval);
            }
            else {
                textSpaceTakenRect.union(rect);
                // Reset
                accumulatedLabelInterval = 0;
            }
        }

        return autoLabelInterval;
    };

    /**
     * @param {Object} axis
     * @param {Function} labelFormatter
     * @return {Array.<string>}
     */
    axisHelper.getFormattedLabels = function (axis, labelFormatter) {
        var scale = axis.scale;
        var labels = scale.getTicksLabels();
        var ticks = scale.getTicks();
        if (typeof labelFormatter === 'string') {
            labelFormatter = (function (tpl) {
                return function (val) {
                    return tpl.replace('{value}', val);
                };
            })(labelFormatter);
            return zrUtil.map(labels, labelFormatter);
        }
        else if (typeof labelFormatter === 'function') {
            return zrUtil.map(ticks, function (tick, idx) {
                return labelFormatter(
                    axis.type === 'category' ? scale.getLabel(tick) : tick,
                    idx
                );
            }, this);
        }
        else {
            return labels;
        }
    };

    return axisHelper;
});