/**
 * page_capture
 * Copyright (c) 2015 Yieldbot, Inc. - All rights reserved.
 */

/* globals chrome, draggable */

'use strict';

(function() {
  var manifest = chrome.runtime.getManifest();

  /**
   *
   * @param {string} imageBase64
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   * @param {number} zoomFactor
   * @param {function} cb
   * @return {undefined}
   */
  var crop = function(imageBase64, x, y, width, height, zoomFactor, cb) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var canvasContext = canvas.getContext('2d');

      canvas.width = width;
      canvas.height = height;

      // update the properties if the zoom level is not 100%
      if (zoomFactor !== 1) {
        x = x * zoomFactor;
        y = y * zoomFactor;
        width = width * zoomFactor;
        height = height * zoomFactor;
      }

      canvasContext.drawImage(img, x, y, width, height, 0, 0, canvas.width, canvas.height);

      cb(canvas.toDataURL('image/jpeg', 1));
    };
    img.src = imageBase64;
  };

  /**
   *
   * @param {string} selectors
   * @param {function} callback
   * @return {undefined}
   */
  var screenCaptureHandler = function(selectors, callback) {
    var target = document.querySelector(selectors);

    if (!target) {
      callback(null);
    } else {
      setTimeout(function() {
        var offset = target.getBoundingClientRect();
        chrome.runtime.sendMessage({api: 'screenCapture'}, function(data) {
          crop(data.img, offset.left, offset.top, offset.width, offset.height, data.zoomFactor, callback);
        });
      }, 400);
    }
  };

  var createControlPanel = function(){
    var panel = document.getElementById('pc-control-panel');
    if(!panel) {
      panel = document.createElement('div');
      panel.setAttribute('id', 'pc-control-panel');
      document.body.appendChild(panel);
    }
    panel.style.position = 'fixed';
    panel.style.top = '100px';
    panel.style.right = '10px';
    panel.style.width = '100px';
    panel.style.height = '100px';
    panel.style.background = 'linear-gradient(#ccc, #aaf)';
    panel.style.border = '2px solid #02aeef';
    panel.style.zIndex = '99999999';
    panel.style.borderRadius = '50%';
    panel.style.boxShadow = '0 0 30px 0 #02aeef';
    panel.style.lineHeight = '100px';
    panel.style.textAlign = 'center';
    panel.style.cursor = 'pointer';
    panel.style.fontWeight = 'bold';
    panel.innerHTML = 'capture';
    return panel;
  };

  // listen to messages from clients using the the public api's
  window.addEventListener('message', function(event) {
    var data = event.data || {};

    if (!data.__index || !data.ns || !data.api) {
      return;
    }

    var send = function(value) {
      var opt = {
        __key: data.__index,
        value: value
      };
      window.postMessage(opt, '*');
    };

    console.log('page_capture api', data.api);

    if (data.api === 'getVersion') {
      send(manifest.version);
    }

    else if (data.api === 'captureElement') {
      screenCaptureHandler(data.element, function(data) {
        send(data);
        return true;
      });
    }

    else if (data.api === 'capturePage') {
      chrome.runtime.sendMessage({api: 'screenCapture'}, function(data) {
        send(data.img);
        return true;
      });
    }

    else if (data.api === 'captureSection') {
      chrome.runtime.sendMessage({api: 'screenCapture'}, function(responseData) {
        crop(responseData.img, data.x, data.y, data.width, data.height, responseData.zoomFactor, send);
        return true;
      });
    }

    else if (data.api === 'captureUrl') {
      chrome.runtime.sendMessage(data, function(dataUrl) {
        send(dataUrl);
        return true;
      });
    }
  });

  // listens for messages from the background script
  chrome.extension.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.option === 'addControls') {
      var panel = createControlPanel();

      if(message.imgUrl){
        var img = new Image();
        img.onload = function(){
          img.style.width = img.naturalWidth + 'px';
          img.style.height = img.naturalHeight + 'px';
          draggable(img);
        };
        img.src = message.imgUrl;
      }

      var onClick = function(e) {
        e.preventDefault();
        document.getElementById('pc-control-panel').style.display = 'none';
        var info = null;
        if(message.imgUrl) {
          info = {};
          if (!message.includeOverlay) {
            img.style.display = 'none';
            info.url = location.href;
            info.overlay = img.dataset;
            info.overlay.url = message.imgUrl;
            delete info.overlay.pcType;
          }
        }
        setTimeout(function() {
          chrome.runtime.sendMessage({api: 'screenCapture'}, function(responseData) {
            if(info){
              responseData.info = info;
              sendResponse(responseData);
            } else {
              sendResponse(responseData.img);
            }
            return true;
          });
        }, 500);
      };

      var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        panel.addEventListener('touchend', onClick, false);
      } else {
        panel.addEventListener('click', onClick, false);
      }
    }
    // all for asynchronously response
    return true;
  });

  // inject the api script in the current page document
  var apiScript = document.createElement('script');
  apiScript.src = chrome.extension.getURL('public.api.js');
  apiScript.type = 'text/javascript';
  document.body.appendChild(apiScript);

  console.log();

})();