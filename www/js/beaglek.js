(function() {

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
            {
                name: "map",
                setup: setupMap,
                keyUp: function() { if (map) map.zoomIn(); },
                keyDown: function() { if (map) map.zoomOut(); },
                keyReturn: function() { tracking.toggle(); }
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
        courseOverGround: 0,
    };
    var wind;
    var waterSpeed;
    var defaultZoom = 15;
    var positionMarker;
    var directionMarker;
    var directionMarkerLength = 0;
    var windMarkers;

    var tracking = function() {
        var b = new Bacon.Bus();

        var result = {
            value: true,
            toggle: function() {
                result.set(!result.value);
            },
            set: function(enabled) {
                result.bus.push(enabled);
            },
            bus: b,
            property: b.toProperty(true),
        };
        result.property.onValue(function(v) {
            result.value = v;
        });

        return result;
    }();

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

        if (!wind) {
            wind = {};
        }

        if (awa) {
            updateWindSector("awa-marker", "awa-indicator", awa.value);
            set("#awa", Math.floor(Math.abs(awa.value)));
            wind.awa = awa.value;
        }
        if (aws) {
            set("#aws", aws.value);
            wind.aws = aws.value;
        }
        if (twa) {
            rotateSvgElement("twa-marker", twa.value);
            set("#twa", Math.floor(Math.abs(twa.value)));
            wind.twa = twa.value;
        }
        if (tws) {
            set("#tws", tws.value);
            wind.tws = tws.value;
        }
    }

    function handlePositionUpdate(update) {
        position.lat = R.path('value.latitude', update) || position.lat;
        position.lon = R.path('value.longitude', update) || position.lon;
        position.time = R.path('value.timestamp', update) || position.time;
        updateMapPosition();
        updateDirectionMarkers();
    }

    function handleCogUpdate(update) {
        var cog = Math.floor(update.value);
        set('#cog', cog);
        position.courseOverGround = cog;
        rotatePositionIndicator(cog);
        updateDirectionMarkers();
    }

    function updateDirectionMarkers() {
        if (!isMapVisible()) return;

        var positionCoords = positionMarker.getLatLng();
        var positionPoint = map.latLngToContainerPoint(positionCoords);

        updateCourseMarker(positionPoint, positionCoords);
        updateWindMarkers(positionPoint, positionCoords);
    }

    function updateCourseMarker(positionPoint, positionCoords) {
        if (directionMarker) map.removeLayer(directionMarker);
        directionMarker = drawDirectionMarker(position.courseOverGround,
                                              positionPoint,
                                              positionCoords,
                                              '#000080');
    }

    function courseDifference(course1, course2) {
        var c1 = course1 >= 0 ? course1 : course1 + 360;
        var c2 = course2 >= 0 ? course2 : course2 + 360;
        return Math.abs(c1 - c2);
    }

    function updateWindMarkers(positionPoint, positionCoords) {
        if (windMarkers) {
            windMarkers.forEach(function(w) { map.removeLayer(w); });
            windMarkers = null;
        }
        if (!wind || !wind.awa || !wind.twa || !wind.tws ||
           wind.tws < 2 || speed > wind.tws) return;

        var awa = Math.abs(wind.awa);
        var twa = Math.abs(wind.twa);
        if (awa > 40 || awa < 20) return;

        var wdiff = twa - awa;
        var tack = wind.awa < 0 ? -1 : +1; // -1: left, +1, right.
        var twd = position.courseOverGround + tack * twa;
        var optimalTrueWindAngle = wdiff + optimalAngle(wind.aws);
        var bestCourseCurrentTack =
            normalizeAngle(twd + (-1) * tack * optimalTrueWindAngle);
        var bestCourseOtherTack =
            normalizeAngle(twd + tack * optimalTrueWindAngle);
        if (courseDifference(bestCourseCurrentTack,
                             bestCourseOtherTack) > 120) return;

        windMarkers = [
            drawDirectionMarker(bestCourseCurrentTack,
                                positionPoint, positionCoords,
                                windMarkerColor(tack)),
            drawDirectionMarker(bestCourseOtherTack,
                                positionPoint, positionCoords,
                                windMarkerColor(-1 * tack))
        ];
    }

    function drawDirectionMarker(direction,
                                 positionPoint,
                                 positionCoords,
                                 color) {
        var dirRad = radians(direction);
        var endPoint = new L.Point(positionPoint.x +
                                   directionMarkerLength * Math.sin(dirRad),
                                   positionPoint.y -
                                   directionMarkerLength * Math.cos(dirRad));
        var endCoords = map.containerPointToLatLng(endPoint);

        var marker = L.polyline([positionCoords,
                                 endCoords],
                                { color: color,
                                  weight: 2,
                                  fillOpacity: 0.8 });
        map.addLayer(marker);
        return marker;
    }

    function windMarkerColor(tack) {
        return tack < 0 ? '#00ff00' : '#ff0000';
    }

    function normalizeAngle(angle) {
        if (angle < 0) {
            return 360 + angle;
        }
        return angle % 360;
    }

    function optimalAngle(aws) {
        return 30;
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

    var dataDestinations = {
        "navigation.speedOverGround": { handler: handleSogUpdate },
        "navigation.speedThroughWater": { handler: handleWaterSpeedUpdate },
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

    function mapSizeChange() {
        directionMarkerLength = map.getSize().x / 1.5;
    }

    function isMapVisible() {
        return map && currentView().name === 'map';
    }

    function rotatePositionIndicator(direction) {
        $(".yacht-position-indicator").css("transform", "rotate(" + direction + "deg)");
        $(".yacht-position-indicator").css("transform-origin", "center");
    }

    function updateMapPosition() {
        if (!isMapVisible()) return;

        positionMarker.setLatLng(position);
        if (tracking.value)
            map.panTo(position);
    }

    function viewFunction(name) {
        var view = currentView();
        if (view[name])
            view[name]();
    }

    function returnPress() {
        var view = currentView();
        if (view.keyReturn) view.keyReturn();
    }

    function mapDragStart() {
        tracking.set(false);
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
        keyDowns.filter(filterKeyCode, KEY_RETURN).onValue(returnPress);
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
                                                     iconSize: [20, 20],
                                                     html: '<div class="yacht-position-indicator"> </div>'}),
                                    keyboard: false,
                                    opacity: 0.8,
                                  });
        positionMarker.addTo(map);

        map.on('dragstart', mapDragStart);
        map.on('resize', mapSizeChange);

        mapSizeChange();

        tracking.property.onValue(setInfoboxVisibility);
    }

    function setInfoboxVisibility(trackingEnabled) {
        if (trackingEnabled) {
            $('#tracking-infobox').css('display', 'none');
        }
        else {
            $('#tracking-infobox').css('display', 'inline-block');
            $('#tracking-infobox .infobox-text')
                .text("Press enter to resume tracking");
        }
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
