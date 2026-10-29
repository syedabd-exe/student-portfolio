
const API_URL = "http://127.0.0.1:8000/api";

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const emailInput = document.getElementById("loginEmail");
const passwordInput = document.getElementById("loginPassword");
const togglePassword = document.getElementById("togglePassword");
const loginMessage = document.getElementById("loginMessage");
const registerMessage = document.getElementById("registerMessage");
const loginPanel = document.getElementById("loginPanel");
const registerPanel = document.getElementById("registerPanel");

function showMessage(target, text, type = "") {
    target.className = `auth-message ${type}`.trim();
    target.textContent = text;
}

async function postJSON(path, payload) {
    const response = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            typeof result.detail === "string"
                ? result.detail
                : "Request failed. Check the submitted details."
        );
    }

    return result;
}

togglePassword?.addEventListener("click", () => {
    const show = passwordInput.type === "password";

    passwordInput.type = show ? "text" : "password";
    togglePassword.textContent = show ? "Hide" : "Show";
});

document.getElementById("showRegister").addEventListener("click", () => {
    loginPanel.hidden = true;
    registerPanel.hidden = false;
    showMessage(loginMessage, "");
    document.getElementById("registerName").focus();
});

document.getElementById("showLogin").addEventListener("click", () => {
    registerPanel.hidden = true;
    loginPanel.hidden = false;
    showMessage(registerMessage, "");
    emailInput.focus();
});

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    showMessage(loginMessage, "");

    if (!email || !password) {
        showMessage(loginMessage, "Please enter your email and password.", "error");
        return;
    }

    const button = loginForm.querySelector('button[type="submit"]');

    if (button) button.disabled = true;

    try {
        const result = await postJSON("/auth/login", { email, password });

        localStorage.setItem("access_token", result.access_token);
        localStorage.setItem("student", JSON.stringify(result.student));

        showMessage(loginMessage, "Login successful!", "success");
        window.location.href = "index.html";
    } catch (error) {
        showMessage(
            loginMessage,
            error instanceof TypeError
                ? "Cannot connect to the backend. Start the server and check the frontend origin."
                : error.message,
            "error"
        );
    } finally {
        if (button) button.disabled = false;
    }
});

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!registerForm.reportValidity()) return;

    const button = registerForm.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Creating account...";
    showMessage(registerMessage, "");

    const payload = {
        name: document.getElementById("registerName").value.trim(),
        email: document.getElementById("registerEmail").value.trim(),
        department: document.getElementById("registerDepartment").value.trim(),
        college: document.getElementById("registerCollege").value.trim() || null,
        password: document.getElementById("registerPassword").value
    };

    try {
        await postJSON("/auth/register", payload);
        emailInput.value = payload.email;
        registerForm.reset();
        registerPanel.hidden = true;
        loginPanel.hidden = false;
        showMessage(
            loginMessage,
            "Account created. Sign in with your new credentials.",
            "success"
        );
        passwordInput.focus();
    } catch (error) {
        showMessage(
            registerMessage,
            error instanceof TypeError
                ? "Cannot connect to the backend. Start the server and check the frontend origin."
                : error.message,
            "error"
        );
    } finally {
        button.disabled = false;
        button.innerHTML = 'Create account <span>→</span>';
    }
});
