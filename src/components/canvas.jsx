/* Written by Ye Liu */

import React from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import MapboxTraffic from '@mapbox/mapbox-gl-traffic';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

import emitter from '@utils/events.utils';
import Minimap from '@plugins/minimap.plugin';
import geocoder from '@plugins/geocoder.plugin';
import pulsingDot from '@plugins/pulsingDot.plugin';
import { mapStyles } from '@utils/map.utils';
import { ACCESS_TOKEN } from '@/config';
import '@styles/map.style.css';

const styles = {
    root: {
        width: '100%',
        position: 'fixed',
        top: 64,
        bottom: 0,
    }
};

class Canvas extends React.Component {
    state = {
        map: null,
        draw: null,
        minimap: null,
        popup: null,
        gettingPoint: null,
        tempId: null,
        styleCode: mapStyles.Streets.substring(16)
    }

    removeTempLayer = () => {
        // Remove layers
        var layers = this.state.map.getStyle().layers;
        layers.map(layer => {
            if (layer.id === 'custom-temp-point') {
                this.state.map.removeLayer('custom-temp-point');
                this.state.map.removeSource('custom-temp-point');
            }
            return true;
        });

        // Remove popup
        if (this.state.popup.isOpen()) {
            this.state.popup.remove();
        }
    }

    removeTempPoint = () => {
        this.state.draw.delete(this.state.tempId);
        this.setState({
            tempId: null
        });
    }

    componentDidMount() {
        // Verify access token
        mapboxgl.accessToken = ACCESS_TOKEN;

        // Check for browser support
        if (!mapboxgl.supported()) {
            alert('Your browser does not support Mapbox GL');
            return;
        }

        // Initialize map object
        var map = new mapboxgl.Map({
            container: 'map',
            style: mapStyles.Streets,
            center: [103.000, 35.000],
            zoom: 3
        });

        // Initialize map draw plugin
        var draw = new MapboxDraw({
            controls: {
                combine_features: false,
                uncombine_features: false
            }
        });

        // Add map controls
        var minimap = new Minimap({
            center: [103.000, 35.000]
        });

        map.addControl(new MapboxGeocoder({
            accessToken: mapboxgl.accessToken,
            mapboxgl: mapboxgl,
            localGeocoder: geocoder,
            placeholder: 'Search Address',
            marker: {
                color: 'red'
            }
        }), 'top-left');
        map.addControl(new mapboxgl.NavigationControl(), 'top-left');
        map.addControl(new mapboxgl.GeolocateControl(), 'top-left');
        map.addControl(new MapboxTraffic({
            trafficSource: new RegExp('/*/')
        }), 'top-left');
        map.addControl(draw, 'top-left');
        map.addControl(minimap, 'bottom-left');

        // Initialize popup
        var popup = new mapboxgl.Popup({
            closeButton: false,
            anchor: 'bottom'
        }).setHTML('<div id="popup-container"></div>');

        // Set state
        this.setState({
            map: map,
            draw: draw,
            minimap: minimap,
            popup: popup
        });

        // Recover search box style
        document.getElementsByClassName('mapboxgl-ctrl-geocoder--input')[0].setAttribute('type', 'search-box');

        // Bind event listeners
        map.on('draw.create', e => {
            if (!this.state.gettingPoint) {
                return;
            }

            // Save temp id
            this.setState({
                tempId: e.features[0].id
            });

            // Set point
            emitter.emit('setPoint', e.features[0], this.state.styleCode, this.state.map.getZoom());

            // Reset state
            this.setState({
                gettingPoint: false
            })
        });

        this.setMapStyleListener = emitter.addListener('setMapStyle', e => {
            // Remove last popup
            if (this.state.popup.isOpen()) {
                this.state.popup.remove();
            }

            // Set main map style
            this.state.map.setStyle(mapStyles[e]);

            // Set minimap style
            var minimap = new Minimap({
                center: this.state.map.getCenter(),
                style: mapStyles[e]
            });
            map.removeControl(this.state.minimap);
            map.addControl(minimap, 'bottom-left');

            this.setState({
                minimap: minimap,
                styleCode: mapStyles[e].substring(16)
            });
        });

        this.displayTempLayerListener = emitter.addListener('displayTempLayer', e => {
            // Remove previews temp layer
            this.removeTempLayer();

            // Add rendering resource
            if (!this.state.map.hasImage('pulsing-dot')) {
                this.state.map.addImage('pulsing-dot', pulsingDot, { pixelRatio: 3 });
            }

            // Add point layer on map
            this.state.map.addLayer({
                id: 'custom-temp-point',
                type: 'symbol',
                source: {
                    type: 'geojson',
                    data: e.geometry
                },
                layout: {
                    'icon-image': 'pulsing-dot'
                }
            });

            // Add popup on map
            this.state.popup.setLngLat(e.geometry.geometry.coordinates).addTo(this.state.map);
            emitter.emit('bindPopup', e);

            // Fly to the point
            this.state.map.flyTo({
                center: e.geometry.geometry.coordinates,
                zoom: 6,
                bearing: 0
            });
        });

        this.removeTempLayerListener = emitter.addListener('removeTempLayer', () => {
            // Remove temp layer
            this.removeTempLayer();
        });

        this.getPointListener = emitter.addListener('getPoint', () => {
            // Remove temp point
            this.removeTempPoint();

            // Active draw_point mode
            this.state.draw.changeMode('draw_point');
            emitter.emit('showSnackbar', 'default', 'Click on the map to select a point.');
            this.setState({
                gettingPoint: true
            })
        });

        this.removeTempPointListener = emitter.addListener('removeTempPoint', () => {
            // Remove temp point
            this.removeTempPoint();
        });
    }

    componentWillUnmount() {
        // Remove event listeners
        emitter.removeListener(this.setMapStyleListener);
        emitter.removeListener(this.displayTempLayerListener);
        emitter.removeListener(this.removeTempLayerListener);
        emitter.removeListener(this.getPointListener);
        emitter.removeListener(this.removeTempPointListener);
    }


    render() {
        return (
            <div id="map" style={styles.root}></div>
        );
    }
}

export default Canvas;