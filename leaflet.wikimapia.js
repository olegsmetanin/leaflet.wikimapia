//http://api.wikimapia.org/?function=box&bbox=37.617188,55.677586,37.70507,55.7271128&key=60175C48-4B0C86C-A2D4D106-A5F37CAF-5A760C96-45526DF2-6D90C63B-511E68EE&pack=gzip&format=jsonp&jsoncallback=qwe

/*
 * L.WikimapiaJSON turns Wikimapia API box (http://wikimapia.org/wiki/API_box) data into a Leaflet layer.
 */

L.WikimapiaJSON = L.FeatureGroup.extend({

	initialize: function (wikijson, options) {
		var i, j;

		L.setOptions(this, options);

		this._layers = {};

		if (wikijson && wikijson.folder.length>0) {
			for (i=0;i<wikijson.folder.length;i++) {
				var polycoords = wikijson.folder[i].polygon
					, coords = [];

					for (j=0;j<polycoords.length;j++) {
						coords.push([polycoords[j].y,polycoords[j].x]);
					}

					var layer = new L.Polygon(coords);
					layer.feature = wikijson.folder[i];

					this.resetStyle(layer);

					if (options.onEachFeature) {
						options.onEachFeature(layer.feature, layer);
					}

					this.addLayer(layer);

			}
		}
	}

	, resetStyle: function (layer) {
		var style = this.options.style;
		if (style) {
			// reset any custom styles
			L.Util.extend(layer.options, layer.defaultOptions);

			this._setLayerStyle(layer, style);
		}
	}

	, setStyle: function (style) {
		this.eachLayer(function (layer) {
			this._setLayerStyle(layer, style);
		}, this);
	}

	, _setLayerStyle: function (layer, style) {
		if (typeof style === 'function') {
			style = style(layer.feature);
		}
		if (layer.setStyle) {
			layer.setStyle(style);
		}
	}

});

L.WikimapiaAPI = L.Class.extend({
    includes: L.Mixin.Events

    , timer: null
    , mouseMoveTimer: null
    , counter: 0
    , options: {
         url:'http://api.wikimapia.org/'
        , opacity: 1
        , attribution: '<a href="http://wikimapia.org" target="_blank">Wikimapia.org</a>'

    }

    , initialize: function (options) {
        L.setOptions(this, options);
        this._hash = {};
        this._mouseIsDown = false;
    }

    , setOptions: function (newOptions) {
        L.setOptions(this, newOptions);
        this._update();
    }

    , onAdd: function (map) {
        this._map = map;

        map.on('viewreset', this._update, this);
        map.on('moveend', this._update, this);
        map.on('zoomend', this._update, this);
        map.on('mousemove', this._mousemove, this);
        map.on('mouseout', this._mouseout, this);
        map.on('mousedown', this._mousedown, this);
        map.on('mouseup', this._mouseup, this);

        this._update();
    }

    , onRemove: function (map) {

        map.off('viewreset', this._update, this);
        map.off('moveend', this._update, this);
        map.off('zoomend', this._update, this);
        map.off('mousemove', this._mousemove, this);
        map.off('mouseout', this._mouseout, this);
        map.off('mousedown', this._mousedown, this);
        map.off('mouseup', this._mouseup, this);


    }

   , addTo: function (map) {
        map.addLayer(this);
        return this;
    }

    , getAttribution: function () {
        return this.options.attribution;
    }

    , _wikiPointsToPolygon: function (polyPoints) {

		coords = [];

		for (j=0;j<polyPoints.length;j++) {
			coords.push([polyPoints[j].y,polyPoints[j].x]);
		}

		return new L.Polygon(coords);

    }

    , _hideFeature: function () {
    	var that = this;

		if (that._feature) {
				that._feature.polygon.unbindLabel();
				that._map.removeLayer(that._feature.polygon);
				that._feature = null;
			}
    }

    , _showFeature:function(feature) {
    	var that = this;

		if (!(that._feature && that._feature.id==feature.id)) {
			that._hideFeature();

			that._feature = feature;

			if (that.options.onActiveFeature) {
				that.options.onActiveFeature(that._feature, that._feature.polygon);
			}

			if (that.options.style) {
				that._feature.polygon.setStyle(that.options.style(that._feature));
			}

			that._feature.polygon.bindLabel(that._feature.name).addTo(that._map);

		}
    }

    , _mousemove: function (e) {

    	var that = this;

    	if (!that._mouseIsDown) {

	        if (that.mouseMoveTimer) {
	        	window.clearTimeout(that.mouseMoveTimer);
	        }

			that.mouseMoveTimer = window.setTimeout(function() {


		    	var point = e.latlng
		    		, features = that._filter(that._hash, function (item) {
		    			return (item.bounds.contains(point) && that._pointInPolygon(point, item.polygon))
		    		});

		    		if (features.length>0) {
		    			var feature = (features.length == 1 ? features[0] : that._chooseBestFeature(features));
		    			that._showFeature(feature);
					} else {
						that._hideFeature();
					}

		    }, 0);
    	}
    }

    , _mousedown: function () {
    	var that = this;
    	that._mouseIsDown = true;
    }

    , _mouseup: function () {
    	var that = this;
    	that._mouseIsDown = false;
    }

    , _chooseBestFeature: function (features) {
		var that = this
			, bestLookingArea = that._boundsArea(that._map.getBounds())/12
			, bestFeatureIndex = 0
			, bestFeatureScale = that._boundsArea(features[0].bounds)/bestLookingArea;
		if (bestFeatureScale < 1) {bestFeatureScale = 1/bestFeatureScale}

		for (var i=1; i<features.length;i++) {
			var featureArea = that._boundsArea(features[i].bounds)
				, featureScale = featureArea/bestLookingArea;
			if (featureScale < 1) {featureScale = 1/featureScale}

			if (featureScale<bestFeatureScale) {
				bestFeatureIndex = i;
				bestFeatureScale = featureScale;
			}
		}

		return features[bestFeatureIndex];
    }

 	, _boundsArea: function(bounds) {
 		var sw = bounds.getSouthWest()
 			, ne = bounds.getNorthEast();
 		return (ne.lat-sw.lat)*(ne.lat-sw.lat)+(ne.lng-sw.lng)*(ne.lng-sw.lng)
 	}

    , _mouseout: function () {
		var that = this;
		that._hideFeature();
    }

    , _filter: function(obj, predicate) {
		var res=[];

		$.each(obj, function(index,item) {
			if (predicate(item)) {res.push(item)}
		});

		return res;
    }

	, _pointInPolygon: function (point, polygon) {
	    // ray-casting algorithm based on
	    // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

	    var x = point.lng
	    , y = point.lat
	    , poly = polygon.getLatLngs()
	    , inside = false;

	    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {

	        var xi = poly[i].lng, yi = poly[i].lat
	        , xj = poly[j].lng, yj = poly[j].lat
	        , intersect = ((yi > y) != (yj > y))
	            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

	        if (intersect) inside = !inside;

	    }

	    return inside;
	}

	, _update: function () {
		var that = this;

        if (that.timer) {
        	window.clearTimeout(that.timer);
        }

		that.timer = window.setTimeout(function() {

				that.counter++;
		        $.ajax({
		            url : that.options.url
		            , dataType : 'jsonp'
		            , jsonp : 'jsoncallback'
		            , data : {
		                'function' : 'box'
		                , 'bbox' : that._map.getBounds().toBBoxString()
		                , 'key' : that.options.key
		                , 'format' : 'jsonp'
		                , 'count' : '100'
		                , 'pack' : 'gzip'
		            }
	              	, jsonpCallback: 'wikimapiacallback'+that.counter
	              	, success: function(data) {
	              		that.counter--;
			            if (data) {

		            		for (var i=0;i<data.folder.length;i++) {
		            			var item = data.folder[i];

	            				that._hash[item.id] = {
	            					id: item.id
	            					, name: item.name
	            					, url : item.url
	            					, bounds: L.latLngBounds([item.location.south, item.location.west],[item.location.north, item.location.east])
	            					, polygon: that._wikiPointsToPolygon(item.polygon)
	            				};
		            		}
				        }
				    }
		        })

	    },0);

	    }
})