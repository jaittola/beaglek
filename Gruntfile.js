module.exports = function(grunt) {
    var sourceFiles = [ 'www/js/beaglek.js', 'www/js/map.js' ];
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        browserify: {
            'www/js/bundle.js': sourceFiles
        },
        watch: {
            files: sourceFiles,
            tasks: [ 'browserify' ]
        }
    });

    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('default', 'browserify');
}
