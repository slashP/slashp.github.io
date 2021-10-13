// ==UserScript==
// @name         Copy/paste Geoguessr map data
// @namespace    slashP
// @version      0.1
// @description  Copy latitude, longitude, heading and pitch information from Geoguessr maps as JSON data. Add locations to maps by pasting JSON data in map maker.
// @author       slashP
// @match        https://www.geoguessr.com/map-maker/*
// @license       MIT
// ==/UserScript==

(function () {
  'use strict';
  const copyMapDataButtonHtml = '<button id="copyMapData" style="margin-left: 1rem;" class="button button--medium button--secondary margin--left-small" type="button"><span class="button__animation"></span><span class="button__label">Copy map data to clipboard</span></button><span style="margin-left: 10px;" id="copyMapDataFeedback"></span>';
  const addLocationsButtonHtml = '<div class="center-content"><button id="addLocations" style="margin-top: 50px;" class="button button--medium button--danger margin--left-small" type="button"><span class="button__animation"></span><span class="button__label">Add locations from clipboard data and save map</span></button><span style="margin-left: 10px;" id="addLocationsFeedback"></span></div>';
  const mapJsonDataSelector = '[type="application/json"]';
  const buttons = [
    { html: copyMapDataButtonHtml, containerSelector: ".center-content" },
    { html: addLocationsButtonHtml, containerSelector: ".container__content" }
  ];
  for (let button of buttons) {
    const buttonElement = document.createElement("span");
    buttonElement.innerHTML = button.html;
    document.querySelector(button.containerSelector).appendChild(buttonElement);
  }

  const getExistingMapData = () => {
    const map = JSON.parse(document.querySelector(mapJsonDataSelector).innerText).props.pageProps.map;
    return {
      id: map.id,
      name: map.name,
      description: map.description,
      avatar: map.avatar,
      highlighted: map.highlighted,
      published: map.published,
      customCoordinates: map.customCoordinates
    };
  }
  const uniqueBy = (arr, selector) => {
    const flags = {};
    return arr.filter(entry => {
      if (flags[selector(entry)]) {
        return false;
      }
      flags[selector(entry)] = true;
      return true;
    });
  };

  document.getElementById("copyMapData").onclick = () => {
    const map = getExistingMapData();
    const setMapFeedbackText = text => { document.getElementById("copyMapDataFeedback").innerText = text; }
    navigator.clipboard.writeText(JSON.stringify(map, null, 2)).then(() => {
      setMapFeedbackText("Map data copied to clipboard.");
      setTimeout(() => setMapFeedbackText(""), 8000);
    });
  }

  document.getElementById("addLocations").onclick = () => {
    const setAddLocationsFeedbackText = text => { document.getElementById("addLocationsFeedback").innerText = text; }
    navigator.clipboard.readText().then(text => {
      try {
        const existingMap = getExistingMapData();
        const mapDataFromClipboard = JSON.parse(text);
        if (!mapDataFromClipboard?.customCoordinates?.length) {
          setAddLocationsFeedbackText("Invalid map data in clipboard.");
          return;
        }
        // take unique locations based on lat/lng, keep first entry/original.
        const uniqueLocations = uniqueBy([...existingMap.customCoordinates, ...mapDataFromClipboard.customCoordinates], x => `${x.lat},${x.lng}`);
        const newMap = {
          ...existingMap,
          customCoordinates: uniqueLocations
        };
        console.log(newMap);
        fetch(`/api/v3/profiles/maps/${existingMap.id}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newMap)
        }).then(response => {
          if (!response.ok) {
            setAddLocationsFeedbackText("Something went wrong when calling the server.");
            return;
          }
          return response.json();
        }).then(mapResponse => {
          if (mapResponse.id) {
            setAddLocationsFeedbackText("Map updated. Reloading page in 3 seconds.");
            setTimeout(() => {
              window.location.reload();
            }, 3000);
          }
        });
      } catch (err) {
        setAddLocationsFeedbackText("Invalid map data in clipboard.");
      }
    });
  }

  setTimeout(() => document.getElementById("addLocations").style = "display: none;", 60000);
})();