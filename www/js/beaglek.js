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
            require('./instruments')({ name: 'instruments' }),
            require('./map')({ name: 'map'})
        ],
        currentViewIndex: 0,
    };

    function updateNavigationData(update) {
        views.views.forEach(function(v) {
            if (v.updateNavigationData) v.updateNavigationData(update);
        });
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

    function setupViewToggleButton() {
        $(".toggle-view").click(function() {
            changeView(+1);
        });
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

    function handleSizeVariantChange(mediaQueryListener) {
        views.views.forEach(function(v) {
            if (v.sizeVariantChange)
                v.sizeVariantChange(!mediaQueryListener.matches);
        });
    }

    function setupMediaQuery() {
        var mediaQueryListener = window.matchMedia("(min-width: 600px)");
        mediaQueryListener.addListener(handleSizeVariantChange);
        handleSizeVariantChange(mediaQueryListener);
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

        setupViewToggleButton();
        setupKeyInput();
        setupWindowResize();
        setupMediaQuery();
    }

    $(document).ready(setup);
}());
