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

const ext = globalThis.browser ?? globalThis.chrome;

ext.runtime.onInstalled.addListener(async () => {
  const { rules } = await ext.storage.sync.get("rules");
  if (!rules) {
    await ext.storage.sync.set({ rules: DEFAULT_RULES });
  }
});

ext.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_RULES") {
    ext.storage.sync.get("rules").then(({ rules }) => {
      sendResponse({ rules: rules ?? DEFAULT_RULES });
    });
    return true;
  }

  if (message?.type === "SET_RULES") {
    ext.storage.sync.set({ rules: message.rules }).then(async () => {
      const tabs = await ext.tabs.query({ url: ["https://spacer.click/*", "https://*.spacer.click/*"] });
      await Promise.allSettled(
        tabs
          .filter((tab) => tab?.id != null)
          .map((tab) => ext.tabs.sendMessage(tab.id, { type: "RULES_UPDATED", rules: message.rules }))
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
