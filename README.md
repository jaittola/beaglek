# About Beaglek

Beaglek is a simple user interface for a SignalK (http://signalk.org/)
marine data server. Beaglek is intended for low-resolution
displays like a BeagleBoard Black with a 7" display cape. The minimum
supported resolution is 480x272.

<a href="http://www.youtube.com/watch?feature=player_embedded&v=yo1xdx7KK0g" target="_blank"><img src="http://img.youtube.com/vi/yo1xdx7KK0g/0.jpg" alt="View a video of SignalK" width="640" height="480" border="10" /></a>

# Deploying

Beaglek will run as an extension of the SignalK server. The details
are still open.

# Compiling

Beaglek uses npm and browserify for handling external dependencies,
and grunt to bundle all javascript to one file. To install the
depdencies and to compile the javascript bundle, issue the following
commands:

* [install npm using your OS's package manager]
* run 'npm install'
* run './grunt'

For developing, you can run grunt with the watch module, i.e., it watches
for source file changes and rebuilds the bundle automatically:

* run 'grunt watch'
