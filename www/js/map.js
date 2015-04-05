module.exports = function(opts) {

    var $ = require('jquery');
    var L = require('leaflet');
    var Bacon = require('baconjs');
    var R = require('ramda');

    // Browserify support hacks.
    L.Icon.Default.imagePath = 'images/leaflet-images';

    var name = opts.name || 'map';
    var selector = '#' + name;
    var map;
    var wind;
    var position = {
        lat: 60.15,
        lon: 24.97,
        time: "",
        courseOverGround: 0,
    };
    var waterSpeed;
    var defaultZoom = 15;
    var positionMarker;
    var directionMarker;
    var directionMarkerLength = 0;
    var windMarkers;

    function radians(degrees) {
        return Math.PI * degrees / 180;
    }

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

    function handleWindUpdate(windData) {
        if (!wind) {
            wind = {};
        }

        wind.awa = R.path('value.angleApparent.value', windData) || wind.awa;
        wind.aws = R.path('value.speedApparent.value', windData) || wind.aws;
        wind.twa = R.path('value.angleTrue.value', windData) || wind.twa;
        wind.tws = R.path('value.speedTrue.value', windData) || wind.tws;
        updateDirectionMarkers();
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
        position.courseOverGround = cog;
        rotatePositionIndicator(cog);
        updateDirectionMarkers();
    }

    function handleWaterSpeedUpdate(update) {
        waterSpeed = update.value;
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
            wind.tws < 2 || waterSpeed > wind.tws)
            return;

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

    function mapSizeChange() {
        directionMarkerLength = map.getSize().x / 1.5;
    }

    function isMapVisible() {
        return map && $(selector).is(":visible");
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

    function mapDragStart() {
        tracking.set(false);
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

    function updateNavigationData(update) {
        var dataDestinations = {
            "navigation.speedThroughWater": handleWaterSpeedUpdate,
            "navigation.courseOverGroundTrue": handleCogUpdate,
            "environment.wind": handleWindUpdate,
            "navigation.position": handlePositionUpdate,
        };

        var handler = dataDestinations[update.path];
        if (handler) handler(update);
    }

    function setupMap() {
        if (map) {
            map.invalidateSize();
            updateMapPosition();
            return;
        }

        // TODO, width / height.
        $(selector).css("height", $(window).height());
        $(selector).css("width", $(window).width());

        map = L.map(name,
                    { zoomAnimation: false,
                      zoomControl: false,
                      keyboard: false });
        map.setView([position.lat, position.lon], defaultZoom);
        // TODO, the map source should be configurable. The line below
        // points to a local MapProxy.
        L.tileLayer.wms('http://' + window.location.hostname + ':8001/service',
                        { layers: 'osm,liikennevirasto_sea' }).addTo(map);
        positionMarker = L.marker(position, {
            icon: L.divIcon({className: "yacht-position",
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

    var self = {
        name: name,
        setup: setupMap,
        resize: function() { if (map) map.invalidateSize(); },
        keyUp: function() { if (map) map.zoomIn(); },
        keyDown: function() { if (map) map.zoomOut(); },
        keyReturn: function() { tracking.toggle(); },
        updateNavigationData: updateNavigationData,
    };

    return self;
};
