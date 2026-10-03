const state = {
    languages: {},
    current: null
};

const languageCode = document.getElementById("languageCode");
const languageSelect = document.getElementById("languageSelect");
const editor = document.getElementById("editor");
const editorTitle = document.getElementById("editorTitle");
const rows = document.getElementById("rows");
const filePicker = document.getElementById("filePicker");

function loadState() {
    try {
        state.languages = JSON.parse(localStorage.getItem("mcLangGenerator") || "{}");
    } catch {
        state.languages = {};
    }
    refreshDropdown();
}

function saveState() {
    localStorage.setItem("mcLangGenerator", JSON.stringify(state.languages));
}

function refreshDropdown(selectName = null) {
    languageSelect.innerHTML = "";

    const names = Object.keys(state.languages).sort();

    if (!names.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No files loaded";
        languageSelect.appendChild(option);
        return;
    }

    for (const name of names) {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        languageSelect.appendChild(option);
    }

    if (selectName && names.includes(selectName)) {
        languageSelect.value = selectName;
    } else {
        languageSelect.value = names[0];
    }
}

function validateLanguageName(name) {
    if (!name) return "Please enter a language code.";

    // Invalid Windows filename characters.
    if (/[<>:"/\\\\|?*]/.test(name)) {
        return "The language code contains invalid filename characters.";
    }

    return null;
}

function createLanguage() {
    const name = languageCode.value.trim();
    const error = validateLanguageName(name);

    if (error) {
        alert(error);
        return;
    }

    if (state.languages[name]) {
        if (!confirm(`Language "${name}" already exists. Open it for editing?`)) {
            return;
        }
        openEditor(name);
        return;
    }

    state.languages[name] = {};
    saveState();
    languageCode.value = "";
    refreshDropdown(name);
    openEditor(name);
}

function addRow(key = "", value = "") {
    const row = document.createElement("div");
    row.className = "translation-row";

    const keyInput = document.createElement("input");
    keyInput.type = "text";
    keyInput.placeholder = "item.example.name";
    keyInput.value = key;

    const valueInput = document.createElement("input");
    valueInput.type = "text";
    valueInput.placeholder = "Translation";
    valueInput.value = value;

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-row";
    deleteButton.textContent = "X";
    deleteButton.title = "Remove translation";
    deleteButton.addEventListener("click", () => row.remove());

    row.append(keyInput, valueInput, deleteButton);
    rows.appendChild(row);
}

function openEditor(name) {
    if (!state.languages[name]) return;

    state.current = name;
    editorTitle.textContent = `Translations (${name})`;
    rows.innerHTML = "";

    const translations = state.languages[name];

    for (const [key, value] of Object.entries(translations)) {
        addRow(key, value);
    }

    if (!rows.children.length) {
        addRow();
    }

    editor.classList.remove("hidden");
    editor.scrollIntoView({ behavior: "smooth", block: "start" });
}

function saveChanges() {
    if (!state.current) return;

    const newTranslations = {};
    const seen = new Set();

    for (const row of rows.children) {
        const inputs = row.querySelectorAll("input");
        const key = inputs[0].value.trim();
        const value = inputs[1].value;

        if (!key && !value) continue;

        if (!key) {
            alert("Every translation needs an ID.");
            return;
        }

        if (seen.has(key)) {
            alert(`The ID "${key}" appears more than once.`);
            return;
        }

        seen.add(key);
        newTranslations[key] = value;
    }

    state.languages[state.current] = newTranslations;
    saveState();
    refreshDropdown(state.current);

    downloadLanguageFiles(state.current, newTranslations);

    alert("Translations saved successfully. The updated files were downloaded.");
}

function makeJson(name, translations) {
    return JSON.stringify({
        translations: translations
    }, null, 4);
}

function makeLang(translations) {
    return Object.entries(translations)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n") + (Object.keys(translations).length ? "\n" : "");
}

function downloadText(filename, content, type = "text/plain") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function downloadLanguageFiles(name, translations) {
    downloadText(
        `${name}.data.json`,
        makeJson(name, translations),
        "application/json"
    );

    setTimeout(() => {
        downloadText(
            `${name}.lang`,
            makeLang(translations),
            "text/plain"
        );
    }, 150);
}

function deleteSelected() {
    const name = languageSelect.value;

    if (!name || !state.languages[name]) {
        alert("Please select a language to delete.");
        return;
    }

    if (!confirm(`Delete the saved browser copy of "${name}"?`)) {
        return;
    }

    delete state.languages[name];
    saveState();
    refreshDropdown();

    if (state.current === name) {
        state.current = null;
        editor.classList.add("hidden");
    }
}

function parseLang(text) {
    const result = {};

    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

        const index = trimmed.indexOf("=");
        const key = trimmed.slice(0, index).trim();
        const value = trimmed.slice(index + 1);

        if (key && !(key in result)) {
            result[key] = value;
        }
    }

    return result;
}

function parseJson(text) {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object") return {};

    const translations = data.translations;
    return translations && typeof translations === "object" ? translations : {};
}

async function openFiles(files) {
    const langFiles = [...files].filter(f => f.name.endsWith(".lang"));
    const jsonFiles = [...files].filter(f => f.name.endsWith(".json"));

    if (!langFiles.length && !jsonFiles.length) {
        alert("Please select a .lang or .data.json file.");
        return;
    }

    const grouped = {};

    for (const file of langFiles) {
        const name = file.name.slice(0, -5);
        grouped[name] = grouped[name] || {};
        Object.assign(grouped[name], parseLang(await file.text()));
    }

    for (const file of jsonFiles) {
        const name = file.name.endsWith(".data.json")
            ? file.name.slice(0, -10)
            : file.name.slice(0, -5);

        grouped[name] = grouped[name] || {};

        try {
            Object.assign(grouped[name], parseJson(await file.text()));
        } catch {
            alert(`Could not read JSON file: ${file.name}`);
        }
    }

    for (const [name, translations] of Object.entries(grouped)) {
        state.languages[name] = translations;
    }

    saveState();

    const first = Object.keys(grouped)[0];
    refreshDropdown(first);
    openEditor(first);
}

document.getElementById("createBtn").addEventListener("click", createLanguage);

languageCode.addEventListener("keydown", event => {
    if (event.key === "Enter") createLanguage();
});

document.getElementById("editBtn").addEventListener("click", () => {
    const name = languageSelect.value;
    if (name) openEditor(name);
});

document.getElementById("deleteBtn").addEventListener("click", deleteSelected);

document.getElementById("openBtn").addEventListener("click", () => {
    filePicker.click();
});

filePicker.addEventListener("change", () => {
    openFiles(filePicker.files);
    filePicker.value = "";
});

document.getElementById("downloadBtn").addEventListener("click", () => {
    const name = languageSelect.value;
    if (!name || !state.languages[name]) {
        alert("Please select a language first.");
        return;
    }
    downloadLanguageFiles(name, state.languages[name]);
});

document.getElementById("addBtn").addEventListener("click", () => addRow());

document.getElementById("saveBtn").addEventListener("click", saveChanges);

document.getElementById("closeEditorBtn").addEventListener("click", () => {
    editor.classList.add("hidden");
    state.current = null;
});

loadState();
