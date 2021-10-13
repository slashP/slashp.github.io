// ==UserScript==
// @name         Copy/paste Geoguessr map data
// @namespace    slashP
// @version      2.0.0
// @description  Copy latitude, longitude, heading and pitch information from Geoguessr maps as JSON data. Add locations to maps by pasting JSON data in map maker.
// @author       slashP
// @match        https://www.geoguessr.com/*
// @license       MIT
// ==/UserScript==

(function () {
  'use strict';
  const copyMapDataButtonHtml = '<button id="copyMapData" style="margin-left: 1rem;" class="button button--medium button--secondary margin--left-small" type="button"><span class="button__animation"></span><span class="button__label">Copy map data to clipboard</span></button><span style="margin-left: 10px;" id="copyMapDataFeedback"></span>';
  const importLocationsButtonHtml = '<div class="center-content" id="importLocationsSection"><button id="importLocations" style="margin-top: 50px;" class="button button--medium button--secondary margin--left-small" type="button"><span class="button__animation"></span><span class="button__label">Try importing locations from clipboard data</span></button></span><span style="margin-left: 10px;" id="importLocationsFeedback"></span></div>';
  const addLocationsButtonHtml = '<div class="center-content" id="addLocationsSection" style="margin-top: 50px; display: none;"><span id="saveExplanation"></span><br /><div style="margin-top: 30px;"><button id="addLocations" class="button button--medium button--danger margin--left-small" type="button"><span class="button__animation"></span><span class="button__label">Add locations and save map</span></button><span style="margin-left: 10px;" id="addLocationsFeedback"></span></div></div>';
  const replaceLocationsButtonHtml = '<div class="center-content" id="replaceLocationsSection" style="margin-top: 50px; display: none;"><span id="replaceLocationsExplanation"></span><br /><div style="margin-top: 30px;"><button id="replaceLocations" class="button button--medium button--danger margin--left-small" type="button"><span class="button__animation"></span><span class="button__label">Replace locations and save map</span></button><span style="margin-left: 10px;" id="replaceLocationsFeedback"></span></div></div>';
  const buttons = [
    { html: copyMapDataButtonHtml, containerSelector: ".center-content" },
    { html: importLocationsButtonHtml, containerSelector: ".container__content" },
    { html: addLocationsButtonHtml, containerSelector: ".container__content" },
    { html: replaceLocationsButtonHtml, containerSelector: ".container__content" },
  ];

  const getExistingMapData = () => {
    const mapId = location.href.split('/').pop();
    return fetch(`/api/v3/profiles/maps/${mapId}`)
      .then(response => response.json())
      .then(map => ({
        id: map.id,
        name: map.name,
        description: map.description,
        avatar: map.avatar,
        highlighted: map.highlighted,
        published: map.published,
        customCoordinates: map.customCoordinates
      }));
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
  const intersectionCount = (arr1, arr2, selector) => {
    var setB = new Set(arr2.map(selector));
    var intersection = arr1.map(selector).filter(x => setB.has(x));
    return intersection.length;
  }
  const exceptCount = (arr1, arr2, selector) => {
    var setB = new Set(arr2.map(selector));
    var except = arr1.map(selector).filter(x => !setB.has(x));
    return except.length;
  }
  const latLngSelector = x => `${x.lat},${x.lng}`;

  const copyMapData = () => {
    getExistingMapData()
      .then(map => {
        const setMapFeedbackText = text => { document.getElementById("copyMapDataFeedback").innerText = text; }
        navigator.clipboard.writeText(JSON.stringify(map, null, 2)).then(() => {
          setMapFeedbackText("Map data copied to clipboard.");
          setTimeout(() => setMapFeedbackText(""), 8000);
        });
      });
  }
  let mapDataFromClipboard = null;
  let existingMap = null;
  const importLocations = () => {
    const setImportLocationsFeedbackText = text => { document.getElementById("importLocationsFeedback").innerText = text; }
    navigator.clipboard.readText().then(text => {
      try {
        getExistingMapData()
          .then(map => {
            existingMap = map;
            mapDataFromClipboard = JSON.parse(text);
            if (!mapDataFromClipboard?.customCoordinates?.length) {
              setImportLocationsFeedbackText("Invalid map data in clipboard.");
              return;
            }
            const uniqueLocations = uniqueBy([...existingMap.customCoordinates, ...mapDataFromClipboard.customCoordinates], latLngSelector);
            const numberOfLocationsBeingAdded = uniqueLocations.length - existingMap.customCoordinates.length;
            const numberOfUniqueLocationsImported = uniqueBy(mapDataFromClipboard.customCoordinates, latLngSelector).length;
            const numberOfSimilarLocations = intersectionCount(existingMap.customCoordinates, mapDataFromClipboard.customCoordinates, latLngSelector);
            const numberOfLocationsNotInImportedList = exceptCount(existingMap.customCoordinates, mapDataFromClipboard.customCoordinates, latLngSelector);
            const numberOfLocationsNotInExistingMap = exceptCount(mapDataFromClipboard.customCoordinates, existingMap.customCoordinates, latLngSelector);

            if (numberOfLocationsBeingAdded === 0) {
              setImportLocationsFeedbackText("All locations are already in the map.");
              return;
            }

            document.getElementById("saveExplanation").innerText = `Add ${numberOfLocationsBeingAdded} locations to this map. New count: ${uniqueLocations.length}. Any manual changes applied after this page was loaded will be lost.`;
            document.getElementById("addLocationsSection").style.display = "block";

            document.getElementById("replaceLocationsExplanation").innerHTML = `Replace the locations in the map. New count: ${numberOfUniqueLocationsImported}. Any manual changes applied after this page was loaded will be lost.<br>
<span style="color: red;">${numberOfLocationsNotInImportedList} deletions</span><br>
<span style="color: green;">${numberOfLocationsNotInExistingMap} additions</span><br>
${numberOfSimilarLocations} stay as is`;
            document.getElementById("replaceLocationsSection").style.display = "block";

            document.getElementById("importLocationsSection").style.display = "none";
          });
      } catch (err) {
        console.log(err);
        setImportLocationsFeedbackText("Invalid map data in clipboard.");
      }
    });
  }

  const addLocations = () => {
    if (!mapDataFromClipboard || !existingMap) {
      return;
    }
    const setAddLocationsFeedbackText = text => { document.getElementById("addLocationsFeedback").innerText = text; }
    // take unique locations based on lat/lng, keep first entry/original.
    const uniqueLocations = uniqueBy([...existingMap.customCoordinates, ...mapDataFromClipboard.customCoordinates], latLngSelector);
    const newMap = {
      ...existingMap,
      customCoordinates: uniqueLocations
    };
    updateMap(newMap, setAddLocationsFeedbackText);
  }

  const replaceLocations = () => {
    if (!mapDataFromClipboard || !existingMap) {
      return;
    }
    const setReplaceLocationsFeedbackText = text => { document.getElementById("replaceLocationsFeedback").innerText = text; }
    // take unique locations based on lat/lng, keep first entry/original.
    const uniqueLocations = uniqueBy(mapDataFromClipboard.customCoordinates, latLngSelector);
    const newMap = {
      ...existingMap,
      customCoordinates: uniqueLocations
    };
    updateMap(newMap, setReplaceLocationsFeedbackText);
  }

  function updateMap(newMap, setFeedback) {
    fetch(`/api/v3/profiles/maps/${existingMap.id}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newMap)
    }).then(response => {
      if (!response.ok) {
        setFeedback("Something went wrong when calling the server.");
        return;
      }
      return response.json();
    }).then(mapResponse => {
      if (mapResponse.id) {
        setFeedback(`Map updated. Reloading page in 5 seconds.`);
        setTimeout(() => {
          window.location.reload();
        }, 5000);
      }
    });
  }

  const tryAddButtons = () => {
    setTimeout(() => {
      if (new RegExp('^https:\/\/www.geoguessr.com\/map-maker/').test(window.location.href)) {
        for (let button of buttons) {
          const buttonElement = document.createElement("span");
          buttonElement.innerHTML = button.html;
          document.querySelector(button.containerSelector).appendChild(buttonElement);
        }
        document.getElementById("copyMapData").onclick = copyMapData;
        document.getElementById("importLocations").onclick = importLocations;
        document.getElementById("addLocations").onclick = addLocations;
        document.getElementById("replaceLocations").onclick = replaceLocations;
      }
    }, 250);
  }
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      tryAddButtons();
    }
  }).observe(document, { subtree: true, childList: true });
  tryAddButtons();
})();