# PSpacer Companion — User Prompt Log

Source: direct session with lioha  
Scope: prompts related to `pspacer-companion` extension work  
Note: timestamps are preserved from user messages.

---

## [Thu 2026-03-05 21:30 GMT+2]
**Prompt:**
> draft a concrete MV3 extension skeleton in separate project pspacer-companion

## [Thu 2026-03-05 21:33 GMT+2]
**Prompt:**
> please move it to /mnt/d/Lioha/WORK/workspace/pspacer-companion

## [Thu 2026-03-05 21:33 GMT+2]
**Prompt:**
> yes

## [Thu 2026-03-05 21:34 GMT+2]
**Prompt:**
> lioha/a.janciukas@gmail.com

## [Thu 2026-03-05 21:35 GMT+2]
**Prompt:**
> can I use WebStrom for this project?

## [Thu 2026-03-05 21:41 GMT+2]
**Prompt:**
> can you move API interception logic from pspacer java app?

## [Thu 2026-03-05 21:44 GMT+2]
**Prompt:**
> i dunno, but devtools shows it as XHR

**Image:** provided by user in chat (not available as file in tool transcript).

## [Thu 2026-03-05 21:45 GMT+2]
**Prompt:**
> where is type column?

## [Thu 2026-03-05 21:48 GMT+2]
**Prompt:**
> where to click?

**Image:** provided by user in chat (not available as file in tool transcript).

## [Thu 2026-03-05 21:50 GMT+2]
**Prompt:**
> found it, type is xhr for API call i want to intercept

## [Thu 2026-03-05 21:55 GMT+2]
**Prompt:**
> how to use extension?

## [Thu 2026-03-05 22:04 GMT+2]
**Prompt:**
> no need to show urls on overlay

## [Thu 2026-03-05 22:06 GMT+2]
**Prompt:**
> no need for sample entries on overlay

## [Thu 2026-03-05 22:07 GMT+2]
**Prompt:**
> is it possible to implement drop down selection in extension rules?

## [Thu 2026-03-05 22:11 GMT+2]
**Prompt:**
> i prefer dynamic approach app fetches: territories from https://spacer.click/api/private-K20A-prod-3d807/v1/ParkingSpaces parking lots from https://spacer.click/api/private-K20A-prod-3d807/v1/ParkingLots can you read those values from API or just fetch them from JS objects?

## [Thu 2026-03-05 22:14 GMT+2]
**Prompt:**
> yes, dropdowns + “Any” option and with territory→parking-lot dependency. for parking name present drop down with 3 values: "El.", "El.stotelė", "El.lizdas", but also allow to enter value freely

## [Thu 2026-03-05 22:17 GMT+2]
**Prompt:**
> dropdowns have no values, console shows GET https://spacer.click/api/private-K20A-prod-3d807/v1/ParkingSpaces net::ERR_ABORTED 401 (Unauthorized) auth is missing i think

## [Thu 2026-03-05 22:22 GMT+2]
**Prompt:**
> i've made a mistake territories are returned by https://spacer.click/api/private-K20A-prod-3d807/v1/ParkingLots?Territory=true

## [Thu 2026-03-05 22:27 GMT+2]
**Prompt:**
> now dropdowns are ok. but changing parking lot has no effect on filtering

## [Thu 2026-03-05 22:32 GMT+2]
**Prompt:**
> https://spacer.click sharing filtering page has territory dropdown already, but has no parking lot dropdown. is it possible to add parking lot filtering directly to page itself?

## [Thu 2026-03-05 22:34 GMT+2]
**Prompt:**
> do 1, with all proposed options. no need for territory/parkinglot drop down in plugin page then

## [Thu 2026-03-05 22:36 GMT+2]
**Prompt:**
> no parking lot dropdown

**Image:** provided by user in chat (not available as file in tool transcript).

## [Thu 2026-03-05 22:39 GMT+2]
**Prompt:**
> it is there now, but inside territory dropdown and both are non-selectable now

**Image:** provided by user in chat (not available as file in tool transcript).

## [Thu 2026-03-05 22:42 GMT+2]
**Prompt:**
> now sharings page just hangs when i open it

## [Thu 2026-03-05 22:44 GMT+2]
**Prompt:**
> still inside selection works, but for territory only, no matter where i click

**Image:** provided by user in chat (not available as file in tool transcript).

## [Thu 2026-03-05 22:47 GMT+2]
**Prompt:**
> there is badly located parkinglot dropdown, but it have single "Any" value i'd prefer to have parkinglot dropdown on page itself. can you give some DOM to find correct place to inject it?

**Image:** provided by user in chat (not available as file in tool transcript).

## [Thu 2026-03-05 22:50 GMT+2]
**Prompt:**
> { "labelPath": "label.MuiFormLabel-root..." ... }

(Full JSON DOM capture provided in chat and used for selector tuning.)

## [Thu 2026-03-05 22:52 GMT+2]
**Prompt:**
> second failed page-hook.js:43 GET https://spacer.click/api/private-K20A-prod-3d807/v1/ParkingLots 401 (Unauthorized)

## [Thu 2026-03-05 22:53 GMT+2]
**Prompt:**
> better, but dropdown not clickable and impacted position of date

**Image:** provided by user in chat (not available as file in tool transcript).

## [Thu 2026-03-05 22:55 GMT+2]
**Prompt:**
> before last change it was non-clicable, but i was able to select values using keyboard

## [Thu 2026-03-05 22:58 GMT+2]
**Prompt:**
> it's clickable now, but 2 issues: parkinglot dropdown position overlays date parkinglots values does not depend on territory selected. show only those parking lots which belongs to selected territory

## [Thu 2026-03-05 23:04 GMT+2]
**Prompt:**
> position is good, but dropdown is non-selectable with mouse, selectable with keyboard still contains all parking lot values, i.e. not depends on selected territory territories JSON {...} perkinglost JSON {...}

**Image:** provided by user in chat (not available as file in tool transcript).

## [Thu 2026-03-05 23:11 GMT+2]
**Prompt:**
> Territory dependency for lots - ok now. changing of territory refreshes parkinglots properly, but this change alone does not trigger sharing fetching, i have to select date to run fetching another issue - when territory dropdown is selected it visual conflicts with parkinglot dropdown

**Image:** provided by user in chat (not available as file in tool transcript).

## [Thu 2026-03-05 23:15 GMT+2]
**Prompt:**
> when i select territory it does not conflict with parkinglot dropdown, but stays invisible territory selection from dropdown TRIGGERS fetch, i want the same for parkinglot selection

**Image:** provided by user in chat (not available as file in tool transcript).

## [Thu 2026-03-05 23:19 GMT+2]
**Prompt:**
> 1 resulted in previous issue when parkinglot dropdown is shown over opened territory dropdown 2. parkinglot value change does not force to fetch sharings again

## [Thu 2026-03-05 23:22 GMT+2]
**Prompt:**
> 1 cannot verify - extension has errors (screenshot) 2 will not work since there are no buttons on this form. it fetches sharing when territory or dates changes. i want the same for parkinglot.

**Image:** provided by user in chat (not available as file in tool transcript).

## [Thu 2026-03-05 23:26 GMT+2]
**Prompt:**
> 1. so now lot visibility is ok mostly, but code is still play with its visibility. is it really necessary since date fields reside below territory dropdown and those have no visibility conflicts 2. lot selection does not fetch anyway

## [Thu 2026-03-05 23:30 GMT+2]
**Prompt:**
> now lot selection do autofetch, but it resets territory value to default on. i want to avoid that

## [Thu 2026-03-05 23:31 GMT+2]
**Prompt:**
> now lot selection does not fetch again

## [Thu 2026-03-05 23:39 GMT+2]
**Prompt:**
> fetch on lot selection does not work as expected anyway. remove all code related to autofetch on lot selection for now

## [Thu 2026-03-05 23:45 GMT+2]
**Prompt:**
> good, now i want to address visibility issues again. when i select territory dropdown, it opens and show all territories. problem is that lot dropdown below territory dropdown visible stays on top and partially overlays opened territory dropdown items. i want lot dropdown to not overlay opened territory dropdown. i can provide you DOM if it can help

## [Thu 2026-03-05 23:46 GMT+2]
**Prompt:**
> how to copy whole dom from devtools console?

## [Thu 2026-03-05 23:51 GMT+2]
**Prompt:**
> i doubt it full dom { ... }

## [Thu 2026-03-05 23:55 GMT+2]
**Prompt:**
> can we stop playing with lot visibility? parkinglot becomes invisible sometimes. from visibility perspective, can we have parkinglot defined in the same way as below dates fields are defined, since those does not intefere with dropdowns visibility

## [Thu 2026-03-05 23:59 GMT+2]
**Prompt:**
> perfect, visibility is ok now, just rename lot label to "Actual parking lot"

## [Fri 2026-03-06 00:01 GMT+2]
**Prompt:**
> visibility is resolved, now i want to return to autofetching issue on parkinglot value change. how fetch happens when territory chnages?

## [Fri 2026-03-06 00:02 GMT+2]
**Prompt:**
> lets detect, give me instructions

## [Fri 2026-03-06 00:05 GMT+2]
**Prompt:**
> runSharingsFlow (page-hook.js:238) ... Vn.fetchSharedSpaces (Exchanges.js:76) Vn.setLot (Exchanges.js:220) ...

## [Fri 2026-03-06 00:06 GMT+2]
**Prompt:**
> no need to fetch anything from devtools?

## [Fri 2026-03-06 00:06 GMT+2]
**Prompt:**
> go ahead then

## [Fri 2026-03-06 00:08 GMT+2]
**Prompt:**
> lot change does not autofetch

## [Fri 2026-03-06 00:10 GMT+2]
**Prompt:**
> still no

## [Fri 2026-03-06 00:12 GMT+2]
**Prompt:**
> bingo, works as expected

## [Fri 2026-03-06 00:13 GMT+2]
**Prompt:**
> not yet, add parking name dropdown from plugin page to app page below lot dropdown with label "Parking name" and autofetch on its change

## [Fri 2026-03-06 00:19 GMT+2]
**Prompt:**
> it shall be possible to enter custom text to parking name field. autofetch on enter

## [Fri 2026-03-06 00:22 GMT+2]
**Prompt:**
> selecting custom in dropdown showed additional field once, but after switching back/forth it is gone for now revert to 3 values + any, without custom values

## [Fri 2026-03-06 00:24 GMT+2]
**Prompt:**
> icon you added is not shown in extension list nor in toolbar

## [Fri 2026-03-06 00:33 GMT+2]
**Prompt:**
> logo i've sent you have text in lower part (black text) remove this black text, keep only blue graphics

## [Fri 2026-03-06 00:35 GMT+2]
**Prompt:**
> good. please store all my prompts related to this extension to some file with images and timestamps

---

## Image Handling Note
Images were exchanged in chat and used for troubleshooting, but raw binary image files are not available in this tool transcript export. This log references where images were provided and linked to relevant prompts.
