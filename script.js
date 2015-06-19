jQuery.fn.exists = function (){
    return jQuery(this).length > 0;
  };

  // --------------------------------------------------------------------
  // Main function that will be called at the bottom of the page to
  // initialize and start the application lifecycle
  // --------------------------------------------------------------------
  function applicationInitialize(){
    window.appGlobals = {
      map: null,
      collectMode: false,
      compassionLayer: null,
      locator: null,
      locatorURL: "//geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer",
      compassionLayerURL:"http://services.arcgis.com/8df8p0NlLFEShl0r/arcgis/rest/services/CompassionService_Jun19/FeatureServer/0",
      center: [-93.236330, 44.971881]
    };

    $.mobile.pagecontainer({ defaults: true });

    $.mobile.pagecontainer({
      create: function (event, ui){
        // ----------------------------------------------------
        // Invoke function to initialize the code for the
        // ArcGIS API for JavaScript
        // ----------------------------------------------------
        $(".ui-loader").show();
        initializeEsriJS();
      }
    });

    function initializeEsriJS(){
      require([
          "dojo/_base/array",
          "dojo/_base/lang",
          "dojo/dom-construct",
          "dojo/on",
          "dojo/parser",
          "dojo/query!css3",
          "esri/Color",
          "esri/config",
          "esri/dijit/AttributeInspector",
          "esri/dijit/Geocoder",
          "esri/dijit/HomeButton",
          "esri/dijit/LocateButton",
          "esri/dijit/PopupMobile",
          "esri/geometry/webMercatorUtils",
          "esri/graphic",
          "esri/InfoTemplate",
          "esri/layers/FeatureLayer",
          "esri/map",
          "esri/symbols/PictureMarkerSymbol",
          "esri/symbols/SimpleLineSymbol",
          "esri/symbols/SimpleMarkerSymbol",
          "esri/tasks/locator",
          "esri/tasks/query", "dojo/domReady!"
        ], function (array, lang, domConstruct, on, parser, query, Color, esriConfig, AttributeInspector, Geocoder,
          HomeButton, LocateButton, PopupMobile, webMercatorUtils, Graphic, InfoTemplate, FeatureLayer, Map, PictureMarkerSymbol,
          SimpleLineSymbol, SimpleMarkerSymbol, Locator, Query){

          parser.parse();
          // ----------------------------------------------------
          // This sample requires a proxy page to handle
          // communications with the ArcGIS Server services. You
          // will need to replace the url below with the location
          // of a proxy on your machine. See the
          // "Using the proxy page" help topic for details on
          // setting up a proxy page.
          // ----------------------------------------------------
          esriConfig.defaults.io.proxyUrl = "/sproxy/";

          // ----------------------------------------------------
          // Create the symbology for the selected feature,
          // when a Popup opens
          // ----------------------------------------------------
          var slsHighlightSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([38, 38, 38, 0.7]), 2);
          var sms = new SimpleMarkerSymbol();
          sms.setPath("M21.5,21.5h-18v-18h18V21.5z M12.5,3V0 M12.5,25v-3 M25,12.5h-3M3,12.5H0");
          sms.setSize(45);
          sms.setOutline(slsHighlightSymbol);
          var infoWindowPopup = new PopupMobile({markerSymbol: sms}, domConstruct.create("div"));

          // ----------------------------------------------------
          // Dictionary objects to provide domain value lookup for fields in popups
          // ----------------------------------------------------
          var compassionFieldDomainCodedValuesDict = {};
          var requestTypeFieldDomainCodedValuesDict = {};

          // ----------------------------------------------------
          // InfoTemplate for the FeatureLayer
          // ----------------------------------------------------
          var featureLayerInfoTemplate = new InfoTemplate();
          featureLayerInfoTemplate.setTitle("<b>Compassion</b>");
          var infoTemplateContent = "<span class=\"infoTemplateContentRowLabel\">Date:</span>" + 
            "<span class=\"infoTemplateContentRowItem\">" + 
                "${Date:DateString(local: true,hideTime: false)}" + 
            "</span><br>" +
            "<span class=\"infoTemplateContentRowLabel\">Act of Compassion:</span>" +
            "<span class=\"infoTemplateContentRowItem\">"+ 
                "${Signs_of_Compassion:requestCompassionDomainLookup}"+
            "</span><br>";
          featureLayerInfoTemplate.setContent(infoTemplateContent);

          // ----------------------------------------------------
          // Formatting functions for infoTemplate
          // ----------------------------------------------------
          //severityDomainLookup = function (value, key, data){
            //return compassionFieldDomainCodedValuesDict[value];
          //};
          requestCompassionDomainLookup = function (value, key, data){
            return compassionFieldDomainCodedValuesDict[value];
          };

          formatRequestID = function (value, key, data){
            var searchText = new String(value);
            var formattedString = searchText.replace(/(\d)(?=(\d\d\d)+(?!\d))/gm, "$1,");
            return formattedString;
          };
          formatPhoneNumber = function (value, key, data){
            return "<a href=\"tel:" + data.phone + "\">" + data.phone + "</a>";
          }

          // ----------------------------------------------------
          // Initialize the main User Interface components
          // ----------------------------------------------------
          appGlobals.map = new Map("ui-map", {
            sliderOrientation: "horizontal",
            sliderPosition: "bottom-right",
            basemap: "topo",
            center: appGlobals.center,
            zoom: 15,
            sliderStyle: "small",
            infoWindow: infoWindowPopup
          });

          appGlobals.locator = new Locator(appGlobals.locatorURL);

          var geocoder = new Geocoder({
            arcgisGeocoder: {
              placeholder: "Search "
            },
            map: appGlobals.map
          }, "ui-dijit-geocoder");

          var geoLocate = new LocateButton({
            map: appGlobals.map
          }, "ui-dijit-locatebutton");

          var homeButton = new HomeButton({
            map: appGlobals.map
          }, "ui-home-button-hidden");

          // ----------------------------------------------------
          // Initialize the FeatureLayer, LayerInfo, and
          // AttributeInspector
          // ----------------------------------------------------
          appGlobals.compassionLayer = new FeatureLayer(appGlobals.compassionLayerURL,
            {mode: FeatureLayer.MODE_SNAPSHOT,
              infoTemplate: featureLayerInfoTemplate,
              outFields: ["*"]
            });
          var layerInfoArray = [
            {
              "featureLayer": appGlobals.compassionLayer,
              "showAttachments": false,
              "showDeleteButton": false,
              "isEditable": true,
              "fieldInfos": [
                {
                  "fieldName": "Signs_of_Compassion",
                  "label": "Act of Compassion",
                  "isEditable": true
                },
                 {
                  "fieldName": "Date",
                  "label": "Date",
                  "isEditable": true
                }

              ]
            }
          ];


          var attributeInspector = new AttributeInspector({
            layerInfos: layerInfoArray
          }, "ui-attributes-container");

          // ----------------------------------------------------
          // Returns the Feature Template given the Coded Value
          // ----------------------------------------------------
          function getFeatureTemplateFromCodedValueByName(item){
            returnType = appGlobals.compassionLayer.templates[0];
            return returnType;
          }

          // ----------------------------------------------------
          // Initializes event handler for map and prepares the
          // FeatureTemplate
          // ----------------------------------------------------
          function addCitizenRequestFeature(item){

            $("#ui-collection-prompt").popup("open");

            var citizenRequestFeatureTemplate = getFeatureTemplateFromCodedValueByName(item);
            var mapClickEventHandler = on(appGlobals.map, "click", function (event){

              //only capture one click
              mapClickEventHandler.remove();
              // set back to false, since the map has been clicked on.
              appGlobals.collectMode = false;

        
              var newAttributes = lang.mixin({}, citizenRequestFeatureTemplate.prototype.attributes);
              newAttributes["Date"] = new Date();
              var newGraphic = new Graphic(event.mapPoint, null, newAttributes);
              // ----------------------------------------------------
              // Creates the new feature in the citizen request
              // FeatureLayer
              // ----------------------------------------------------
              appGlobals.compassionLayer.applyEdits([newGraphic], null, null, function (adds){
                var query = new Query();
                var res = adds[0];
                query.objectIds = [res.objectId];
                // ----------------------------------------------------
                // Query the citizen request FeatureLayer for the
                // Graphic that was just added, well use its geometry
                // to lookup the address at that location
                // ----------------------------------------------------
                appGlobals.compassionLayer.queryFeatures(query, function (result){
                  if (result.features.length > 0) {
                    var currentFeature = result.features[0];

                    var currentFeatureLocation = webMercatorUtils.webMercatorToGeographic(currentFeature.geometry);
                    // ----------------------------------------------------
                    // Convert the feature's location to a real world
                    // address using ArcGIS.com locator service
                    // ----------------------------------------------------
                    appGlobals.locator.locationToAddress(currentFeatureLocation, 100, function (candidate){
                      var address = [];
                      var displayAddress;
                      if (candidate.address) {
                        if (candidate.address.Address) {
                          address.push(candidate.address.Address);
                        }
                        if (candidate.address.City) {
                          address.push(candidate.address.City + ",");
                        }
                        if (candidate.address.Region) {
                          address.push(candidate.address.Region);
                        }
                        if (candidate.address.Postal) {
                          address.push(candidate.address.Postal);
                        }
                        displayAddress = address.join(" ");
                      }
                      else {
                        displayAddress = "No address for this location";
                      }
                      // ----------------------------------------------------
                      // Tell jQuery Mobile to navigate to the page containing
                      // the AttributeInspector
                      // ----------------------------------------------------
                      $.mobile.changePage("#ui-attributes-page", null, true, true);
                      //display the geocoded address on the attribute dialog.
                      $("#currentAddress")[0].textContent = displayAddress;
                    }, function (error){
                      console.warn("Unable to find address, maybe there are no streets at this location",
                        error.details[0]);
                      // ----------------------------------------------------
                      // Tell jQuery Mobile to navigate to the page containing
                      // the AttributeInspector
                      // ----------------------------------------------------
                      $.mobile.changePage("#ui-attributes-page", null, true, true);
                      //display the geocode error on the attribute dialog.
                      $("#currentAddress")[0].textContent = error.details[0];
                    });
                  }
                  else {
                    console.warn("Unable to locate the feature that was just collected.");
                  }
                });
              }, function (error){
                // do some great error catching
                console.error(JSON.stringify(error));
              });
            });

          }

          function layersAddResultEventHandler(event){
            var layersArray = event.layers;

            $.each(layersArray, function (index, value){
              var currentLayer = value.layer;
              var compassionValueArray = currentLayer.fields[1].domain.codedValues;

              $("#ui-feature-list").append("<li data-role=\"list-divider\" class=\"ui-li-divider ui-bar-inherit ui-first-child\">Sign of Compassion</li>");

              $.each(compassionValueArray, function (i, info){

                  compassionFieldDomainCodedValuesDict[info.value] = info.name;
                  // ----------------------------------------------------
                  // Initialize an event handler for the list item click
                  // ----------------------------------------------------
                  var listItem = $("<li/>").on("click", function (event){

                    appGlobals.map.setMapCursor("pointer");
                    appGlobals.collectMode = true;

                  });

            
                  listItem.attr("data-theme", "a");
                  var listContent = [];
                  listContent.push("<a href=\"#ui-map-page\" class=\"ui-btn ui-btn-icon-right ui-icon-plus\">" + info.name + "</a>");
                  listItem.append(listContent.join(""));

                  // ----------------------------------------------------
                  // unordered list in parent div ui-features-panel
                  // ----------------------------------------------------
                  $("#ui-feature-list").append(listItem);
                });
                
            }); 
            addCitizenRequestFeature("Compassion"); 
            
        };

          function initializeEventHandlers(){

            on(appGlobals.map, "load", function (event){
              appGlobals.map.infoWindow.resize(185, 100);
              on(appGlobals.map, "layers-add-result", layersAddResultEventHandler);
            });

            on(appGlobals.compassionLayer, "error", function (event){
              console.error("compassionLayer failed to load.", (event.error));
              $(".ui-loader").hide();
            });

            on(appGlobals.compassionLayer, "load", function (event){
                var featureLayerTemplates = appGlobals.compassionLayer.templates;
                if (appGlobals.compassionLayer.hasOwnProperty("fields")) {
                  var fieldsArray = appGlobals.compassionLayer.fields;
                  array.forEach(fieldsArray, function (field, i){
                    if (field.name === "Signs_of_Compassion") {
                          var codedValuesArray = field.domain.codedValues;
                          array.forEach(codedValuesArray, function (codedValue){
                            compassionFieldDomainCodedValuesDict[codedValue.code] = codedValue.name;

                          });
                        
                      
                    }
                  });
                }
                else {
                  console.error("Unable to find property fields in: ", JSON.stringify(appGlobals.compassionLayer));
                }
                $(".ui-loader").hide();
              }
            );

            on(appGlobals.compassionLayer, "click", function (event){
              appGlobals.map.infoWindow.setFeatures([event.graphic]);
            });

            on(attributeInspector, "attribute-change", function (event){
              var feature = event.feature;
              if (event.fieldName && event.fieldValue) {
                feature.attributes[event.fieldName] = event.fieldValue;
                feature.getLayer().applyEdits(null, [feature], null);
              }
              else {
                feature.getLayer().applyEdits(null, [feature], null);
              }
            });

            on(geoLocate, "locate", function (event){
              var coords = event.position.coords;
            });

            on(infoWindowPopup, "show", function (event){
              if ($("*.esriMobileNavigationItem.left > img[src]").exists()) {
                $("*.esriMobileNavigationItem.left > img").removeAttr("src");
              }
              if ($("*.esriMobileNavigationItem.right > img[src]").exists) {
                $("*.esriMobileNavigationItem.right > img").removeAttr("src");
              }
            });

            geocoder.startup();
            geoLocate.startup();
            homeButton.startup();

            $("#ui-home-button").click(function (){
              homeButton.home();
              $("#ui-settings-panel").panel("close");
            });

            $(".basemapOption").click(swapBasemap);

            $("#ui-features-panel").on("popupafteropen", function (event, ui){

              $("#ui-features-panel").on("popupafterclose", function (event, ui){
                if (appGlobals.collectMode) {
                  $("#ui-collection-prompt").show();
                }
                else {
                  $("#ui-collection-prompt").hide();
                }
                setTimeout(function (){
                  $("#ui-collection-prompt").popup("open");
                }, 15);
              });
            });

            $("#ui-collection-prompt").on("popupafteropen", function (event, ui){
              setTimeout(function (){
                $("#ui-collection-prompt").popup("close");
              }, 5000);
            });
          }

          // ----------------------------------------------------
          // Initialize Event Handlers and add the citizen request
          // layer to the map
          // ----------------------------------------------------
          initializeEventHandlers();
          appGlobals.map.addLayers([appGlobals.compassionLayer]);


        }
      ); // end require / function
    }

    function swapBasemap(event){
      var _basemapName = event.target.dataset.basemapname;
      appGlobals.map.setBasemap(_basemapName);
      $("#ui-settings-panel").panel("close");
    }
  }
  // --------------------------------------------------------------------
  // Begin the sequence by calling the initialization function
  // --------------------------------------------------------------------
  $(function (){
    applicationInitialize();
  });