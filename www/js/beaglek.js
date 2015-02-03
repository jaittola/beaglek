(function() {

    var KEY_LEFT = 37;
    var KEY_UP = 38;
    var KEY_RIGHT = 39;
    var KEY_DOWN = 40;

    var views = {
        views: [
            {
                name: "instruments",
                setup: null,
                keyUp: null,
                keyDown: null,
            },
            {
                name: "map",
                setup: setupMap,
                keyUp: function() { if (map) map.zoomIn(); },
                keyDown: function() { if (map) map.zoomOut(); },
            },
        ],
        currentViewIndex: 0,
    };

    var graphCenterX = 400;
    var graphCenterY = 400;
    var graphCircleRadius = 380;

    var map;
    var position = {
        lat: 60.15,
        lon: 24.97,
        time: "",
    };
    var defaultZoom = 15;
    var positionMarker;

    function radians(degrees) {
        return Math.PI * degrees / 180;
    }

    function halfAngle(angle) {
        return (angle > 180 ? 360 - angle : angle);
    }

    function rotateSvgElement(selector, amount) {

        if (!selector)
            return;

        $('#' + selector).attr("transform",
                               "rotate(" + amount + ", " +
                               graphCenterX + ", " + graphCenterY + ")");
    }

    function updateWindSector(enclosingSelector, sectorSelector, angle) {
        var angleRadians = radians(halfAngle(angle));
        var resultX = Math.floor(graphCircleRadius * Math.sin(angleRadians));
        var resultY = Math.floor(graphCircleRadius *
                                 (1 - Math.cos(angleRadians)));
        var sectorPath = [ "M", graphCenterX, graphCenterY,
                           "v", -graphCircleRadius,
                           "a", graphCircleRadius,  graphCircleRadius,
                           0, 0, 1,
                           resultX, resultY ];
        var transformation = angle > 180 ?
            "translate(" + (2 * graphCenterX) + ", 0) scale(-1,1)" :
            "";

        $("#" + sectorSelector).attr("d", sectorPath.join(" "));
        $("#" + enclosingSelector).attr("transform", transformation);
    }

    function set(selector, value) {
        $(selector).html(String(value).substring(0, 4));
    }

    function handleWindUpdate(windData) {
        var awa = R.path('value.directionApparent', windData);
        var aws = R.path('value.speedApparent', windData);
        var twa = R.path('value.directionTrue', windData);
        var tws = R.path('value.speedTrue', windData);

        if (awa) {
            updateWindSector("awa-marker", "awa-indicator", awa.value);
            set("#awa", Math.floor(halfAngle(awa.value)));
        }
        if (aws) {
            set("#aws", aws.value);
        }
        if (twa) {
            rotateSvgElement("twa-marker", twa.value);
            set("#twa", Math.floor(halfAngle(twa.value)));
        }
        if (tws) {
            set("#tws", tws.value);
        }
    }

    function handlePositionUpdate(update) {
        position.lat = R.path('value.latitude', update) || position.lat;
        position.lon = R.path('value.longitude', update) || position.lon;
        position.time = R.path('value.timestamp', update) || position.time;
        updateMapPosition();
    }

    function handleCogUpdate(update) {
        var cog = Math.floor(update.value);
        set('#cog', cog);
        rotatePositionIndicator(cog);
    }

    var dataDestinations = {
        "navigation.speedOverGround": { selectors: [ "speed", "sog" ] },
        "environment.depth": { selectors: [ "depth" ],
                               valueContainer: "value.belowTransducer.value" },
        "navigation.courseOverGroundTrue": { handler: handleCogUpdate },
        "environment.wind": { handler: handleWindUpdate },
        "navigation.position": { handler: handlePositionUpdate },
    };

    function handleUpdate(update) {
        var destination = dataDestinations[update.path];
        if (!destination)
            return;

        if (destination.handler) {
            destination.handler(update);
        }
        else {
            var valueContainer = destination.valueContainer || "value";
            var value = R.path(valueContainer, update);
            var formattedData = (destination.formatter ?
                                 destination.formatter(value) : value) || "";
            destination.selectors.forEach(function(s) {
                set("#" + s, formattedData);
            });
        }
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

    function zoomIn() {
        if (!map) return;
        map.zoomIn();
    }

    function zoomOut() {
        if (!map) return;
        map.zoomOut();
    }

    function isMapVisible() {
        return map && currentView().name === 'map';
    }

    function rotatePositionIndicator(direction) {
        // Does not work; it's not possible to rotate a divicon.
//        $(".yacht-position").css("transform", "rotate(" + direction + "deg)");
//        $(".yacht-position").css("transform-origin", "center");
    }

    function updateMapPosition() {
        if (!isMapVisible()) return;
        map.panTo(position);
        positionMarker.setLatLng(position);
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
    }

    function setupMap() {
        if (map) {
            map.invalidateSize();
            updateMapPosition();
            return;
        }

        $('#map').css("height", $(window).height());
        $('#map').css("width", $(window).width());

        map = L.map('map',
                    { zoomAnimation: false,
                      keyboard: false });
        map.setView([position.lat, position.lon], defaultZoom);
        L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png').addTo(map);
        L.tileLayer.wms("http://kartta.liikennevirasto.fi/meriliikenne/dgds/wms_ip/merikartta", {
            layers: 'cells',
            styles: 'style-id-203',     // Ground areas are black (transparent).
            // styles: 'style-id-202',  // 202 has simple ground data.
            format: 'image/png',
            transparent: true,
        }).addTo(map);
        positionMarker = L.marker(position,
                                  { icon: L.divIcon({className: "yacht-position",
                                                     iconSize: [30, 30]}),
                                    keyboard: false,
                                    opacity: 0.8,
                                  });
        positionMarker.addTo(map);
    }

    function setupWindowResize() {
        $(window).resize(function() {
            $('#map').css("height", $(window).height());
            $('#map').css("width", $(window).width());

            if (map)
                map.invalidateSize();
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
                   R.forEach(handleUpdate))(msg);
        });

        setupKeyInput();
        setupWindowResize();
    }

    $(document).ready(setup);
}());
