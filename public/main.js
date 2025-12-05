// main.js

// Mobile nav toggle
const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    navLinks.classList.toggle("open");
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("open");
    });
  });
}

// Attach submit handler to any form with class .js-enquiry-form
document.addEventListener("DOMContentLoaded", () => {
  const forms = document.querySelectorAll(".js-enquiry-form");

  forms.forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector("button[type='submit']");
      const statusEl = form.querySelector(".form-status");

      const formData = new FormData(form);
      const payload = {
        name: formData.get("name"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        message: formData.get("message"),
        sourcePage: window.location.pathname
      };

      if (submitBtn) submitBtn.disabled = true;
      if (statusEl) {
        statusEl.textContent = "Sending...";
        statusEl.style.color = "#555";
      }

      try {
        const res = await fetch("/api/enquiry", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to submit enquiry");
        }

        form.reset();
        if (statusEl) {
          statusEl.textContent = "Enquiry submitted. We’ll contact you soon.";
          statusEl.style.color = "green";
        }
      } catch (err) {
        console.error(err);
        if (statusEl) {
          statusEl.textContent = "Something went wrong. Please try again.";
          statusEl.style.color = "red";
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  });

  // Footer year
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
