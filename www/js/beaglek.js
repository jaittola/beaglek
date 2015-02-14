(function() {

    var $ = require('jquery');
    var Bacon = require('baconjs');
    var R = require('ramda');

    // Browserify support hacks.
    $.fn.asEventStream = Bacon.$.asEventStream;

    var KEY_LEFT = 37;
    var KEY_UP = 38;
    var KEY_RIGHT = 39;
    var KEY_DOWN = 40;
    var KEY_RETURN = 13;

    var views = {
        views: [
            {
                name: "instruments",
            },
            require('./map')({ name: "map"})
        ],
        currentViewIndex: 0,
    };

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

    function handleUpdate(update) {
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

    function updateNavigationData(update) {
        views.views.forEach(function(v) {
            if (v.updateNavigationData) v.updateNavigationData(update);
        });
        handleUpdate(update);
    }

    function currentView() {
        return views.views[views.currentViewIndex];
    }

    function changeView(step) {
        var nextViewIndex = views.currentViewIndex + step;
        if (nextViewIndex < 0)
            nextViewIndex = views.views.length - 1;
        if (nextViewIndex >= views.views.length)
            nextViewIndex = 0;

        var nextView = views.views[nextViewIndex];
        $("#" + currentView().name).hide();
        $("#" + nextView.name).show();
        views.currentViewIndex = nextViewIndex;
        if (nextView.setup)
            nextView.setup();
    }

    function viewFunction(name) {
        var view = currentView();
        if (view[name])
            view[name]();
    }

    function filterKeyCode(keyCode, event) {
        return event.keyCode === keyCode;
    }

    function setupKeyInput() {
        var keyDowns = $(document).asEventStream("keydown");
        keyDowns.filter(filterKeyCode, KEY_LEFT).onValue(changeView, -1);
        keyDowns.filter(filterKeyCode, KEY_RIGHT).onValue(changeView, +1);
        keyDowns.filter(filterKeyCode, KEY_UP).onValue(viewFunction, 'keyUp');
        keyDowns.filter(filterKeyCode, KEY_DOWN).onValue(viewFunction, 'keyDown');
        keyDowns.filter(filterKeyCode, KEY_RETURN).onValue(viewFunction, 'keyReturn');
    }

    function setupWindowResize() {
        $(window).resize(function() {
            $('#map').css("height", $(window).height());
            $('#map').css("width", $(window).width());

            viewFunction('resize');
        });
    }

    function setup() {
        var primusData = Primus.connect(window.location.protocol + "://" +
                                        window.location.host +
                                        "/primus/signalk?stream=delta",
                                        { reconnect: { maxDelay: 15000,
                                                       minDelay: 500,
                                                       retries: Infinity }
                                        });
        primusData.on('data', function(msg) {
            R.pipe(R.prop('updates'),
                   R.pluck('values'),
                   R.flatten,
                   R.forEach(updateNavigationData))(msg);
        });

        setupKeyInput();
        setupWindowResize();
    }

    $(document).ready(setup);
}());
