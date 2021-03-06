var width = 960,
    height = 480,
    height_slider = 80;


//===============================================================================
// Brush 
  var svg_slider = d3.select('#worldMapSlider').append('g')
    .attr("transform",  "translate(" + 40 + "," + 40 + ")")

  var x = d3.scale.linear()
    .domain([2008, 2014])
    .range([0, width-60])
    .clamp(true);

  var brush = d3.svg.brush()
    .x(x)
    .extent([2008, 2008])
    .on("brush", updateBrush);

  var myPlotInterval;

  function updateBrush(){
    var value = brush.extent()[0];
    
    if (d3.event.sourceEvent) { // not a programmatic event
      value = x.invert(d3.mouse(this)[0]);
      brush.extent([value, value]);
    }

    handle.attr("cx", x(value));      
    // Here for doing the animation
    // clearInterval(myPlotInterval);
    // myPlotInterval = setInterval(plotHeart, Math.floor(100-value+1));
  }

  // slider.select(".background")
  //     .attr("height", height);

   svg_slider.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0 " + height_slider - 50 + ")")
    .attr("z-index", "10")
    .attr("fill", "black")
    .call(d3.svg.axis()
          .scale(x)
          .orient("bottom")
          .tickFormat(function(d) { return d; })
          .tickSize(0)
          .tickPadding(4)
          // .attr("dy", "-1em")
          // .text("Speed of creation")
         )
    .append("text")
    .attr("x", x(2008))
    .attr("dy", "-1em")
    .style("text-anchor", "end")
    .text("Date")
    .select(".domain")
    .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
    .attr("class", "halo");

  var slider = svg_slider.append("g")
    .attr("class", "slider")
    .call(brush);

  slider.selectAll(".extent,.resize")
    .remove();

  slider.select(".background")
    .attr("height", height_slider);

  var handle = slider.append("circle")
    .attr("class", "handle")
    .attr("transform", "translate(0," + height_slider - 50  + ")")
    .attr("r", 9);

//===============================================================================

//d3.geo.azimuthalEqualArea()
var projection = d3.geo.mercator() 
  .scale((width + 1) / 1.65 / Math.PI)
  .translate([width / 2 - 25, height / 2 + 80])
  .precision(.1);

var path = d3.geo.path()
  .projection(projection);

var graticule = d3.geo.graticule();

// Zoom hack
var zoom = d3.behavior.zoom()
  .translate([0, 0])
  .scale(1)
  .scaleExtent([0.5, 10])
  .on("zoom", zoomed);

d3.select('#worldMap')
  .attr("class", "overlay")
  .attr("width", width)
  .attr("height", height)
  .call(zoom);

var quantize = d3.scale.quantize()
  .domain([0, .15])
  .range(d3.range(9).map(function(i) { return "q" + i + "-9"; }));

var city_radius = 5;

var svg =  d3.select('#worldMap').append("g");

function zoomed() {
  var d3_scale = d3.event.scale;
  svg.attr("transform", "translate(" + d3.event.translate + ") scale(" + d3_scale + ")");
  svg.selectAll(".city")
    .attr("r", city_radius/Math.sqrt(d3_scale))
    .style("stroke-width", 2/Math.sqrt(d3_scale) + 'px');
}
// End of Zoom

svg.append("path")
  .datum(graticule)
  .attr("class", "graticule")
  .attr("d", path);

var count_by_id = d3.map();
var date_format = d3.time.format("%Y-%m-%d");
var data_ts;
// function(error, data){data_ts = data;})

queue()
  .defer(d3.json, "data/world-50m.json")
  .defer(d3.csv, "data/dat_ly_ts.csv")
  .await(createMap);

// d3.csv('data/location.csv', putCityVoronoi)


function createMap(error, world, data) {
  data_ts = data;
  var nest = d3.nest()
    .key(function(d) {return d.iso3})
    .rollup(function(leaves) {return leaves.N})
    .entries(data);


  svg.insert("path", ".graticule")
    .datum(topojson.feature(world, world.objects.land))
    .attr("class", "land")
    .attr("d", path);

  svg.insert("path", ".graticule")
      .datum(topojson.mesh(world, world.objects.countries, function(a, b) { return a !== b; }))
      .attr("class", "boundary")
      .attr("d", path);


}


// Put dots on the map for the location from a csv file 
// location, long, lat, sizeBubble, nPictures
function putCityVoronoi(error, data){
  
  var centroid = d3.geo.centroid;

  data.forEach(function(d){
    d.longitude = +d.longitude;
    d.latitude = +d.latitude;
    d.geojson = {type: 'Point', 
                 coordinates: [d.latitude, d.longitude]};
  });
  
  //Color scale
  var color = d3.scale.quantile()
    .range(d3.range(10).map(function(i) { j = i; return "q" + j + "-10"; }))
    .domain([0, 1]);

  //Voronoi tessleation
  var voronoi = d3.geom.voronoi()
    .clipExtent([[0,0], [width, height]]);

  //Add a circle in the middle of the municipalities
  var pathCentroid = function(d, i){
    return path.centroid(d.geojson);
  }

  
  // Voronoi tesslation

  //Creates a voronois tesselation
  function polygon(d) {
    return "M" + d.join("L") + "Z";
  }
  
  positions = data.map(function(d){
    return pathCentroid(d);
  })

  polygons = d3.geom.voronoi(positions);

  var voronoiArea = svg.append("g")
    .attr("class", "municipality-voronoi")
  // .attr("transform", 'translate(-' + translate_width_constant + ',0)')
    .selectAll("path")
    .data(polygons, polygon) //apply the polygon function to the dat polygon
    .enter().append("path")
    .attr("d", polygon)
    .attr("stroke-width", "0")
    .on("click", updateSlider);
  
  var tooltip = d3.select("body")
	  .append("div")
    .attr("class", "d3-tip worldMapTip")
	  .style("position", "absolute")
	  .style("z-index", "10")
	  .style("visibility", "hidden");
  
  function htmlInsideTooltipFn(d, i){
    d = data[i];
    htmlText = "<div align='center'>";
    htmlText += '<font color="red">' + d.location + "</font> ";
    htmlText += '   (' + d.visitedDate + ')';
    htmlText += '</div>';
    // Add something here (Such as descriptions or date of tripe)  
    return htmlText;
  }
  addToolTip(voronoiArea, tooltip, htmlInsideTooltipFn);
  
  //Add Circle to cities
  var cities = svg.append("g")
    .selectAll("circle")
    .data(data)
    .enter().append("circle")
    .attr("class", "city")
//    .attr('r', function(d) {return 0.22*(d.bubbleSize+1);})
    .attr('r', city_radius)
    .attr("cx", function(d) { return pathCentroid(d)[0]; })
    .attr("cy", function(d) { return pathCentroid(d)[1]; })
    .on("click", updateSlider);

  addToolTip(cities, tooltip, htmlInsideTooltipFn);
  
  var this_location;
  function updateSlider(d, i){
    
    d = data[i];
    if (this_location == d.location){
      return;
    }
    console.log(this_location);
    this_location = d.location;
    var newSlides = updatePictures(d.location, d.nPictures);
    d3.select('#pictureSlider')
      .remove();
    
    d3.select('#sliderDiv')
      .append('div')
      .attr('class', 'flexslider')      
      .attr('id', 'pictureSlider')
      .style('width', '640px')
      .style('height', '480px')
      .html(newSlides);
    
    $('.flexslider').flexslider({
      animation: "slide",
      slideshowSpeed: 3000,
    });
  }

  function updatePictures(location, nPictures){
    var newPict = function(n){            
      return '<li> \n  <img src="data/pictures/' + 
        location + '/' + (n < 10 ? '0' + n : n) + 
        '.jpg" /> \n </li> \n';
    };
    
    htmlText = '<ul class="slides"> \n';
    for (var i=1; i <= nPictures; ++i){
      htmlText += newPict(i);
    }
    htmlText += '</ul> \n';
    //console.log(htmlText);
    return htmlText;
  }

}

function addToolTip(g, tooltip, htmlInsideTooltipFn){
  g.on("mouseover", function(d, i){
    tooltip
      .html(htmlInsideTooltipFn(d,i))
      .style("visibility", "visible")
    return true;})
	  .on("mousemove", function(){return tooltip.style("top", (d3.event.pageY-10)+"px").style("left",(d3.event.pageX+10)+"px");})
	  .on("mouseout", function(){return tooltip.style("visibility", "hidden");})
}

d3.select(self.frameElement).style("height", height + "px");
