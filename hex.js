const main = document.getElementById("hex");

const decimal = document.createElement("input");
const hex = document.createElement("input");
const binary = document.createElement("div");
const binaryElements = [];
for (let i = 0; i < 64; i++) {
    const e = document.createElement("div");
    e.textContent = (63 - i).toString();
    binaryElements.push(e);
    binary.appendChild(e);
}
const cbfTable = document.createElement("table");
const cbfSelectors = document.createElement("div");

const max = BigInt("0xFFFFFFFFFFFFFFFF");

/* Custom Bitfields */
let cbfSelected = -1;
let cbf = [];

/* Update */
let currentValue = 0n;
const updateCbf = () => {
    cbfTable.innerHTML = "";
    if (cbfSelected < 0) return;

    const thead = cbfTable.createTHead();
    const tr = thead.insertRow();
    const td = tr.insertCell();
    tr.insertCell();
    td.textContent = cbf[cbfSelected].name;

    const tbody = cbfTable.createTBody();

    let i = 0;
    for (const dataRow of cbf[cbfSelected].data) {
        if (dataRow.position != undefined) {
            if (i > dataRow.position) {
                console.error("cbf malformed");
                continue;
            }
            i = dataRow.position;
        }

        const makeMask = (length) => {
            let mask = 0n;
            for (let i = 0; i < length; i++) mask += 1n << BigInt(i);
            return mask;
        };
        const value = (currentValue >> BigInt(i)) & makeMask(dataRow.length);
        i += dataRow.length;

        const row = tbody.insertRow();
        row.setAttribute("title", `bit: ${i}, length: ${dataRow.length}`);
        if (dataRow.length == 1 && value > 0) row.classList.add("active");

        const labelCell = row.insertCell();
        labelCell.innerText = dataRow.label;
        const valueCell = row.insertCell();
        valueCell.innerText = value.toString(16);
    }
};
const updateBinary = () => {
    for (let i = 0; i < 64; i++) {
        const elem = binaryElements[64 - 1 - i];

        if ((currentValue & (1n << BigInt(i))) == 0n) {
            elem.classList.remove("active");
        } else {
            elem.classList.add("active");
        }
    }
};
const update = (value) => {
    if (typeof value != "bigint") {
        if (value == "" || value == "0x") {
            value = 0n;
        } else {
            try {
                value = BigInt(value);
            } catch {
                value = currentValue;
            }
            if (value > max) value = max;
        }
    }
    currentValue = value;

    decimal.value = currentValue.toString(10);
    hex.value = currentValue.toString(16);
    updateBinary();
    updateCbf();
};

/* Input */
decimal.oninput = (e) => update(e.target.value);
hex.oninput = (e) => update("0x" + e.target.value);

for (let i = 0; i < 64; i++) {
    binaryElements[64 - 1 - i].onclick = () => {
        if ((currentValue & (1n << BigInt(i))) == 0n) {
            update(currentValue | (1n << BigInt(i)));
        } else {
            update(currentValue & ~(1n << BigInt(i)));
        }
    };
}

/* Decimal */
const labelDecimal = document.createElement("label");
labelDecimal.textContent = "Decimal";
main.appendChild(labelDecimal);

decimal.placeholder = "Decimal";
decimal.value = currentValue;
main.appendChild(decimal);

/* Hex */
const labelHex = document.createElement("label");
labelHex.textContent = "Hex";
main.appendChild(labelHex);

hex.placeholder = "Hex";
hex.value = currentValue;
main.appendChild(hex);

/* Binary */
const labelBinary = document.createElement("label");
labelBinary.textContent = "Binary";
main.appendChild(labelBinary);

main.appendChild(binary);

/* CBF Table */
updateCbf();

const cbfMain = document.getElementById("cbf");
cbfMain.appendChild(cbfTable);
cbfMain.appendChild(cbfSelectors);

/* Load CBF */
fetch("/cbf.json")
    .then((res) => res.json())
    .then((data) => {
        cbf = data;
        for (let i = 0; i < cbf.length; i++) {
            const selectButton = document.createElement("button");
            selectButton.onclick = () => {
                cbfSelected = i;
                updateCbf();
            };
            selectButton.textContent = cbf[i].name;
            cbfSelectors.appendChild(selectButton);
        }
    });
