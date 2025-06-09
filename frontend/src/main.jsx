import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration.js";

createRoot(document.getElementById("root")).render(<App />);

// Register service worker for PWA support
serviceWorkerRegistration.register();