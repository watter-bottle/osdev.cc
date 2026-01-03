const tools = document.getElementById("links-tools");
const quick = document.getElementById("links-quick");

fetch("/links.json")
    .then((res) => res.json())
    .then((data) => {
        if (tools != null) {
            for (const tool of data.tools) {
                const a = document.createElement("a");
                a.href = tool.url;
                a.textContent = tool.name;
                tools.appendChild(a);
            }
        }

        if (quick != null) {
            for (const link of data.quick) {
                const a = document.createElement("a");
                a.href = link.url;
                a.target = "_blank";
                a.rel = "noreferrer";
                a.textContent = link.name;
                quick.appendChild(a);
            }
        }
    });
