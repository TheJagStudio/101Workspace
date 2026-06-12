// --- 1. Form Attributes Setup ---
const form = document.getElementById("fluentform_12");

if (form) {
    const attributesToRemove = [];
    for (let i = 0; i < form.attributes.length; i++) {
        const attrName = form.attributes[i].name;
        if (attrName !== "method" && attrName !== "class") {
            attributesToRemove.push(attrName);
        }
    }
    attributesToRemove.forEach((attrName) => {
        form.removeAttribute(attrName);
    });
    form.setAttribute("action", "http://127.0.0.1:8000/api/summer-sale-registration/");
    // form.setAttribute("action", "https://workspace.101distributors.com/backend/api/summer-sale-registration/");
    form.setAttribute("class", "frm-fluent-form ff-el-form-top ffs_default ff-form-loaded");
    form.setAttribute("enctype", "multipart/form-data");
} else {
    console.error('Form with ID "fluentform_12" not found.');
}

// --- 2. File Upload Input Customization ---
const uploadHolders = document.querySelectorAll(".ff_file_upload_holder");
uploadHolders.forEach((holder, index) => {
    const span = holder.querySelector(".ff_upload_btn");
    let input = holder.querySelector('input[type="file"]');
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    let originalButtonText = "Choose File";
    input = newInput;

    if (!span || !input) {
        console.warn("Could not find required span or input in holder:", holder);
        return;
    }
    holder.style.position = "relative";
    holder.style.overflow = "hidden";
    span.style.pointerEvents = "none";
    input.style.position = "absolute";
    input.style.bottom = "-10px";
    input.style.left = "0";
    input.style.width = "100%";
    input.style.height = "30px";
    input.style.opacity = "0";
    input.style.cursor = "pointer";

    const allowedAttributes = ["name", "type", "style"];
    const attributesToRemove = [];
    for (const attr of input.attributes) {
        if (!allowedAttributes.includes(attr.name)) {
            attributesToRemove.push(attr.name);
        }
    }
    let inputFieldMap = {
        business_license_document: ["input_text_2", "licenseNumber"],
        tobacco_license_document: ["input_text_3", "licenseNumber"],
        fein_license_document: ["input_text_4", "feinNumber"],
        hemp_license_document: ["input_text_5", "licenseNumber"],
        driving_license_document: ["input_text_7", "licenseNumber"],
        void_check_document: ["input_text_6", "bankName"],
    };
    input.addEventListener("change", () => {
        if (input.files && input.files.length > 0) {
            const fileName = input.files[0].name;
            span.textContent = fileName;
        } else {
            span.textContent = originalButtonText;
        }
    });
    attributesToRemove.forEach((attrName) => {
        input.removeAttribute(attrName);
    });
    // --------------------------------------------------------------------------------------------------
    let requiredList = ["driving_license_document", "fein_license_document", "business_license_document"];
    if (requiredList.includes(input.getAttribute("name"))) {
    	input.setAttribute("required", "");
    }
    // --------------------------------------------------------------------------------------------------
});

// --- 3. State Input Replacement & County Filtering ---
const stateInput = document.getElementById("ff_12_address_1_state_");
let activeStateSelect = stateInput; // Keep track of the active element

if (stateInput) {
    // Replace it if it isn't already a select (or if you just want to rebuild it)
    if (stateInput.tagName.toLowerCase() !== "select") {
        const states = { Alabama: "1", Alaska: "2", Arizona: "3", Arkansas: "4", California: "5", Colorado: "6", Connecticut: "7", Delaware: "8", "District Of Columbia": "9", Florida: "10", Georgia: "11", Hawaii: "12", Idaho: "13", Illinois: "14", Indiana: "15", Iowa: "16", Kansas: "17", Kentucky: "18", Louisiana: "19", Maine: "20", Maryland: "21", Massachusetts: "22", Michigan: "23", Minnesota: "24", Mississippi: "25", Missouri: "26", Montana: "27", Nebraska: "28", Nevada: "29", "New Hampshire": "30", "New Jersey": "31", "New Mexico": "32", "New York": "33", "North Carolina": "34", "North Dakota": "35", Ohio: "36", Oklahoma: "37", Oregon: "38", Pennsylvania: "39", "Rhode Island": "40", "South Carolina": "41", "South Dakota": "42", Tennessee: "43", Texas: "44", Utah: "45", Vermont: "46", Virginia: "47", Washington: "48", "West Virginia": "49", Wisconsin: "50", Wyoming: "51", "American Samoa": "52", Guam: "53", "Northern Mariana Islands": "54", "Puerto Rico": "55", "United States Minor Outlying Islands": "56", "Virgin Islands": "57" };
        const selectElement = document.createElement("select");
        selectElement.id = stateInput.id;
        selectElement.name = stateInput.name;
        selectElement.className = stateInput.className;
        selectElement.setAttribute("required", "");

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "Select a State";
        defaultOption.disabled = true;
        defaultOption.selected = true;
        selectElement.appendChild(defaultOption);

        for (const stateName in states) {
            if (Object.hasOwnProperty.call(states, stateName)) {
                const option = document.createElement("option");
                option.value = states[stateName];
                option.textContent = stateName;
                selectElement.appendChild(option);
            }
        }
        if (stateInput.parentNode) {
            stateInput.parentNode.replaceChild(selectElement, stateInput);
            activeStateSelect = selectElement; // Update active element to the new dropdown
        }
    }

    // ---> Injected County Filter Logic <---
    const countySelect = document.getElementById("ff_12_County_Dropdown");
    if (countySelect && activeStateSelect) {
        const countyWrapper = countySelect.closest('.choices');
        
        if (countyWrapper) {
            countyWrapper.setAttribute('data-ff-county-filter', 'true');
            const styleEl = document.createElement('style');
            document.head.appendChild(styleEl);

            const getDirectText = (element) => {
                let text = "";
                for (let child of element.childNodes) {
                    if (child.nodeType === Node.TEXT_NODE) text += child.textContent;
                }
                return text.trim();
            };

            const assignStateAttributes = () => {
                const choiceItems = countyWrapper.querySelectorAll(".choices__list--dropdown .choices__item--choice");
                choiceItems.forEach((item) => {
                    if (!item.hasAttribute("data-county-state")) {
                        const text = getDirectText(item);
                        if (text !== "- Select -" && text.includes(", ")) {
                            const statePart = text.split(",").pop().trim();
                            item.setAttribute("data-county-state", statePart);
                        }
                    }
                });
            };

            const filterCountyChoices = () => {
                const selectedOption = activeStateSelect.options[activeStateSelect.selectedIndex];
                const stateName = selectedOption ? selectedOption.textContent.trim() : "";

                if (!stateName || stateName === "Select a State") {
                    styleEl.innerHTML = "";
                    return;
                }

                styleEl.innerHTML = `
                    .choices[data-ff-county-filter] .choices__list--dropdown .choices__item--choice[data-county-state]:not([data-county-state="${stateName}"]) {
                        display: none !important;
                    }
                `;
            };

            assignStateAttributes();
            filterCountyChoices(); // Run on init

            activeStateSelect.addEventListener("change", () => {
                filterCountyChoices();
                
                const activeItem = countyWrapper.querySelector(".choices__list--single .choices__item[data-value]:not([data-value=''])");
                if (activeItem) {
                    const activeText = getDirectText(activeItem);
                    const selectedOption = activeStateSelect.options[activeStateSelect.selectedIndex];
                    const stateName = selectedOption ? selectedOption.textContent.trim() : "";

                    if (!activeText.endsWith(`, ${stateName}`)) {
                        const removeBtn = activeItem.querySelector('button.choices__button');
                        if (removeBtn) removeBtn.click();
                        else {
                            countySelect.value = "";
                            const placeholder = countyWrapper.querySelector('.choices__list--dropdown .choices__placeholder');
                            if (placeholder) placeholder.click();
                        }
                    }
                }
            });

            const dropdownList = countyWrapper.querySelector('.choices__list--dropdown');
            if (dropdownList) {
                const observer = new MutationObserver(() => assignStateAttributes());
                observer.observe(dropdownList, { childList: true, subtree: true });
            }
        }
    }
} else {
    console.error('State input with ID "ff_12_address_1_state_" not found.');
}

// --- 4. Inputs caching into Local Storage ---
let inputList = [
    'input[name="names[first_name]"]',
    'input[name="names[last_name]"]',
    'input[name="names[email]"]',
    'input[name="email"]', 
    'input[name="names[phone]"]',
    'input[name="phone"]', 
    'input[name="address_1[address_line_1]"]',
    'input[name="address_1[city]"]',
    'input[name="address_1[state]"]',
    'input[name="County_Dropdown"]',
    'input[name="address_1[zip]"]',
    'input[name="input_text_1"]',
    'input[name="input_text"]',
    'input[name="input_text_2"]',
    'input[name="input_text_3"]',
    'input[name="input_text_4"]',
    'input[name="input_text_5"]',
    'input[name="input_text_6"]',
];

const inputs = document.querySelectorAll(inputList.join(', ') + ', select');
inputs.forEach((input) => {
    input.addEventListener("change", () => {
        const value = input.value;
        let localData = localStorage.getItem("dataForm");
        localData = localData ? JSON.parse(localData) : {};
        
        if (value) {
            localData[input.getAttribute("name")] = value;
        } else {
            delete localData[input.getAttribute("name")];
        }
        localStorage.setItem("dataForm", JSON.stringify(localData));
    });
});

// Load the dataForm from local storage
let localData = localStorage.getItem("dataForm");
if (localData) {
    localData = JSON.parse(localData);
    for (const [name, value] of Object.entries(localData)) {
        const input = document.querySelector(`[name="${name}"]`);
        if (input) {
            input.value = value;
            // Dispatch change event to trigger scripts (like the county filter!)
            input.dispatchEvent(new Event("change"));
        }
    }
}

// --- 5. Validations & Formatting Setup ---
const firstNameInput = document.querySelector('input[name="names[first_name]"]');
const lastNameInput = document.querySelector('input[name="names[last_name]"]');
const emailInput = document.querySelector('input[name="names[email]"], input[name="email"]'); 
const phoneInput = document.querySelector('input[name="names[phone]"], input[name="phone"]'); 
const addressInput = document.querySelector('input[name="address_1[address_line_1]"]');
const cityInput = document.querySelector('input[name="address_1[city]"]');
const zipInput = document.querySelector('input[name="address_1[zip]"]');

if (firstNameInput) firstNameInput.setAttribute("required", "");
if (lastNameInput) lastNameInput.setAttribute("required", "");
if (emailInput) emailInput.setAttribute("required", "");

if (phoneInput) {
    phoneInput.setAttribute("required", "");
    phoneInput.setAttribute("type", "tel");
    phoneInput.setAttribute("pattern", "[0-9]{3}-?[0-9]{3}-?[0-9]{4}");
    phoneInput.setAttribute("placeholder", "123-456-7890");
}
if (addressInput) {
    addressInput.setAttribute("required", "");
    addressInput.setAttribute("type", "text");
    addressInput.setAttribute("placeholder", "123 Main St");
}
if (cityInput) {
    cityInput.setAttribute("required", "");
    cityInput.setAttribute("type", "text");
    cityInput.setAttribute("placeholder", "City");
}
if (zipInput) {
    zipInput.setAttribute("required", "");
    zipInput.setAttribute("type", "text");
    zipInput.setAttribute("placeholder", "12345");
}

const input_text = document.querySelector('input[name="input_text"]');
const input_text_1 = document.querySelector('input[name="input_text_1"]');
const terms_and_conditions = document.querySelector('input[name="terms-n-condition"]');

if (terms_and_conditions) terms_and_conditions.setAttribute("required", "");
if (input_text_1) input_text_1.setAttribute("required", "");
if (input_text) input_text.setAttribute("required", "");

// --- 6. URL Parameters & Popups ---
const urlParams = new URLSearchParams(window.location.search);
const params = Object.fromEntries(urlParams.entries());
const message = params.message || "";
const statusData = params.status || "";

if (message) {
    const popup = document.createElement("div");
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.right = "50%";
    popup.style.width = "300px";
    popup.style.minHeight = "100px";
    popup.style.transform = "translate(50%, -50%)";
    popup.style.backgroundColor = statusData === "success" ? "#d4edda" : "#f8d7da";
    popup.style.color = statusData === "success" ? "#155724" : "#721c24";
    popup.style.padding = "30px";
    popup.style.border = statusData === "success" ? "1px solid #c3e6cb" : "1px solid #f5c6cb";
    popup.style.borderRadius = "5px";
    popup.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.1)";
    popup.style.zIndex = "1000";
    popup.style.textAlign = "center";
    popup.style.justifyContent = "center";
    popup.style.fontSize = "25px";

    let newP = document.createElement("p");
    newP.textContent = message;
    newP.style.lineHeight = "30px";
    popup.appendChild(newP);

    let closeButton = document.createElement("button");
    closeButton.innerHTML = "Close";
    closeButton.style.padding = "5px";
    closeButton.style.backgroundColor = statusData === "success" ? "#28a745" : "#dc3545";
    closeButton.style.color = "#fff";
    closeButton.style.border = "none";
    closeButton.style.borderRadius = "5px";
    closeButton.style.position = "absolute";
    closeButton.style.top = "10px";	
    closeButton.style.right = "10px";
    closeButton.style.cursor = "pointer";
    
    closeButton.addEventListener("click", () => {
        const newUrl = window.location.href.split('?')[0];
        history.replaceState(null, '', newUrl);
        popup.remove();
    });

    popup.appendChild(closeButton);
    popup.style.display = "flex";
    popup.style.alignItems = "center";
    popup.style.justifyContent = "center";
    popup.style.fontFamily = "Arial, sans-serif";
    document.body.appendChild(popup);
}

// --- 7. Form Submission with Loading Spinner & Confetti ---
function createLoaderOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "form-loader-overlay";
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.55); display: flex; flex-direction: column;
        align-items: center; justify-content: center; z-index: 9999;
        font-family: 'Arial', sans-serif;
    `;
    overlay.innerHTML = `
        <div style="background: #fff; border-radius: 16px; padding: 40px 50px; text-align: center; box-shadow: 0 8px 30px rgba(0,0,0,0.25);">
            <div id="loader-spinner" style="
                width: 56px; height: 56px; border: 5px solid #e0e0e0;
                border-top-color: #2563eb; border-radius: 50%;
                animation: spin 0.8s linear infinite; margin: 0 auto 20px;
            "></div>
            <p style="margin: 0; font-size: 18px; color: #333; font-weight: 500;">Creating your account...</p>
            <p style="margin: 8px 0 0; font-size: 14px; color: #888;">Please wait, this may take a moment.</p>
        </div>
    `;
    // Inject keyframes
    if (!document.getElementById("loader-keyframes")) {
        const style = document.createElement("style");
        style.id = "loader-keyframes";
        style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
        document.head.appendChild(style);
    }
    document.body.appendChild(overlay);
    return overlay;
}

function removeLoaderOverlay() {
    const overlay = document.getElementById("form-loader-overlay");
    if (overlay) overlay.remove();
}

function launchConfetti() {
    const duration = 7000;
    const end = Date.now() + duration;
    const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ff6600", "#6600ff"];

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10000;";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    const particles = [];
    const half = 75;
    // Left side burst
    for (let i = 0; i < half; i++) {
        const angle = (Math.random() * 0.8 + 0.2) * Math.PI; // 0.2π to 1π → upward/sideways
        const speed = Math.random() * 6 + 4;
        particles.push({
            x: 0,
            y: canvas.height * (0.2 + Math.random() * 0.6),
            w: Math.random() * 10 + 5,
            h: Math.random() * 6 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: Math.cos(angle) * speed,
            vy: -Math.abs(Math.sin(angle) * speed),
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 8,
            opacity: 1,
        });
    }
    // Right side burst
    for (let i = 0; i < half; i++) {
        const angle = (Math.random() * 0.8 + 0.2) * Math.PI;
        const speed = Math.random() * 6 + 4;
        particles.push({
            x: canvas.width,
            y: canvas.height * (0.2 + Math.random() * 0.6),
            w: Math.random() * 10 + 5,
            h: Math.random() * 6 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: -Math.cos(angle) * speed,
            vy: -Math.abs(Math.sin(angle) * speed),
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 8,
            opacity: 1,
        });
    }

    function animate() {
        if (Date.now() > end) {
            canvas.remove();
            return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of particles) {
            p.x += p.vx;
            p.vy += 0.06;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;
            p.opacity = Math.max(0, 1 - (Date.now() - (end - duration)) / duration);
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.globalAlpha = p.opacity;
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        }
        requestAnimationFrame(animate);
    }
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    window.addEventListener("resize", () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
    animate();
}

if (form) {
    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        // Basic browser validation
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        const overlay = createLoaderOverlay();

        try {
            const formData = new FormData(form);
            const response = await fetch(form.action, {
                method: "POST",
                body: formData,
                headers: {
                    "X-Requested-With": "XMLHttpRequest",
                },
            });

            removeLoaderOverlay();

            const data = await response.json();
            const status = data.status || "";
            const message = data.message || "Account created successfully!";

            if (response.ok && status === "success") {
                // Freeze form
                const allInputs = form.querySelectorAll("input, select, textarea, button");
                allInputs.forEach((el) => (el.disabled = true));

                // Show success popup
                showSuccessPopup(message);
                launchConfetti();
            } else if (status === "error") {
                showErrorPopup(message);
                if (submitBtn) submitBtn.disabled = false;
            } else if (!response.ok) {
                // JSON validation errors (400 Bad Request)
                let errorMsg = "";
                if (typeof data === "object") {
                    const firstError = Object.values(data)[0];
                    if (firstError) errorMsg = String(firstError);
                }
                showErrorPopup(errorMsg || "Registration failed. Please try again.");
                if (submitBtn) submitBtn.disabled = false;
            } else {
                showErrorPopup("Something went wrong. Please try again.");
                if (submitBtn) submitBtn.disabled = false;
            }
        } catch (err) {
            removeLoaderOverlay();
            showErrorPopup("Network error. Please check your connection and try again.");
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

function showSuccessPopup(message) {
    const popup = document.createElement("div");
    popup.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        display: flex; align-items: center; justify-content: center;
        z-index: 10001; background: rgba(0,0,0,0.15);
        font-family: 'Arial', sans-serif;
    `;
    popup.innerHTML = `
        <div style="background: #fff; border-radius: 16px; padding: 40px 50px; text-align: center; box-shadow: 0 8px 30px rgba(0,0,0,0.2); max-width: 420px;">
            <div style="width: 80px; height: 80px; background: #d4edda; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#155724" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
            <p style="margin: 0 0 8px; font-size: 24px; color: #155724; font-weight: 700;">Success!</p>
            <p style="margin: 0; font-size: 16px; color: #555; line-height: 1.5;">${message}</p>
        </div>
    `;
    document.body.appendChild(popup);
}

function showErrorPopup(message) {
    const popup = document.createElement("div");
    popup.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        width: 320px; background: #f8d7da; color: #721c24; padding: 30px;
        border: 1px solid #f5c6cb; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.15);
        z-index: 10001; text-align: center; font-family: 'Arial', sans-serif;
    `;
    popup.innerHTML = `
        <p style="margin: 0 0 15px; font-size: 18px; font-weight: 600;">Error</p>
        <p style="margin: 0 0 15px; font-size: 15px;">${message}</p>
        <button onclick="this.closest('div').remove()" style="
            padding: 8px 20px; background: #dc3545; color: #fff; border: none;
            border-radius: 5px; cursor: pointer; font-size: 14px;
        ">Close</button>
    `;
    document.body.appendChild(popup);
}
