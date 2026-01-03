const DECODER_STORAGE_KEY = "osdev.selectedDecoder";
let selectedDecoder = -1;
let decoders = [];

const queryDecoderParam = new URLSearchParams(window.location.search).get(
    "decoder",
);

const normalizeDecoderKey = (value) => {
    if (typeof value !== "string") return "";
    return value.trim().toLowerCase();
};

const findDecoderIndexByKey = (value) => {
    const normalized = normalizeDecoderKey(value);
    if (!normalized) return -1;
    return decoders.findIndex((decoder) => {
        if (!decoder) return false;
        return normalizeDecoderKey(decoder.id) === normalized;
    });
};

const persistSelectedDecoder = () => {
    if (selectedDecoder < 0 || !decoders[selectedDecoder]) {
        localStorage.removeItem(DECODER_STORAGE_KEY);
        return;
    }
    localStorage.setItem(DECODER_STORAGE_KEY, decoders[selectedDecoder].id);
};

const decoderMain = document.getElementById("decoder");
const decoderTable = document.createElement("table");
const decoderControls = document.createElement("div");
decoderControls.classList.add("decoder-selector");

const decoderSelectorLabel = document.createElement("label");
decoderSelectorLabel.setAttribute("for", "decoder-selector");
const decoderSelector = document.createElement("select");
decoderSelector.id = "decoder-selector";
decoderSelector.addEventListener("change", (event) => {
    const index = Number(event.target.value);
    if (Number.isNaN(index)) return;
    selectedDecoder = index;
    persistSelectedDecoder();
    updateDecoder();
});

decoderControls.appendChild(decoderSelectorLabel);
decoderControls.appendChild(decoderSelector);
decoderMain.appendChild(decoderControls);
decoderMain.appendChild(decoderTable);

/* Update */
const updateDecoder = () => {
    decoderTable.innerHTML = "";
    if (selectedDecoder < 0) {
        decoderSelector.selectedIndex = -1;
        return;
    }

    decoderSelector.value = selectedDecoder.toString();

    const thead = decoderTable.createTHead();
    const tr = thead.insertRow();
    const thField = tr.insertCell();
    const thBits = tr.insertCell();
    const thValue = tr.insertCell();
    thField.textContent = "Field";
    thBits.textContent = "Bits";
    thValue.textContent = "Value";

    const tbody = decoderTable.createTBody();

    let i = 0;
    for (const dataRow of decoders[selectedDecoder].data) {
        if (dataRow.position !== undefined) {
            if (i > dataRow.position) {
                console.error("decoder malformed");
                continue;
            }
            i = dataRow.position;
        }

        const makeMask = (length) => {
            let mask = 0n;
            for (let i = 0; i < length; i++) mask += 1n << BigInt(i);
            return mask;
        };
        const startBit = i;
        const value =
            (currentValue >> BigInt(startBit)) & makeMask(dataRow.length);
        i += dataRow.length;

        const row = tbody.insertRow();
        row.setAttribute(
            "title",
            `bit: ${startBit}, length: ${dataRow.length}`,
        );
        if (value > 0) row.classList.add("active");

        const labelCell = row.insertCell();
        labelCell.innerText = dataRow.label;
        const bitCell = row.insertCell();
        const endBit = startBit + dataRow.length - 1;
        bitCell.classList.add("bits");
        bitCell.innerText =
            dataRow.length === 1 ? `${startBit}` : `${startBit}..${endBit}`;
        const valueCell = row.insertCell();
        valueCell.classList.add("value");

        let valueString;
        if (dataRow.as === undefined) {
            dataRow.as = "decimal";
        }

        switch (dataRow.as) {
            case "hex":
                valueString = `0x${value.toString(16)}`;
                break;
            case "decimal":
                valueString = value.toString(10);
                break;
            case "boolean":
                valueString = value === 0n ? "false" : "true";
                break;
            default:
                break;
        }

        if (dataRow.match !== undefined) {
            valueCell.innerText = `${dataRow.match[value]} (${valueString})`;
        } else {
            valueCell.innerText = valueString;
        }
    }
};

/* Decoder */
updateDecoder();

fetch("/decoder-entries.json")
    .then((res) => res.json())
    .then((data) => {
        decoders = data;
        decoderSelector.innerHTML = "";
        for (let i = 0; i < decoders.length; i++) {
            const option = document.createElement("option");
            option.value = i.toString();
            option.textContent = decoders[i].name;
            decoderSelector.appendChild(option);
        }
        if (decoders.length > 0) {
            const storedKey = localStorage.getItem(DECODER_STORAGE_KEY);
            const storedIndex = findDecoderIndexByKey(storedKey);
            selectedDecoder = storedIndex >= 0 ? storedIndex : 0;

            const queryIndex = findDecoderIndexByKey(queryDecoderParam);
            if (queryIndex >= 0) {
                selectedDecoder = queryIndex;
            }

            decoderSelector.disabled = false;
        } else {
            selectedDecoder = -1;
            decoderSelector.disabled = true;
            localStorage.removeItem(DECODER_STORAGE_KEY);
        }
        updateDecoder();
        persistSelectedDecoder();
    });
