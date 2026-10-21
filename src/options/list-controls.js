export function isCardOpen(card) {
  return card.classList.contains("cleanup-rule-card") ? card.open : card.dataset.open === "true";
}

export function setCardOpen(card, isOpen) {
  if (!card) return;
  if (card.classList.contains("cleanup-rule-card")) {
    card.open = isOpen;
    return;
  }
  card.dataset.open = String(isOpen);
  card.classList.toggle("is-open", isOpen);
  const editor = card.querySelector(".prompt-editor");
  const toggle = card.querySelector("[data-toggle-prompt]");
  if (editor) editor.hidden = !isOpen;
  toggle?.setAttribute("aria-expanded", String(isOpen));
}

export function updateListControls(list, countElement, toggleButton, searchInput, unit, filter) {
  const cards = [...list.querySelectorAll(".prompt-card")];
  const searchLabel = searchInput.closest(".list-search");
  searchLabel.hidden = cards.length <= 5;
  if (searchLabel.hidden) searchInput.value = "";

  const query = searchInput.value.trim().toLocaleLowerCase();
  if (filter) {
    list.querySelector(".search-empty")?.remove();
    for (const card of cards) {
      const values = [...card.querySelectorAll("input, textarea, select")].map((input) => input.value);
      const summary = card.querySelector(".prompt-card-heading, summary")?.textContent ?? "";
      card.hidden = Boolean(query) && !`${summary} ${values.join(" ")}`.toLocaleLowerCase().includes(query);
    }
    if (query && !cards.some((card) => !card.hidden)) {
      const emptyState = document.createElement("div");
      emptyState.className = "list-empty search-empty";
      emptyState.textContent = "没有找到匹配项，试试其他关键词。";
      list.append(emptyState);
    }
  }

  const visibleCount = cards.filter((card) => !card.hidden).length;
  countElement.textContent = query ? `显示 ${visibleCount}/${cards.length} ${unit}` : `${cards.length} ${unit}`;
  toggleButton.disabled = cards.length === 0;
  toggleButton.textContent = cards.length && cards.every(isCardOpen) ? "全部收起" : "全部展开";
}

export function toggleCards(list, updateControls) {
  const cards = [...list.querySelectorAll(".prompt-card")];
  const shouldExpand = !cards.length || !cards.every(isCardOpen);
  for (const card of cards) setCardOpen(card, shouldExpand);
  updateControls();
}

