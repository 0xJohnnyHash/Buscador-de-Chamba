// Vacantes+ Autorrelleno asistido — popup
const FIELDS = ["nombre", "apellido", "email", "telefono", "ciudad", "linkedin", "mensaje"];

// Cargar datos guardados
chrome.storage.local.get("perfil", (res) => {
  const p = res.perfil || {};
  FIELDS.forEach((f) => { if (p[f]) document.getElementById(f).value = p[f]; });
});

function getData() {
  const d = {};
  FIELDS.forEach((f) => { d[f] = document.getElementById(f).value; });
  return d;
}

function msg(t, ok = true) {
  const el = document.getElementById("msg");
  el.textContent = t;
  el.style.color = ok ? "#34d399" : "#f87171";
}

document.getElementById("btn-save").addEventListener("click", () => {
  chrome.storage.local.set({ perfil: getData() }, () => msg("Datos guardados ✔"));
});

document.getElementById("btn-fill").addEventListener("click", async () => {
  const data = getData();
  chrome.storage.local.set({ perfil: data });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) { msg("No hay pestaña activa", false); return; }
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillForm,
      args: [data],
    });
    msg(`Rellenados ${result} campo(s). Revisa y envía.`);
  } catch (e) {
    msg("No se pudo rellenar en esta página", false);
  }
});

// Esta función se INYECTA en la página activa (se ejecuta allí, no en el popup)
function fillForm(data) {
  const norm = (s) => (s || "").toLowerCase();
  const MAP = {
    nombre: ["first name", "firstname", "nombre", "given name", "nombres"],
    apellido: ["last name", "lastname", "apellido", "surname", "family name", "apellidos"],
    email: ["email", "e-mail", "correo"],
    telefono: ["phone", "tel", "telefono", "teléfono", "mobile", "celular", "movil"],
    ciudad: ["city", "ciudad", "location", "ubicaci"],
    linkedin: ["linkedin", "website", "url", "portfolio", "perfil"],
  };
  const attrs = (el) => norm(
    [el.name, el.id, el.placeholder, el.getAttribute("aria-label"),
     (el.labels && el.labels[0] && el.labels[0].textContent) || ""].join(" ")
  );
  const setVal = (el, val) => {
    if (!val) return false;
    const proto = el.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, val);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  };

  let count = 0;
  const inputs = Array.from(document.querySelectorAll(
    'input[type="text"],input[type="email"],input[type="tel"],input[type="url"],input:not([type]),textarea'
  ));
  for (const el of inputs) {
    if (el.value) continue;              // no pisar lo ya escrito
    const a = attrs(el);
    if (el.tagName === "TEXTAREA") {
      if (setVal(el, data.mensaje)) count++;
      continue;
    }
    for (const [key, hints] of Object.entries(MAP)) {
      if (hints.some((h) => a.includes(h))) {
        if (setVal(el, data[key])) count++;
        break;
      }
    }
  }
  return count;
}
