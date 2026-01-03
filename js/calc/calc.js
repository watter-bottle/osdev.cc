const main = document.getElementById("calc");
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
const queryValueParam = new URLSearchParams(window.location.search).get(
    "value",
);

const max = BigInt("0xFFFFFFFFFFFFFFFF");

let currentValue = 0n;

/* Calculator */
const operatorPrecedence = {
    "u+": 7,
    "u-": 7,
    "*": 6,
    "/": 6,
    "%": 6,
    "+": 5,
    "-": 5,
    "<<": 4,
    ">>": 4,
    "&": 3,
    "^": 2,
    "|": 1,
};

const operatorAssociativity = {
    "u+": "right",
    "u-": "right",
    "*": "left",
    "/": "left",
    "%": "left",
    "+": "left",
    "-": "left",
    "<<": "left",
    ">>": "left",
    "&": "left",
    "^": "left",
    "|": "left",
};

const clampValue = (value) => {
    if (value < 0n) return 0n;
    if (value > max) return max;
    return value;
};

const tokenizeExpression = (input, baseMode) => {
    const tokens = [];
    let i = 0;

    const isHexDigit = (char) => /[0-9a-fA-F]/.test(char);
    const isDecDigit = (char) => /[0-9]/.test(char);

    while (i < input.length) {
        const char = input[i];
        if (char === " " || char === "\t" || char === "\n") {
            i += 1;
            continue;
        }

        const next = input[i + 1] || "";
        if (char === "0" && (next === "x" || next === "X")) {
            let start = i;
            i += 2;
            while (i < input.length && isHexDigit(input[i])) i += 1;
            if (i === start + 2) return null;
            tokens.push({
                type: "number",
                value: BigInt(input.slice(start, i)),
            });
            continue;
        }

        if (char === "0" && (next === "b" || next === "B")) {
            let start = i;
            i += 2;
            while (i < input.length && /[01]/.test(input[i])) i += 1;
            if (i === start + 2) return null;
            tokens.push({
                type: "number",
                value: BigInt(input.slice(start, i)),
            });
            continue;
        }

        if (char === "0" && (next === "o" || next === "O")) {
            let start = i;
            i += 2;
            while (i < input.length && /[0-7]/.test(input[i])) i += 1;
            if (i === start + 2) return null;
            tokens.push({
                type: "number",
                value: BigInt(input.slice(start, i)),
            });
            continue;
        }

        if (baseMode === "hex" ? isHexDigit(char) : isDecDigit(char)) {
            let start = i;
            i += 1;
            while (i < input.length) {
                if (baseMode === "hex") {
                    if (!isHexDigit(input[i])) break;
                } else if (!isDecDigit(input[i])) {
                    break;
                }
                i += 1;
            }
            const raw = input.slice(start, i);
            const value = baseMode === "hex" ? BigInt("0x" + raw) : BigInt(raw);
            tokens.push({ type: "number", value });
            continue;
        }

        if (char === "(" || char === ")") {
            tokens.push({ type: "paren", value: char });
            i += 1;
            continue;
        }

        if (char === "<" && next === "<") {
            tokens.push({ type: "operator", value: "<<" });
            i += 2;
            continue;
        }

        if (char === ">" && next === ">") {
            tokens.push({ type: "operator", value: ">>" });
            i += 2;
            continue;
        }

        if (["+", "-", "*", "/", "%", "&", "|", "^"].includes(char)) {
            tokens.push({ type: "operator", value: char });
            i += 1;
            continue;
        }

        return null;
    }

    return tokens;
};

const parseExpression = (input, baseMode) => {
    if (input === "" || input === "0x" || input === "0X") return 0n;
    const tokens = tokenizeExpression(input, baseMode);
    if (!tokens) return null;

    const output = [];
    const operators = [];
    let prevType = "start";

    for (const token of tokens) {
        if (token.type === "number") {
            output.push(token);
            prevType = "number";
            continue;
        }

        if (token.type === "paren") {
            if (token.value === "(") {
                operators.push(token);
                prevType = "(";
                continue;
            }

            while (
                operators.length &&
                operators[operators.length - 1].value !== "("
            ) {
                output.push(operators.pop());
            }
            if (!operators.length) return null;
            operators.pop();
            prevType = ")";
            continue;
        }

        if (token.type === "operator") {
            let op = token.value;
            if (
                prevType === "start" ||
                prevType === "(" ||
                prevType === "operator"
            ) {
                if (op === "+") op = "u+";
                if (op === "-") op = "u-";
            }

            const opPrec = operatorPrecedence[op];
            if (opPrec === undefined) return null;

            while (operators.length) {
                const top = operators[operators.length - 1];
                if (top.type !== "operator") break;

                const topPrec = operatorPrecedence[top.value];
                if (topPrec === undefined) return null;

                const assoc = operatorAssociativity[op] || "left";
                if (
                    (assoc === "left" && opPrec <= topPrec) ||
                    (assoc === "right" && opPrec < topPrec)
                ) {
                    output.push(operators.pop());
                } else {
                    break;
                }
            }

            operators.push({ type: "operator", value: op });
            prevType = "operator";
        }
    }

    while (operators.length) {
        const op = operators.pop();
        if (op.type === "paren") return null;
        output.push(op);
    }

    const stack = [];
    for (const token of output) {
        if (token.type === "number") {
            stack.push(token.value);
            continue;
        }

        if (token.type === "operator") {
            if (token.value === "u+" || token.value === "u-") {
                if (!stack.length) return null;
                const value = stack.pop();
                stack.push(token.value === "u-" ? -value : value);
                continue;
            }

            if (stack.length < 2) return null;
            const right = stack.pop();
            const left = stack.pop();

            let result = 0n;
            switch (token.value) {
                case "+":
                    result = left + right;
                    break;
                case "-":
                    result = left - right;
                    break;
                case "*":
                    result = left * right;
                    break;
                case "/":
                    if (right === 0n) return null;
                    result = left / right;
                    break;
                case "%":
                    if (right === 0n) return null;
                    result = left % right;
                    break;
                case "<<":
                    if (right < 0n) return null;
                    result = left << right;
                    break;
                case ">>":
                    if (right < 0n) return null;
                    result = left >> right;
                    break;
                case "&":
                    result = left & right;
                    break;
                case "^":
                    result = left ^ right;
                    break;
                case "|":
                    result = left | right;
                    break;
                default:
                    return null;
            }

            stack.push(result);
        }
    }

    if (stack.length !== 1) return null;
    return stack[0];
};

const evaluateExpression = (input, baseMode) => {
    const value = parseExpression(input.trim(), baseMode);
    if (value === null) return { ok: false, value: currentValue };
    return { ok: true, value: clampValue(value) };
};

const updateBinary = () => {
    for (let i = 0; i < 64; i++) {
        const elem = binaryElements[64 - 1 - i];

        if ((currentValue & (1n << BigInt(i))) === 0n) {
            elem.classList.remove("active");
        } else {
            elem.classList.add("active");
        }
    }
};

const setCurrentValue = (value, options = {}) => {
    currentValue = clampValue(value);

    const source = options.source || null;
    if (source !== decimal) decimal.value = currentValue.toString(10);
    if (source !== hex) hex.value = currentValue.toString(16);

    updateBinary();
    updateDecoder();
};

const handleInput = (input, baseMode) => {
    const result = evaluateExpression(input.value, baseMode);
    if (!result.ok) return;
    setCurrentValue(result.value, { source: input });
};

const commitInput = (input, baseMode) => {
    const result = evaluateExpression(input.value, baseMode);
    if (!result.ok) return;
    setCurrentValue(result.value);
};

decimal.oninput = () => handleInput(decimal, "dec");
hex.oninput = () => handleInput(hex, "hex");

decimal.onblur = () => commitInput(decimal, "dec");
hex.onblur = () => commitInput(hex, "hex");

const commitOnEnter = (event, baseMode) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commitInput(event.target, baseMode);
};

decimal.addEventListener("keydown", (event) => commitOnEnter(event, "dec"));
hex.addEventListener("keydown", (event) => commitOnEnter(event, "hex"));

for (let i = 0; i < 64; i++) {
    binaryElements[64 - 1 - i].onclick = () => {
        if ((currentValue & (1n << BigInt(i))) === 0n) {
            setCurrentValue(currentValue | (1n << BigInt(i)));
        } else {
            setCurrentValue(currentValue & ~(1n << BigInt(i)));
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

const applyInitialValueFromQuery = () => {
    if (!queryValueParam) return;
    const trimmed = queryValueParam.trim();
    if (trimmed === "") return;

    try {
        currentValue = clampValue(BigInt(trimmed));
    } catch (error) {
        console.warn("Ignoring invalid value query parameter", error);
        return;
    }

    decimal.value = currentValue.toString(10);
    hex.value = currentValue.toString(16);
    updateBinary();
};

applyInitialValueFromQuery();
