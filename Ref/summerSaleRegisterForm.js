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
	// form.setAttribute("action", "http://127.0.0.1:8000/api/summer-sale-registration/");
	form.setAttribute("action", "https://workspace.101distributors.com/backend/api/summer-sale-registration/");
	form.setAttribute("class", "frm-fluent-form ff-el-form-top ffs_default ff-form-loaded");
	form.setAttribute("enctype", "multipart/form-data");
} else {
	console.error('Form with ID "fluentform_12" not found.');
}

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
			const file = input.files[0];
			span.textContent = fileName;
			// const callApi = async (base64Image) => {
			//     const apiUrl = 'https://workspace.101distributors.com/backend/api/license-validator/';

			//     console.log("Calling API with image data...");
			//     const response = await fetch(apiUrl, {
			//         method: 'POST',
			//         headers: {
			//             'Content-Type': 'application/json',
			//         },
			//         body: JSON.stringify({
			//             image_url: base64Image,
			//             name: input.getAttribute("name")
			//         })
			//     });

			//     if (!response.ok) {
			//         throw new Error(`API call failed with status: ${response.status}`);
			//     }

			//     const data = await response.json();
			//     document.getElementsByName(inputFieldMap[input.getAttribute("name")][0])[0].value = data?.[inputFieldMap[input.getAttribute("name")][1]]
			//     console.log(`License Found! ${JSON.stringify(data)}`);
			//     const expiryDate = new Date(data.expiryDate);
			//     const currentDate = new Date();

			//     if (expiryDate < currentDate) {
			//         input.value = '';
			//         alert("The expiry date has passed.");
			//     } else {
			//         console.log("The expiry date has not yet passed.");
			//     }
			// };

			// try {
			//     if (file.type === "application/pdf") {
			//         console.log("Processing PDF file...");
			//         const fileReader = new FileReader();

			//         fileReader.onload = async function() {
			//             const typedarray = new Uint8Array(this.result);

			//             const pdf = await pdfjsLib.getDocument(typedarray).promise;
			//             const page = await pdf.getPage(1);

			//             const viewport = page.getViewport({ scale: 1.5 });
			//             const canvas = document.createElement('canvas');
			//             const context = canvas.getContext('2d');
			//             canvas.height = viewport.height;
			//             canvas.width = viewport.width;

			//             await page.render({ canvasContext: context, viewport: viewport }).promise;
			//             const base64Image = canvas.toDataURL('image/jpeg');
			//             await callApi(base64Image);
			//         };

			//         fileReader.readAsArrayBuffer(file);

			//     }
			//     else if (file.type.startsWith("image/")) {
			//         console.log("Processing image file...");
			//         const reader = new FileReader();
			//         reader.onloadend = async function () {
			//             const base64Image = reader.result;
			//             await callApi(base64Image);
			//         }
			//         reader.readAsDataURL(file);
			//     }
			//     else {
			//         alert("Unsupported file type. Please upload a PDF or an image.");
			//         span.textContent = originalButtonText;
			//     }
			// } catch (error) {
			//     console.error("An error occurred:", error);
			//     alert("Something went wrong while processing the file. Please try again.");
			//     span.textContent = originalButtonText;
			// }
		} else {
			span.textContent = originalButtonText;
		}
	});
	attributesToRemove.forEach((attrName) => {
		input.removeAttribute(attrName);
	});
	// let requiredList = ["driving_license_document", "fein_license_document", "business_license_document"];
	// if (requiredList.includes(input.getAttribute("name"))) {
	// 	input.setAttribute("required", "");
	// }
});

const stateInput = document.getElementById("ff_12_address_1_state_");
if (stateInput) {
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
	}
} else {
	console.error('State input with ID "ff_12_address_1_state_" not found.');
}

// select all inputs with type text, email, tel, number, textarea, and select
let inputList = [
	'input[name="names[first_name]"]',
	'input[name="names[last_name]"]',
	'input[name="names[email]"]',
	'input[name="names[phone]"]',
	'input[name="address_1[address_line_1]"]',
	'input[name="address_1[city]"]',
	'input[name="address_1[zip]"]',
	'input[name="input_text_1"]',
	'input[name="input_text"]',
	'input[name="input_text_2"]',
	'input[name="input_text_3"]',
	'input[name="input_text_4"]',
	'input[name="input_text_5"]',
	'input[name="input_text_6"]',
]
const inputs = document.querySelectorAll(inputList.join(', ') + ', select');
inputs.forEach((input) => {
	input.addEventListener("change", () => {
		const value = input.value;
		if (value) {
			let localData = localStorage.getItem("dataForm");
			if (localData) {
				localData = JSON.parse(localData);
			} else {
				localData = {};
			}
			localData[input.getAttribute("name")] = value;
			localStorage.setItem("dataForm", JSON.stringify(localData));
		}else{
			let localData = localStorage.getItem("dataForm");
			if (localData) {
				localData = JSON.parse(localData);
				delete localData[input.getAttribute("name")];
				localStorage.setItem("dataForm", JSON.stringify(localData));
			}
		}
	});
});

// load the dataForm from local storage
let localData = localStorage.getItem("dataForm");
if (localData) {
	localData = JSON.parse(localData);
	for (const [name, value] of Object.entries(localData)) {
		const input = document.querySelector(`[name="${name}"]`);
		if (input) {
			input.value = value;
		}
	}
}

const firstNameInput = document.querySelector('input[name="names[first_name]"]');
const lastNameInput = document.querySelector('input[name="names[last_name]"]');
const emailInput = document.querySelector('input[name="names[email]"]');
const phoneInput = document.querySelector('input[name="names[phone]"]');
const addressInput = document.querySelector('input[name="address_1[address_line_1]"]');
const cityInput = document.querySelector('input[name="address_1[city]"]');
const zipInput = document.querySelector('input[name="address_1[zip]"]');
if (firstNameInput) {
	firstNameInput.setAttribute("required", "");
}
if (lastNameInput) {
	lastNameInput.setAttribute("required", "");
}
if (emailInput) {
	emailInput.setAttribute("required", "");
}
if (phoneInput) {
	phoneInput.setAttribute("required", "");
	phoneInput.setAttribute("type", "tel");
	phoneInput.setAttribute("pattern", "[0-9]{3}-[0-9]{3}-[0-9]{4}");
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

// do required for input_text
const input_text = document.querySelector('input[name="input_text"]');
const input_text_1 = document.querySelector('input[name="input_text_1"]');
const terms_and_conditions = document.querySelector('input[name="terms-n-condition"]');
if (terms_and_conditions) {
	terms_and_conditions.setAttribute("required", "");
}
if (input_text_1) {
	input_text_1.setAttribute("required", "");
}
if (input_text) {
	input_text.setAttribute("required", "");
}


// fetch url parameters
const urlParams = new URLSearchParams(window.location.search);
const params = Object.fromEntries(urlParams.entries());
// get message from params
const message = params.message || "";
const statusData = params.status || "";
if (message ) {
	// alert(message);
	// create a small popup with the message
	const popup = document.createElement("div");
	popup.style.position = "fixed";
	popup.style.top = "50%";
	popup.style.right = "50%";
	popup.style.width = "300px";
	popup.style.minHeight = "100px";
	popup.style.transform = "translate(50%, -50%)";
	popup.style.backgroundColor = statusData === "success" ? "#d4edda" : "#f8d7da";
	popup.style.color = statusData === "success" ? "#155724" : "#721c24";
	popup.style.padding = "14px";
	popup.style.border = statusData === "success" ? "1px solid #c3e6cb" : "1px solid #f5c6cb";
	popup.style.borderRadius = "5px";
	popup.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.1)";
	popup.style.zIndex = "1000";
	popup.style.textAlign = "center";
	popup.style.justifyContent = "center";
	popup.style.fontSize = "25px";

	let newP = document.createElement("p");
	newP.textContent = message;
	popup.appendChild(newP);
	popup.style.display = "flex";
	popup.style.alignItems = "center";
	popup.style.justifyContent = "center";
	popup.style.fontFamily = "Arial, sans-serif";
	document.body.appendChild(popup);
	// remove the popup after 5 seconds
	setTimeout(() => {
		popup.remove();
	}, 5000);
}