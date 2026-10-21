export function askBeforeLeaving(title, message, choices) {
  const dialog = document.createElement("dialog");
  dialog.className = "confirmation-dialog";
  const content = document.createElement("form");
  content.method = "dialog";
  content.className = "confirmation-dialog-content";
  const heading = document.createElement("h2");
  heading.id = "draft-confirmation-title";
  heading.textContent = title;
  dialog.setAttribute("aria-labelledby", heading.id);
  const description = document.createElement("p");
  description.textContent = message;
  const actions = document.createElement("div");
  actions.className = "confirmation-dialog-actions";
  for (const [value, text] of choices) {
    const button = document.createElement("button");
    button.type = "submit";
    button.value = value;
    button.textContent = text;
    actions.append(button);
  }
  content.append(heading, description, actions);
  dialog.append(content);
  document.body.append(dialog);
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => { const result = dialog.returnValue; dialog.remove(); resolve(result); }, { once: true });
    dialog.showModal();
    actions.querySelector("button").focus();
  });
}

