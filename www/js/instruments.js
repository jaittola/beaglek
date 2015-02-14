module.exports = function(opts) {

    var $ = require('jquery');
    var R = require('ramda');

    var name = opts.name || 'instruments';
    var selector = '#' + name;

    var graphCenterX = 400;
    var graphCenterY = 400;
    var graphCircleRadius = 380;

    var position = {
        lat: 0,
        lon: 0,
        time: "",
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

    function set(selector, value) {
        $(selector).html(String(value).substring(0, 4));
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

    function handlePositionUpdate(update) {
        position.lat = R.path('value.latitude', update) || position.lat;
        position.lon = R.path('value.longitude', update) || position.lon;
        position.time = R.path('value.timestamp', update) || position.time;
    }

    function handleCogUpdate(update) {
        var cog = Math.floor(update.value);
        set('#cog', cog);
    }

    function handleSpeedUpdate(selector, value) {
        set("#" + selector, value * 2.0);  // Convert to m/s to kn.
    }

    function handleSogUpdate(update) {
        handleSpeedUpdate("sog", update.value);
    }

    function handleWaterSpeedUpdate(update) {
        waterSpeed = update.value;
        handleSpeedUpdate("speed", update.value);
    }

    function handleDepthUpdate(update) {
        set("#depth", R.path('value.belowTransducer.value', update) || "");
    }

    function updateNavigationData(update) {
        var dataDestinations = {
            "navigation.speedOverGround": handleSogUpdate,
            "navigation.speedThroughWater": handleWaterSpeedUpdate,
            "environment.depth": handleDepthUpdate,
            "navigation.courseOverGroundTrue": handleCogUpdate,
            "environment.wind": handleWindUpdate,
            "navigation.position": handlePositionUpdate,
        };

        var handler = dataDestinations[update.path];
        if (handler) handler(update);
    }

    var self = {
        name: name,
        updateNavigationData: updateNavigationData,
    };

    return self;
}
