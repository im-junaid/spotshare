document.addEventListener("DOMContentLoaded", () => {
  // --- VARS ---

  const card = document.getElementById("auth-card");
  const authForm = document.getElementById("auth-form");

  const emailInput = document.getElementById("email-input");
  const nameInput = document.getElementById("name-input");
  const phoneInput = document.getElementById("phone-input");

  const displayEmail = document.getElementById("display-email");
  const otpBoxes = document.querySelectorAll(".otp-box");
  const submitBtn = document.getElementById("submit-btn");
  const errorBox = document.getElementById("error-box");
  const errorTxt = document.getElementById("error-txt");

  const csrftoken = getCookie("csrftoken");

  // TIME VARS
  const valEl = document.getElementById("timer-val");
  const timerWrapper = document.getElementById("timer-wrapper");
  const resetBtn = document.getElementById("resend-btn");

  let timerInstance = null;
  isOtpFailed = false;

  // --- BUTTON STATE MANAGER ---
  const updateButtonState = () => {
    const formType = authForm.dataset.type;
    const view = card.dataset.view;
    let isInvalid = true;

    if (view === "email") {
      const emailEntered = emailInput.value.trim() !== "";
      if (formType === "signup") {
        const nameEntered = nameInput.value.trim() !== "";
        const phoneEntered = phoneInput.value.trim() !== "";
        isInvalid = !(emailEntered && nameEntered && phoneEntered);
      } else {
        isInvalid = !emailEntered;
      }
    } else {
      const code = Array.from(otpBoxes, (b) => b.value).join("");
      isInvalid = code.length === 0;
    }
    submitBtn.disabled = isInvalid;
  };

  // RESET SUBMIT BUTTON TEXT
  const resetSubmitButton = (formType) => {
    submitBtn.innerText =
      formType === "signup" ? "Create Account" : "Send Secure Code";
  };

  // --- OTP : AUTO-FOCUS & BACKSPACE ---
  otpBoxes.forEach((box, i) => {
    // ONLY ALLOW SOME KEYS & NUMBERS
    box.addEventListener("keydown", (e) => {
      if (e.key === " " || e.code === "Space") e.preventDefault();
      if (e.key === "Backspace" && !box.value && i > 0) {
        resetOtpVisuals();
        otpBoxes[i - 1].focus();
      }
    });

    // INPUT
    box.addEventListener("input", () => {
      resetOtpVisuals();
      if (box.value && i < 5) otpBoxes[i + 1].focus();
      updateButtonState();
      checkOtp();
    });

    // PASTE SUPPORT, AUTO SUBMIT ON PASTE
    box.addEventListener("paste", (e) => {
      e.preventDefault();
      resetOtpVisuals();
      const data = (e.clipboardData || window.clipboardData)
        .getData("text")
        .trim();
      if (data.length === 6 && /^\d+$/.test(data)) {
        data.split("").forEach((char, index) => {
          if (otpBoxes[index]) otpBoxes[index].value = char;
        });
        otpBoxes[5].focus();
        checkOtp();
      }
    });
  });

  // --- REMOVE THE FAILED COLOR FROM OTPBOX ---
  const resetOtpVisuals = () => {
    if (!isOtpFailed) return;
    otpBoxes.forEach((b) => b.classList.remove("otp-box-failed"));
    isOtpFailed = false;
    submitBtn.innerText = "Verify & Sign In";
    submitBtn.classList.remove("bg-danger");
  };

  // --- CHECK THE OTP INPUTS ---
  function checkOtp(isShowError = false) {
    const code = Array.from(otpBoxes, (b) => b.value).join("");
    if (code.length === 6) {
      verifyCode(code);
      return;
    }
    if (isShowError) {
      showError("Please enter the full 6-digit code.");
    }
  }

  // --- VIEW MANAGER ---
  const setView = (view) => {
    card.dataset.view = view;
    const isOtp = view === "otp";
    document
      .querySelectorAll(".view-email")
      .forEach((el) => el.classList.toggle("hidden", isOtp));
    document
      .querySelectorAll(".view-otp")
      .forEach((el) => el.classList.toggle("hidden", !isOtp));

    resetSubmitButton(authForm.dataset.type);
    displayEmail.innerText = emailInput.value;

    if (isOtp) {
      clearError();
      setTimeout(() => otpBoxes[0].focus(), 200);
      runTimer(60);
    }
    updateButtonState();
  };

  // --- SEND OTP ---
  const sendOtp = async () => {
    const formType = authForm.dataset.type;
    const email = emailInput.value.trim();
    const fullName = nameInput ? nameInput.value.trim() : "";
    const phone = phoneInput ? phoneInput.value.trim() : "";

    if (!email) {
      showError("Please enter a valid email address.");
      return;
    }

    clearError();
    otpBoxes.forEach((b) => (b.value = ""));
    submitBtn.disabled = true;
    submitBtn.innerText = "Sending...";

    try {
      const payload = JSON.stringify({
        email,
        type: formType,
        ...(formType === "signup" && { full_name: fullName, phone }),
      });

      const response = await fetch("/otp/send/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: payload,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        runTimer(60);
        setView("otp");
      } else {
        showError(data.message || "Failed to send OTP. Please try again.");
        resetSubmitButton(formType);
      }
    } catch (err) {
      showError("Connection error. Is the server running?");
      resetSubmitButton(formType);
    } finally {
      submitBtn.disabled = false;
    }
  };

  // --- SUBMIT OTP ---
  const verifyCode = async (otp) => {
    const email = emailInput.value.trim();

    clearError();
    submitBtn.disabled = true;
    submitBtn.innerHTML = "Verifying...";

    try {
      const response = await fetch("/otp/verify/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // SUCCESS CASE
        submitBtn.innerHTML = "Success ✓";
        submitBtn.classList.remove("bg-primary");
        submitBtn.classList.add("bg-green-600");

        // CLEAR TIMER
        clearInterval(timerInstance);
        timerWrapper.classList.add("hidden");
        resetBtn.classList.add("hidden");

        // ANIMATION FOR OTP BOX SUCCESS
        for (const box of otpBoxes) {
          await new Promise((r) => setTimeout(r, 80));
          box.classList.add("otp-box-success");
          if (window.navigator.vibrate) window.navigator.vibrate(10);
        }

        //Final step: Redirect or move to next screen
        setTimeout(() => {
          window.location.href = "/";
          console.log("Auth complete!");
        }, 800);
      } else {
        isOtpFailed = true;
        submitBtn.disabled = false;
        submitBtn.innerText = "Try Again";

        // ANIMATION FOR OTP BOX FAILED
        for (const box of otpBoxes) {
          await new Promise((r) => setTimeout(r, 80));
          box.classList.add("otp-box-failed");
          if (window.navigator.vibrate) window.navigator.vibrate([50, 50, 50]);
        }
        showError(data.message || "Invalid OTP.");
      }
    } catch (err) {
      showError("Connection error. Is the server running?");
      updateButtonState();
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = "Verify OTP";
    }
  };

  // EVENT LISTENER : FORM INPUT, EMAIL, OTP
  authForm.addEventListener("input", updateButtonState);
  authForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (card.dataset.view === "email") {
      if (!globalValidate.email(emailInput.value)) {
        showError("Please enter a valid email address.");
        return;
      }
      if (authForm.dataset.type === "signup") {
        if (!globalValidate.full_name(nameInput.value)) {
          showError("Full name must be at least 4 characters.");
          return;
        }
        if (!globalValidate.phone(phoneInput.value)) {
          showError("Please enter a valid 10-digit phone number.");
          return;
        }
      }

      console = "email, input,otp";
      sendOtp();
    } else {
      checkOtp(true);
    }
  });
  document
    .getElementById("change-email")
    .addEventListener("click", () => setView("email"));
  document.getElementById("resend-btn").addEventListener("click", sendOtp);

  // --- TIMER ---
  const runTimer = (duration) => {
    let timeLeft = duration;

    timerWrapper.classList.remove("hidden");
    resetBtn.classList.add("hidden");
    valEl.innerText = timeLeft;

    if (timerInstance) clearInterval(timerInstance);

    timerInstance = setInterval(() => {
      timeLeft--;
      valEl.innerText = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(timerInstance);
        timerWrapper.classList.add("hidden");
        resetBtn.classList.remove("hidden");
      }
    }, 1000);
  };

  // --- UTILITY FUNCTIONS ---
  function showError(msg) {
    errorTxt.innerText = msg;
    errorBox.classList.remove("hidden");
    errorBox.classList.add("flex");
  }

  function clearError() {
    errorTxt.innerText = "";
    errorBox.classList.add("hidden");
    errorBox.classList.remove("flex");
  }
});
