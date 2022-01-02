import { Component, ElementRef, OnInit } from '@angular/core';
import { MapboxService } from '../mapbox.service';
import * as mapboxgl from 'mapbox-gl';
import * as MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf'
import { environment } from 'src/environments/environment';
import { AppConstants } from '../app.constants';
import { DataService } from '../data-service.service';

interface countryModel {
  code: string,
  hdi: number,
  name: string
}

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements OnInit {

  // map: mapboxgl.Map; //gives error
  map: any;
  draw: any;
  style = 'mapbox://styles/mapbox/dark-v9';
  countryDataList: Array<countryModel> = [];
  userSelectedCountries: Array<countryModel> = [];
  place_coordinates: any = [];
  mapType = 'cluster_map'

  constructor(private mapService: MapboxService, private dataService: DataService) { }

  ngOnInit(): void {
    // this.mapService.buildMap();
    // mapboxgl.accessToken = environment.mapbox.accessToken; //gives error
    (mapboxgl as typeof mapboxgl).accessToken = environment.mapbox.accessToken;
    this.dataService.getCountryData().subscribe((resp: any) => {
      console.log(resp);
      this.countryDataList = resp.data;
    });

    this.dataService.getCoordinates().subscribe((resp: any) => {
      console.log(resp);
      this.place_coordinates = resp;
    });

    this.initializemap();
  }

  initializemap() {
    this.map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/dark-v10',
      // zoom: AppConstants.COUNTRY_SETTINGS['AUS'].zoom,
      // center: [AppConstants.COUNTRY_SETTINGS['AUS'].center[0], AppConstants.COUNTRY_SETTINGS['AUS'].center[1]],
      // center: Object.assign(AppConstants.COUNTRY_SETTINGS['AUS'].center),
      // attributionControl: false
      // center: [-103.5917, 40.6699],
      center: [138, -28],//AUS
      // center: [-120, 50],
      // zoom: 2,
      zoom: 3.5
      // zoom: 3
    });

    //
    this.map.addControl(new mapboxgl.NavigationControl({
      showCompass: false
    }), 'bottom-right');
    // const navigation = new mapboxgl.NavigationControl();
    // this.map.addControl(navigation, 'top-right');
    this.map.on('load', () => {

      //to highlight selected countries
      this.map.addSource('countries', {
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1'
      });

      this.addClusterMap();

      // this.addHeatMap();

      this.geoJsonArea();

      this.drawPolygon();

    });
  }

  selectCountry(element: HTMLLIElement, country: countryModel) {
    console.log(element.classList);
    console.log(country);
    if (element.classList.contains('selected')) {
      element.classList.remove('selected');
      this.userSelectedCountries.splice(this.userSelectedCountries.indexOf(country), 1);
      console.log(this.userSelectedCountries);
    }
    else {
      element.classList.add('selected');
      this.userSelectedCountries.push(country);
      console.log(this.userSelectedCountries);
    }
    console.log(element.classList);
    if (this.map.getLayer('countries-join')) {
      this.map.removeLayer('countries-join');
    }
    if (this.userSelectedCountries.length) {
      this.highLightCountry();
    }
    this.map.flyTo({ center: [13.5917, 49.6699], zoom: 3 });
  }


  highLightCountry() {
    ////
    // Add source for country polygons using the Mapbox Countries tileset
    // The polygons contain an ISO 3166 alpha-3 code which can be used to for joining the data
    // https://docs.mapbox.com/vector-tiles/reference/mapbox-countries-v1

    // Build a GL match expression that defines the color for every vector tile feature
    // Use the ISO 3166-1 alpha 3 code as the lookup key for the country shape
    const matchExpression = ['match', ['get', 'iso_3166_1_alpha_3']];
    console.log(this.userSelectedCountries);
    // Calculate color values for each country based on 'hdi' value
    for (const row of this.userSelectedCountries) {
      // Convert the range of data values to a suitable color
      const green = row['hdi'] * 255;
      const color = `rgb(0, ${green}, 0)`;

      matchExpression.push(row['code'], color);
    }

    // Last value is the default, used where there is no data
    matchExpression.push('rgba(0, 0, 0, 0)');

    // Add layer from the vector tile source to create the choropleth
    // Insert it below the 'admin-1-boundary-bg' layer in the style
    this.map.addLayer(
      {
        'id': 'countries-join',
        'type': 'fill',
        'source': 'countries',
        'source-layer': 'country_boundaries',
        'paint': {
          'fill-color': matchExpression
        }
      },
      'admin-1-boundary-bg'
    );
  }

  updateArea = (e?: any) => {
    console.log(this.draw);
    const data = this.draw.getAll();
    const answer: any = document.getElementById('calculated-area');
    if (answer) {
      if (data.features.length > 0) {
        const area = turf.area(data);
        // Restrict the area to 2 decimal points.
        const rounded_area = Math.round(area * 100) / 100;
        answer.innerHTML = `<p><strong>${rounded_area}</strong></p><p>square meters</p>`;
      } else {
        answer.innerHTML = '';
        if (e.type !== 'draw.delete')
          alert('Click the map to draw a polygon.');
      }
    }
  }

  addClusterMap() {
    this.map.addSource('clustermap', {
      type: 'geojson',
      data: 'https://docs.mapbox.com/mapbox-gl-js/assets/earthquakes.geojson',
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50
    });

    this.map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'clustermap',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#31bc73',
        'circle-radius': ['step', ['get', 'point_count'], 20, 1, 40, 2, 60, 3, 80],
        'circle-opacity': 0.15,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#31bc73'
      }
    });

    this.map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'clustermap',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12
      }
    });

    this.map.loadImage('../../assets/images/places-pin-green.png', (error: any, image: any) => {
      if (error) { throw error; }
      this.map.addImage('custom-marker', image);
      this.map.addLayer({
        id: 'unclustered-point',
        type: 'symbol',
        source: 'clustermap',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': 'custom-marker',
          'icon-size': 0.8,
          'icon-allow-overlap': true
        }
      });
    });

    // inspect a cluster on click
    this.map.on('click', 'clusters', (e: any) => {
      const features = this.map.queryRenderedFeatures(e.point, {
        layers: ['clusters']
      });
      const clusterId = features[0].properties.cluster_id;
      this.map.getSource('clustermap').getClusterExpansionZoom(
        clusterId,
        (err: any, zoom: any) => {
          if (err) return;

          this.map.easeTo({
            center: features[0].geometry.coordinates,
            zoom: zoom
          });
        }
      );
    });

    // When a click event occurs on a feature in
    // the unclustered-point layer, open a popup at
    // the location of the feature, with
    // description HTML from its properties.
    this.map.on('click', 'unclustered-point', (e: any) => {
      const coordinates = e.features[0].geometry.coordinates.slice();
      // console.log(coordinates);
      const mag = e.features[0].properties.mag;
      const tsunami =
        e.features[0].properties.tsunami === 1 ? 'yes' : 'no';

      // Ensure that if the map is zoomed out such that
      // multiple copies of the feature are visible, the
      // popup appears over the copy being pointed to.
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(
          `magnitude: ${mag}<br>Was there a tsunami?: ${tsunami}`
        )
        .addTo(this.map);
    });

  }

  removeClusterMap() {
    this.map.removeLayer('clusters');
    this.map.removeLayer('cluster-count');
    this.map.removeLayer('unclustered-point');
    this.map.removeSource('clustermap');
  }

  addHeatMap() {
    //heatMap
    // Add a geojson point source.
    // Heatmap layers also work with a vector tile source.
    this.map.addSource('heatmap', {
      'type': 'geojson',
      'data': 'https://docs.mapbox.com/mapbox-gl-js/assets/earthquakes.geojson'
    });
    this.map.addLayer(
      {
        'id': 'earthquakes-heat',
        'type': 'heatmap',
        'source': 'heatmap',
        'maxzoom': 9,
        'paint': {
          // Increase the heatmap weight based on frequency and property magnitude
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'mag'],
            0,
            0,
            6,
            1
          ],
          // Increase the heatmap color weight weight by zoom level
          // heatmap-intensity is a multiplier on top of heatmap-weight
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            1,
            9,
            3
          ],
          // Color ramp for heatmap.  Domain is 0 (low) to 1 (high).
          // Begin color ramp at 0-stop with a 0-transparancy color
          // to create a blur-like effect.
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(33,102,172,0)',
            0.2,
            'rgb(103,169,207)',
            0.4,
            'rgb(209,229,240)',
            0.6,
            'rgb(253,219,199)',
            0.8,
            'rgb(239,138,98)',
            1,
            'rgb(178,24,43)'
          ],
          // Adjust the heatmap radius by zoom level
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            2,
            9,
            20
          ],
          // Transition from heatmap to circle layer by zoom level
          'heatmap-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7,
            1,
            9,
            0
          ]
        }
      },
      'waterway-label'
    );

    this.map.addLayer(
      {
        'id': 'earthquakes-point',
        'type': 'circle',
        'source': 'heatmap',
        'minzoom': 7,
        'paint': {
          // Size circle radius by earthquake magnitude and zoom level
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7,
            ['interpolate', ['linear'], ['get', 'mag'], 1, 1, 6, 4],
            16,
            ['interpolate', ['linear'], ['get', 'mag'], 1, 5, 6, 50]
          ],
          // Color circle by earthquake magnitude
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'mag'],
            1,
            'rgba(33,102,172,0)',
            2,
            'rgb(103,169,207)',
            3,
            'rgb(209,229,240)',
            4,
            'rgb(253,219,199)',
            5,
            'rgb(239,138,98)',
            6,
            'rgb(178,24,43)'
          ],
          'circle-stroke-color': 'white',
          'circle-stroke-width': 1,
          // Transition from heatmap to circle layer by zoom level
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7,
            0,
            8,
            1
          ]
        }
      },
      'waterway-label'
    );
  }

  removeHeatMap() {
    this.map.removeImage('custom-marker');
    this.map.removeLayer('earthquakes-heat');
    this.map.removeLayer('earthquakes-point');
    this.map.removeSource('heatmap');
  }

  drawPolygon() {
    this.draw = new MapboxDraw({
      displayControlsDefault: false,
      // Select which mapbox-gl-draw control buttons to add to the map.
      controls: {
        polygon: true,
        trash: true
      },
      // Set mapbox-gl-draw to draw by default.
      // The user does not have to click the polygon control button first.
      // defaultMode: 'draw_polygon'
    });
    console.log(this.draw);
    this.map.addControl(this.draw);

    this.map.on('draw.create', this.updateArea);
    this.map.on('draw.delete', this.updateArea);
    this.map.on('draw.update', this.updateArea);

    this.map.on('mouseenter', ['clusters', 'unclustered-point'], () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', ['clusters', 'unclustered-point'], () => {
      this.map.getCanvas().style.cursor = '';
    });
  }

  geoJsonArea() {
    // Add a data source containing GeoJSON data.
    // These coordinates outline Maine.
    const coordinates = [
      [
        [-67.13734, 45.13745],
        [-66.96466, 44.8097],
        [-68.03252, 44.3252],
        [-69.06, 43.98],
        [-70.11617, 43.68405],
        [-70.64573, 43.09008],
        [-70.75102, 43.08003],
        [-70.79761, 43.21973],
        [-70.98176, 43.36789],
        [-70.94416, 43.46633],
        [-71.08482, 45.30524],
        [-70.66002, 45.46022],
        [-70.30495, 45.91479],
        [-70.00014, 46.69317],
        [-69.23708, 47.44777],
        [-68.90478, 47.18479],
        [-68.2343, 47.35462],
        [-67.79035, 47.06624],
        [-67.79141, 45.70258],
        [-67.13734, 45.13745]
      ]
    ];
    console.log('api coordinates: ', this.place_coordinates);
    console.log('api coordinates[0]: ', this.place_coordinates[0]);
    console.log('hardcoded coordinates: ', coordinates);
    let geojson = this.getPolygonsByType(this.place_coordinates, 'MultiPolygon');
    this.map.addSource('maine', {
      'type': 'geojson',
      // 'data': {
      //   'type': 'Feature',
      //   'geometry': {
      //     'type': 'Polygon',
      //     // 'coordinates': this.place_coordinates
      //     'coordinates': this.place_coordinates[0]
      //     // 'coordinates': coordinates
      //   }
      // }
      'data': geojson
    });

    // Add a new layer to visualize the polygon.
    this.map.addLayer({
      'id': 'maine',
      'type': 'fill',
      'source': 'maine', // reference the data source
      'layout': {},
      'paint': {
        'fill-color': '#0080ff', // blue color fill
        'fill-opacity': 0.5
      }
    });

    this.flyToPolygon(this.place_coordinates);
  }

  getPolygonsByType(geoAssetArray: any, polygonType: any) {
    const featureCollection: any = { type: 'FeatureCollection' };
    featureCollection['features'] = [];
    geoAssetArray.forEach((geoAssetObj: any) => {
      const data = geoAssetObj.coordinates;
      // const data = geoAssetObj;
      const feature = {
        type: 'Feature',
        // properties: {
        //   exclude: geoAssetObj.exclude
        // },
        geometry: {
          type: polygonType,
          coordinates: data
        }
      };
      featureCollection['features'].push(feature);
    });
    return featureCollection;
  }

  flyToPolygon(geoAssetArray: any) {
    if (geoAssetArray.length) {
      const geoAssetObj = geoAssetArray[0];
      console.log(geoAssetObj);
      const polygonType = geoAssetObj.type;
      // if (this.disableCustomPolygon) {
      //   $('.mapboxgl-ctrl-top-left').hide();
      // }
      if (Object.keys(geoAssetObj).length) {
        const data = geoAssetObj.coordinates;
        let center = geoAssetObj.center ? [geoAssetObj.center.split(',')[1], geoAssetObj.center.split(',')[0]] : undefined;
        console.log(center);
        // if (!center) {
        //   center = (polygonType == AppConstants.POLYGONS.SIMPLE) ? data[0][0] : data[0][0][0];
        // }
        if (!center) {
          center = data[0][0][0];
        }
        // this.map.flyTo({ center, zoom: (AppConstants.COUNTRY_SETTINGS[this.modalData.country].zoom + 4) });
        this.map.flyTo({ center, zoom: ((3.5) + 4) });
      }
    }
  }

  changeMapType(type: string) {
    this.mapType = type === 'cluster_map' ? 'heat_map' : 'cluster_map';
    if (this.mapType === 'cluster_map') {
      if(this.map.getSource('heatmap')){
        this.removeHeatMap();
      }
      if(!this.map.getSource('clustermap')) {
        this.addClusterMap()
      }
      this.map.flyTo({ center: [13.5917, 39.6699], zoom: 2 });
    }
    else {
      if(this.map.getSource('clustermap')){
        this.removeClusterMap();
      }
      if(!this.map.getSource('heatmap')) {
        this.addHeatMap()
      }
      this.map.flyTo({ center: [-33.5917, 39.6699], zoom: 1.5 });
    }
  }

}
