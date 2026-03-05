const DEFAULT_RULES = {
  enabled: true,
  urlPattern: "/AssignSharedSpace/Sharings?",
  pageSize: 200,
  maxFetchCycles: 10,
  minItemCount: 5,
  filter: {
    territoryId: null,
    parkingLotId: null,
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
    chrome.storage.sync.set({ rules: message.rules }).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.type === "LOG") {
    console.info("[PSpacer]", message.payload);
  }

  return false;
});
