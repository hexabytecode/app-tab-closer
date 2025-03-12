// popup.js
document.addEventListener("DOMContentLoaded", function () {
  const startButton = document.getElementById("start-timer");
  const cancelButton = document.getElementById("cancel-button");
  const actionType = document.getElementById("action-type");
  const hoursInput = document.getElementById("hours");
  const minutesInput = document.getElementById("minutes");
  const secondsInput = document.getElementById("seconds");
  const activeTimerDiv = document.getElementById("active-timer");
  const countdownSpan = document.getElementById("countdown");
  const actionInfoDiv = document.getElementById("action-info");
  const progressCircle = document.querySelector(".progress-ring-circle");

  let countdownInterval;
  let initialDuration = 0; // Store initial duration for progress calculation

  // Set up circle properties
  const radius = progressCircle.r.baseVal.value;
  const circumference = radius * 2 * Math.PI;
  progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;

  // Check if there's an active timer when popup opens
  chrome.storage.local.get(
    ["endTime", "actionType", "initialDuration"],
    function (result) {
      if (result.endTime) {
        const now = Date.now();
        const remaining = result.endTime - now;

        if (remaining > 0) {
          initialDuration = result.initialDuration || remaining;
          showActiveTimer(result.endTime, result.actionType);
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

  // Make inputs better UX
  hoursInput.addEventListener("input", function () {
    if (this.value > 23) this.value = 23;
    if (this.value < 0) this.value = 0;
  });

  minutesInput.addEventListener("input", function () {
    if (this.value > 59) this.value = 59;
    if (this.value < 0) this.value = 0;
  });

  secondsInput.addEventListener("input", function () {
    if (this.value > 59) this.value = 59;
    if (this.value < 0) this.value = 0;
  });

  // Start timer button
  startButton.addEventListener("click", function () {
    const hours = parseInt(hoursInput.value) || 0;
    const minutes = parseInt(minutesInput.value) || 0;
    const seconds = parseInt(secondsInput.value) || 0;

    const totalMilliseconds = (hours * 3600 + minutes * 60 + seconds) * 1000;

    if (totalMilliseconds <= 0) {
      alert("Please set a timer greater than 0");
      return;
    }

    const endTime = Date.now() + totalMilliseconds;
    const action = actionType.value;
    initialDuration = totalMilliseconds;

    // Add ripple effect
    addRippleEffect(this);

    // Save timer details
    chrome.storage.local.set({
      endTime: endTime,
      actionType: action,
      initialDuration: totalMilliseconds,
    });

    // Set the alarm
    chrome.runtime.sendMessage({
      type: "startTimer",
      endTime: endTime,
      action: action,
      duration: totalMilliseconds,
    });

    showActiveTimer(endTime, action);
  });

  // Cancel timer button
  cancelButton.addEventListener("click", function () {
    // Add ripple effect
    addRippleEffect(this);

    chrome.runtime.sendMessage({ type: "cancelTimer" });
    chrome.storage.local.remove(["endTime", "actionType", "initialDuration"]);
    hideActiveTimer();
  });

  function showActiveTimer(endTime, action) {
    startButton.style.display = "none";
    activeTimerDiv.style.display = "block";

    let actionText = "Closing current tab";
    if (action === "window") {
      actionText = "Closing current window";
    } else if (action === "browser") {
      actionText = "Quitting Chrome";
    }

    actionInfoDiv.textContent = "Action: " + actionText;

    // Start countdown with animation
    updateCountdown(endTime);
    countdownInterval = setInterval(function () {
      updateCountdown(endTime);
    }, 1000);

    // Animate the display
    activeTimerDiv.style.animation = "fadeIn 0.5s";
  }

  function hideActiveTimer() {
    clearInterval(countdownInterval);

    // Animate out
    activeTimerDiv.style.animation = "fadeIn 0.5s reverse";
    setTimeout(() => {
      startButton.style.display = "block";
      activeTimerDiv.style.display = "none";
    }, 300);
  }

  function updateCountdown(endTime) {
    const now = Date.now();
    const remaining = endTime - now;

    if (remaining <= 0) {
      hideActiveTimer();
      return;
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    countdownSpan.textContent = `${padZero(hours)}:${padZero(
      minutes
    )}:${padZero(seconds)}`;

    // Update progress circle
    updateProgressCircle(remaining);
  }

  function updateProgressCircle(remaining) {
    const progress = remaining / initialDuration;
    const offset = circumference - progress * circumference;
    progressCircle.style.strokeDashoffset = offset;

    // Change color based on remaining time (gradually shifts from blue to red)
    const hue = Math.floor(progress * 240); // 240 (blue) to 0 (red)
    progressCircle.style.stroke = `hsl(${hue}, 80%, 50%)`;
  }

  function padZero(num) {
    return num.toString().padStart(2, "0");
  }

  function addRippleEffect(button) {
    button.classList.remove("ripple");
    void button.offsetWidth; // Force reflow
    button.classList.add("ripple");
  }
});
