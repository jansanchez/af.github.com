var d3 = require('d3');


var githubGraph = function(config) {
    var COMET_SPACING = 25;
    var x = config.xScale;
    var createdAtX = config.dateToX({ propName: 'created_at' });

    var all = config.el.selectAll('g.repo').data(config.data);
    var enter = all.enter().append('g')
                    .attr('class', 'repo')
                    .attr('transform', 'translate(0,20)');  // clears space for x-axis at top

    var links = enter.append('a')
            .attr('xlink:href', function(d) { return d.html_url });

    // Add rects to expand the hoverable area:
    links.append('rect')
            .attr('width', function(d, i) { return x(new Date(d.pushed_at)) - createdAtX(d) })
            .attr('height', COMET_SPACING)
            .attr('transform', function(d, i) {
                return "translate(" + createdAtX(d) + "," + (15 + i*COMET_SPACING) + ")";
            });

    var text = links.append('text').attr('class', 'name')
            .attr('transform', function(d, i) {
                return "translate(" + createdAtX(d) + "," + (25 + i*COMET_SPACING) + ")";
            })
            .text(function(d) { return d.name });
    text.append('tspan')
        .attr('class', 'language')
        .attr('dx', 10)
        .text(function(d) { return d.language });
    text.append('tspan')
        .attr('class', 'description')
        .attr('dx', 10)
        .text(function(d) { return d.description });

    // Draw "comet" shape for each repo:
    links.append('path')
            .attr('d', function(d) {
                var width = x(new Date(d.pushed_at)) - createdAtX(d);
                var height = 10 + Math.floor(Math.sqrt(d.stargazers_count));
                var path = 'M0 2 ';
                path += ('Q' + width + ' 0 ' + (width - 10) + ' ' + height + ' ');
                path += ('L' + width + ' 0 ');
                path += ('L' + (width - 10) + ' ' + (-height) + ' ');
                path += ('Q' + width + ' 0 0 -2');
                return path;
            })
            .attr('transform', function(d, i) {
                return "translate(" + createdAtX(d) + "," + (30 + i*COMET_SPACING) + ")";
            });
};


// Simple chart mapping content as circles along a time axis.
// Config params:
//  data
//  el
//  dateToX
//  groupClass
//  timeProp
//  urlProp
//  titleProp
//  radius
//  yBaseline
function circleChart(config) {
    var dateToX = config.dateToX;
    var yBaseline = config.yBaseline || 20;
    var radius = config.radius || 20;
    if (typeof radius !== 'function') {
        var r = radius;
        radius = function() { return r };
    }

    var selector = 'g' + (config.groupClass ? '.' + config.groupClass : '');
    var all = config.el.selectAll(selector).data(config.data);
    var enter = all.enter().append('g').attr('class', config.groupClass || '');

    var links = enter.append('a')
            .attr('xlink:href', function(d) { return d[config.urlProp] });

    links.append('circle')
            .attr('cx', dateToX({ propName: config.timeProp }))
            .attr('cy', yBaseline)
            .attr('r', radius);

    links.append('line')
            .attr('x1', dateToX({ propName: config.timeProp, offset: 0.5 }))
            .attr('x2', dateToX({ propName: config.timeProp, offset: 0.5 }))
            .attr('y1', function(d) {
                var radius = parseFloat(d3.select(this.parentElement.firstChild).attr('r'));
                return yBaseline + radius + 3;
            })
            .attr('y2', function(d) { return parseFloat(d3.select(this).attr('y1')) + 30; });

    enter.append('text')
            .text(function(d) { return d[config.titleProp] })
            .attr('transform', function(d) {
                var x = dateToX({ propName: config.timeProp, offset: 5 })(d);
                var y = yBaseline + radius(d) + 20;
                return 'translate(' + [x,y].join(',') + ')';
            });
    enter.append('text').attr('class', 'date')
            .text(function(d) { return (new Date(d[config.timeProp])).toISOString().split('T')[0]; })
            .attr('transform', function(d) {
                var x = dateToX({ propName: config.timeProp, offset: 5 })(d);
                var y = yBaseline + radius(d) + 35;
                return 'translate(' + [x,y].join(',') + ')';
            });
}


module.exports = function() {
    var START_DATE = new Date(new Date() - 548*24*3600*1000);   // ~ 1.5 years of history
    var GITHUB_URL = 'https://api.github.com/users/af/repos?per_page=60';
    var DELICIOUS_URL = 'https://api.del.icio.us/v2/json/aaron.franks?count=100&callback=linksCallback';
    var svgWidth = parseInt(getComputedStyle(document.querySelector('svg')).width);

    var x = d3.time.scale().range([0, svgWidth])
                           .domain([START_DATE, new Date()]);

    // Set up an x axis and put it on the code chart:
    var xAxis = d3.svg.axis().scale(x)
                    .tickSize(1)
                    .ticks(d3.time.years, 1);
    d3.select('section.code svg').append('g').call(xAxis);

    // Helper function to convert an ISO date string to an x pixel value
    var dateToX = function(options) {
        options = options || {};
        var offset = options.offset || 0;
        var propName = options.propName || 'date';

        return function(d) {
            var xVal = Math.floor(x(new Date(d[propName])));
            return Math.max(0, xVal + offset);
        };
    };

    // Plot the blogposts that are dumped as window._posts in the homepage template
    circleChart({
        data: window._posts,
        width: svgWidth,
        dateToX: dateToX,
        yBaseline: 30,
        el: d3.select('section.posts svg'),
        radius: function(d) { return 15 + Math.sqrt(d.length)/5; },
        groupClass: 'post',
        timeProp: 'date',
        urlProp: 'url',
        titleProp: 'title'
    });

    // Plot saved links from delicious's JSONP API
    var s = document.createElement('script');
    s.src = DELICIOUS_URL;
    document.body.appendChild(s);
    window.linksCallback = function(links) {
        // Divide links into tag group "buckets":
        var tagGroups = {'javascript': [], 'programming': [], 'other': []};
        var tags = Object.keys(tagGroups);
        links.forEach(function(l) {
            for (var i=0; i < tags.length; i++) {
                var t = tags[i];
                if (l.t && l.t.indexOf(t) > -1) return tagGroups[t].push(l);
                else if (i === tags.length - 1) tagGroups[t].push(l);   // Push to 'other' if no other matches
            }
        });

        // Plot a row of circles for each tag group
        for (var j=tags.length-1; j >= 0; j--) {
            var tag = tags[j];
            circleChart({
                data: tagGroups[tag],
                width: svgWidth,
                dateToX: dateToX,
                yBaseline: 20 + j*20,
                radius: 10,
                el: d3.select('section.links svg'),
                groupClass: tag,
                timeProp: 'dt',
                urlProp: 'u',
                titleProp: 'd'
            });
        }
    };

    // Plot Github source repos, using their CORS-enabled public API
    d3.json(GITHUB_URL, function(err, data) {
        if (err) return alert('gh fail');
        var myRepos = data.filter(function(r) { return !r.fork })
                          .filter(function(r) { return (new Date(r.pushed_at)) > START_DATE })
                          .sort(function(r1, r2) {
                            return (r1.pushed_at < r2.pushed_at) ? 1 : -1;
                          });
        githubGraph({
            data: myRepos,
            width: svgWidth,
            xScale: x,
            dateToX: dateToX,
            el: d3.select('section.code svg')
        });
    });

};
