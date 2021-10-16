// ==UserScript==
// @name         Copy/paste Geoguessr map data
// @namespace    slashP
// @version      2.1.2
// @description  Copy latitude, longitude, heading and pitch information from Geoguessr maps as JSON data. Add locations to maps by pasting JSON data in map maker.
// @author       slashP
// @match        https://www.geoguessr.com/*
// @license       MIT
// ==/UserScript==

(function () {
  'use strict';
  const copyMapDataButtonHtml = '<button id="copyMapData" style="margin-left: 1rem;" class="button button--medium button--secondary margin--left-small" type="button"><span class="button__animation"></span><span class="button__label">Copy map data to clipboard</span></button>';
  const downloadMapDataButtonHtml = '<button id="downloadMapData" style="margin-left: 1rem;" class="button button--medium button--secondary margin--left-small" type="button"><span class="button__animation"></span><span class="button__label">Download map data</span></button><span style="margin-left: 10px;" id="copyMapDataFeedback"></span>';
  const importLocationsFromClipboardButtonHtml = '<div class="center-content" id="importLocationsFromClipboardSection"><button id="importLocationsFromClipboard" style="margin-top: 50px;" class="button button--medium button--secondary margin--left-small" type="button"><span class="button__animation"></span><span class="button__label">Try importing locations from clipboard data</span></button></span></div>';
  const importLocationsFromFileInputHtml = '<div class="center-content" id="importLocationsFromFileSection"><label for="importLocationsFromFile">Try importing locations from file(s)</label><input accept="application/json" multiple type="file" id="importLocationsFromFile" style="margin-top: 50px;" class="button button--medium button--secondary margin--left-small" type="button"><span class="button__animation"></span><span class="button__label"></span></button></span><span style="margin-left: 10px;" id="importLocationsFeedback"></span></div>';
  const addLocationsButtonHtml = '<div class="center-content" id="addLocationsSection" style="margin-top: 50px; display: none;"><span id="saveExplanation"></span><br /><div style="margin-top: 30px;"><button id="addLocations" class="button button--medium button--danger margin--left-small" type="button"><span class="button__animation"></span><span class="button__label">Add locations and save map</span></button><span style="margin-left: 10px;" id="addLocationsFeedback"></span></div></div>';
  const replaceLocationsButtonHtml = '<div class="center-content" id="replaceLocationsSection" style="margin-top: 50px; display: none;"><span id="replaceLocationsExplanation"></span><br /><div style="margin-top: 30px;"><button id="replaceLocations" class="button button--medium button--danger margin--left-small" type="button"><span class="button__animation"></span><span class="button__label">Replace locations and save map</span></button><span style="margin-left: 10px;" id="replaceLocationsFeedback"></span></div></div>';
  const buttons = [
    { html: copyMapDataButtonHtml, containerSelector: ".center-content" },
    { html: downloadMapDataButtonHtml, containerSelector: ".center-content" },
    { html: importLocationsFromClipboardButtonHtml, containerSelector: ".container__content" },
    { html: importLocationsFromFileInputHtml, containerSelector: ".container__content" },
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
  const latLngHeadingPitchSelector = x => `${x.lat},${x.lng},${x.heading},${x.pitch}`;
  const pluralize = (text, count) => count === 1 ? text : text + "s";

  const copyMapData = () => {
    getExistingMapData()
      .then(map => {
        const setMapFeedbackText = text => { document.getElementById("copyMapDataFeedback").innerText = text; }
        navigator.clipboard.writeText(JSON.stringify(map)).then(() => {
          setMapFeedbackText("Map data copied to clipboard.");
          setTimeout(() => setMapFeedbackText(""), 8000);
        });
      });
  }
  let mapDataFromClipboard = null;
  let existingMap = null;
  const importLocationsFromClipboard = () => {
    navigator.clipboard.readText().then(text => {
      importLocations(text)
    });
  }
  const setImportLocationsFeedbackText = text => { document.getElementById("importLocationsFeedback").innerText = text; }

  const importLocations = (text, mapAsObject) => {
    try {
      getExistingMapData()
        .then(map => {
          existingMap = map;
          mapDataFromClipboard = mapAsObject ? mapAsObject : JSON.parse(text);
          if (!mapDataFromClipboard?.customCoordinates?.length) {
            setImportLocationsFeedbackText("Invalid map data.");
            return;
          }
          const uniqueExistingLocations = uniqueBy(existingMap.customCoordinates, latLngSelector);
          const uniqueImportedLocations = uniqueBy(mapDataFromClipboard.customCoordinates, latLngSelector);
          const uniqueLocations = uniqueBy([...uniqueExistingLocations, ...uniqueImportedLocations], latLngSelector);
          const numberOfLocationsBeingAdded = uniqueLocations.length - uniqueExistingLocations.length;
          const numberOfUniqueLocationsImported = uniqueImportedLocations.length;
          const numberOfExactlyMatchingLocations = intersectionCount(uniqueExistingLocations, uniqueImportedLocations, latLngHeadingPitchSelector);
          const numberOfLocationsWithSameLatLng = intersectionCount(uniqueExistingLocations, uniqueImportedLocations, latLngSelector);
          const numberOfLocationEditions = numberOfLocationsWithSameLatLng - numberOfExactlyMatchingLocations;
          const numberOfLocationsNotInImportedList = exceptCount(uniqueExistingLocations, uniqueImportedLocations, latLngSelector);
          const numberOfLocationsNotInExistingMap = exceptCount(uniqueImportedLocations, uniqueExistingLocations, latLngSelector);

          if (numberOfExactlyMatchingLocations === uniqueExistingLocations.length && uniqueExistingLocations.length === uniqueImportedLocations.length) {
            setImportLocationsFeedbackText("All locations are exactly the same.");
            return;
          }
          if (numberOfExactlyMatchingLocations === uniqueExistingLocations.length && uniqueExistingLocations.length === uniqueImportedLocations.length) {
            setImportLocationsFeedbackText("All locations are exactly the same.");
            return;
          }

          const maximumNumberOfLocations = 105000;
          if (numberOfUniqueLocationsImported > maximumNumberOfLocations) {
            setImportLocationsFeedbackText(`You can't import more than ${maximumNumberOfLocations} locations.`);
            return;
          }

          if (numberOfLocationsBeingAdded > 0 && uniqueLocations.length < maximumNumberOfLocations) {
            document.getElementById("saveExplanation").innerText = `Add ${numberOfLocationsBeingAdded} locations to this map. New count: ${uniqueLocations.length}. Any manual changes applied after this page was loaded will be lost.`;
            document.getElementById("addLocationsSection").style.display = "block";
          }

          document.getElementById("replaceLocationsExplanation").innerHTML = `Replace the locations in the map. New count: ${numberOfUniqueLocationsImported}. Any manual changes applied after this page was loaded will be lost.<br>
<span style="color: red;">${numberOfLocationsNotInImportedList} ${pluralize("deletion", numberOfLocationsNotInImportedList)}</span><br>
<span style="color: green;">${numberOfLocationsNotInExistingMap} ${pluralize("addition", numberOfLocationsNotInExistingMap)}</span><br>
<span style="color: cornflowerblue;">${numberOfLocationEditions} ${pluralize("edition", numberOfLocationEditions)} (different heading/pitch)</span><br>
<span style="color: coral;">${numberOfExactlyMatchingLocations} exactly same</span>`;
          document.getElementById("replaceLocationsSection").style.display = "block";

          document.getElementById("importLocationsFromClipboardSection").style.display = "none";
          document.getElementById("importLocationsFromFileSection").style.display = "none";
        }).catch(error => setImportLocationsFeedbackText("Invalid map data. " + error));
    } catch (err) {
      console.log(err);
      setImportLocationsFeedbackText("Invalid map data. " + err);
    }
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

  const downloadMapData = () => {
    getExistingMapData()
      .then(map => {
        let a = document.createElement('a');
        a.href = "data:application/octet-stream," + encodeURIComponent(JSON.stringify(map));
        a.download = `${map.name}.json`;
        a.click();
      })
  }

  async function handleFileImportChanged() {
    try {
      let map = {};
      for (let file of this.files) {
        const content = await readFileContent(file);
        const additionalMap = JSON.parse(content);
        map = {
          ...map,
          customCoordinates: [...map.customCoordinates || [], ...additionalMap.customCoordinates]
        }
      }
      importLocations(null, map);
    } catch (err) {
      console.log(err);
      setImportLocationsFeedbackText("Importing failed. " + err);
    }
  }

  function readFileContent(file) {
    const reader = new FileReader()
    return new Promise((resolve, reject) => {
      reader.onload = event => resolve(event.target.result)
      reader.onerror = error => reject(error)
      reader.readAsText(file)
    })
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
        document.getElementById("downloadMapData").onclick = downloadMapData;
        document.getElementById("importLocationsFromClipboard").onclick = importLocationsFromClipboard;
        document.getElementById("importLocationsFromFile").addEventListener("change", handleFileImportChanged, false);
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