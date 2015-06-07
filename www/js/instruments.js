module.exports = function(opts) {

    var $ = require('jquery');
    var R = require('ramda');
    var moment = require('moment');

    var name = opts.name || 'instruments';
    var selector = '#' + name;
    var hardwareButtonNavigation = false;

    var views = {
        currentViewIndex: 0,
        views: [
            {
                name: 'default',
                addStyles: {
                },
                removeStyles: {
                    '#windrose': [ 'small-windrose' ]
                },
                show: [ ],
                hide: [ '#coordinatecontainer', '#timecontainer',
                        '#vmgcontainer' ],
            },
            {
                name: 'coordinates',
                addStyles: {
                    '#windrose': [ 'small-windrose' ]
                },
                removeStyles: {
                },
                show: [ '#coordinatecontainer' ],
                hide: [ '#timecontainer', '#vmgcontainer' ],
            },
            {
                name: 'time',
                addStyles: {
                    '#windrose': [ 'small-windrose' ]
                },
                removeStyles: {
                },
                show: [ '#timecontainer' ],
                hide: [ '#coordinatecontainer', '#vmgcontainer' ],
            },
            {
                name: 'vmg',
                addStyles: {
                    '#windrose': [ 'small-windrose' ]
                },
                removeStyles: {
                },
                show: [ '#vmgcontainer' ],
                hide: [ '#coordinatecontainer', '#timecontainer' ],
            },
        ],
    }

    var graphCenterX = 400;
    var graphCenterY = 400;
    var graphCircleRadius = 380;

    var position = {
        lat: 0,
        lon: 0,
        time: "",
    }

    function setupViewVariant(view) {
        var styleMod = function(modifier, modifications) {
            R.mapObjIndexed(modifier, modifications);
        };
        var addStyles = function(styles, selector) {
            R.forEach(function(s) {
                var classes = R.pipe(R.split(" "),
                                     R.append(s),
                                     R.uniq)($(selector).attr('class'));
                $(selector).attr('class', classes.join(" "));
            },
                      styles);
        };
        var removeStyles = function(styles, selector) {
            R.forEach(function(s) {
                var classes = R.pipe(R.split(" "),
                                     R.filter(function(v) {
                                         return v !== s;
                                     }))($(selector).attr('class'));
                $(selector).attr('class', classes.join(" "));
            },
                      styles);
        };

        styleMod(addStyles, view.addStyles);
        styleMod(removeStyles, view.removeStyles);
        R.forEach(function(selector) { $(selector).show(); }, view.show);
        R.forEach(function(selector) { $(selector).hide(); }, view.hide);
    }

    function viewVariant(change) {
        var nextIdx =
            (change === 0 || !hardwareButtonNavigation) ?
            0 : views.currentViewIndex + change;
        if (nextIdx < 0) nextIdx = views.views.length - 1;
        else if (nextIdx >= views.views.length) nextIdx = 0;
        views.currentViewIndex = nextIdx;
        setupViewVariant(views.views[views.currentViewIndex]);
    }

    function radians(degrees) {
        return Math.PI * degrees / 180;
    }

    function rotateSvgElement(selector, amount) {
        if (!selector)
            return;

        $('#' + selector).attr("transform",
                               "rotate(" + amount + ", " +
                               graphCenterX + ", " + graphCenterY + ")");
    }

    function updateWindSector(enclosingSelector, sectorSelector, angle) {
        var angleRadians = radians(Math.abs(angle));
        var resultX = Math.floor(graphCircleRadius * Math.sin(angleRadians));
        var resultY = Math.floor(graphCircleRadius *
                                 (1 - Math.cos(angleRadians)));
        var sectorPath = [ "M", graphCenterX, graphCenterY,
                           "v", -graphCircleRadius,
                           "a", graphCircleRadius,  graphCircleRadius,
                           0, 0, 1,
                           resultX, resultY ];
        var transformation = angle < 0 ?
            "translate(" + (2 * graphCenterX) + ", 0) scale(-1,1)" :
            "";

        $("#" + sectorSelector).attr("d", sectorPath.join(" "));
        $("#" + enclosingSelector).attr("transform", transformation);
    }

    function setL(selector, value) {
        if ($(selector).is(':visible')) $(selector).html(value);
    }

    function set(selector, value) {
        setL(selector, String(value).substring(0, 4));
    }

    function handleWindUpdate(windData) {
        var awa = R.path('value.angleApparent', windData);
        var aws = R.path('value.speedApparent', windData);
        var twa = R.path('value.angleTrue', windData);
        var tws = R.path('value.speedTrue', windData);

        if (awa) {
            updateWindSector("awa-marker", "awa-indicator", awa.value);
            set("#awa", Math.floor(Math.abs(awa.value)));
        }
        if (aws) {
            set("#aws", aws.value);
        }
        if (twa) {
            rotateSvgElement("twa-marker", twa.value);
            set("#twa", Math.floor(Math.abs(twa.value)));
        }
        if (tws) {
            set("#tws", tws.value);
        }
    }

    function formatCoordinate(numericCoordinate, latOrLong) {
        latOrLong = latOrLong || 'lat';
        var hemispheres = latOrLong === 'lat' ? ['N', 'S'] : ['E', 'W'];
        var degrees = Math.floor(Math.abs(numericCoordinate));
        var minutes = (numericCoordinate - degrees) * 60;
        var hemisphere = numericCoordinate >= 0 ?
            hemispheres[0] : hemispheres[1];
        return hemisphere + " " + degrees + "°" + minutes.toFixed(3) + "'";
    }

    function formatTime(timestamp) {
        var t = moment(timestamp);
        if (t.isValid())
            setL(".time", t.format('D.M.YYYY H.mm.ss'));
    }

    function handlePositionUpdate(update) {
        position.lat = R.path('value.latitude', update) || position.lat;
        position.lon = R.path('value.longitude', update) || position.lon;
        position.time = R.path('value.timestamp', update) || position.time;
        setL('.latitude', formatCoordinate(position.lat, 'lat'));
        setL('.longitude', formatCoordinate(position.lon, 'lon'));
        setL('.time', formatTime(position.time));
    }

    function handleCogUpdate(update) {
        var cog = Math.floor(update.value);
        set('#cog', cog);
    }

    function handleSpeedUpdate(selector, value) {
        set(selector, value * 2.0);  // Convert to m/s to kn.
    }

    function handleSogUpdate(update) {
        handleSpeedUpdate(".sog", update.value);
    }

    function handleWaterSpeedUpdate(update) {
        handleSpeedUpdate(".speed", update.value);
    }

    function handleVmgUpdate(update) {
        handleSpeedUpdate(".vmg", Math.abs(update.value));
    }

    function handleDepthUpdate(update) {
        set("#depth", update.value);
    }

    function updateNavigationData(update) {
        var dataDestinations = {
            "navigation.speedOverGround": handleSogUpdate,
            "navigation.speedThroughWater": handleWaterSpeedUpdate,
            "navigation.speedParallelToWind": handleVmgUpdate,
            "environment.depth.belowTransducer": handleDepthUpdate,
            "navigation.courseOverGroundTrue": handleCogUpdate,
            "environment.wind": handleWindUpdate,
            "navigation.position": handlePositionUpdate,
        };

        var handler = dataDestinations[update.path];
        if (handler) handler(update);
    }

    function sizeVariantChange(withHwButtons) {
        hardwareButtonNavigation = withHwButtons;
        viewVariant(0);
    }

    var self = {
        name: name,
        keyUp: function() { viewVariant(-1); },
        keyDown: function() { viewVariant(+1); },
        updateNavigationData: updateNavigationData,
        sizeVariantChange: sizeVariantChange,
    };

    return self;
}
