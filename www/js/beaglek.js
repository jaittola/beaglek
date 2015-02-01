(function() {

    var graphCenterX = 400;
    var graphCenterY = 400;
    var graphCircleRadius = 380;

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

    var dataDestinations = {
        "navigation.speedOverGround": { selectors: [ "speed", "sog" ] },
        "environment.depth": { selectors: [ "depth" ],
                               valueContainer: "value.belowTransducer.value" },
        "navigation.courseOverGroundTrue": { selectors: [ "cog" ],
                    formatter: function(data) {
                        return Math.floor(data);
                    }},
        "environment.wind": { handler: handleWindUpdate },
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
    }

    $(document).ready(setup);
}());
