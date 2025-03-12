// background.js
let activeAlarm = null;
let badgeUpdateInterval = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === "startTimer") {
    startTimer(message.endTime, message.action, message.duration);
  } else if (message.type === "cancelTimer") {
    cancelTimer();
  }
});

// When the alarm goes off, perform the closing action
chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === "autoCloseTimer") {
    chrome.storage.local.get(["actionType"], function (result) {
      performAction(result.actionType);
      chrome.storage.local.remove(["endTime", "actionType", "initialDuration"]);
      clearBadge();
    });
  }
});

function startTimer(endTime, action, duration) {
  // Cancel any existing alarm
  cancelTimer();

  // Calculate delay in minutes (alarms API uses minutes)
  const now = Date.now();
  const delayInMinutes = (endTime - now) / (1000 * 60);

  // Create a new alarm
  chrome.alarms.create("autoCloseTimer", {
    delayInMinutes: delayInMinutes,
  });

  activeAlarm = "autoCloseTimer";

  // Start updating the badge
  updateBadge(endTime);
  badgeUpdateInterval = setInterval(function () {
    updateBadge(endTime);
  }, 1000);
}

function cancelTimer() {
  if (activeAlarm) {
    chrome.alarms.clear(activeAlarm);
    activeAlarm = null;

    // Clear the badge update interval
    clearInterval(badgeUpdateInterval);
    badgeUpdateInterval = null;
    clearBadge();
  }
}

function updateBadge(endTime) {
  const now = Date.now();
  const remaining = endTime - now;

  if (remaining <= 0) {
    clearBadge();
    return;
  }

  // Format the badge text based on remaining time
  let badgeText = "";

  // Different formats based on time remaining
  if (remaining >= 3600000) {
    // More than 1 hour
    badgeText = Math.ceil(remaining / 3600000) + "h";
  } else if (remaining >= 60000) {
    // More than 1 minute
    badgeText = Math.ceil(remaining / 60000) + "m";
  } else {
    // Less than 1 minute
    badgeText = Math.ceil(remaining / 1000) + "s";
  }

  // Set badge text
  chrome.action.setBadgeText({ text: badgeText });

  // Change badge color from blue to red as time approaches end
  const timeRatio = remaining / 3600000; // Use hour as baseline for color
  let r = Math.min(255, Math.round(255 * (1 - Math.min(timeRatio, 1))));
  let b = Math.min(255, Math.round(255 * Math.min(timeRatio, 1)));
  chrome.action.setBadgeBackgroundColor({ color: [r, 0, b, 255] });
}

function clearBadge() {
  chrome.action.setBadgeText({ text: "" });

  // Clear the badge update interval if it exists
  if (badgeUpdateInterval) {
    clearInterval(badgeUpdateInterval);
    badgeUpdateInterval = null;
  }
}

function performAction(actionType) {
  switch (actionType) {
    case "tab":
      // Close current tab
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs.length > 0) {
          chrome.tabs.remove(tabs[0].id);
        }
      });
      break;

    case "window":
      // Close current window
      chrome.windows.getCurrent(function (window) {
        chrome.windows.remove(window.id);
      });
      break;

    case "browser":
      // Quit Chrome
      chrome.runtime.getPlatformInfo(function (info) {
        if (info.os === "mac") {
          // On Mac, we need to close all windows
          chrome.windows.getAll({}, function (windows) {
            for (let window of windows) {
              chrome.windows.remove(window.id);
            }
          });
        } else {
          // On Windows/Linux we can use chrome.runtime.restart();
          chrome.runtime.restart();
        }
      });
      break;
  }
}

// Check for any persisted timers when the background script starts
chrome.storage.local.get(
  ["endTime", "actionType", "initialDuration"],
  function (result) {
    if (result.endTime) {
      const now = Date.now();
      const remaining = result.endTime - now;

      if (remaining > 0) {
        // Timer still active, restart it
        startTimer(result.endTime, result.actionType, result.initialDuration);
      } else {
        // Timer has expired, clean up storage
        chrome.storage.local.remove([
          "endTime",
          "actionType",
          "initialDuration",
        ]);
      }
    }
  }
);
