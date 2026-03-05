const DEFAULT_RULES = {
  enabled: true,
  urlPattern: "/AssignSharedSpace/Sharings?",
  pageSize: 200,
  maxFetchCycles: 10,
  minItemCount: 5,
  filter: {
    territoryId: "e551bf93-968b-4443-86b3-46b62c529f82",
    parkingLotId: "32e0ddb0-626b-42d6-bcb2-9eb01bda5b94",
    parkingName: "El."
  }
};

chrome.runtime.onInstalled.addListener(async () => {
  const { rules } = await chrome.storage.sync.get("rules");
  if (!rules) {
    await chrome.storage.sync.set({ rules: DEFAULT_RULES });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_RULES") {
    chrome.storage.sync.get("rules").then(({ rules }) => {
      sendResponse({ rules: rules ?? DEFAULT_RULES });
    });
    return true;
  }

  if (message?.type === "SET_RULES") {
    chrome.storage.sync.set({ rules: message.rules }).then(async () => {
      const tabs = await chrome.tabs.query({ url: ["https://spacer.click/*", "https://*.spacer.click/*"] });
      await Promise.allSettled(
        tabs.map((tab) => chrome.tabs.sendMessage(tab.id, { type: "RULES_UPDATED", rules: message.rules }))
      );
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.type === "LOG") {
    console.info("[PSpacer]", message.payload);
  }

  return false;
});
